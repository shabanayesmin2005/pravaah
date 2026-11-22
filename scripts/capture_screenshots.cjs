const puppeteer = require('puppeteer-core');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';
const SCREENSHOTS_DIR = path.resolve(__dirname, '../docs/screenshots');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capture() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();

  try {
    // 1. Login page
    console.log('Capturing Login page...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await sleep(1000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_login.png') });

    // Login as Admin
    console.log('Logging in as Admin...');
    await page.type('input[type="email"]', 'admin@pravaah.local');
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
    await page.type('input[type="password"]', adminPassword);
    await page.click('button[type="submit"]');

    // Wait for client-side navigation into the dashboard
    await page.waitForSelector('aside', { timeout: 10000 });
    console.log('Logged in successfully!');
    await sleep(3000); // allow map and charts to load

    // 2. Command Center
    console.log('Capturing Command Center...');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_command_center.png') });

    // 3. Traffic Analytics
    console.log('Capturing Traffic Analytics...');
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle0' });
    await sleep(2500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_traffic_analytics.png') });

    // 4. Alerts Management
    console.log('Capturing Alerts Management...');
    await page.goto(`${BASE_URL}/alerts`, { waitUntil: 'networkidle0' });
    await sleep(2500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_alerts_management.png') });

    // Click on the first alert view button if available
    const viewButtons = await page.$$('button');
    for (const btn of viewButtons) {
      const text = await page.evaluate((el) => el.textContent, btn);
      if (text && (text.includes('View') || text.includes('Inspect') || text.includes('Details'))) {
        await btn.click();
        await sleep(1500);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_alert_details_modal.png') });
        await page.keyboard.press('Escape');
        await sleep(500);
        break;
      }
    }

    // 5. Plate Search
    console.log('Capturing Plate Search...');
    await page.goto(`${BASE_URL}/plates`, { waitUntil: 'networkidle0' });
    await sleep(1500);
    const searchInputs = await page.$$('input');
    if (searchInputs.length > 0) {
      await searchInputs[0].type('DL');
      await sleep(1000);
      await page.keyboard.press('Enter');
      await sleep(2000);
    }
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_plate_search.png') });

    // 6. Trajectory Playback
    console.log('Capturing Trajectory Playback...');
    await page.goto(`${BASE_URL}/trajectories`, { waitUntil: 'networkidle0' });
    await sleep(1500);
    const trajInputs = await page.$$('input');
    if (trajInputs.length > 0) {
      await trajInputs[0].type('DL05ZZ9999');
      await sleep(500);
      await page.keyboard.press('Enter');
      await sleep(3000);
    }
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07_trajectory_playback.png') });

    // 7. Blacklist Management
    console.log('Capturing Blacklist Management...');
    await page.goto(`${BASE_URL}/blacklist`, { waitUntil: 'networkidle0' });
    await sleep(2500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08_blacklist_management.png') });

    // 8. Audit Logs Viewer
    console.log('Capturing Audit Logs Viewer...');
    await page.goto(`${BASE_URL}/audit-logs`, { waitUntil: 'networkidle0' });
    await sleep(2500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09_audit_logs.png') });

    console.log('SUCCESS: All screenshots captured and saved to docs/screenshots!');
  } catch (err) {
    console.error('Error during screenshot capture:', err);
  } finally {
    await browser.close();
  }
}

capture();
