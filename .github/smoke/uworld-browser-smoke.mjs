import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = 'http://127.0.0.1:4173';
const output = 'uworld-browser-artifacts';
await fs.mkdir(output, { recursive: true });

const question = {
  id: 4100, externalId: 'UW4100', displayOrder: 1, questionBank: {
    id: 23, mainBankId: 23, name: 'UWorld (Step 2)', code: 'UWORLD_S2',
  },
  textHtml: '<p>Patient with knee pain: what is the diagnosis?</p>',
  explanationHtml: '',
  options: [
    { id: 511, displayOrder: 'A', textHtml: '<p>Option A</p>' },
    { id: 512, displayOrder: 'B', textHtml: '<p>Option B</p>' },
  ],
  userAnswer: null, isMarked: false, isAnswered: false, isOmitted: false,
  status: 'unanswered', estimatedTimeSeconds: 60,
};
const test = (id, timed, answered) => ({
  id, title: 'UWorld module smoke', viewerThemeProfileSnapshot: 'uworld',
  type: timed ? 'timed' : 'tutor', mode: 'unused', step: 2,
  status: 'in_progress', timeLimitSeconds: timed ? 1200 : null,
  timerElapsedSeconds: 20, timeSpentSeconds: 20,
  startedAt: new Date().toISOString(), completedAt: null,
  filters: { questionBankIds: [23] },
  totalQuestions: 1, answeredQuestions: answered ? 1 : 0, correctAnswers: answered ? 1 : 0,
  resumeQuestionId: 4100, resumeDisplayOrder: 1,
  omittedQuestionIds: [], blockResultsLocked: false,
  questions: [{ ...question, options: question.options.map(o => ({
    ...o, ...(answered ? { isCorrect: o.id === 512, uworldChosenBy: o.id === 512 ? 70 : 30 } : {}),
  })), ...(answered ? {
    userAnswer: { selectedOptionId: 512, isCorrect: true, timeSpentSeconds: 4, answerChanges: 0 },
    isAnswered: true, status: 'answered', explanationHtml: '<p>Clinical review for option B.</p>',
  } : {}) }],
});
let answered = false;
let savedTimed = null;
async function mock(context) {
  await context.route('https://medhvgg-production.up.railway.app/api/**', route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, '');
    const method = route.request().method();
    const respond = (body, status = 200) => route.fulfill({
      status, contentType: 'application/json', body: JSON.stringify(body),
    });
    if (path === '/auth/me') return respond({ success: true, data: {
      userId: 1, name: 'UWorld Smoke', email: 'uworld@example.test',
      subscriptionPlan: 'pro', subscriptionExpiry: null,
    } });
    if (path === '/notes/question/4100') return respond(null);
    if (path === '/tests/9010' && method === 'GET') return respond(test(9010, false, answered));
    if (path === '/tests/9011' && method === 'GET') return respond(test(9011, true, false));
    if (path === '/tests/9010/submit' && method === 'POST') {
      answered = true;
      return respond({ submission: { selectedOptionId: 512, isCorrect: true,
        correctOptionId: 512, timeSpentSeconds: 4 },
        testStats: { answeredQuestions: 1, correctAnswers: 1, timeSpentSeconds: 24, percentageScore: 100 } });
    }
    if (path === '/tests/9010/questions/4100/explanation') return respond({
      explanationHtml: '<p>Clinical review for option B.</p>', updatedAt: new Date().toISOString(),
      options: [{ id: 511, isCorrect: false, explanationHtml: null, uworldChosenBy: 30 },
        { id: 512, isCorrect: true, explanationHtml: null, uworldChosenBy: 70 }],
    });
    if (path === '/tests/9011/timed-selection' && method === 'PATCH') {
      savedTimed = JSON.parse(route.request().postData() || '{}');
      return respond({ ok: true, ...savedTimed });
    }
    if (path === '/tests/9010/highlights' && method === 'PATCH') return respond({ ok: true });
    if (path === '/lab-values') return respond({});
    return respond({ error: 'Unhandled UWorld smoke API ' + method + path }, 404);
  });
}

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 900 }, { width: 834, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    answered = false;
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => localStorage.setItem('token', 'uworld-mock-token'));
    await mock(context);
    const page = await context.newPage();
    await page.goto(base + '/test/9010', { waitUntil: 'networkidle' });
    await page.locator('.uw-runner[data-appearance="blue"]').waitFor();
    // Topbar fidelity stage #67: geometry is measured in the rendered Chromium UI.
    const geometry = await page.evaluate(() => {
      const bar = document.querySelector('.uw-topbar');
      const center = document.querySelector('.uw-top-center');
      const mobile = window.innerWidth <= 650;
      const mark = document.querySelector(mobile ? '.uw-item-index' : '.uw-mark');
      const previous = document.querySelector('.uw-top-navigation');
      const right = document.querySelector(mobile
        ? '.uw-top-mobile-actions button' : '.uw-top-right button');
      const toolLabel = document.querySelector('.uw-top-tool span');
      if (!bar || !center || !mark || !previous || !right || !toolLabel) return null;
      const box = el => el.getBoundingClientRect();
      const b = box(bar), n = box(center), m = box(mark), p = box(previous), r = box(right);
      return {
        centerDelta: Math.abs((n.left + n.width / 2) - (b.left + b.width / 2)),
        leftOverlap: m.right - p.left,
        rightOverlap: n.right - r.left,
        barOverflow: bar.scrollWidth - bar.clientWidth,
        labelSize: Number.parseFloat(window.getComputedStyle(toolLabel).fontSize),
        barHeight: b.height,
      };
    });
    assert(geometry, 'Topbar geometry could not be measured');
    assert(geometry.centerDelta <= 8,
      'Topbar Previous/Next not centrally aligned at ' + viewport.width + ': ' + JSON.stringify(geometry));
    assert(geometry.leftOverlap <= 2 && geometry.rightOverlap <= 2,
      'Topbar navigation overlaps adjacent actions at ' + viewport.width + ': ' + JSON.stringify(geometry));
    assert(geometry.barOverflow <= 2,
      'Topbar overflows horizontally at ' + viewport.width + ': ' + JSON.stringify(geometry));
    assert(geometry.labelSize <= 11,
      'Topbar font is too large at ' + viewport.width + ': ' + geometry.labelSize);
    assert(Math.abs(geometry.barHeight - (viewport.width <= 650 ? 56 : 48)) <= 2,
      'Topbar height differs from approved V3 at ' + viewport.width + ': ' + geometry.barHeight);
    await page.locator('.uw-topbar').screenshot({ path: output + '/topbar-v3-' + viewport.width + '.png' });
    await page.getByText('Patient with knee pain').waitFor();
    await page.getByRole('radio', { name: /Option B/ }).check();
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.locator('.uw-result-card').waitFor();
    await page.getByText('Clinical review for option B.').waitFor();
    assert.equal(await page.locator('.uw-runner').getAttribute('data-mode'), 'split');
    await page.screenshot({ path: output + '/uworld-blue-split-' + viewport.width + '.png' });
    if (viewport.width <= 650) {
      // Mobile has exactly the four visible exam actions: Prev, Next, Mark, Settings.
      const top = page.locator('.uw-topbar');
      for (const label of ['Previous', 'Next', 'Mark', 'Settings']) {
        assert.equal(await top.getByRole('button', { name: label, exact: true }).count(), 1,
          'Mobile control ' + label + ' is missing or duplicated at ' + viewport.width);
      }
      const settings = top.getByRole('button', { name: 'Settings', exact: true });
      assert.equal(await settings.getAttribute('aria-expanded'), 'false');
      await settings.click();
      assert.equal(await settings.getAttribute('aria-expanded'), 'true');
      const tools = top.getByRole('group', { name: 'Additional exam tools' });
      await tools.waitFor();
      assert.deepEqual(await tools.locator('button').allTextContents(), [
        'Shortcuts', 'Full Screen', 'Marker', 'Lab Values', 'Notes', 'Calculator', 'Appearance & Layout',
      ]);
      await page.waitForTimeout(570);
      const railGeometry = await page.evaluate(() => {
        const tray = document.querySelector('.uw-mobile-tools-tray');
        const gear = document.querySelector('.uw-settings-gear');
        const toggle = document.querySelector('.uw-mobile-settings-toggle');
        const buttons = Array.from(document.querySelectorAll('.uw-mobile-tray-action'));
        const orb = buttons[0]?.querySelector('.uw-mobile-action-orb');
        if (!tray || !toggle || !gear || !orb) return null;
        const items = buttons.map(button => button.getBoundingClientRect());
        const floating = tray.getBoundingClientRect();
        const settings = toggle.getBoundingClientRect();
        const circle = orb.getBoundingClientRect();
        const lefts = items.map(item => item.left + item.width / 2);
        return {
          width: floating.width,
          rightGap: window.innerWidth - floating.right,
          gearAlignment: Math.abs(settings.right - floating.right),
          top: floating.top,
          mainBottom: settings.bottom,
          itemCenters: lefts,
          itemTops: items.map(item => item.top),
          circleWidth: circle.width,
          circleHeight: circle.height,
          circleRadius: getComputedStyle(orb).borderRadius,
          rotation: getComputedStyle(gear).transform,
          scrollHeight: tray.scrollHeight,
          clientHeight: tray.clientHeight,
        };
      });
      assert(railGeometry, 'Mobile radial rail layout unavailable');
      assert(railGeometry.width <= 86 && railGeometry.rightGap >= -1 && railGeometry.rightGap <= 12,
        'Rail should float near right screen edge, not across the screen: ' + JSON.stringify(railGeometry));
      assert(railGeometry.gearAlignment <= 12 && railGeometry.top >= railGeometry.mainBottom,
        'Rail must unfold immediately below settings gear: ' + JSON.stringify(railGeometry));
      assert(railGeometry.itemTops.every((top, i, items) => i === 0 || top > items[i-1]),
        'Tools must be a single descending column, not a horizontal grid');
      assert(Math.max(...railGeometry.itemCenters) - Math.min(...railGeometry.itemCenters) <= 3,
        'Tool orbs are not vertically aligned');
      assert(Math.abs(railGeometry.circleWidth - railGeometry.circleHeight) <= 1
        && railGeometry.circleRadius.includes('50%') || Math.abs(railGeometry.circleWidth - railGeometry.circleHeight) <= 1
          && railGeometry.circleRadius.startsWith('23px'),
        'Tools must render as circular icons');
      assert(railGeometry.rotation.startsWith('matrix(0, 1, -1, 0,') ||
        railGeometry.rotation.startsWith('matrix(0, 1, -1, 0,'),
        'Settings gear should rotate 90deg when the rail is open: ' + railGeometry.rotation);
      await page.screenshot({ path: output + '/mobile-tools-vertical-' + viewport.width + '.png' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false);
      await settings.click();
      assert.equal(await settings.getAttribute('aria-expanded'), 'false',
        'Second tap must close mobile tray');
      await settings.click();
      await page.keyboard.press('Escape');
      assert.equal(await settings.getAttribute('aria-expanded'), 'false',
        'Escape must close mobile tray');
      await settings.click();
      // Click visible exam canvas below the dropdown, not text covered by the tray.
      await page.mouse.click(viewport.width - 12, viewport.height - 100);
      assert.equal(await settings.getAttribute('aria-expanded'), 'false',
        'Outside pointer must dismiss tray');
      await settings.click();
      await tools.getByRole('button', { name: 'Marker' }).click();
      assert.equal(await settings.getAttribute('aria-expanded'), 'false',
        'Selecting a tool closes tray');
      await settings.click();
      assert.equal(await tools.getByRole('button', { name: 'Marker' }).getAttribute('aria-pressed'), 'true');
      await tools.getByRole('button', { name: 'Appearance & Layout' }).click();
    } else {
      await page.getByRole('button', { name: 'Settings' }).click();
    }
    await page.getByRole('button', { name: /Sepia/ }).click();
    assert.equal(await page.locator('.uw-runner').getAttribute('data-appearance'), 'sepia');
    await page.getByRole('checkbox', { name: 'Split view' }).uncheck();
    assert.equal(await page.locator('.uw-runner').getAttribute('data-mode'), 'continuous');
    await page.screenshot({ path: output + '/uworld-' + viewport.width + '.png' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false);
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  await context.addInitScript(() => localStorage.setItem('token', 'uworld-mock-token'));
  await mock(context);
  const page = await context.newPage();
  await page.goto(base + '/test/9011', { waitUntil: 'networkidle' });
  await page.getByRole('radio', { name: /Option B/ }).check();
  await page.waitForTimeout(500);
  assert.equal(savedTimed?.selectedOptionId, 512);
  assert.equal(await page.locator('.uw-result-card').count(), 0, 'Timed mode leaked correctness');
  assert.equal(await page.locator('.uw-explanation-pane').count(), 0, 'Timed mode leaked explanation');
  await context.close();
  console.log('UWORLD_BROWSER_SMOKE_PASS');
} finally { await browser.close(); }
