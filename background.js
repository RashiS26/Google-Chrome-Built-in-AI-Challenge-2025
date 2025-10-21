// background.js - service worker
const CHECK_INTERVAL_MINUTES = 60; // hourly checks by default

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('periodicPriceCheck', { periodInMinutes: CHECK_INTERVAL_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'periodicPriceCheck') {
    checkAllTracked();
  }
});

async function checkAllTracked() {
  const data = await chrome.storage.local.get({ tracked: [] });
  const tracked = data.tracked || [];
  for (const item of tracked) {
    try {
      const result = await fetchPrice(item.url);
      if (result && result.price != null) {
        const prev = item.lastPrice || null;
        item.lastPrice = result.price;
        item.title = item.title || result.title || item.title;
        // notify if below threshold
        if (item.threshold && result.price <= item.threshold && !item.notified) {
          notifyPriceDrop(item, result.price, item.threshold);
          item.notified = true;
        } else if (item.threshold && result.price > item.threshold) {
          item.notified = false;
        }
      }
    } catch (e) {
      console.error('Error checking', item.url, e);
    }
  }
  await chrome.storage.local.set({ tracked });
}

function notifyPriceDrop(item, price, threshold) {
  chrome.notifications.create(item.id || item.url, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Price drop: ' + (item.title || 'Tracked product'),
    message: `Now ₹${price} — below your threshold of ₹${threshold}. Click to open.`,
    priority: 2
  }, () => {});
  // open tab on click
  chrome.notifications.onClicked.addListener((nid) => {
    if (nid === (item.id || item.url)) {
      chrome.tabs.create({ url: item.url });
    }
  });
}

async function fetchPrice(url) {
  // fetch HTML and parse heuristics for sites
  const resp = await fetch(url, { credentials: 'omit' });
  const text = await resp.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  const hostname = (new URL(url)).hostname;
  let price = null, title = null;
  title = doc.querySelector('title') ? doc.querySelector('title').innerText.trim() : null;

  if (hostname.includes('amazon')) {
    // amazon price selectors
    const selectors = ['#priceblock_ourprice', '#priceblock_dealprice', '#tp_price_block_total_price_ww', '#price_inside_buybox'];
    for (const s of selectors) {
      const el = doc.querySelector(s);
      if (el) { price = extractNumber(el.innerText); break; }
    }
    if (!price) {
      // fallback: look for meta price
      const meta = doc.querySelector('meta[name="price"]');
      if (meta) price = extractNumber(meta.getAttribute('content') || meta.content);
    }
  } else if (hostname.includes('flipkart')) {
    // flipkart selectors
    const el = doc.querySelector('._30jeq3._16Jk6d') || doc.querySelector('._30jeq3');
    if (el) price = extractNumber(el.innerText);
  } else {
    // generic regex fallback
    const match = text.match(/₹\s?([0-9,]+\.?[0-9]*)/);
    if (match) price = extractNumber(match[0]);
  }

  return { price, title };
}

function extractNumber(str) {
  if (!str) return null;
  const cleaned = str.replace(/[₹,\s]/g, '').match(/\d+(?:\.\d+)?/);
  return cleaned ? Number(cleaned[0]) : null;
}

// Message handler (from popup/content scripts)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'addTracked') {
    addTrackedItem(msg.item).then(() => sendResponse({ ok: true }));
    return true;
  } else if (msg.action === 'checkNow') {
    checkAllTracked().then(() => sendResponse({ ok: true }));
    return true;
  } else if (msg.action === 'removeTracked') {
    removeTracked(msg.url).then(() => sendResponse({ ok: true }));
    return true;
  }
});

async function addTrackedItem(item) {
  const data = await chrome.storage.local.get({ tracked: [] });
  const tracked = data.tracked || [];
  // assign id
  item.id = item.url;
  tracked.push(item);
  await chrome.storage.local.set({ tracked });
  // immediate check for the new item
  try {
    const result = await fetchPrice(item.url);
    if (result && result.price != null) {
      item.lastPrice = result.price;
      await chrome.storage.local.set({ tracked });
    }
  } catch (e) {}
}

async function removeTracked(url) {
  const data = await chrome.storage.local.get({ tracked: [] });
  const tracked = (data.tracked || []).filter(x => x.url !== url);
  await chrome.storage.local.set({ tracked });
}
