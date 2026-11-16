const fs = require('node:fs/promises');
const path = require('node:path');
const { openApp } = require('./browser-helper.cjs');

// 같은 조건으로 전후 비교할 수 있도록 화면 상태와 이미지 이름을 고정한다.
async function capture() {
  const stage = process.argv[2];
  if (!['before', 'after'].includes(stage)) throw new Error('Use before or after');
  const app = await openApp();
  try {
    for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 375, 812]]) {
      const page = await app.browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      await page.goto(app.url, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const folder = path.resolve('doc/review-screenshots', stage);
      await fs.mkdir(folder, { recursive: true });
      await page.screenshot({ path: path.join(folder, `${name}-idle.png`) });
      await page.locator('.js-settings-open').click();
      await page.screenshot({ path: path.join(folder, `${name}-settings.png`) });
      await page.locator('.js-settings-close').click();
      const time = new Date('2026-11-16T00:00:00Z');
      await page.clock.install({ time });
      await page.clock.pauseAt(time);
      await page.evaluate(() => document.querySelector('.js-timer-action').click());
      await page.clock.runFor(1100);
      await page.evaluate(() => document.querySelector('.js-timer-action').click());
      await page.screenshot({ path: path.join(folder, `${name}-paused.png`) });
      await page.close();
    }
  } finally {
    await app.close();
  }
}

capture().catch(error => { console.error(error); process.exitCode = 1; });
