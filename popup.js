document.addEventListener('DOMContentLoaded', function () {
    const keywordInput = document.getElementById('keyword');
    const searchBtn = document.getElementById('searchBtn');
    const googleSearchBtn = document.getElementById('googleSearchBtn');
    const resultDiv = document.getElementById('result');
    const loadingDiv = document.getElementById('loading');

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
        } catch (error) {
            loadingDiv.style.display = 'none';
            resultDiv.textContent = '查询失败，请重试';
            resultDiv.className = 'result error';
            console.error(error);
        }
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
