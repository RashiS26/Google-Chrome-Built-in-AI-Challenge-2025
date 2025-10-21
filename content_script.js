// content_script.js
(function(){
  // inject a small Track Price button into known product pages
  function createButton() {
    if (document.getElementById('ptp-track-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'ptp-track-btn';
    btn.innerText = 'Track price with Price Tracker Pro+';
    btn.style.position = 'fixed';
    btn.style.bottom = '16px';
    btn.style.right = '16px';
    btn.style.zIndex = 999999;
    btn.style.padding = '10px 14px';
    btn.style.background = 'linear-gradient(90deg, #00c6ff, #0072ff)';
btn.style.color = '#fff';
btn.style.border = 'none';
btn.style.borderRadius = '50px';
btn.style.padding = '12px 20px';
btn.style.fontWeight = 'bold';
btn.style.letterSpacing = '0.5px';
btn.style.cursor = 'pointer';
btn.style.boxShadow = '0 0 15px rgba(0, 114, 255, 0.8), 0 0 25px rgba(0, 198, 255, 0.6)';
btn.style.transition = 'all 0.3s ease';
btn.style.zIndex = 999999;
btn.style.position = 'fixed';
btn.style.bottom = '16px';
btn.style.right = '16px';
btn.style.fontSize = '14px';

btn.addEventListener('mouseenter', () => {
  btn.style.boxShadow = '0 0 25px rgba(0, 198, 255, 1), 0 0 40px rgba(0, 114, 255, 0.8)';
  btn.style.transform = 'scale(1.05)';
});

btn.addEventListener('mouseleave', () => {
  btn.style.boxShadow = '0 0 15px rgba(0, 114, 255, 0.8), 0 0 25px rgba(0, 198, 255, 0.6)';
  btn.style.transform = 'scale(1)';
});

    document.body.appendChild(btn);
    btn.addEventListener('click', onTrackClick);
  }

  function extractPriceFromDom() {
    const host = location.hostname;
    let price = null;
    if (host.includes('amazon')) {
      const sel = document.querySelector('#priceblock_ourprice, #priceblock_dealprice, #price_inside_buybox');
      if (sel) price = sel.innerText;
    } else if (host.includes('flipkart')) {
      const sel = document.querySelector('._30jeq3._16Jk6d, ._30jeq3');
      if (sel) price = sel.innerText;
    } else {
      // try common patterns
      const match = document.body.innerText.match(/₹\s?([0-9,]+\.?[0-9]*)/);
      if (match) price = match[0];
    }
    return price;
  }

  async function onTrackClick() {
    const title = document.title;
    const url = location.href;
    const priceStr = extractPriceFromDom();
    const thresholdInput = prompt('Set a price threshold (numbers only, leave blank to add without threshold):', priceStr ? priceStr.replace(/[^0-9.]/g,'') : '');
    const threshold = thresholdInput ? Number(thresholdInput.replace(/,/g,'')) : null;
    const item = { url, title, threshold };
    chrome.runtime.sendMessage({ action: 'addTracked', item }, (resp) => {
      if (resp && resp.ok) {
        alert('Added to Price Tracker Pro+');
      } else {
        alert('Added (background might not respond instantly).');
      }
    });
  }

  // wait a bit and inject
  setTimeout(createButton, 1500);
})();
