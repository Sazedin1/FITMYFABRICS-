import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

  page.on('response', response => {
    if (!response.ok()) {
      console.log('FAILED RESPONSE:', response.url(), response.status());
    }
  });

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  
  await new Promise(r => setTimeout(r, 2000));
  
  const content = await page.evaluate(() => {
    return document.getElementById('app-content')?.innerHTML;
  });
  console.log("App content:\n", content);
  
  await browser.close();
  process.exit();
})();
