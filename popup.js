document.addEventListener('DOMContentLoaded', function () {
    const keywordInput = document.getElementById('keyword');
    const searchBtn = document.getElementById('searchBtn');
    const googleSearchBtn = document.getElementById('googleSearchBtn');
    const resultDiv = document.getElementById('result');
    const loadingDiv = document.getElementById('loading');
    
    // SEO指标相关元素
    const intitleCountInput = document.getElementById('intitleCount');
    const monthlyVolumeInput = document.getElementById('monthlyVolume');
    const keywordDifficultyInput = document.getElementById('keywordDifficulty');
    const calculateBtn = document.getElementById('calculateBtn');
    const metricsResults = document.getElementById('metricsResults');
    const kgrValue = document.getElementById('kgrValue');
    const ekgrValue = document.getElementById('ekgrValue');
    const kdroiValue = document.getElementById('kdroiValue');

    // 回车键触发搜索
    keywordInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            searchBtn.click();
        }
    });

    // Google搜索按钮点击事件
    googleSearchBtn.addEventListener('click', function () {
        const keyword = keywordInput.value.trim();
        if (!keyword) {
            resultDiv.textContent = '请输入关键词';
            resultDiv.className = 'result empty';
            return;
        }
        
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;
        chrome.tabs.create({ url: searchUrl });
    });

    searchBtn.addEventListener('click', async function () {
        const keyword = keywordInput.value.trim();

        if (! keyword) {
            resultDiv.textContent = '请输入关键词';
            resultDiv.className = 'result empty';
            return;
        }

        // 显示加载状态
        resultDiv.textContent = '';
        resultDiv.className = 'result';
        loadingDiv.style.display = 'block';

        try {
            const count = await searchIntitleCount(keyword);
            loadingDiv.style.display = 'none';
            resultDiv.textContent = ` ${count} `;
            resultDiv.className = 'result success';
            
            // 自动填充到intitle结果数量输入框
            // const numericCount = parseInt(count.replace(/,/g, '')) || 0;
            // intitleCountInput.value = numericCount;
        } catch (error) {
            loadingDiv.style.display = 'none';
            resultDiv.textContent = '查询失败，请重试';
            resultDiv.className = 'result error';
            console.error(error);
        }
    });
    
    // KD值到所需反链域名数量的映射表
    const kdToReferringDomains = {
        0: 0, 10: 10, 20: 22, 30: 36, 40: 56,
        50: 84, 60: 129, 70: 202, 80: 353, 90: 756
    };

    // 根据KD值插值计算所需反链域名数量
    function getRequiredDomains(kd) {
        const kdValues = Object.keys(kdToReferringDomains).map(Number);
        const lowerKd = Math.max(...kdValues.filter(k => k <= kd));
        const upperKd = Math.min(...kdValues.filter(k => k >= kd));
        
        if (lowerKd === upperKd) return kdToReferringDomains[lowerKd];
        
        const lowerDomains = kdToReferringDomains[lowerKd];
        const upperDomains = kdToReferringDomains[upperKd];
        
        return Math.round(
            lowerDomains + 
            (kd - lowerKd) * (upperDomains - lowerDomains) / (upperKd - lowerKd)
        );
    }

    // 计算单个链接的成本（阶梯定价）
    function getLinkCost(linkOrder) {
        if (linkOrder <= 10) return 100;
        if (linkOrder <= 50) return 100 * (1 + (linkOrder - 10) * 0.01);
        if (linkOrder <= 200) return 100 * (1 + (50 - 10) * 0.01 + (linkOrder - 50) * 0.015);
        return 100 * (1 + (50 - 10) * 0.01 + (200 - 50) * 0.015 + (linkOrder - 200) * 0.02);
    }

    // 计算总链接成本
    function getTotalLinkCost(totalLinks) {
        let totalCost = 0;
        for (let i = 1; i <= totalLinks; i++) {
            totalCost += getLinkCost(i);
        }
        return totalCost;
    }

    // 计算SEO指标
    calculateBtn.addEventListener('click', function() {
        const intitleCount = parseFloat(intitleCountInput.value);
        const monthlyVolume = parseFloat(monthlyVolumeInput.value);
        const keywordDifficulty = parseFloat(keywordDifficultyInput.value);
        
        // 验证输入
        if (!intitleCount || !monthlyVolume || !keywordDifficulty) {
            alert('请填写Intitle结果数量、月搜索量和关键词难度');
            return;
        }
        
        if (keywordDifficulty < 0 || keywordDifficulty > 100) {
            alert('关键词难度必须在0-100之间');
            return;
        }
        
        // 计算KGR
        const kgr = intitleCount / monthlyVolume;
        let kgrText = kgr.toFixed(4);
        
        // KGR竞争激烈程度
        kgrValue.className = 'metric-value';
        if (kgr < 0.25) {
            kgrText += ' (低竞争 - 极好的机会！)';
            kgrValue.classList.add('low-competition');
        } else if (kgr <= 1.0) {
            kgrText += ' (中等竞争 - 需考虑网站实力)';
            kgrValue.classList.add('medium-competition');
        } else {
            kgrText += ' (高竞争 - 排名具有挑战性)';
            kgrValue.classList.add('high-competition');
        }
        kgrValue.textContent = kgrText;
        
        // 计算EKGR
        const ekgr = (intitleCount * (1 + keywordDifficulty / 100)) / monthlyVolume;
        let ekgrText = ekgr.toFixed(4);
        
        // EKGR竞争激烈程度
        ekgrValue.className = 'metric-value';
        if (ekgr < 0.25 && keywordDifficulty < 30) {
            ekgrText += ' (低竞争且难度适中)';
            ekgrValue.classList.add('low-competition');
        } else if (ekgr <= 1.0 && keywordDifficulty <= 50) {
            ekgrText += ' (中等竞争 - 评估所需资源)';
            ekgrValue.classList.add('medium-competition');
        } else {
            ekgrText += ' (高竞争 - 需要大量资源投入)';
            ekgrValue.classList.add('high-competition');
        }
        ekgrValue.textContent = ekgrText;
        
        // 计算KDROI
        const dailyVolume = monthlyVolume / 30;
        const requiredDomains = getRequiredDomains(keywordDifficulty);
        const totalInvestment = getTotalLinkCost(requiredDomains);
        const annualRevenue = dailyVolume * 0.1 * 365;
        const roi = ((annualRevenue - totalInvestment) / totalInvestment) * 100;
        
        let kdroiText = roi.toFixed(2) + '%';
        
        // KDROI竞争激烈程度
        kdroiValue.className = 'metric-value';
        if (roi > 300) {
            kdroiText += ' (优秀/不错的投资回报 - 推荐投资)';
            kdroiValue.classList.add('low-competition');
        } else if (roi > 100) {
            kdroiText += ' (低回报 - 谨慎投资)';
            kdroiValue.classList.add('medium-competition');
        } else {
            kdroiText += ' (负回报 - 不建议投资)';
            kdroiValue.classList.add('high-competition');
        }
        kdroiText += `\n所需反链: ${requiredDomains}个 | 投资: $${totalInvestment.toLocaleString()} | 年收入: $${annualRevenue.toLocaleString()}`;
        
        kdroiValue.textContent = kdroiText;
        
        // 显示结果
        metricsResults.style.display = 'flex';
    });
});

async function searchIntitleCount(keyword) {
    const query = `intitle:"${keyword}"`;
    const url = `https://www.google.com/search?q=${
        encodeURIComponent(query)
    }`;

    console.log('chrome对象:', chrome);
    console.log('chrome.scripting:', chrome.scripting);
    console.log('chrome.tabs:', chrome.tabs);

    // 检查API是否可用
    if (!chrome.scripting) {
        throw new Error('chrome.scripting API不可用，请重新安装插件');
    }

    // 创建新标签页并导航到Google搜索
    const tab = await chrome.tabs.create({url: url, active: false});

    // 等待页面加载完成
    await new Promise((resolve) => {
        const listener = (tabId, changeInfo) => {
            if (tabId === tab.id && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
    });

    // 注入脚本提取结果数量
    const results = await chrome.scripting.executeScript({
        target: {
            tabId: tab.id
        },
        func: extractResultCount
    });

    // 调试：打印返回的结果
    console.log('脚本执行结果:', results[0]);
    console.log('提取的数量:', results[0].result);

    // 关闭标签页
    await chrome.tabs.remove(tab.id);

    return results[0].result ?. resultStatsText || '0';
}

function extractResultCount() { // 这个函数会在Google搜索页面中执行
    const bodyText = document.body.innerText;
    const htmlText = document.body.innerHTML;

    const debugInfo = {
        count: '0',
        bodyTextPreview: bodyText.substring(0, 500),
        hasResultStats: !!document.getElementById('result-stats'),
        resultStatsText: document.getElementById('result-stats') ?. innerText || 'none'
    };

    // 匹配中文结果: "找到约 6,130 条结果"
    const zhPattern = /找到约\s*([\d,，]+)\s*条结果/;
    const zhMatch = bodyText.match(zhPattern);
    if (zhMatch) {
        debugInfo.count = zhMatch[1].replace(/,|，/g, '');
        debugInfo.matchType = '中文';
        return debugInfo;
    }

    // 匹配英文结果: "About 6,130 results"
    const enPattern = /About\s*([\d,]+)\s*results/i;
    const enMatch = bodyText.match(enPattern);
    if (enMatch) {
        debugInfo.count = enMatch[1].replace(/,/g, '');
        debugInfo.matchType = '英文';
        return debugInfo;
    }

    // 尝试更宽松的匹配
    const loosePattern = /([\d,，]+)\s*(条结果|results)/i;
    const looseMatch = bodyText.match(loosePattern);
    if (looseMatch) {
        debugInfo.count = looseMatch[1].replace(/,|，/g, '');
        debugInfo.matchType = '宽松';
        return debugInfo;
    }

    debugInfo.matchType = '未匹配';
    return debugInfo;
}
