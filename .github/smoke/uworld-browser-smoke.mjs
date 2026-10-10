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
  for (const viewport of [{ width: 1440, height: 900 }, { width: 834, height: 1000 }, { width: 390, height: 844 }]) {
    answered = false;
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => localStorage.setItem('token', 'uworld-mock-token'));
    await mock(context);
    const page = await context.newPage();
    await page.goto(base + '/test/9010', { waitUntil: 'networkidle' });
    await page.locator('.uw-runner[data-appearance="blue"]').waitFor();
    await page.getByText('Patient with knee pain').waitFor();
    await page.getByRole('radio', { name: /Option B/ }).check();
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.locator('.uw-result-card').waitFor();
    await page.getByText('Clinical review for option B.').waitFor();
    await page.getByRole('button', { name: 'Settings' }).click();
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
