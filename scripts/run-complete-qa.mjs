import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOTS_DIR = process.env.QA_SCREENSHOTS_DIR || path.resolve('scratch/qa-screenshots');
const TARGET_URL = process.env.QA_TARGET_URL || 'http://localhost:4177';
const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const QA_EMAIL = process.env.QA_USER_EMAIL || '';
const QA_PASSWORD = process.env.QA_USER_PASSWORD || '';

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function runCompleteQA() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const consoleLogs = [];
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(text);
    console.log(text);
  });
  page.on('pageerror', err => {
    const text = `[PAGE ERROR] ${err.message}`;
    consoleLogs.push(text);
    console.error(text);
  });
  page.on('dialog', async dialog => {
    console.log(`[ALERT/DIALOG] "${dialog.message()}"`);
    try {
      await dialog.accept();
    } catch (_) {}
  });

  await page.setViewport({ width: 390, height: 844 });

  console.log('--- Step 1: Navigate to app ---');
  await page.goto(TARGET_URL, { waitUntil: 'networkidle0' });
  await sleep(1000);

  // 1. Authenticate if on Auth Screen
  const pwdInput = await page.$('input[type="password"]');
  if (pwdInput) {
    if (!QA_EMAIL || !QA_PASSWORD) {
      console.warn('QA_USER_EMAIL and QA_USER_PASSWORD environment variables are required to run authenticated QA tests.');
      await browser.close();
      return;
    }
    console.log(`--- Step 1b: Login as ${QA_EMAIL} ---`);
    const inputs = await page.$$('input');
    await inputs[0].click({ clickCount: 3 });
    await inputs[0].type(QA_EMAIL, { delay: 20 });
    await inputs[1].click({ clickCount: 3 });
    await inputs[1].type(QA_PASSWORD, { delay: 20 });
    await sleep(500);

    const btns = await page.$$('button');
    for (const b of btns) {
      const txt = await page.evaluate(el => el.textContent, b);
      if (txt.includes('Log In')) {
        console.log('Clicking Log In button...');
        await b.click();
        break;
      }
    }

    console.log('Waiting for auth transition...');
    await sleep(4000);
  }

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_authenticated_pos.png') });
  console.log('Authenticated POS captured');

  // Verify Shop Details
  const shopInfo = await page.evaluate(() => {
    const shopName = document.querySelector('h1 + p')?.textContent?.trim() || document.querySelector('.serif')?.textContent?.trim();
    const billNumEl = document.body.innerText.match(/Bill No:\s*(\d+)/);
    const trialBadge = document.body.innerText.match(/Trial \(([^)]+)\)/);
    return {
      shopName,
      billNumber: billNumEl ? billNumEl[1] : null,
      trialBadge: trialBadge ? trialBadge[1] : null
    };
  });
  console.log('Initial Shop Info:', shopInfo);

  // --- Step 2: Simple Keypad Billing ---
  console.log('--- Step 2: Test Simple Keypad Billing ---');
  await page.evaluate(() => {
    const keypadButtons = Array.from(document.querySelectorAll('button')).filter(b => /^[0-9]$/.test(b.textContent.trim()));
    const btn9 = keypadButtons.find(b => b.textContent.trim() === '9');
    if (btn9) {
      btn9.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      btn9.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      btn9.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      btn9.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      btn9.click();
    }
  });
  await sleep(300);
  await page.evaluate(() => {
    const keypadButtons = Array.from(document.querySelectorAll('button')).filter(b => /^[0-9]$/.test(b.textContent.trim()));
    const btn9 = keypadButtons.find(b => b.textContent.trim() === '9');
    if (btn9) {
      btn9.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      btn9.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      btn9.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      btn9.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      btn9.click();
    }
  });
  await sleep(600);

  const enteredAmount = await page.evaluate(() => document.querySelector('input[readonly]')?.value);
  console.log('Entered keypad amount:', enteredAmount);

  // Click Generate Bill
  console.log('Clicking Generate Bill...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const genBtn = btns.find(b => b.textContent.includes('Generate Bill') && !b.disabled);
    if (genBtn) genBtn.click();
  });

  await sleep(4000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'debug_after_gen_bill.png') });
  const bodyAfterGen = await page.evaluate(() => document.body.innerText);
  console.log('DEBUG: Screen text 4s after Generate Bill:\n---START---\n' + bodyAfterGen + '\n---END---');

  // Wait for Receipt Modal
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('bill recorded'), { timeout: 30000 });
  await sleep(1500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_receipt_modal_verified.png') });
  console.log('Receipt Modal captured');

  // Verify Receipt Contents
  const receiptDetails = await page.evaluate(() => {
    const bodyText = document.body.innerText.toLowerCase();
    return {
      hasPan: bodyText.includes('pan:'),
      hasAmount: bodyText.includes('99.00'),
      hasIrdNote: bodyText.includes('prize.ird.gov.np') || bodyText.includes('supabase cloud')
    };
  });
  console.log('Receipt details verification:', receiptDetails);

  // Click Show QR
  console.log('Testing QR View...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const qrBtn = btns.find(b => b.textContent.includes('Show QR'));
    if (qrBtn) qrBtn.click();
  });
  await sleep(1500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_qr_modal_verified.png') });
  console.log('QR View captured');

  // Close QR / Receipt Modal
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const doneBtn = btns.find(b => b.textContent.includes('Done') || b.textContent.includes('Close'));
    if (doneBtn) doneBtn.click();
  });
  await sleep(1000);

  // If still on Receipt Modal, click Done — New Bill
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const newBillBtn = btns.find(b => b.textContent.includes('Done — New Bill'));
    if (newBillBtn) newBillBtn.click();
  });
  await sleep(1000);

  // --- Step 3: Itemized Billing ---
  console.log('--- Step 3: Test Itemized Billing ---');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const addItemsBtn = btns.find(b => b.textContent.includes('+ Add items'));
    if (addItemsBtn) addItemsBtn.click();
  });
  await sleep(1000);

  // Add Coke (Rs 70) and Real Juice (Rs 30)
  const itemAddStatus = await page.evaluate(() => {
    const itemButtons = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Tap to add'));
    if (itemButtons.length >= 2) {
      itemButtons[0].click(); // First item
      itemButtons[1].click(); // Second item
      return { added: 2, item1: itemButtons[0].textContent.trim(), item2: itemButtons[1].textContent.trim() };
    } else if (itemButtons.length === 1) {
      itemButtons[0].click();
      return { added: 1, item1: itemButtons[0].textContent.trim() };
    }
    return { added: 0 };
  });
  console.log('Items added to basket:', itemAddStatus);
  await sleep(800);

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07_itemized_basket_verified.png') });
  console.log('Itemized Basket captured');

  // Generate Itemized Bill
  console.log('Generating bill from basket...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const genBtn = btns.find(b => b.textContent.includes('Generate Bill — Rs') && !b.disabled);
    if (genBtn) genBtn.click();
  });

  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('bill recorded'), { timeout: 30000 });
  await sleep(1500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08_itemized_receipt_verified.png') });
  console.log('Itemized Receipt captured');

  // Close Receipt Modal
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const newBillBtn = btns.find(b => b.textContent.includes('Done — New Bill'));
    if (newBillBtn) newBillBtn.click();
  });
  await sleep(1000);

  // --- Step 4: Bill History ---
  console.log('--- Step 4: Test Bill History ---');
  await page.evaluate(() => {
    const historyBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('History'));
    if (historyBtn) historyBtn.click();
  });
  await sleep(1500);

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09_history_screen_verified.png') });
  console.log('History Screen captured');

  // Click on the top bill in history to open detail sheet
  const historyOpened = await page.evaluate(() => {
    // Look for bill rows
    const rows = Array.from(document.querySelectorAll('div[class*="cursor-pointer"], button')).filter(el => /#\d+/.test(el.textContent));
    if (rows.length > 0) {
      rows[0].click();
      return true;
    }
    return false;
  });
  console.log('Opened bill detail sheet:', historyOpened);
  await sleep(1200);

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10_history_detail_verified.png') });
  console.log('Bill Detail Sheet captured');

  // Close Bill Detail Sheet
  await page.evaluate(() => {
    const closeBtn = document.querySelector('button[title="Close"]');
    if (closeBtn) closeBtn.click();
  });
  await sleep(600);

  // Return to New Bill
  await page.evaluate(() => {
    const backBtn = document.querySelector('button[title="Back to New Bill"]');
    if (backBtn) backBtn.click();
  });
  await sleep(800);

  // --- Step 5: Manage Items Inventory ---
  console.log('--- Step 5: Test Manage Items Modal ---');
  await page.evaluate(() => {
    const manageBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Manage Items'));
    if (manageBtn) manageBtn.click();
  });
  await sleep(1200);

  // Add new item "Wai Wai Quick", Rs 25
  await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    const nameInput = inputs.find(i => i.placeholder && i.placeholder.includes('Tea'));
    const priceInput = inputs.find(i => i.placeholder === 'Rs');
    if (nameInput) {
      nameInput.value = 'Wai Wai Quick';
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      nameInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (priceInput) {
      priceInput.value = '25';
      priceInput.dispatchEvent(new Event('input', { bubbles: true }));
      priceInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await sleep(400);

  // Click Add Item to Cloud
  await page.evaluate(() => {
    const addBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('+ Add Item to Cloud') && !b.disabled);
    if (addBtn) addBtn.click();
  });
  await sleep(2500);

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '11_manage_items_added.png') });
  console.log('Manage Items (new item added) captured');

  // Close Manage Items modal
  await page.evaluate(() => {
    const backBtn = document.querySelector('button[title="Back"]');
    if (backBtn) backBtn.click();
  });
  await sleep(800);

  // --- Step 6: Settings & Theme Toggle ---
  console.log('--- Step 6: Test Settings & Theme Toggle ---');
  await page.evaluate(() => {
    const settingsBtn = document.querySelector('button[title="Settings"]');
    if (settingsBtn) settingsBtn.click();
  });
  await sleep(1500);

  // Toggle Dark Mode
  await page.evaluate(() => {
    const toggleBtn = document.querySelector('button[aria-label="Toggle Dark Mode"]');
    if (toggleBtn) toggleBtn.click();
  });
  await sleep(800);

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '12_light_mode_settings.png') });
  console.log('Light Mode Settings captured');

  // Close settings to see light mode POS
  await page.evaluate(() => {
    const closeBtn = document.querySelector('button[title="Close Settings"]');
    if (closeBtn) closeBtn.click();
  });
  await sleep(1000);

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '13_light_mode_pos.png') });
  console.log('Light Mode POS captured');

  // Re-open settings and switch back to Dark Mode
  await page.evaluate(() => {
    const settingsBtn = document.querySelector('button[title="Settings"]');
    if (settingsBtn) settingsBtn.click();
  });
  await sleep(1200);

  await page.evaluate(() => {
    const toggleBtn = document.querySelector('button[aria-label="Toggle Dark Mode"]');
    if (toggleBtn) toggleBtn.click();
  });
  await sleep(800);

  await page.evaluate(() => {
    const closeBtn = document.querySelector('button[title="Close Settings"]');
    if (closeBtn) closeBtn.click();
  });
  await sleep(800);

  // --- Step 7: Responsive Layout Verifications ---
  console.log('--- Step 7: Viewport Responsiveness ---');
  // Tablet Portrait
  await page.setViewport({ width: 768, height: 1024 });
  await sleep(800);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '14_tablet_portrait.png') });

  // Tablet Landscape
  await page.setViewport({ width: 1024, height: 768 });
  await sleep(800);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '15_tablet_landscape.png') });

  // Desktop
  await page.setViewport({ width: 1280, height: 800 });
  await sleep(800);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '16_desktop.png') });
  console.log('All responsive viewports captured');

  // Touch targets inspection
  const touchTargetAudit = await page.evaluate(() => {
    const interactiveElements = Array.from(document.querySelectorAll('button, a, input'));
    const undersized = [];
    interactiveElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        if (rect.width < 40 || rect.height < 40) {
          undersized.push({
            tag: el.tagName,
            text: el.textContent.trim().slice(0, 30),
            title: el.title || el.getAttribute('aria-label') || '',
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          });
        }
      }
    });
    return undersized;
  });

  console.log('Touch Target Audit (<40px elements count):', touchTargetAudit.length);
  console.log('Sample undersized elements:', touchTargetAudit.slice(0, 5));

  await browser.close();
  console.log('=== Complete QA Run Successfully Finished ===');
}

runCompleteQA().catch(err => {
  console.error('QA Run Failed with error:', err);
  process.exit(1);
});
