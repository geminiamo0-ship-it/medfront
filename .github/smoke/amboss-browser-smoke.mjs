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
  { id: 106, displayOrder: 'F', textHtml: '<p>Varicella-zoster virus</p>' },
  { id: 107, displayOrder: 'G', textHtml: '<p>Respiratory syncytial virus</p>' },
  { id: 108, displayOrder: 'H', textHtml: '<p>Influenza virus</p>' },
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

const timedQuestions = [
  makeQuestion(3001, 1, 'hard'),
  makeQuestion(3002, 2, 'easy'),
  makeQuestion(3003, 3, 'very_hard'),
  makeQuestion(3004, 4, 'medium'),
  makeQuestion(3005, 5, 'very_easy'),
];
let timedStatus = 'in_progress';
let timedTimeSpentSeconds = 0;
let timedStartedAt = new Date().toISOString();
const timedDrafts = new Map();
let timedBatchBody = null;
let timedSelectionSaves = 0;
let timedHighlightSaves = 0;
let timedAiSummaryCalls = 0;

let tutorLifecycleStatus = 'in_progress';
let tutorLifecycleTimeSpentSeconds = 0;
let tutorLifecycleStartedAt = new Date().toISOString();
let tutorSuspendBody = null;
let tutorCompleteBody = null;
let createdTimedBody = null;

function correctOptionFor(question) {
  return question.options.find((option) => option.displayOrder === 'H');
}

function ambossExplanationBlob(question) {
  const parts = question.options.map((option) => {
    const state = option.displayOrder === 'H' ? 'Correct' : 'Incorrect';
    const libraryLink =
      option.displayOrder === 'H'
        ? ' <a href="https://www.amboss.com/us/library#xid=SM0yLg&anker=Zc00dca4994157e86d8e6e8ee9510443f" data-learningcard-id="SM0yLg" data-anker="Zc00dca4994157e86d8e6e8ee9510443f">edema</a>'
        : '';
    return `<div><b>${option.displayOrder.toLowerCase()} (${state}):</b><br><p>Blob explanation for option ${option.displayOrder} on question ${question.id}.${libraryLink}</p></div>`;
  });

  parts.push(
    '<br><div class="amboss-learning-obj"><b>Key Info:</b><br>Blob learning objective.</div>',
  );

  return parts.join('<br>');
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
    question.explanationHtml = ambossExplanationBlob(question);
    question.options = question.options.map((option) => ({
      ...option,
      isCorrect: option.displayOrder === 'H',
      explanationHtml: null,
      uworldChosenBy: option.displayOrder === 'H' ? 61 : 10,
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

function timedTestPayload() {
  const completed = timedStatus === 'completed';
  const body = {
    id: 9002,
    title: 'AMBOSS timed smoke',
    type: 'timed',
    mode: 'unused',
    step: 1,
    status: timedStatus,
    totalQuestions: timedQuestions.length,
    answeredQuestions: completed
      ? timedQuestions.filter((q) => timedDrafts.get(q.id) != null).length
      : 0,
    correctAnswers: completed
      ? timedQuestions.filter((q) => timedDrafts.get(q.id) === correctOptionFor(q)?.id).length
      : 0,
    timeSpentSeconds: timedTimeSpentSeconds,
    timeLimitSeconds: timedQuestions.length * 60,
    startedAt: timedStartedAt,
    completedAt: completed ? new Date().toISOString() : null,
    viewerThemeProfileSnapshot: null,
    filters: { questionBankIds: [1] },
    resumeQuestionId: timedQuestions[0].id,
    resumeDisplayOrder: 1,
    omittedQuestionIds: [],
    blockResultsLocked: false,
    questions: structuredClone(timedQuestions),
  };

  for (const question of body.questions) {
    const selectedOptionId = timedDrafts.has(question.id) ? timedDrafts.get(question.id) : null;
    if (!completed) {
      question.draftSelectedOptionId = selectedOptionId;
      question.userAnswer = null;
      question.isAnswered = false;
      question.isOmitted = false;
      question.status = 'unanswered';
      continue;
    }

    const correctOptionId = correctOptionFor(question)?.id ?? null;
    const isCorrect = selectedOptionId != null && selectedOptionId === correctOptionId;
    question.draftSelectedOptionId = null;
    question.userAnswer = {
      selectedOptionId,
      isCorrect,
      timeSpentSeconds: 1,
      answerChanges: 0,
    };
    question.isAnswered = selectedOptionId != null;
    question.isOmitted = selectedOptionId == null;
    question.status = selectedOptionId == null ? 'omitted' : 'answered';
    question.explanationHtml = ambossExplanationBlob(question);
    question.options = question.options.map((option) => ({
      ...option,
      isCorrect: option.id === correctOptionId,
      explanationHtml: null,
      uworldChosenBy: option.id === correctOptionId ? 61 : 10,
    }));
  }

  body.omittedQuestionIds = body.questions.filter((q) => q.isOmitted).map((q) => q.id);
  return body;
}

function tutorLifecyclePayload() {
  const body = structuredClone(testState);
  body.id = 9003;
  body.title = 'AMBOSS tutor lifecycle smoke';
  body.status = tutorLifecycleStatus;
  body.timeSpentSeconds = tutorLifecycleTimeSpentSeconds;
  body.startedAt = tutorLifecycleStartedAt;
  body.completedAt = tutorLifecycleStatus === 'completed' ? new Date().toISOString() : null;
  body.questions = body.questions.map((question) => ({
    ...question,
    userAnswer: null,
    isAnswered: false,
    isOmitted: tutorLifecycleStatus === 'completed',
    status: tutorLifecycleStatus === 'completed' ? 'omitted' : 'unanswered',
  }));
  body.omittedQuestionIds =
    tutorLifecycleStatus === 'completed' ? body.questions.map((question) => question.id) : [];
  return body;
}

function explanationPayload(question) {
  return {
    // Mirrors current AMBOSS imports: all A/B/C/D/E explanations live in the
    // question-level blob while option-level explanationHtml is null.
    explanationHtml: ambossExplanationBlob(question),
    updatedAt: new Date().toISOString(),
    options: question.options.map((option) => ({
      id: option.id,
      isCorrect: option.displayOrder === 'H',
      explanationHtml: null,
      uworldChosenBy: option.displayOrder === 'H' ? 61 : 10,
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

async function installApiMocks(target) {
  await target.route('https://medhvgg-production.up.railway.app/api/**', async (route) => {
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

    if (path === '/tests/metadata/question-banks' && method === 'GET') {
      return json(route, [{
        id: 1,
        mainBankId: 1,
        name: 'Amboss (Step 1)',
        code: 'AMBOSS_S1',
        description: 'AMBOSS browser smoke bank',
        step: 1,
        totalQuestions: 2785,
        usedQuestions: 0,
        isPremium: false,
        isBlockBank: false,
        blockSize: 40,
        icon: null,
        gradient: null,
        displayOrder: 1,
        isLocked: false,
      }]);
    }

    if (path === '/tests/counts' && method === 'POST') {
      return json(route, {
        all: 2785,
        unused: 2700,
        used: 85,
        incorrect: 20,
        correct: 40,
        marked: 10,
        marked_correct: 4,
        marked_incorrect: 3,
        omitted: 2,
        suspended: 1,
      });
    }

    if (path === '/tests/metadata/difficulty-counts' && method === 'POST') {
      return json(route, {
        very_hard: 100,
        hard: 500,
        medium: 1200,
        easy: 700,
        very_easy: 285,
      });
    }

    if (path === '/tests/metadata/subjects' && method === 'POST') {
      return json(route, []);
    }

    if (path === '/tests/metadata/systems-with-topics' && method === 'POST') {
      return json(route, []);
    }

    if (path === '/tests' && method === 'POST') {
      createdTimedBody = JSON.parse(route.request().postData() || '{}');
      return json(route, { id: 9002 }, 201);
    }

    if (path === '/tests' && method === 'GET') {
      const now = new Date().toISOString();
      return json(route, [
        {
          id: 9003,
          title: 'AMBOSS tutor lifecycle smoke',
          type: 'tutor',
          mode: 'all',
          step: 1,
          status: tutorLifecycleStatus,
          totalQuestions: 5,
          answeredQuestions: 0,
          correctAnswers: 0,
          percentageScore: '0',
          startedAt: tutorLifecycleStartedAt,
          completedAt: tutorLifecycleStatus === 'completed' ? now : null,
          createdAt: now,
        },
      ]);
    }

    if (path === '/tests/9001' && method === 'GET') {
      return json(route, decoratedTestState());
    }

    if (path === '/tests/9002' && method === 'GET') {
      return json(route, timedTestPayload());
    }

    if (path === '/tests/9003' && method === 'GET') {
      return json(route, tutorLifecyclePayload());
    }

    if (path === '/tests/9003/suspend' && method === 'PUT') {
      tutorSuspendBody = JSON.parse(route.request().postData() || '{}');
      tutorLifecycleTimeSpentSeconds = Math.max(
        tutorLifecycleTimeSpentSeconds,
        Number(tutorSuspendBody.totalTimeSpentSeconds || 0),
      );
      tutorLifecycleStatus = 'suspended';
      return json(route, tutorLifecyclePayload());
    }

    if (path === '/tests/9003/resume' && method === 'PUT') {
      tutorLifecycleStatus = 'in_progress';
      tutorLifecycleStartedAt = new Date().toISOString();
      return json(route, tutorLifecyclePayload());
    }

    if (path === '/tests/9003/complete' && method === 'PUT') {
      tutorCompleteBody = JSON.parse(route.request().postData() || '{}');
      tutorLifecycleTimeSpentSeconds = Math.max(
        tutorLifecycleTimeSpentSeconds,
        Number(tutorCompleteBody.totalTimeSpentSeconds || 0),
      );
      tutorLifecycleStatus = 'completed';
      return json(route, tutorLifecyclePayload());
    }

    if (path === '/tests/9002/timed-selection' && method === 'PATCH') {
      const data = JSON.parse(route.request().postData() || '{}');
      timedDrafts.set(Number(data.questionId), data.selectedOptionId ?? null);
      timedSelectionSaves += 1;
      return json(route, {
        ok: true,
        questionId: Number(data.questionId),
        selectedOptionId: data.selectedOptionId ?? null,
      });
    }

    if (path === '/tests/9002/highlights' && method === 'PATCH') {
      timedHighlightSaves += 1;
      return json(route, { ok: true });
    }

    if (path === '/tests/9002/suspend' && method === 'PUT') {
      timedStatus = 'suspended';
      timedTimeSpentSeconds = Math.max(1, timedTimeSpentSeconds + 1);
      return json(route, timedTestPayload());
    }

    if (path === '/tests/9002/resume' && method === 'PUT') {
      timedStatus = 'in_progress';
      timedStartedAt = new Date().toISOString();
      return json(route, timedTestPayload());
    }

    if (path === '/tests/9002/submit-batch' && method === 'POST') {
      timedBatchBody = JSON.parse(route.request().postData() || '{}');
      for (const answer of timedBatchBody.answers || []) {
        timedDrafts.set(Number(answer.questionId), answer.selectedOptionId ?? null);
      }
      timedTimeSpentSeconds = Number(timedBatchBody.totalTimeSpentSeconds || timedTimeSpentSeconds);
      timedStatus = 'completed';
      return json(route, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        answeredQuestions: timedQuestions.filter((q) => timedDrafts.get(q.id) != null).length,
        correctAnswers: timedQuestions.filter((q) => timedDrafts.get(q.id) === correctOptionFor(q)?.id).length,
        omittedQuestions: timedQuestions.filter((q) => timedDrafts.get(q.id) == null).length,
        percentageScore: 0,
        timeSpentSeconds: timedTimeSpentSeconds,
      });
    }

    if (path === '/tests/9002/questions/3001/ai-explain' && method === 'POST') {
      timedAiSummaryCalls += 1;
      return json(route, {
        content: 'AI review summary for the completed timed question.',
        language: 'en',
      });
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


    if (path === '/library/structure' && method === 'GET') {
      return json(route, [
        {
          id: 'Amboss',
          name: 'Amboss',
          articles: [{ id: 2583, title: 'Edema' }],
          children: [],
        },
      ]);
    }

    if (path === '/library/article/SM0yLg' && method === 'GET') {
      return json(route, {
        id: 2583,
        name: 'Edema',
        title: 'Edema',
        source: 'amboss',
        contentHtml:
          '<div id="Zc00dca4994157e86d8e6e8ee9510443f"><h2>Edema</h2><p>Internal AMBOSS article smoke</p></div>',
        isRead: false,
        isBookmarked: false,
      });
    }

    if (path === '/library/article/2583/highlights' && method === 'GET') {
      return json(route, []);
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

function timerTextToSeconds(value) {
  const parts = String(value || '').trim().split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return NaN;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return NaN;
}

async function preparePage(browser, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => {
    localStorage.setItem('token', 'browser-smoke-token');
  });
  await installApiMocks(context);
  const page = await context.newPage();
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
    await page.getByText('LAB VALUES', { exact: true }).waitFor();
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
    await answerRows.nth(1).getByText(/Blob explanation for option B/i).waitFor();
    assert(submitBodies.length === 1, `Expected exactly one submit after first click, got ${submitBodies.length}`);
    assert(submitBodies[0].questionId === 2001, 'First submit used the wrong question');
    assert(submitBodies[0].selectedOptionId === 113, 'First submit did not persist option B');
    assert(await answerRows.nth(1).evaluate((node) => node.classList.contains('is-incorrect')), 'First wrong answer did not turn red');
    assert((await page.locator('.amboss-option-explanation').count()) === 1, 'Only the first clicked explanation should open initially');

    // Later clicks are explanation-only: no second submit, but correctness UI opens.
    await answerRows.nth(7).click(); // H = correct and final option
    await answerRows.nth(7).locator('.amboss-option-explanation').waitFor();
    await answerRows.nth(7).getByText(/Blob explanation for option H/i).waitFor();
    assert(submitBodies.length === 1, 'Post-submit option click incorrectly called submit again');
    assert(await answerRows.nth(7).evaluate((node) => node.classList.contains('is-correct')), 'Final correct option did not turn green');
    assert((await page.locator('.amboss-option-explanation').count()) === 2, 'Final option explanation did not open inline');

    // Show All expands every explanation without changing the recorded first answer.
    await page.getByRole('button', { name: /SHOW ALL EXPLANATIONS/i }).click();
    await page.waitForTimeout(100);
    assert((await page.locator('.amboss-option-explanation').count()) === 8, 'SHOW ALL EXPLANATIONS did not open every option');
    assert(submitBodies.length === 1, 'SHOW ALL EXPLANATIONS performed an unexpected submit');

    // On a fresh question, SHOW ANSWER with no selection is an explicit omission.
    await page.getByRole('button', { name: /NEXT/i }).click();
    await page.getByText(/AMBOSS sample question 2/i).waitFor();
    await page.getByRole('button', { name: /SHOW ANSWER/i }).click();
    await page.getByRole('button', { name: /HIDE ALL EXPLANATIONS/i }).waitFor();
    assert(submitBodies.length === 2, 'Omission did not create exactly one submit');
    assert(submitBodies[1].questionId === 2002, 'Omission submit used the wrong question');
    assert(submitBodies[1].selectedOptionId === null, 'Omission submit must send selectedOptionId=null');
    assert((await page.locator('.amboss-option-explanation').count()) === 8, 'Omission reveal did not open all explanations');
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

    // Imported AMBOSS links must stay inside MedPark and resolve by the
    // original external article ID instead of opening amboss.com.
    const internalLibraryLink = page
      .locator('a[data-medpark-library-link="1"][data-learningcard-id="SM0yLg"]')
      .first();
    await internalLibraryLink.waitFor();
    const internalHref = await internalLibraryLink.getAttribute('href');
    assert(internalHref?.includes('/library?'), `AMBOSS link was not rewritten to Library: ${internalHref}`);
    assert(internalHref?.includes('source=amboss'), `AMBOSS link lost source=amboss: ${internalHref}`);
    assert(internalHref?.includes('article=SM0yLg'), `AMBOSS link lost external article ID: ${internalHref}`);
    assert(internalHref?.includes('anchor=Zc00dca4994157e86d8e6e8ee9510443f'), `AMBOSS link lost section anchor: ${internalHref}`);
    assert(!internalHref?.includes('amboss.com'), `AMBOSS link still points outside MedPark: ${internalHref}`);

    await internalLibraryLink.click();
    const linkMenu = page.getByRole('menu', { name: /Open edema/i });
    await linkMenu.waitFor();
    assert(
      (await page.getByRole('menuitem', { name: /Open in split view/i }).count()) === 1,
      'Split-view option missing from AMBOSS article menu',
    );
    assert(
      (await page.getByRole('menuitem', { name: /Open in new tab/i }).count()) === 1,
      'New-tab option missing from AMBOSS article menu',
    );

    // New tab keeps the normal full Library experience.
    const popupPromise = context.waitForEvent('page');
    await page.getByRole('menuitem', { name: /Open in new tab/i }).click();
    const popup = await popupPromise;
    await popup.waitForURL(/\/library\?.*article=SM0yLg/);
    await popup.getByText('Internal AMBOSS article smoke').waitFor();
    assert(!popup.url().includes('embedded=1'), 'New-tab Library unexpectedly opened in embedded mode');
    await popup.close();

    // Split keeps the exam in place and embeds the same Library reader.
    await internalLibraryLink.click();
    await page.getByRole('menuitem', { name: /Open in split view/i }).click();
    const splitPane = page.locator('.amboss-library-split');
    await splitPane.waitFor();
    const libraryFrame = page.frameLocator('.amboss-library-frame');
    await libraryFrame.getByText('Internal AMBOSS article smoke').waitFor();
    assert(
      (await libraryFrame.locator('#sb').count()) === 0,
      'Embedded Library must not render the browse sidebar',
    );
    assert(
      (await libraryFrame.getByRole('button', { name: /Key exam info/i }).count()) === 1,
      'Embedded Library lost Key Exam control',
    );
    assert(
      (await libraryFrame.getByRole('button', { name: /High-yield/i }).count()) === 1,
      'Embedded Library lost High-yield control',
    );

    const beforeSplitBox = await splitPane.boundingBox();
    assert(beforeSplitBox, 'Split pane has no bounding box');
    const resizer = page.locator('.amboss-library-resizer');
    const resizeBox = await resizer.boundingBox();
    assert(resizeBox, 'Split pane resize handle missing');
    await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + 100);
    await page.mouse.down();
    await page.mouse.move(resizeBox.x - 80, resizeBox.y + 100, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    const afterSplitBox = await splitPane.boundingBox();
    assert(
      afterSplitBox && beforeSplitBox && afterSplitBox.width > beforeSplitBox.width + 40,
      'Dragging the split divider did not resize the Library pane',
    );

    await page.getByRole('button', { name: /Close library split view/i }).click();
    assert((await page.locator('.amboss-library-split').count()) === 0, 'Library split did not close');

    await context.close();
  }

  {
    createdTimedBody = null;
    const { context, page } = await preparePage(browser, { width: 1440, height: 1000 });
    await page.goto(`${baseUrl}/qbank/1/create-test?step=1`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Create Test' }).waitFor();

    await page.getByRole('button', { name: /^Timed$/i }).click();
    await page.getByText('Time per question', { exact: true }).waitFor();
    await page.getByRole('button', { name: /^Custom$/i }).click();
    const customMinutes = page.getByLabel('Minutes / question');
    await customMinutes.fill('2.5');
    await page.getByText('1h 40m', { exact: true }).waitFor();

    await page.getByRole('button', { name: /^1:30$/ }).click();
    await page.getByText('1h 00m', { exact: true }).waitFor();
    await page.getByRole('button', { name: /^Create Test$/i }).click();
    await page.waitForURL(/\/test\/9002/);
    assert(createdTimedBody?.type === 'timed', 'Create Test did not send type=timed');
    assert(Number(createdTimedBody?.totalQuestions) === 40, 'Create Test did not preserve 40 questions');
    assert(Number(createdTimedBody?.timeLimitSeconds) === 3600, `Expected 40 × 90s = 3600s, got ${createdTimedBody?.timeLimitSeconds}`);
    await context.close();
  }

  {
    tutorLifecycleStatus = 'in_progress';
    tutorLifecycleTimeSpentSeconds = 0;
    tutorLifecycleStartedAt = new Date().toISOString();
    tutorSuspendBody = null;
    tutorCompleteBody = null;

    const { context, page } = await preparePage(browser, { width: 1440, height: 1000 });
    await page.goto(`${baseUrl}/test/9003`, { waitUntil: 'networkidle' });
    await page.getByText('70% ethanol').waitFor();

    const tutorTopTimer = page.locator('.amboss-primary-timer strong');
    const tutorSideTimer = page.locator('.amboss-sidebar-time strong');
    const tutorFirst = (await tutorTopTimer.textContent())?.trim();
    assert((await page.getByRole('button', { name: /^End Block$/i }).count()) === 1, 'Tutor is missing End Block');

    await page.waitForTimeout(1150);
    const tutorSecond = (await tutorTopTimer.textContent())?.trim();
    const tutorSideSecond = (await tutorSideTimer.textContent())?.trim();
    assert(
      timerTextToSeconds(tutorSecond) > timerTextToSeconds(tutorFirst),
      `Tutor counter did not count up: ${tutorFirst} → ${tutorSecond}`,
    );
    assert(tutorSecond === tutorSideSecond, `Tutor top/sidebar timers drifted: ${tutorSecond} vs ${tutorSideSecond}`);

    await page.getByRole('button', { name: /^Suspend$/i }).click();
    await page.waitForURL(/\/qbank\/1\/previous-tests\?step=1/);
    assert(tutorLifecycleStatus === 'suspended', 'Tutor Suspend did not persist suspended status');
    assert(
      Number(tutorSuspendBody?.totalTimeSpentSeconds) >= 1,
      `Tutor Suspend did not send elapsed session time: ${JSON.stringify(tutorSuspendBody)}`,
    );
    await page.getByText('AMBOSS tutor lifecycle smoke', { exact: true }).waitFor();

    const tutorRow = page.getByRole('row').filter({ hasText: 'AMBOSS tutor lifecycle smoke' });
    await tutorRow.getByRole('link', { name: 'Open' }).click();
    await page.waitForURL(/\/test\/9003/);
    await page.getByRole('button', { name: /Resume block/i }).waitFor();
    assert((await page.locator('.amboss-primary-timer.is-paused').count()) === 1, 'Suspended Tutor timer was not paused');

    await page.getByRole('button', { name: /Resume block/i }).click();
    await page.getByRole('button', { name: /^Suspend$/i }).waitFor();
    const resumedFirst = (await tutorTopTimer.textContent())?.trim();
    await page.waitForTimeout(1150);
    const resumedSecond = (await tutorTopTimer.textContent())?.trim();
    assert(
      timerTextToSeconds(resumedSecond) > timerTextToSeconds(resumedFirst),
      `Tutor timer did not continue after Resume: ${resumedFirst} → ${resumedSecond}`,
    );

    await page.getByRole('button', { name: /^End Block$/i }).click();
    const tutorEndDialog = page.locator('.amboss-end-block-dialog');
    await tutorEndDialog.getByText('Session time', { exact: true }).waitFor();
    await tutorEndDialog.getByRole('button', { name: /End block now/i }).click();
    await page.getByRole('button', { name: /AI Summary/i }).waitFor();
    assert(tutorLifecycleStatus === 'completed', 'Tutor End Block did not complete the test');
    assert(
      Number(tutorCompleteBody?.totalTimeSpentSeconds) >= Number(tutorSuspendBody?.totalTimeSpentSeconds),
      'Tutor End Block lost elapsed time accumulated before Suspend/Resume',
    );

    await page.screenshot({ path: `${outDir}/amboss-tutor-lifecycle.png`, fullPage: true });
    await context.close();
  }

  {
    timedStatus = 'in_progress';
    timedTimeSpentSeconds = 0;
    timedStartedAt = new Date().toISOString();
    timedDrafts.clear();
    timedBatchBody = null;
    timedSelectionSaves = 0;
    timedHighlightSaves = 0;
    timedAiSummaryCalls = 0;

    const { context, page } = await preparePage(browser, { width: 1440, height: 1000 });
    await page.goto(`${baseUrl}/test/9002`, { waitUntil: 'networkidle' });
    await page.getByText('70% ethanol').waitFor();

    assert((await page.getByRole('button', { name: /AI Summary/i }).count()) === 0, 'AI Summary leaked into active Timed block');

    const topTimer = page.locator('.amboss-primary-timer strong');
    const sideTimer = page.locator('.amboss-sidebar-time strong');
    const firstTopTimer = (await topTimer.textContent())?.trim();
    const firstSideTimer = (await sideTimer.textContent())?.trim();
    assert(/^0[45]:\d{2}$/.test(firstTopTimer || ''), `Timed top countdown did not start near 05:00: ${firstTopTimer}`);
    assert(firstTopTimer === firstSideTimer, `Top/sidebar timers are not synchronized: ${firstTopTimer} vs ${firstSideTimer}`);

    await page.waitForTimeout(1150);
    const secondTopTimer = (await topTimer.textContent())?.trim();
    const secondSideTimer = (await sideTimer.textContent())?.trim();
    assert(
      timerTextToSeconds(secondTopTimer) < timerTextToSeconds(firstTopTimer),
      `Timed counter did not count down: ${firstTopTimer} → ${secondTopTimer}`,
    );
    assert(secondTopTimer === secondSideTimer, `Timed top/sidebar drifted after ticking: ${secondTopTimer} vs ${secondSideTimer}`);

    const timedRows = page.locator('.amboss-option');
    await timedRows.nth(0).click();
    await page.waitForTimeout(120);
    assert(timedSelectionSaves >= 1, 'Timed option click did not autosave a draft');
    assert(await timedRows.nth(0).evaluate((node) => node.classList.contains('is-selected')), 'Timed selected option did not turn blue');
    assert(!await timedRows.nth(0).evaluate((node) => node.classList.contains('is-correct')), 'Timed selection leaked correct styling');
    assert(!await timedRows.nth(0).evaluate((node) => node.classList.contains('is-incorrect')), 'Timed selection leaked incorrect styling');
    assert((await page.locator('.amboss-option-explanation').count()) === 0, 'Timed selection leaked an explanation');

    await page.getByRole('button', { name: /NEXT/i }).click();
    await page.getByText(/AMBOSS sample question 2/i).waitFor();
    await page.getByRole('button', { name: /PREVIOUS/i }).click();
    await page.getByText('70% ethanol').waitFor();
    assert(await page.locator('.amboss-option').nth(0).evaluate((node) => node.classList.contains('is-selected')), 'Timed selection was lost across navigation');

    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('70% ethanol').waitFor();
    assert(await page.locator('.amboss-option').nth(0).evaluate((node) => node.classList.contains('is-selected')), 'Timed draft was not restored after reload');

    await page.getByRole('button', { name: /^Tools$/i }).click();
    await page.getByRole('button', { name: /^Marker Purple$/i }).click();
    await page.getByRole('button', { name: /^Tools$/i }).click();
    await page.locator('.amboss-stem').selectText();
    await page.locator('.amboss-question-content').dispatchEvent('mouseup');
    await page.waitForTimeout(100);
    assert(timedHighlightSaves >= 1, 'Marker did not persist through the dedicated highlights endpoint');
    const userMarker = page.locator('mark[data-medpark-marker="1"]').first();
    await userMarker.waitFor();
    assert(
      (await userMarker.evaluate((node) => node.style.getPropertyValue('--amboss-marker-color').trim().toLowerCase())) === '#9b7be5',
      'Marker did not persist the selected purple color',
    );
    const lightMarkerBackground = await userMarker.evaluate((node) => getComputedStyle(node).backgroundColor);

    await page.getByRole('button', { name: /^Settings$/i }).click();
    await page.getByRole('button', { name: /^Dark$/i }).click();
    assert(await page.locator('.amboss-runner').getAttribute('data-appearance') === 'dark', 'Settings did not switch AMBOSS appearance');
    const darkMarkerBackground = await userMarker.evaluate((node) => getComputedStyle(node).backgroundColor);
    assert(
      darkMarkerBackground !== lightMarkerBackground,
      `Dark marker contrast treatment did not change: ${lightMarkerBackground}`,
    );

    await page.getByRole('button', { name: /^Settings$/i }).click();
    await page.getByRole('button', { name: /^Tools$/i }).click();
    await page.getByRole('button', { name: /^Pencil Green$/i }).click();
    assert((await page.locator('.amboss-pencil-canvas.is-active').count()) === 1, 'Pencil did not activate from the color palette');
    const activeSwatch = page.locator('.amboss-active-tool-swatch');
    assert(
      (await activeSwatch.evaluate((node) => node.style.getPropertyValue('--amboss-active-tool-color').trim().toLowerCase())) === '#63c174',
      'Selected Pencil color was not reflected in the active tool control',
    );
    await page.getByRole('button', { name: /^Tools$/i }).click();

    await page.getByRole('button', { name: /^Calculator$/i }).click();
    await page.getByRole('button', { name: /^2$/ }).click();
    await page.getByRole('button', { name: /^\+$/ }).click();
    await page.getByRole('button', { name: /^3$/ }).click();
    await page.getByRole('button', { name: /^=$/ }).click();
    assert((await page.locator('.amboss-calculator-display').textContent())?.trim() === '5', 'Calculator 2 + 3 did not equal 5');

    await page.getByRole('button', { name: /^End Block$/i }).click();
    await page.getByRole('heading', { name: /End this block/i }).waitFor();
    const endBlockDialog = page.locator('.amboss-end-block-dialog');
    await endBlockDialog.getByText('Answered', { exact: true }).waitFor();
    await endBlockDialog.getByText('Unanswered', { exact: true }).waitFor();
    await page.getByRole('button', { name: /End block now/i }).click();
    await page.getByRole('button', { name: /AI Summary/i }).waitFor();
    assert(timedBatchBody?.complete === true, 'End Block did not use complete=true batch submission');
    assert(Array.isArray(timedBatchBody?.answers) && timedBatchBody.answers.length === 5, 'End Block did not submit the full question set');
    assert(timedStatus === 'completed', 'End Block did not complete the timed test');

    await page.getByRole('button', { name: /AI Summary/i }).click();
    await page.getByText('AI review summary for the completed timed question.').waitFor();
    assert(timedAiSummaryCalls === 1, 'AI Summary did not call the review-only AI endpoint');

    await page.screenshot({ path: `${outDir}/amboss-timed-toolbar.png`, fullPage: true });
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
    await page.getByText('LAB VALUES', { exact: true }).waitFor();
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

  console.log('AMBOSS_BROWSER_SMOKE_OK desktop=true ipad=true mobile=true clue=true hint=true labs=true notes=true mark=true first_answer_submit=true post_submit_inline=true show_all=true omitted=true blob_explanations=true last_option_explanation=true internal_library_link=true library_split=true library_new_tab=true timed_create_duration=true timed_timer_ticks=true tutor_timer_ticks=true tutor_suspend_navigation=true tutor_end_block=true marker_palette=true marker_dark_contrast=true pencil_palette=true');
} finally {
  await browser.close();
}

// PR14 browser-smoke retrigger
