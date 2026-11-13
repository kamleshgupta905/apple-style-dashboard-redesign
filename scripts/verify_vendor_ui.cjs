const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 1. Visit live users page
  console.log('Navigating to Users page...');
  await page.goto('https://api.vmhgroupsmr.com/#/users', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Take screenshot of users page
  await page.screenshot({ path: 'verify_users_page_linked_vendor.png' });

  // Click Add user button
  const addBtn = await page.locator('button:has-text("Add user")').first();
  if (await addBtn.isVisible()) {
    await addBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'verify_add_user_vendor_dropdown.png' });
  }

  // 2. Visit dashboard
  console.log('Navigating to Dashboard...');
  await page.goto('https://api.vmhgroupsmr.com/#/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'verify_dashboard_vendor_view.png' });

  await browser.close();
  console.log('Screenshots captured successfully!');
})();
