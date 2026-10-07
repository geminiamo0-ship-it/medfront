import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseUrl = 'http://127.0.0.1:4173';
const outDir = 'amboss-browser-artifacts';
await fs.mkdir(outDir, { recursive: true });

const baseQuestionHtml = `
<style>
.nowrap { white-space: nowrap; }
.scientific-name { font-style: italic; }
.wichtig { font-weight: bold; }
</style>
<p>
  The occupational health department at a hospital implements new safety precautions to prevent
  <span class="nowrap">laboratory-acquired</span> infections. One of the new precautions includes
  disinfecting the microbiology laboratory benches with
  <span class="nowrap"><span class="Highlight">70% ethanol</span></span>
  before and after use. This measure is most likely to be effective in preventing the transmission
  of which of the following viruses?
</p>
<div class="amboss-hint"><br><b>Hint:</b><br>
  <p>Ethyl alcohol at concentrations of 60–80% is a potent virucidal agent that is effective against
  <span class="wichtig">enveloped viruses</span>.</p>
</div>`;

const options = [
  { id: 101, displayOrder: 'A', textHtml: '<p>Hepatitis A virus</p>' },
  { id: 102, displayOrder: 'B', textHtml: '<p>Parvovirus</p>' },
  { id: 103, displayOrder: 'C', textHtml: '<p>Poliovirus</p>' },
  { id: 104, displayOrder: 'D', textHtml: '<p>Polyomavirus</p>' },
  { id: 105, displayOrder: 'E', textHtml: '<p>Herpes simplex virus</p>' },
];

function makeQuestion(id, displayOrder, difficultyTier = 'hard') {
  return {
    id,
    externalId: String(7700 + displayOrder),
    displayOrder,
    textHtml: displayOrder === 1 ? baseQuestionHtml : `<p>AMBOSS sample question ${displayOrder} with <span class="Highlight">key clue</span>.</p>`,
    explanationHtml: '',
    difficulty: 'hard',
    difficultyTier,
    estimatedTimeSeconds: 90,
    questionBank: { id: 1, mainBankId: 1, name: 'Amboss (Step 1)', code: 'AMBOSS_S1' },
    options: options.map((o, index) => ({ ...o, id: o.id + displayOrder * 10 + index })),
    userAnswer: null,
    isMarked: displayOrder === 4,
    isAnswered: false,
    isOmitted: false,
    status: 'unanswered',
  };
}

const questions = [
  makeQuestion(2001, 1, 'hard'),
  makeQuestion(2002, 2, 'easy'),
  makeQuestion(2003, 3, 'very_hard'),
  makeQuestion(2004, 4, 'medium'),
  makeQuestion(2005, 5, 'very_easy'),
];

const testState = {
  id: 9001,
  title: 'Custom session from Oct 7, 2PM',
  type: 'tutor',
  mode: 'all',
  step: 1,
  status: 'in_progress',
  totalQuestions: 5,
  answeredQuestions: 0,
  correctAnswers: 0,
  timeSpentSeconds: 42,
  timeLimitSeconds: null,
  startedAt: new Date().toISOString(),
  completedAt: null,
  viewerThemeProfileSnapshot: null,
  filters: { questionBankIds: [1] },
  resumeQuestionId: 2001,
  resumeDisplayOrder: 1,
  omittedQuestionIds: [],
  blockResultsLocked: false,
  questions,
};

let marked = false;
let savedNote = null;
const submittedByQuestion = new Map();
const submitBodies = [];

function correctOptionFor(question) {
  return question.options.find((option) => option.displayOrder === 'E');
}

function decoratedTestState() {
  const body = structuredClone(testState);
  body.answeredQuestions = 0;
  body.correctAnswers = 0;
  body.omittedQuestionIds = [];

  for (const question of body.questions) {
    if (!submittedByQuestion.has(question.id)) continue;

    const submission = submittedByQuestion.get(question.id);
    const selectedOptionId = submission.selectedOptionId;
    const omitted = selectedOptionId == null;

    question.userAnswer = {
      selectedOptionId,
      isCorrect: submission.isCorrect,
      timeSpentSeconds: 1,
      answerChanges: 0,
    };
    question.isAnswered = !omitted;
    question.isOmitted = omitted;
    question.status = omitted ? 'omitted' : 'answered';
    question.options = question.options.map((option) => ({
      ...option,
      isCorrect: option.displayOrder === 'E',
      explanationHtml: `<p>Explanation for option ${option.displayOrder}</p>`,
      uworldChosenBy: option.displayOrder === 'E' ? 61 : 10,
    }));

    if (omitted) body.omittedQuestionIds.push(question.id);
    else body.answeredQuestions += 1;
    if (submission.isCorrect) body.correctAnswers += 1;
  }

  const resume = body.questions.find((question) => question.status === 'unanswered');
  body.resumeQuestionId = resume?.id ?? body.questions.at(-1)?.id ?? null;
  body.resumeDisplayOrder = resume?.displayOrder ?? body.questions.at(-1)?.displayOrder ?? null;
  return body;
}

function explanationPayload(question) {
  return {
    explanationHtml: '<p>AMBOSS question explanation.</p>',
    updatedAt: new Date().toISOString(),
    options: question.options.map((option) => ({
      id: option.id,
      isCorrect: option.displayOrder === 'E',
      explanationHtml: `<p>Explanation for option ${option.displayOrder}</p>`,
      uworldChosenBy: option.displayOrder === 'E' ? 61 : 10,
    })),
  };
}

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installApiMocks(page) {
  await page.route('https://medhvgg-production.up.railway.app/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, '');
    const method = route.request().method();

    if (path === '/auth/me' && method === 'GET') {
      return json(route, {
        success: true,
        data: {
          userId: 1,
          name: 'Browser Smoke',
          email: 'smoke@example.test',
          rating: 0,
          ratingTier: 'Starter',
          subscriptionPlan: 'pro',
          subscriptionExpiry: null,
        },
      });
    }

    if (path === '/tests/9001' && method === 'GET') {
      return json(route, decoratedTestState());
    }

    if (path === '/tests/9001/mark' && method === 'PATCH') {
      const data = JSON.parse(route.request().postData() || '{}');
      marked = Boolean(data.isMarked);
      return json(route, { ok: true, isMarked: marked });
    }

    if (path === '/notes/question/2001' && method === 'GET') {
      return json(route, savedNote);
    }

    if (path === '/notes' && method === 'POST') {
      const data = JSON.parse(route.request().postData() || '{}');
      savedNote = {
        id: 'note-smoke-1',
        questionId: Number(data.questionId),
        content: String(data.content || ''),
        updatedAt: new Date().toISOString(),
      };
      return json(route, savedNote);
    }

    if (path === '/lab-values' && method === 'GET') {
      return json(route, {
        Serum: [
          { id: 'lab-1', category: 'Serum', name: 'ALT', referenceRange: '10–40 U/L', siReferenceInterval: '10–40 U/L' },
          { id: 'lab-2', category: 'Serum', name: 'Calcium', referenceRange: '8.4–10.2 mg/dL', siReferenceInterval: '2.1–2.6 mmol/L' },
        ],
        Blood: [
          { id: 'lab-3', category: 'Blood', name: 'Hemoglobin', referenceRange: '12–16 g/dL', siReferenceInterval: '120–160 g/L' },
        ],
      });
    }

    if (path === '/tests/9001/submit' && method === 'POST') {
      const data = JSON.parse(route.request().postData() || '{}');
      const question = testState.questions.find((item) => item.id === Number(data.questionId));
      if (!question) return json(route, { message: 'Unknown smoke question' }, 404);

      const selectedOptionId = data.selectedOptionId ?? null;
      const correctOptionId = correctOptionFor(question)?.id ?? null;
      const isCorrect = selectedOptionId != null && selectedOptionId === correctOptionId;

      submitBodies.push(data);
      submittedByQuestion.set(question.id, { selectedOptionId, isCorrect });

      return json(route, {
        submission: {
          selectedOptionId,
          isCorrect,
          correctOptionId,
          timeSpentSeconds: 1,
        },
        testStats: {
          answeredQuestions: selectedOptionId == null ? 0 : 1,
          correctAnswers: isCorrect ? 1 : 0,
          timeSpentSeconds: 43,
          percentageScore: isCorrect ? 100 : 0,
        },
      });
    }

    const explanationMatch = path.match(/^\/tests\/9001\/questions\/(\d+)\/explanation$/);
    if (explanationMatch && method === 'GET') {
      const questionId = Number(explanationMatch[1]);
      const question = testState.questions.find((item) => item.id === questionId);
      if (!question) return json(route, { message: 'Unknown smoke question' }, 404);
      return json(route, explanationPayload(question));
    }

    return json(route, { message: `Unhandled browser-smoke route: ${method} ${path}` }, 404);
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function preparePage(browser, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => {
    localStorage.setItem('token', 'browser-smoke-token');
  });
  const page = await context.newPage();
  await installApiMocks(page);
  return { context, page };
}

const browser = await chromium.launch({ headless: true });

try {
  {
    const { context, page } = await preparePage(browser, { width: 1440, height: 1000 });
    await page.goto(`${baseUrl}/test/9001`, { waitUntil: 'networkidle' });

    await page.getByText('70% ethanol').waitFor();
    await page.screenshot({ path: `${outDir}/amboss-desktop-baseline.png`, fullPage: true });
    assert((await page.locator('.amboss-sidebar.is-open').count()) === 1, 'Desktop sidebar should start open');
    assert((await page.locator('input[placeholder="Find AMBOSS content"]').count()) === 0, 'Removed AMBOSS search field reappeared');

    const activeHammers = await page.locator('.amboss-question-row.is-active .amboss-hammer.is-active').count();
    assert(activeHammers === 4, `Expected 4 active hammers for hard difficulty, got ${activeHammers}`);

    await page.getByRole('button', { name: /KEY INFO/i }).click();
    assert((await page.locator('.amboss-stem.amboss-clues-on .Highlight').count()) >= 1, 'KEY INFO did not reveal clue highlight');

    await page.getByRole('button', { name: /ATTENDING TIP/i }).click();
    await page.getByText(/Ethyl alcohol at concentrations of 60–80%/i).waitFor();

    await page.getByRole('button', { name: /^LABS$/i }).click();
    await page.getByText('LAB VALUES').waitFor();
    await page.getByText('Calcium').waitFor();
    await page.getByRole('button', { name: /Close lab values/i }).click();

    await page.getByRole('button', { name: /ADD NOTES/i }).click();
    const note = page.locator('textarea[name="content"]');
    await note.fill('Browser smoke note');
    await page.getByRole('button', { name: /^Save$/i }).click();
    await page.waitForTimeout(100);
    assert(savedNote?.content === 'Browser smoke note', 'Question Note POST did not receive browser content');

    await page.getByRole('button', { name: /^MARK$/i }).click();
    await page.waitForTimeout(100);
    assert(marked === true, 'Mark PATCH did not update mock state');
    assert((await page.getByRole('button', { name: /MARKED/i }).count()) === 1, 'Marked UI state did not update');

    const answerRows = page.locator('.amboss-option');

    // First option click is the ONLY persisted Tutor answer.
    await answerRows.nth(1).click(); // B = wrong
    await answerRows.nth(1).locator('.amboss-option-explanation').waitFor();
    assert(submitBodies.length === 1, `Expected exactly one submit after first click, got ${submitBodies.length}`);
    assert(submitBodies[0].questionId === 2001, 'First submit used the wrong question');
    assert(submitBodies[0].selectedOptionId === 113, 'First submit did not persist option B');
    assert(await answerRows.nth(1).evaluate((node) => node.classList.contains('is-incorrect')), 'First wrong answer did not turn red');
    assert((await page.locator('.amboss-option-explanation').count()) === 1, 'Only the first clicked explanation should open initially');

    // Later clicks are explanation-only: no second submit, but correctness UI opens.
    await answerRows.nth(4).click(); // E = correct
    await answerRows.nth(4).locator('.amboss-option-explanation').waitFor();
    assert(submitBodies.length === 1, 'Post-submit option click incorrectly called submit again');
    assert(await answerRows.nth(4).evaluate((node) => node.classList.contains('is-correct')), 'Post-submit correct option did not turn green');
    assert((await page.locator('.amboss-option-explanation').count()) === 2, 'Second inspected option did not open inline');

    // Show All expands every explanation without changing the recorded first answer.
    await page.getByRole('button', { name: /SHOW ALL EXPLANATIONS/i }).click();
    await page.waitForTimeout(100);
    assert((await page.locator('.amboss-option-explanation').count()) === 5, 'SHOW ALL EXPLANATIONS did not open every option');
    assert(submitBodies.length === 1, 'SHOW ALL EXPLANATIONS performed an unexpected submit');

    // On a fresh question, SHOW ANSWER with no selection is an explicit omission.
    await page.getByRole('button', { name: /NEXT/i }).click();
    await page.getByText(/AMBOSS sample question 2/i).waitFor();
    await page.getByRole('button', { name: /^SHOW ANSWER$/i }).click();
    await page.getByRole('button', { name: /HIDE ALL EXPLANATIONS/i }).waitFor();
    assert(submitBodies.length === 2, 'Omission did not create exactly one submit');
    assert(submitBodies[1].questionId === 2002, 'Omission submit used the wrong question');
    assert(submitBodies[1].selectedOptionId === null, 'Omission submit must send selectedOptionId=null');
    assert((await page.locator('.amboss-option-explanation').count()) === 5, 'Omission reveal did not open all explanations');
    await page.waitForTimeout(100);
    const secondState = await page.locator('.amboss-question-row').nth(1).locator('.amboss-question-state').textContent();
    assert(secondState?.trim() === '○', `Omitted question navigator state should be ○, got ${secondState}`);

    const before = await page.locator('.amboss-sidebar.is-open').count();
    assert(before === 1, 'Sidebar missing before collapse');
    await page.getByRole('button', { name: /Toggle session sidebar/i }).click();
    await page.waitForTimeout(350);
    assert((await page.locator('.amboss-sidebar.is-open').count()) === 0, 'Desktop sidebar did not collapse');
    await page.getByRole('button', { name: /Toggle session navigation/i }).click();
    await page.waitForTimeout(350);
    assert((await page.locator('.amboss-sidebar.is-open').count()) === 1, 'Desktop sidebar did not reopen');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert(!overflow, 'Desktop page has unintended horizontal overflow');

    await page.screenshot({ path: `${outDir}/amboss-desktop-interactions.png`, fullPage: true });
    await context.close();
  }

  for (const device of [
    { name: 'ipad', width: 834, height: 1194 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    marked = false;
    savedNote = null;
    submittedByQuestion.clear();
    submitBodies.length = 0;
    const { context, page } = await preparePage(browser, { width: device.width, height: device.height });
    await page.goto(`${baseUrl}/test/9001`, { waitUntil: 'networkidle' });
    await page.getByText('70% ethanol').waitFor();
    await page.screenshot({ path: `${outDir}/amboss-${device.name}-baseline.png`, fullPage: true });

    assert((await page.locator('.amboss-sidebar.is-open').count()) === 0, `${device.name}: drawer should start closed`);
    await page.getByRole('button', { name: /Toggle session navigation/i }).click();
    await page.locator('.amboss-sidebar.is-open').waitFor();
    assert((await page.locator('.amboss-mobile-backdrop').count()) === 1, `${device.name}: missing drawer backdrop`);
    await page.locator('.amboss-mobile-backdrop').click({ position: { x: device.width - 5, y: 200 } });
    await page.waitForTimeout(350);
    assert((await page.locator('.amboss-sidebar.is-open').count()) === 0, `${device.name}: drawer did not close`);

    await page.getByRole('button', { name: /KEY INFO/i }).click();
    assert((await page.locator('.amboss-stem.amboss-clues-on .Highlight').count()) >= 1, `${device.name}: clue toggle failed`);

    await page.getByRole('button', { name: /^LABS$/i }).click();
    await page.getByText('LAB VALUES').waitFor();
    await page.waitForTimeout(350);
    const labBox = await page.locator('.amboss-labs.is-open').boundingBox();
    assert(labBox && Math.round(labBox.width) >= device.width - 2, `${device.name}: Labs panel is not viewport-wide`);
    assert(labBox && Math.abs(labBox.x) <= 1, `${device.name}: Labs panel did not finish sliding to the viewport edge (x=${labBox?.x})`);
    await page.screenshot({ path: `${outDir}/amboss-${device.name}-labs.png`, fullPage: true });
    await page.getByRole('button', { name: /Close lab values/i }).click();
    await page.waitForTimeout(350);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert(!overflow, `${device.name}: unintended horizontal page overflow`);

    await page.screenshot({ path: `${outDir}/amboss-${device.name}-final.png`, fullPage: true });
    await context.close();
  }

  console.log('AMBOSS_BROWSER_SMOKE_OK desktop=true ipad=true mobile=true clue=true hint=true labs=true notes=true mark=true first_answer_submit=true post_submit_inline=true show_all=true omitted=true');
} finally {
  await browser.close();
}
