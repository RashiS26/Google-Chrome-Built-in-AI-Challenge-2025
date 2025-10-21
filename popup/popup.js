document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('url');
  const thresholdInput = document.getElementById('threshold');
  const addBtn = document.getElementById('addBtn');
  const list = document.getElementById('list');
  const checkNowBtn = document.getElementById('checkNow');
  const openCompareBtn = document.getElementById('openCompare');

  addBtn.addEventListener('click', async () => {
    let url = urlInput.value.trim();
    if (!url) {
      // try current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      url = tabs[0].url;
    }
    const threshold = thresholdInput.value ? Number(thresholdInput.value.replace(/,/g,'')) : null;
    const item = { url, title: null, threshold };
    chrome.runtime.sendMessage({ action: 'addTracked', item }, (r) => {
      refreshList();
      urlInput.value = '';
      thresholdInput.value = '';
    });
  });

  checkNowBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'checkNow' }, () => { refreshList(); });
  });

  openCompareBtn.addEventListener('click', async () => {
    // build compare tabs based on selected item or active tab
    const tracked = (await chrome.storage.local.get({ tracked: [] })).tracked || [];
    if (tracked.length === 0) { alert('No tracked items. Add one first.'); return; }
    // open compare for the first item for simplicity (user can extend)
    const item = tracked[0];
    compareSimilar(item);
  });

  async function compareSimilar(item) {
    // open search tabs on Amazon and Flipkart using the product title or parsed keywords
    let q = item.title || '';
    if (!q) {
      // try to extract from URL
      q = decodeURIComponent(item.url.split('/').slice(-1)[0].replace(/[\-_.]/g,' '));
    }
    const amazonSearch = `https://www.amazon.in/s?k=${encodeURIComponent(q)}`;
    const flipkartSearch = `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`;
    chrome.tabs.create({ url: amazonSearch });
    chrome.tabs.create({ url: flipkartSearch });
  }

  async function refreshList() {
    const data = await chrome.storage.local.get({ tracked: [] });
    const tracked = data.tracked || [];
    list.innerHTML = '';
    for (const t of tracked) {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `<strong>${t.title ? escapeHtml(t.title) : t.url}</strong>
        <div class="meta">Last: ${t.lastPrice ? '₹' + t.lastPrice : 'unknown'} ${t.threshold ? ' • Threshold: ₹'+t.threshold : ''}</div>
        <div class="actions"></div>`;
      const rem = document.createElement('button');
      rem.innerText = 'Remove';
      rem.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'removeTracked', url: t.url }, () => refreshList());
      });
      const openBtn = document.createElement('button');
      openBtn.innerText = 'Open';
      openBtn.style.marginLeft = '6px';
      openBtn.addEventListener('click', () => chrome.tabs.create({ url: t.url }));
      const compareBtn = document.createElement('button');
      compareBtn.innerText = 'Compare';
      compareBtn.style.marginLeft = '6px';
      compareBtn.addEventListener('click', () => compareSimilar(t));
      div.querySelector('.actions').appendChild(rem);
      div.querySelector('.actions').appendChild(openBtn);
      div.querySelector('.actions').appendChild(compareBtn);
      list.appendChild(div);
    }
  }

  function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  refreshList();
});
