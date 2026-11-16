const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { openApp } = require('./browser-helper.cjs');

let app;
before(async () => { app = await openApp(process.env.TEST_BROWSER || 'chrome'); });
after(async () => { if (app) await app.close(); });

async function setup(t) {
  const page = await app.browser.newPage();
  t.after(() => page.close());
  // 외부 폰트 연결 상태가 기능 테스트의 성공 여부에 영향을 주지 않게 한다.
  await page.route('https://fonts.**/*', route => route.abort());
  const time = new Date('2026-11-16T00:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  await page.goto(app.url);
  return page;
}

const action = page => page.evaluate(() => document.querySelector('.js-timer-action').click());
const text = page => page.locator('.js-timer-time').textContent();

test('starts at 25:00 and counts elapsed time', async t => {
  const page = await setup(t);
  assert.equal(await text(page), '25:00');
  await action(page);
  await page.clock.runFor(2000);
  assert.equal(await text(page), '24:58');
  assert.equal(await page.locator('.js-timer-action').textContent(), 'pause');
});

test('repeated pauses preserve fractions of a second and exclude paused time', async t => {
  const page = await setup(t);
  for (let i = 0; i < 10; i++) {
    await action(page);
    await page.clock.runFor(100);
    await action(page);
    await page.clock.runFor(1000);
  }
  assert.equal(await text(page), '24:59');
  await action(page);
  await page.clock.runFor(1000);
  assert.equal(await text(page), '24:58');
});

test('mode changes stop the old timer and reset the duration', async t => {
  const page = await setup(t);
  await action(page);
  await page.clock.runFor(2000);
  await page.locator('[data-mode="short"]').click();
  await page.clock.runFor(3000);
  assert.equal(await text(page), '05:00');
  assert.equal(await page.locator('[data-mode="short"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-mode="pomodoro"]').getAttribute('aria-pressed'), 'false');
});

test('completion waits for the deadline, announces once, and supports restart', async t => {
  const page = await setup(t);
  await page.locator('.js-settings-open').click();
  await page.locator('[name="pomodoro"]').fill('1');
  await page.locator('[type="submit"]').click();
  await action(page);
  await page.clock.runFor(59750);
  assert.equal(await text(page), '00:01');
  await page.clock.runFor(250);
  assert.equal(await text(page), '00:00');
  assert.equal(await page.locator('.js-timer-action').textContent(), 'restart');
  assert.equal(await page.locator('.js-timer-status').textContent(), 'Pomodoro finished.');
  assert.equal(await page.locator('.js-timer-bar').evaluate(el => el.style.getPropertyValue('--progress')), '100.000');
  await page.clock.runFor(2000);
  assert.equal(await text(page), '00:00');
  await action(page);
  assert.equal(await text(page), '01:00');
  assert.equal(await page.locator('.js-timer-status').textContent(), '');
});

test('pausing after a delayed callback completes an expired timer', async t => {
  const page = await setup(t);
  await action(page);
  // 콜백을 실행하지 않고 현재 시각만 앞으로 이동해 백그라운드 지연을 재현한다.
  await page.clock.setSystemTime(new Date('2026-11-16T00:25:01Z'));
  await action(page);
  assert.equal(await text(page), '00:00');
  assert.equal(await page.locator('.js-timer-action').textContent(), 'restart');
});

test('invalid settings retain the dialog and associate errors with the input', async t => {
  const page = await setup(t);
  await page.locator('.js-settings-open').click();
  const input = page.locator('[name="pomodoro"]');
  await input.fill('0');
  await page.locator('[type="submit"]').click();
  assert.equal(await page.locator('#settings').evaluate(el => el.open), true);
  assert.equal(await input.getAttribute('aria-invalid'), 'true');
  assert.equal(await input.getAttribute('aria-describedby'), 'time-hint time-error');
  assert.equal(await input.evaluate(el => el === document.activeElement), true);
  await input.fill('2');
  await page.locator('[type="submit"]').click();
  assert.equal(await text(page), '02:00');
  assert.equal(await page.locator('#settings').evaluate(el => el.open), false);
});

test('native number input supports keyboard increments and dialog focus returns', async t => {
  const page = await setup(t);
  await page.locator('.js-settings-open').click();
  const input = page.locator('[name="pomodoro"]');
  await input.focus();
  await input.press('ArrowUp');
  assert.equal(await input.inputValue(), '26');
  await input.press('ArrowDown');
  assert.equal(await input.inputValue(), '25');
  await input.press('Escape');
  assert.equal(await page.locator('.js-settings-open').evaluate(el => el === document.activeElement), true);
});
