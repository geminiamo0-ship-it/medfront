import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseUrl = 'http://127.0.0.1:4173';
const outDir = 'amboss-browser-artifacts';
await fs.mkdir(outDir, { recursive: true });

const serumMarkerTable = `
<div class="modal-overflow-scroll" data-medical-fixture="prenatal"><table>
<thead><tr><th scope="col"></th><th scope="col">α-Fetoprotein (AFP)</th><th scope="col">Estriol</th><th scope="col">β-Human chorionic gonadotropin (HCG)</th><th scope="col">Inhibin A</th></tr></thead>
<tbody>
<tr><th scope="row">A</th><td>↓</td><td>↓</td><td>↓</td><td>normal</td></tr>
<tr><th scope="row">B</th><td>↓</td><td>↓</td><td>↑</td><td>↑</td></tr>
<tr><th scope="row">C</th><td>Normal</td><td>normal</td><td>normal</td><td>normal</td></tr>
<tr><th scope="row">D</th><td>↓</td><td>↓</td><td>↓</td><td>↓</td></tr>
<tr><th scope="row">E</th><td>↑</td><td>normal</td><td>normal</td><td>normal</td></tr>
</tbody></table></div>`;
const hemoglobinTable = '<table data-medical-fixture="hemoglobin"><thead><tr><th scope="col">Measurement</th><th scope="col">Value</th><th scope="col">Reference range</th></tr></thead><tbody><tr><th scope="row">Hemoglobin</th><td>8.4 g/dL</td><td>12–16 g/dL</td></tr><tr><th scope="row">Platelets</th><td>125 × 10³/µL</td><td>150–400 × 10³/µL</td></tr></tbody></table>';
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
</div>
<img data-exam-image="stem" src="https://pub-2a81f2cb19cc4473a3d076e657af6121.r2.dev/offline_media/big_5b2d50b498902.jpg"
 width="180" height="120" alt="Subarachnoid hemorrhage in the basal cisterns"
 data-overlay-src="offline_media/5b2d50b498902.jpg"
 data-description="&lt;p&gt;CT head (without contrast; axial plane)&lt;/p&gt;&lt;p&gt;Hyperdensity (green overlay) in the basal cisterns indicates the presence of subarachnoid hemorrhage.&lt;/p&gt;">
<span data-global-media-src="https://storage.blablabl234a.online/offline_media/legacy-image.jpg"
      data-unrelated-url="https://example.com/outside.png">media origin test</span>
<img data-relative-media-test="stem" src="offline_media/ihg_681237c83e6287_31701899.jpg" width="1" height="1" alt="Imported stem illustration">
<img data-missing-image="true" src="offline_media/browser-missing-media.jpg" width="100" height="60" alt="Missing image">
${serumMarkerTable}`;

const options = [
  { id: 101, displayOrder: 'A', textHtml: '<p>Hepatitis A virus <span data-option-media-src="https://storage-public.medpark.io/offline_media/option.png"></span><img data-relative-media-test="option" src="./offline_media/option-relative.png" width="36" height="25" alt="Imported option illustration"></p>' },
  { id: 102, displayOrder: 'B', textHtml: '<p>Parvovirus</p>' + hemoglobinTable },
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
    articleId: displayOrder === 1 ? 2583 : undefined,
    libraryName: displayOrder === 1 ? 'amboss' : undefined,
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
let tutorPersistedTimeSpentSeconds = 0;

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
let timedReviewExplanationFetches = 0;
let libraryArticleFetches = 0;
let createdArticleTestBody = null;
let repeatRequestSourceId = null;
const longLibrarySection = Array(20).fill('<p>Reference detail for scrolling and centering an AMBOSS article section.</p>').join('');

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
        ? ' <a href="https://www.amboss.com/us/library#xid=SM0yLg&anker=Zc00dca4994157e86d8e6e8ee9510443f" data-learningcard-id="SM0yLg" data-anker="Zc00dca4994157e86d8e6e8ee9510443f" data-description="&lt;p&gt;Reference about edema&lt;/p&gt;">edema</a> <span class="api" data-learningcard-id="SM0yLg" data-anker="Ztreatment" data-description="&lt;p&gt;Treatment of edema&lt;/p&gt;">treatment</span>'
        : '';
    const illustration = option.displayOrder === "B" ? '<img data-exam-image="explanation" src="offline_media/answer-image.jpg" width="155" height="115" alt="Explanation illustration" data-description="&lt;p&gt;Detailed option explanation image.&lt;/p&gt;">' : '';
    const explanationTable = option.displayOrder === 'B' ? hemoglobinTable : '';
    return `<div><b>${option.displayOrder.toLowerCase()} (${state}):</b><br><p>Blob explanation for option ${option.displayOrder} on question ${question.id}.${libraryLink}${illustration}</p>${explanationTable}</div>`;
  });

  parts.push(
    '<br><div class="amboss-learning-obj"><b>Key Info:</b><br>Blob learning objective.</div>',
  );

  return parts.join('<br>');
}

function decoratedTestState() {
  const body = structuredClone(testState);
  body.timeSpentSeconds = tutorPersistedTimeSpentSeconds;
  body.timerElapsedSeconds = tutorPersistedTimeSpentSeconds;
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
      timeSpentSeconds: Number(submission.timeSpentSeconds || 0),
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
    // Intentionally omit a usable startedAt in browser smoke. The live
    // display must advance from the server timer snapshot, not client date parsing.
    startedAt: null,
    timerElapsedSeconds:
      timedTimeSpentSeconds +
      (timedStatus === 'in_progress'
        ? Math.max(0, Math.floor((Date.now() - new Date(timedStartedAt).getTime()) / 1000))
        : 0),
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
    question.userAnswer = selectedOptionId != null
      ? {
          selectedOptionId,
          isCorrect,
          timeSpentSeconds: 1,
          answerChanges: 0,
        }
      : null;
    question.isAnswered = selectedOptionId != null;
    question.isOmitted = selectedOptionId == null;
    question.status = selectedOptionId == null ? 'omitted' : 'answered';
    // Keep one untouched Omitted question explanation-lazy so completed
    // review must fetch on option inspection instead of relying on preload.
    question.explanationHtml =
      question.id === 3002 && selectedOptionId == null
        ? ''
        : ambossExplanationBlob(question);
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
  body.startedAt = null;
  body.timerElapsedSeconds = tutorLifecycleTimeSpentSeconds;
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
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.filters?.articleId !== undefined) {
        createdArticleTestBody = body;
        return json(route, { id: 9004 }, 201);
      }
      createdTimedBody = body;
      return json(route, { id: 9002 }, 201);
    }

    if ((path === '/tests' || path === '/tests/previous-tests-summary') && method === 'GET') {
      const now = new Date().toISOString();
      const items = [
        {
          id: 9006,
          title: 'System: Cardiology · Topic: Cardiac physiology · Topic: Valve disorders and coronary disease',
          type: 'tutor', mode: 'unused', step: 1, status: 'completed',
          totalQuestions: 40, answeredQuestions: 1, correctAnswers: 1, percentageScore: '2.5',
          startedAt: now, completedAt: now, createdAt: now,
        },
        {
          id: 9007, title: 'Custom IDs — internal test provenance not supplied',
          type: 'timed', mode: 'all', step: 1, status: 'in_progress',
          totalQuestions: 12, answeredQuestions: 0, correctAnswers: 0, percentageScore: '0',
          startedAt: now, completedAt: null, createdAt: now,
        },
        {
          id: 9008, title: 'Suspended clinical practice',
          type: 'tutor', mode: 'unused', step: 1, status: 'suspended',
          totalQuestions: 5, answeredQuestions: 2, correctAnswers: 1, percentageScore: '50',
          startedAt: now, completedAt: null, createdAt: now,
        },
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
      ];
      if (path === '/tests') return json(route, items);
      const projected = items.map((item) => ({
        ...item,
        questionPoolLabel: item.id === 9007 || item.mode === 'all' ? null : 'Unused',
        selectedSystemNames: item.id === 9006 ? ['Cardiology'] : [],
        selectedTopicNames: item.id === 9006 ? ['Cardiac physiology', 'Valve disorders'] : [],
        mixedPoolModes: [],
      }));
      return json(route, {
        page: Number(url.searchParams.get('page') || 1),
        pageSize: 50,
        hasMore: false,
        items: Number(url.searchParams.get('page') || 1) === 1 ? projected : [],
      });
    }

    const repeatMatch = path.match(new RegExp('^/tests/([0-9]+)/repeat$'));
    if (repeatMatch && method === 'POST') {
      repeatRequestSourceId = Number(repeatMatch[1]);
      return json(route, { id: 9004 }, 201);
    }

    if (path === '/tests/9001' && method === 'GET') {
      return json(route, decoratedTestState());
    }

    // Successful article Create Test must LOAD the real AMBOSS Exam Runner.
    // A URL-only assertion would miss the catch-all route redirect to /hub.
    if (path === '/tests/9004' && method === 'GET') {
      return json(route, {
        ...structuredClone(testState),
        id: 9004,
        title: 'Edema Practice',
        questions: [makeQuestion(2001, 1, 'hard')],
        totalQuestions: 1,
        resumeQuestionId: 2001,
        resumeDisplayOrder: 1,
      });
    }

    // Results V1 visual-regression fixture: 1 correct / 40, 39 omitted.
    if (path === '/tests/9005/results' && method === 'GET') {
      return json(route, {
        test: {
          id: 9005, title: 'Amboss (Step 1) — unused', type: 'tutor', status: 'completed',
          step: 1, totalQuestions: 40, answeredQuestions: 1, correctAnswers: 1,
          timeSpentSeconds: 2, percentageScore: 2.5, filters: { questionBankIds: [1] },
        },
        analytics: {
          overall: {
            totalQuestions: 40, answeredQuestions: 1, correctAnswers: 1,
            percentageScore: 2.5, timeSpentSeconds: 2, averageTimePerQuestion: 2,
          },
          sessionBreakdown: {
            totalQuestions: 40, answeredQuestions: 1, correctQuestions: 1,
            incorrectQuestions: 0, omittedQuestions: 39,
            byDifficultyTier: [
              { key: 'very_easy', total: 9, correct: 1, incorrect: 0, omitted: 8 },
              { key: 'easy', total: 10, correct: 0, incorrect: 0, omitted: 10 },
              { key: 'medium', total: 13, correct: 0, incorrect: 0, omitted: 13 },
              { key: 'hard', total: 7, correct: 0, incorrect: 0, omitted: 7 },
              { key: 'very_hard', total: 1, correct: 0, incorrect: 0, omitted: 1 },
            ],
            studyRecommendations: [],
          },
        },
      });
    }
    if ((path === '/tests/9002/results' || path === '/tests/9003/results') && method === 'GET') {
      const isTimed = path.includes('9002');
      const test = isTimed ? timedTestPayload() : tutorLifecyclePayload();
      const total = test.questions.length;
      const answered = isTimed ? Number(test.answeredQuestions) : 0;
      const correct = isTimed ? Number(test.correctAnswers) : 0;
      const omitted = total - answered;
      return json(route, {
        test: { ...test, filters: { questionBankIds: [1] } },
        analytics: {
          overall: {
            totalQuestions: total, answeredQuestions: answered,
            correctAnswers: correct, percentageScore: total ? correct * 100 / total : 0,
            timeSpentSeconds: test.timeSpentSeconds,
            averageTimePerQuestion: answered ? test.timeSpentSeconds / answered : 0,
          },
          sessionBreakdown: {
            totalQuestions: total, answeredQuestions: answered,
            correctQuestions: correct, incorrectQuestions: answered - correct,
            omittedQuestions: omitted,
            byDifficultyTier: [
              { key: 'easy', total: 1, correct: 1, incorrect: 0, omitted: 0 },
              { key: 'medium', total: 2, correct: 0, incorrect: 1, omitted: 1 },
              { key: 'hard', total: total - 3, correct: 0, incorrect: 0, omitted: total - 3 },
            ],
            studyRecommendations: [
              { topicId: 17, name: 'Cardiac physiology', correct: 1, total: 3, incorrect: 2, omitted: 0 },
            ],
          },
        },
      });
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

    const timedExplanationMatch = path.match(/^\/tests\/9002\/questions\/(\d+)\/explanation$/);
    if (timedExplanationMatch && method === 'GET') {
      const questionId = Number(timedExplanationMatch[1]);
      const question = timedQuestions.find((item) => item.id === questionId);
      if (!question) return json(route, { message: 'Unknown timed smoke question' }, 404);
      timedReviewExplanationFetches += 1;
      return json(route, explanationPayload(question));
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

    if ((path === '/library/article/SM0yLg' || path === '/library/article/2583') && method === 'GET') {
      libraryArticleFetches += 1;
      return json(route, {
        id: 2583,
        name: 'Edema',
        title: 'Edema',
        source: 'amboss',
        externalId: 'SM0yLg',
        contentHtml:
          '<div id="Zc00dca4994157e86d8e6e8ee9510443f"><h2>Edema</h2><p>Internal AMBOSS article smoke</p><img class="pm-img" src="offline_media/library-image.jpg" title="Library image example" data-overlay-src="offline_media/library-overlay.jpg" data-description="&lt;p&gt;Library image description&lt;/p&gt;" /></div>' + longLibrarySection + '<span data-type="anker" id="Ztreatment"></span><h2>Treatment</h2><p>Section treatment body with <strong id="Zword">ubiquitinated proteins</strong> and precise anchor.</p>' + longLibrarySection + '<h2>Complications</h2><p>Further reference section</p>',
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

      const submittedTimeSpentSeconds = Math.max(0, Number(data.timeSpentSeconds || 0));
      submitBodies.push(data);
      submittedByQuestion.set(question.id, {
        selectedOptionId,
        isCorrect,
        timeSpentSeconds: submittedTimeSpentSeconds,
      });
      tutorPersistedTimeSpentSeconds += submittedTimeSpentSeconds;

      return json(route, {
        submission: {
          selectedOptionId,
          isCorrect,
          correctOptionId,
          timeSpentSeconds: submittedTimeSpentSeconds,
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
  // Network is intentionally mocked here: this confirms URL rendering,
  // not whether the user's actual R2 objects are uploaded or publicly accessible.
  await context.route('https://pub-2a81f2cb19cc4473a3d076e657af6121.r2.dev/offline_media/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/gif',
      body: Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64'),
    }),
  );
  await context.route(
    'https://pub-2a81f2cb19cc4473a3d076e657af6121.r2.dev/offline_media/browser-missing-media.jpg',
    (route) => route.fulfill({ status:404, contentType:'text/plain', body:'Not found' }),
  );
  await installApiMocks(context);
  const page = await context.newPage();
  return { context, page };
}

const browser = await chromium.launch({ headless: true });

try {
  {
    const { context, page } = await preparePage(browser, { width: 1440, height: 1000 });
    await page.goto(`${baseUrl}/test/9001`, { waitUntil: 'networkidle' });

    await page.locator('.amboss-stem').getByText('70% ethanol').waitFor();

    // Global media migration: the same API adapter handles nested question
    // stems and option HTML; unrelated external URLs are untouched.
    assert(
      await page.locator('[data-global-media-src]').getAttribute('data-global-media-src') ===
        'https://pub-2a81f2cb19cc4473a3d076e657af6121.r2.dev/offline_media/legacy-image.jpg',
      'Legacy image URL in question stem was not replaced globally',
    );
    assert(
      await page.locator('[data-option-media-src]').getAttribute('data-option-media-src') ===
        'https://pub-2a81f2cb19cc4473a3d076e657af6121.r2.dev/offline_media/option.png',
      'Second legacy storage host in option HTML was not migrated',
    );
    assert(
      await page.locator('[data-unrelated-url]').getAttribute('data-unrelated-url') ===
        'https://example.com/outside.png',
      'Unrelated third-party URLs were incorrectly changed',
    );

    // Regression for imported src="offline_media/..." / "./offline_media/...".
    for (const [kind, key] of [
      ['stem', 'ihg_681237c83e6287_31701899.jpg'],
      ['option', 'option-relative.png'],
    ]) {
      const img = page.locator('img[data-relative-media-test="' + kind + '"]');
      assert(
        await img.getAttribute('src') ===
          'https://pub-2a81f2cb19cc4473a3d076e657af6121.r2.dev/offline_media/' + key,
        'Relative ' + kind + ' image did not resolve to global R2 URL',
      );
      assert(
        await img.evaluate((node) => node.complete && node.naturalWidth === 1),
        'Relative ' + kind + ' image failed to decode from mocked canonical R2',
      );
    }

    // Reproduce the user's real prenatal AFP/Estriol/HCG/Inhibin table.
    // Preserve native rows/scoped columns and prove table cells do not overlap.
    const serumFrame = page.locator('.amboss-stem [data-medical-fixture="prenatal"]');
    const serumGrid = serumFrame.locator('table');
    assert((await serumFrame.locator('.amboss-table-scroll').count()) === 0,
      'Existing imported table scroll wrapper was nested by the rendering adapter');
    assert((await serumFrame.getAttribute('class')).includes('amboss-table-scroll'),
      'Imported modal-overflow-scroll was not reused as medical table frame');
    assert((await serumGrid.locator('thead th').count()) === 5 && (await serumGrid.locator('tbody tr').count()) === 5,
      'Prenatal marker table lost semantic headers or row count');
    assert((await serumGrid.locator('thead th').allTextContents()).join('|') ===
      '|α-Fetoprotein (AFP)|Estriol|β-Human chorionic gonadotropin (HCG)|Inhibin A',
      'Prenatal marker column labels changed');
    assert((await serumGrid.locator('thead th[scope="col"]').count()) === 5 &&
      (await serumGrid.locator('tbody th[scope="row"]').count()) === 5,
      'Imported table lost accessible header scopes');
    assert((await serumGrid.locator('tbody tr').nth(1).locator('td').allTextContents()).join('|') === '↓|↓|↑|↑',
      'Prenatal marker choice B values / arrows were changed');
    const serumMetrics = await serumGrid.evaluate((table) => {
      const cells = [...table.querySelectorAll('thead th')];
      return {
        tableDisplay:getComputedStyle(table).display,
        borderRight:getComputedStyle(cells[1]).borderRightWidth,
        padding:getComputedStyle(cells[1]).paddingLeft,
        positions:cells.map((cell) => ({ left:cell.getBoundingClientRect().left, right:cell.getBoundingClientRect().right })),
        headerBackground:getComputedStyle(cells[1]).backgroundColor,
        tbodyBackground:getComputedStyle(table.querySelector('tbody tr:nth-child(2) td')).backgroundColor,
      };
    });
    assert(serumMetrics.tableDisplay === 'table', 'Imported source table still has display:block');
    assert(parseFloat(serumMetrics.borderRight) >= 1 && parseFloat(serumMetrics.padding) >= 8,
      'Semantic table lacks visible grid or legible padding: ' + JSON.stringify(serumMetrics));
    assert(serumMetrics.positions.every((rect, index) =>
      index === 0 || rect.left >= serumMetrics.positions[index - 1].right - 1),
      'Prenatal marker header cells overlap: ' + JSON.stringify(serumMetrics.positions));
    const hemoglobinFrame = page.locator('.amboss-option-text .amboss-table-scroll');
    assert((await hemoglobinFrame.count()) === 1 && (await hemoglobinFrame.locator('> table').count()) === 1,
      'Bare numeric/lab table did not get exactly one scroll wrapper');
    await hemoglobinFrame.getByText('8.4 g/dL').waitFor();
    assert((await hemoglobinFrame.locator('th[scope="row"]').count()) === 2,
      'Numeric lab row headers were lost');
    // Images appended after the source paragraph must still occupy the
    // approved right-side thumbnail rail alongside the stem text.
    const rightRail = page.locator('.amboss-stem-image-rail');
    assert((await rightRail.locator('img').count()) >= 2, 'Stem images were not collected into the sidebar rail');
    const railRect = await rightRail.boundingBox();
    const stemRect = await page.locator('.amboss-stem').boundingBox();
    assert(railRect && stemRect && railRect.y < stemRect.y + 35,
      'Trailing stem images rendered beneath the question instead of beside its heading');

    // A missing actual object should never leave a broken browser image icon.
    await page.locator('.amboss-exam-image-fallback').first().waitFor();
    assert((await page.locator('img[data-missing-image="true"]').isVisible()) === false,
      'Broken imported image was not replaced by a readable placeholder');

    // Approved shared AMBOSS Library Image Viewer: pre-answer overlay is an
    // opt-in hint; Description is not visible in the viewer until reveal.
    const stemImage = page.locator('img[data-exam-image="stem"]');
    await stemImage.click();
    const viewer = page.getByRole('dialog', { name: 'Medical Illustration' });
    await viewer.waitFor();
    assert((await viewer.locator('#aiv-title').innerText()).trim() === 'Medical Illustration',
      'Tutor pre-answer viewer exposed image diagnosis in the title');
    assert((await viewer.getByText('Subarachnoid hemorrhage in the basal cisterns', { exact:true }).count()) === 0,
      'Tutor pre-answer viewer exposed imported diagnostic title');
    assert((await viewer.getByText(/Hyperdensity \(green overlay\)/).count()) === 0,
      'Tutor viewer leaked clinical Description before first answer');
    assert((await viewer.locator('#aiv-overlay').count()) === 0, 'Overlay appeared without consent');
    await viewer.getByRole('button', { name: 'SHOW OVERLAY' }).click();
    assert((await viewer.locator('#aiv-overlay').count()) === 1, 'Optional overlay did not appear');
    await viewer.locator('#aiv-overlay').evaluate((image) => image.decode());
    assert(await viewer.locator('#aiv-overlay').evaluate((image) => image.complete && image.naturalWidth > 0),
      'Overlay IMG element exists but its bitmap did not load/decode');
    assert((await viewer.locator('#aiv-overlay').getAttribute('src')) ===
      'https://pub-2a81f2cb19cc4473a3d076e657af6121.r2.dev/offline_media/5b2d50b498902.jpg',
      'Relative overlay source lost R2 origin');
    await viewer.getByRole('button', { name: 'Zoom In' }).click();
    const imageZoom = await viewer.locator('#aiv-img').evaluate((node) => getComputedStyle(node).transform);
    const overlayZoom = await viewer.locator('#aiv-overlay').evaluate((node) => getComputedStyle(node).transform);
    assert(imageZoom === overlayZoom, 'Overlay and original image zoom became unsynchronized');
    await viewer.getByRole('button', { name: 'HIDE OVERLAY' }).click();
    assert((await viewer.locator('#aiv-overlay').count()) === 0, 'Hide Overlay did not hide layer');
    await page.keyboard.press('Escape');
    assert((await page.getByRole('dialog').count()) === 0, 'ESC did not close the shared Viewer');
    assert(submitBodies.length === 0, 'Viewing stem image submitted an answer');

    // Clicking an image embedded in a clickable option must never select it.
    const optionImage = page.locator('img[data-relative-media-test="option"]').first();
    await optionImage.click();
    await page.getByRole('dialog').waitFor();
    assert((await page.getByRole('button', { name:'SHOW OVERLAY' }).count()) === 0,
      'A no-overlay image should not show the overlay toggle');
    await page.getByRole('button', { name:'Close image viewer' }).click();
    assert(submitBodies.length === 0, 'Clicking an option illustration submitted an answer');

    await page.screenshot({ path: `${outDir}/amboss-desktop-baseline.png`, fullPage: true });
    assert((await page.locator('.amboss-sidebar.is-open').count()) === 1, 'Desktop sidebar should start open');
    assert((await page.locator('input[placeholder="Find AMBOSS content"]').count()) === 0, 'Removed AMBOSS search field reappeared');
    const questionRows = page.locator('.amboss-question-row');
    assert((await questionRows.count()) === 5, 'Sidebar lost question navigation rows');
    assert((await questionRows.nth(0).locator('.amboss-question-title').textContent() || '').startsWith('The occupational health department'), 'Sidebar is not displaying the real first question stem');
    assert((await questionRows.nth(1).locator('.amboss-question-title').textContent() || '').includes('AMBOSS sample question 2'), 'Inactive question row has no stem preview');
    assert((await page.locator('.amboss-sidebar-progress').getAttribute('aria-valuenow')) === '0', 'Initial sidebar question progress should be zero');
    assert((await page.locator('.amboss-sidebar-timer-cell').count()) === 2, 'Sidebar does not expose SESSION and QUESTION clocks');
    assert((await page.getByRole('button', { name: 'EXIT SESSION' }).count()) === 1, 'Sidebar Exit Session action is missing');

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
    assert((await page.locator('.amboss-tools').getByRole('button', { name: /^MARKED$/i }).count()) === 1, 'Marked UI state did not update');

    const answerRows = page.locator('.amboss-option');
    const tutorTopTimer = page.locator('.amboss-primary-timer strong');

    // Unanswered Tutor questions actively count solving time.
    const tutorBeforeSubmit = (await tutorTopTimer.textContent())?.trim();
    await page.waitForTimeout(1150);
    const tutorBeforeSubmitLater = (await tutorTopTimer.textContent())?.trim();
    assert(
      timerTextToSeconds(tutorBeforeSubmitLater) > timerTextToSeconds(tutorBeforeSubmit),
      `Tutor solving clock did not advance before first answer: ${tutorBeforeSubmit} → ${tutorBeforeSubmitLater}`,
    );

    // First option click is the ONLY persisted Tutor answer and immediately
    // pauses the solving clock before explanation/review time begins.
    await answerRows.nth(1).click(); // B = wrong
    await answerRows.nth(1).locator('.amboss-option-explanation').waitFor();
    const explanationTable = answerRows.nth(1).locator('.amboss-option-explanation .amboss-table-scroll > table');
    await explanationTable.waitFor();
    assert((await explanationTable.locator('tbody tr').count()) === 2 &&
      (await explanationTable.getByText('8.4 g/dL').count()) === 1,
      'Revealed explanation numeric table lost rows or original values');

    await answerRows.nth(1).getByText(/Blob explanation for option B/i).waitFor();
    assert(submitBodies.length === 1, `Expected exactly one submit after first click, got ${submitBodies.length}`);
    assert(submitBodies[0].questionId === 2001, 'First submit used the wrong question');
    assert(submitBodies[0].selectedOptionId === 113, 'First submit did not persist option B');
    assert(
      Number(submitBodies[0].timeSpentSeconds) >= 1,
      `Tutor submit did not include active solving delta: ${JSON.stringify(submitBodies[0])}`,
    );
    assert(await answerRows.nth(1).evaluate((node) => node.classList.contains('is-incorrect')), 'First wrong answer did not turn red');
    assert((await page.locator('.amboss-option-explanation').count()) === 1, 'Only the first clicked explanation should open initially');

    // Tutor first-answer reveal unlocks the existing sanitized description.
    await page.locator('img[data-exam-image="stem"]').click();
    const revealedViewer = page.getByRole('dialog', { name: /Subarachnoid hemorrhage/i });
    assert((await revealedViewer.locator('#aiv-title').innerText()).includes('Subarachnoid hemorrhage'),
      'Tutor revealed image title did not restore imported diagnosis');
    await revealedViewer.getByText(/Hyperdensity \(green overlay\)/).waitFor();
    assert((await revealedViewer.getByText(/CT head \(without contrast; axial plane\)/).count()) === 1,
      'Tutor image Description was not rendered after answer');
    await revealedViewer.getByRole('button', { name:'Close image viewer' }).click();
    assert(submitBodies.length === 1, 'Opening a revealed image resubmitted the answer');

    const explanationImage = answerRows.nth(1).locator('img[data-exam-image="explanation"]');
    await explanationImage.waitFor();
    const maxExplanationWidth = await explanationImage.evaluate((node) => node.getBoundingClientRect().width);
    assert(maxExplanationWidth <= 170, 'Explanation thumbnail is too large');
    await explanationImage.click();
    await page.getByRole('dialog').getByText('Detailed option explanation image.').waitFor();
    await page.getByRole('dialog').getByRole('button', { name:'Close image viewer' }).click();
    assert(submitBodies.length === 1, 'Explanation image click incorrectly submitted another answer');

    const tutorPausedAt = (await tutorTopTimer.textContent())?.trim();
    assert((await page.locator('.amboss-primary-timer.is-paused').count()) === 1, 'Tutor clock did not enter paused state after submit');
    await page.waitForTimeout(1150);
    const tutorPausedLater = (await tutorTopTimer.textContent())?.trim();
    assert(
      tutorPausedLater === tutorPausedAt,
      `Tutor explanation time leaked into solving clock: ${tutorPausedAt} → ${tutorPausedLater}`,
    );

    assert((await page.locator('.amboss-main-article-link').count()) === 0,
      'Main Article appeared under an incorrect option before correct explanation was opened');

    // Later clicks are explanation-only: no second submit, but correctness UI opens.
    await answerRows.nth(7).click(); // H = correct and final option
    await answerRows.nth(7).locator('.amboss-option-explanation').waitFor();
    await answerRows.nth(7).getByText(/Blob explanation for option H/i).waitFor();
    assert(submitBodies.length === 1, 'Post-submit option click incorrectly called submit again');
    assert(await answerRows.nth(7).evaluate((node) => node.classList.contains('is-correct')), 'Final correct option did not turn green');
    assert((await page.locator('.amboss-option-explanation').count()) === 2, 'Final option explanation did not open inline');
    const mainSource = answerRows.nth(7).locator('a.amboss-main-article-link');
    await mainSource.waitFor();
    assert((await mainSource.getAttribute('href')) === '/library?source=amboss&article=2583',
      'Correct answer did not use canonical question.articleId for Main Article');
    assert((await answerRows.nth(1).locator('.amboss-main-article-link').count()) === 0,
      'Main Article incorrectly appeared below wrong answer');
    const medicalTerm = answerRows.nth(7).locator('a.amboss-related-term').first();
    assert((await medicalTerm.evaluate((node) => getComputedStyle(node).textDecorationStyle)) === 'dotted',
      'True MedPark Library reference should have dotted underline');
    const inlineTerm = answerRows.nth(7).locator('a.amboss-related-term').filter({ hasText:'treatment' });
    assert((await inlineTerm.count()) === 1, 'Linked AMBOSS span did not become a Library reference');


    // Show All expands every explanation without changing the recorded first answer.
    await page.getByRole('button', { name: /SHOW ALL EXPLANATIONS/i }).click();
    await page.waitForTimeout(100);
    assert((await page.locator('.amboss-option-explanation').count()) === 8, 'SHOW ALL EXPLANATIONS did not open every option');
    assert(submitBodies.length === 1, 'SHOW ALL EXPLANATIONS performed an unexpected submit');

    // Moving to a fresh unanswered question resumes active solving time.
    await page.getByRole('button', { name: /NEXT/i }).click();
    await page.locator('.amboss-stem').getByText(/AMBOSS sample question 2/i).waitFor();
    const secondQuestionStart = (await tutorTopTimer.textContent())?.trim();
    await page.waitForTimeout(1150);
    const secondQuestionRunning = (await tutorTopTimer.textContent())?.trim();
    assert(
      timerTextToSeconds(secondQuestionRunning) > timerTextToSeconds(secondQuestionStart),
      `Tutor clock did not resume on unanswered Q2: ${secondQuestionStart} → ${secondQuestionRunning}`,
    );

    // SHOW ANSWER is also a first submission (omission), so it pauses again.
    await page.getByRole('button', { name: /SHOW ANSWER/i }).click();
    await page.getByRole('button', { name: /HIDE ALL EXPLANATIONS/i }).waitFor();
    assert(submitBodies.length === 2, 'Omission did not create exactly one submit');
    assert(submitBodies[1].questionId === 2002, 'Omission submit used the wrong question');
    assert(submitBodies[1].selectedOptionId === null, 'Omission submit must send selectedOptionId=null');
    assert(
      Number(submitBodies[1].timeSpentSeconds) >= 1,
      `Tutor omission did not include active solving delta: ${JSON.stringify(submitBodies[1])}`,
    );
    assert((await page.locator('.amboss-option-explanation').count()) === 8, 'Omission reveal did not open all explanations');
    assert((await page.locator('.amboss-main-article-link').count()) === 0,
      'A question with no trusted articleId invented a Main Article reference');
    const secondQuestionPaused = (await tutorTopTimer.textContent())?.trim();
    await page.waitForTimeout(1150);
    assert(
      (await tutorTopTimer.textContent())?.trim() === secondQuestionPaused,
      'Tutor clock advanced while reviewing an omitted/revealed question',
    );
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
    await linkMenu.getByText('Reference about edema').waitFor();
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
    await popup.locator('h2#Zc00dca4994157e86d8e6e8ee9510443f').waitFor();
    await popup.locator('h2#Zc00dca4994157e86d8e6e8ee9510443f.amboss-reference-spotlight').waitFor();
    const libraryBeforeRetarget = libraryArticleFetches;
    await popup.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('anchor', 'Ztreatment');
      history.pushState({}, '', url);
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await popup.locator('#Ztreatment').waitFor();
    await popup.locator('h2#Ztreatment.amboss-reference-spotlight').waitFor();
    assert(libraryArticleFetches === libraryBeforeRetarget,
      'Changing anchor inside loaded article unnecessarily refetched entire article');

    // Clicking a section should CENTER its actual heading in the article's
    // scrollable reader, not scroll the outer browser or highlight the card.
    // Smooth scrolling can take longer on busy CI runners; wait for the
    // *same exact* centered position instead of asserting at a fixed 700ms.
    await popup.waitForFunction(() => {
      const heading = document.getElementById('Ztreatment');
      const reader = document.getElementById('ascroll');
      if (!heading || !reader) return false;
      const h = heading.getBoundingClientRect();
      const p = reader.getBoundingClientRect();
      return Math.abs((h.top + h.height / 2) - (p.top + p.height / 2)) < 24;
    }, null, { timeout: 7000 });
    const headingCenter = await popup.evaluate(() => {
      const heading = document.getElementById('Ztreatment');
      const reader = document.getElementById('ascroll');
      const h = heading.getBoundingClientRect();
      const p = reader.getBoundingClientRect();
      return { drift: Math.abs((h.top + h.height/2) - (p.top + p.height/2)),
        canCenter: reader.scrollHeight - reader.clientHeight > 600,
        running: getComputedStyle(heading).animationName,
        wrongCardFlash: !!heading.closest('.amboss-card').querySelector('.amboss-card-header.amboss-reference-spotlight') };
    });
    assert(headingCenter.canCenter && headingCenter.drift < 24,
      'Section heading was not centered inside the Library reader: ' + JSON.stringify(headingCenter));
    assert(headingCenter.running.includes('amboss-anchor-spotlight'), 'Heading lacks two-pulse spotlight animation');
    assert(!headingCenter.wrongCardFlash, 'Navigation flashed the full card instead of actual heading');
    const targetCard = popup.locator('h2#Ztreatment').locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " amboss-card ")][1]');
    await targetCard.evaluate((node) => node.classList.add('collapsed'));
    await popup.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('anchor','Zword');
      history.pushState({}, '', url);
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await popup.locator('#Zword.amboss-reference-spotlight').waitFor();
    assert((await targetCard.evaluate(node => node.classList.contains('collapsed'))) === false,
      'Inline-target link did not expand its collapsed AMBOSS section');
    await popup.waitForTimeout(700);
    const wordCenter = await popup.evaluate(() => {
      const word = document.getElementById('Zword').getBoundingClientRect();
      const reader = document.getElementById('ascroll').getBoundingClientRect();
      return Math.abs((word.top + word.height/2) - (reader.top + reader.height/2));
    });
    assert(wordCenter < 24, 'Inline linked word not centered: drift=' + wordCenter);
    assert((await popup.locator('h2#Ztreatment.amboss-reference-spotlight').count()) === 0,
      'Old heading was still highlighted after moving to another anchor');
    assert(libraryArticleFetches === libraryBeforeRetarget, 'Inline anchor link refetched loaded article');
    // Missing explicit anchor must not highlight a different, similarly named heading.
    await popup.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('anchor','Zmissing');
      history.pushState({}, '', url);
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await popup.waitForTimeout(140);
    assert((await popup.locator('.amboss-reference-spotlight').count()) <= 1,
      'A missing explicit anchor flashed an unrelated section');
    // Restore a concrete link before Library image regression continues.
    await popup.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('anchor','Ztreatment');
      history.pushState({}, '', url);
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await popup.locator('h2#Ztreatment.amboss-reference-spotlight').waitFor();

    await popup.emulateMedia({ reducedMotion:'reduce' });
    await popup.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('anchor','Zword');
      history.pushState({}, '', url);
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await popup.locator('#Zword.amboss-reference-spotlight').waitFor();
    const reduced = await popup.locator('#Zword').evaluate(node =>
      ({ animation:getComputedStyle(node).animationName,
         outline:getComputedStyle(node).outlineStyle }));
    assert(reduced.animation === 'none' && reduced.outline !== 'none',
      'Reduced-motion anchor should show static outline without pulsing: ' + JSON.stringify(reduced));
    await popup.emulateMedia({ reducedMotion:'no-preference' });
    assert(!popup.url().includes('embedded=1'), 'New-tab Library unexpectedly opened in embedded mode');
    // The extracted Viewer must still work unchanged from the original Library.
    await popup.locator('img.pm-img').click();
    const libraryViewer = popup.getByRole('dialog', { name:'Library image example' });
    assert((await libraryViewer.locator('#aiv-title').innerText()) === 'Library image example',
      'Library viewer title was unexpectedly hidden by Exam-only gating');
    await libraryViewer.getByText('Library image description').waitFor();
    await libraryViewer.getByRole('button', { name:'SHOW OVERLAY' }).click();
    assert((await libraryViewer.locator('#aiv-overlay').count()) === 1,
      'Library shared Viewer lost its overlay interaction');
    await libraryViewer.getByRole('button', { name:'Close image viewer' }).click();
    assert((await popup.getByRole('dialog').count()) === 0, 'Library Viewer did not close');
    await popup.close();

    // Split keeps the exam in place and embeds the same Library reader.
    await internalLibraryLink.click();
    await page.getByRole('menuitem', { name: /Open in split view/i }).click();
    const splitPane = page.locator('.amboss-library-split');
    await splitPane.waitFor();
    const libraryFrame = page.frameLocator('.amboss-library-frame');
    await libraryFrame.getByText('Internal AMBOSS article smoke').waitFor();
    await libraryFrame.locator('h2#Zc00dca4994157e86d8e6e8ee9510443f.amboss-reference-spotlight').waitFor();
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

  // Library AMBOSS Create Test button: the article's internal id, not its
  // original external string, must reach the authenticated test endpoint.
  {
    createdArticleTestBody = null;
    const { context, page } = await preparePage(browser, { width: 1440, height: 1000 });
    await page.goto(`${baseUrl}/library?source=amboss&article=SM0yLg`, { waitUntil: 'networkidle' });
    await page.getByText('Internal AMBOSS article smoke').waitFor();
    const createFromArticle = page.getByRole('button', { name: 'Create practice test from article' });
    await createFromArticle.waitFor({ state: 'visible' });
    assert(await createFromArticle.isEnabled(), 'AMBOSS article Create Test button was disabled');
    await createFromArticle.click();
    await page.waitForURL(/\/test\/9004(?:[?#]|$)/, { waitUntil: 'load' });
    await page.locator('.amboss-stem').getByText('70% ethanol').waitFor();
    assert(page.url().endsWith('/test/9004'),
      'Create Test must navigate to the registered /test/:testId route, not /hub');
    assert((await page.locator('.amboss-stem').count()) === 1,
      'Create Test must render the AMBOSS Exam Engine, not the Hub or fallback');
    assert(createdArticleTestBody?.filters?.articleId === 2583,
      'AMBOSS article test did not use canonical internal library article ID');
    assert(createdArticleTestBody?.filters?.questionBankIds?.join(',') === '1',
      'AMBOSS article test did not scope to the correct question bank');
    assert(createdArticleTestBody?.type === 'tutor' && createdArticleTestBody?.mode === 'unused' &&
      createdArticleTestBody?.step === 1,
      'AMBOSS article test did not preserve Tutor / Unused / Step 1 semantics');
    await context.close();
  }

  {
    createdTimedBody = null;
    const { context, page } = await preparePage(browser, { width: 1440, height: 1000 });
    await page.goto(`${baseUrl}/qbank/1/create-test?step=1`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Create Test' }).waitFor();
    const standardNameInput = page.getByRole('textbox', { name: /Test Name/i });
    await standardNameInput.fill('Manual timed practice');
    await page.getByText('Your entered name will be used.').waitFor();

    await page.getByRole('button', { name: /^Timed$/i }).click();
    await page.getByText('Time per question', { exact: true }).waitFor();
    await page.getByRole('button', { name: /^Custom$/i }).last().click();
    const customMinutes = page.getByLabel('Minutes / question');
    await customMinutes.fill('2.5');
    await page.getByText('1h 40m', { exact: true }).waitFor();

    await page.getByRole('button', { name: /^1:30$/ }).click();
    await page.getByText('1h 00m', { exact: true }).waitFor();
    await page.getByRole('button', { name: /^Create Test$/i }).click();
    await page.waitForURL(/\/test\/9002/);
    assert(createdTimedBody?.title === 'Manual timed practice', 'Standard Create Test ignored the optional manual name');
    assert(createdTimedBody?.type === 'timed', 'Create Test did not send type=timed');
    assert(Number(createdTimedBody?.totalQuestions) === 40, 'Create Test did not preserve 40 questions');
    assert(Number(createdTimedBody?.timeLimitSeconds) === 3600, `Expected 40 × 90s = 3600s, got ${createdTimedBody?.timeLimitSeconds}`);
    await context.close();
  }

  // Automatic Test Name must persist actual selected System/Topic names when blank.
  {
    createdTimedBody = null;
    const { context, page } = await preparePage(browser, { width: 1440, height: 1000 });
    await context.route('https://medhvgg-production.up.railway.app/api/tests/metadata/subjects', (route) =>
      json(route, [{ id: 51, name: 'Medicine', displayOrder: 1, questionCount: 100, columnIndex: 0, position: 0 }]));
    await context.route('https://medhvgg-production.up.railway.app/api/tests/metadata/systems-with-topics', (route) =>
      json(route, [{
        id: 52, name: 'Cardiology', questionCount: 100,
        topics: [{ id: 53, name: 'Heart failure', questionCount: 30 }],
      }]));
    await page.goto(baseUrl + '/qbank/1/create-test?step=1', { waitUntil: 'networkidle' });
    await page.getByText('Medicine', { exact: true }).click();
    await page.getByText('Cardiology', { exact: true }).click();
    await page.getByRole('button', { name: 'Show topics' }).click();
    await page.getByText('Heart failure', { exact: true }).click();
    await page.getByText('Automatic name: System: Cardiology · Topic: Heart failure').waitFor();
    await page.getByRole('button', { name: /^Create Test$/i }).click();
    await page.waitForURL((url) => url.pathname === '/test/9002');
    assert(createdTimedBody?.title === 'System: Cardiology · Topic: Heart failure',
      'Automatic name did not persist selected System/Topic names');
    assert(createdTimedBody?.filters?.systemIds?.join(',') === '52' &&
      createdTimedBody?.filters?.topicIds?.join(',') === '53',
      'Automatic title test must not drop authoritative system/topic filters');
    await context.close();
  }

  // Previous Tests V2: accurate desktop table, responsive tablet/mobile cards,
  // full-name disclosure, linked actions, clipboard and long-content overflow.
  for (const device of [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'tablet', width: 834, height: 1194 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const { context, page } = await preparePage(browser, { width: device.width, height: device.height });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(baseUrl + '/qbank/1/previous-tests?step=1', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Previous Tests' }).waitFor();
    const useTable = device.width >= 1280;
    const container = useTable ? page.locator('tbody tr') : page.locator('article');
    const complete = container.filter({ hasText: 'System: Cardiology' });
    await complete.waitFor();
    assert((await complete.getByText('2.5%', { exact: true }).count()) === 1,
      device.name + ': completed percentage must preserve 2.5%, not round to 3%');
    assert((await complete.getByRole('link', { name: 'Results' }).getAttribute('href')) === '/test/9006/results',
      device.name + ': completed row did not link to actual results');
    assert((await complete.getByRole('link', { name: 'Review' }).getAttribute('href')) === '/test/9006',
      device.name + ': completed row did not preserve question review');
    const expanded = complete.getByRole('button', { name: /Show full name/i });
    await expanded.click();
    assert((await complete.getByText('System: Cardiology · Topic: Cardiac physiology · Topic: Valve disorders and coronary disease', { exact:true }).count()) >= 1,
      device.name + ': long names cannot be disclosed');
    await complete.getByRole('button', { name: /Hide full name/i }).press('Escape');
    assert((await complete.getByRole('button', { name: /Show full name/i }).count()) === 1,
      device.name + ': Escape did not close full name details');
    const suspended = container.filter({ hasText: 'Suspended clinical practice' });
    assert((await suspended.getByRole('link', { name: 'Resume' }).getAttribute('href')) === '/test/9008',
      device.name + ': suspended block did not offer Resume');
    const active = container.filter({ hasText: 'Custom IDs — internal test provenance not supplied' });
    assert((await active.getByRole('link', { name: 'Continue' }).getAttribute('href')) === '/test/9007',
      device.name + ': active block did not offer Continue');
    await complete.getByRole('button', { name: /Copy internal test ID/i }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert(copied === '9006', device.name + ': Copy ID did not copy the internal test ID');
    assert((await page.getByRole('status').textContent())?.includes('9006'),
      device.name + ': clipboard success feedback missing');
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert(!overflows, device.name + ': Previous Tests has horizontal viewport overflow');
    await page.screenshot({ path: outDir + '/previous-tests-v2-' + device.name + '.png', fullPage: true });
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
    await page.locator('.amboss-stem').getByText('70% ethanol').waitFor();

    const tutorTopTimer = page.locator('.amboss-primary-timer strong');
    const tutorSideTimer = page.locator('.amboss-sidebar-timer-cell:first-child .amboss-sidebar-time strong');
    const tutorQuestionTimer = page.locator('.amboss-sidebar-timer-cell:nth-child(2) strong');
    const tutorQuestionBefore = (await tutorQuestionTimer.textContent())?.trim();
    const tutorFirst = (await tutorTopTimer.textContent())?.trim();
    assert((await page.getByRole('button', { name: /^End Block$/i }).count()) === 1, 'Tutor is missing End Block');

    await page.waitForTimeout(1150);
    const tutorSecond = (await tutorTopTimer.textContent())?.trim();
    const tutorSideSecond = (await tutorSideTimer.textContent())?.trim();
    const tutorQuestionAfter = (await tutorQuestionTimer.textContent())?.trim();
    assert(timerTextToSeconds(tutorQuestionAfter) > timerTextToSeconds(tutorQuestionBefore), 'Tutor QUESTION clock did not tick');
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
    await page.locator('tbody tr').filter({ hasText: 'AMBOSS tutor lifecycle smoke' }).getByText('AMBOSS tutor lifecycle smoke', { exact: true }).waitFor();

    const tutorRow = page.getByRole('row').filter({ hasText: 'AMBOSS tutor lifecycle smoke' });
    await tutorRow.getByRole('link', { name: 'Resume' }).click();
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
    await tutorEndDialog.getByText('Solving time', { exact: true }).waitFor();
    await tutorEndDialog.getByRole('button', { name: /End block now/i }).click();
    await page.waitForURL(/\/test\/9003\/results/);
    await page.getByRole('heading', { name: 'Session Performance' }).waitFor();
    await page.getByRole('heading', { name: 'Study Recommendations' }).waitFor();
    assert(tutorLifecycleStatus === 'completed', 'Tutor End Block did not complete the test');
    assert(
      Number(tutorCompleteBody?.totalTimeSpentSeconds) >= Number(tutorSuspendBody?.totalTimeSpentSeconds),
      'Tutor End Block lost elapsed time accumulated before Suspend/Resume',
    );

    await page.screenshot({ path: `${outDir}/amboss-tutor-results.png`, fullPage: true });
    await page.getByRole('link', { name: 'Previous Tests' }).last().click();
    await page.waitForURL(/\/qbank\/1\/previous-tests\?step=1/);
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
    timedReviewExplanationFetches = 0;

    const { context, page } = await preparePage(browser, { width: 1440, height: 1000 });
    await page.goto(`${baseUrl}/test/9002`, { waitUntil: 'networkidle' });
    await page.locator('.amboss-stem').getByText('70% ethanol').waitFor();

    await page.locator('img[data-exam-image="stem"]').click();
    assert((await page.getByRole('dialog').locator('#aiv-title').innerText()) === 'Medical Illustration',
      'Timed pre-completion image title exposed the diagnosis');
    assert((await page.getByRole('dialog').getByText(/Hyperdensity \(green overlay\)/).count()) === 0,
      'Timed image Description leaked during solving');
    await page.getByRole('dialog').getByRole('button', { name:'Close image viewer' }).click();

    assert((await page.getByRole('button', { name: /AI Summary/i }).count()) === 0, 'AI Summary leaked into active Timed block');

    const topTimer = page.locator('.amboss-primary-timer strong');
    const sideTimer = page.locator('.amboss-sidebar-timer-cell:first-child .amboss-sidebar-time strong');
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
    await page.locator('.amboss-stem').getByText(/AMBOSS sample question 2/i).waitFor();
    await page.getByRole('button', { name: /PREVIOUS/i }).click();
    await page.locator('.amboss-stem').getByText('70% ethanol').waitFor();
    assert(await page.locator('.amboss-option').nth(0).evaluate((node) => node.classList.contains('is-selected')), 'Timed selection was lost across navigation');

    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.amboss-stem').getByText('70% ethanol').waitFor();
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
    const darkHeader = await page.locator('.amboss-stem .amboss-table-scroll thead th').nth(1)
      .evaluate((cell) => {
        const style = getComputedStyle(cell);
        return { background:style.backgroundColor, color:style.color, border:style.borderRightColor };
      });
    const rgb = (value) => [...value.matchAll(/\d+(?:\.\d+)?/g)].slice(0,3).map(x => Number(x[0]));
    assert(rgb(darkHeader.background).every(value => value < 100) &&
      rgb(darkHeader.color).every(value => value > 180),
      'Dark AMBOSS table headers do not retain readable contrast: ' + JSON.stringify(darkHeader));

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

    // Tool-mode test cleanup: review clicks should run with Pencil disabled.
    await page.getByRole('button', { name: /^Tools$/i }).click();
    await page
      .locator('.amboss-tools-popover .amboss-tool-config')
      .nth(1)
      .locator('.amboss-popover-action')
      .click();
    assert(
      (await page.locator('.amboss-pencil-canvas.is-active').count()) === 0,
      'Pencil smoke cleanup did not disable drawing mode',
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
    await page.waitForURL(/\/test\/9002\/results/);
    await page.getByRole('heading', { name: 'Session Performance' }).waitFor();
    assert((await page.getByRole('heading', { name: 'Performance by Difficulty' }).count()) === 1,
      'Timed End Block did not show difficulty results');
    assert((await page.getByText('Cardiac physiology').count()) === 1,
      'Study Recommendations did not show the topic name');
    await page.getByRole('link', { name: 'Review Questions' }).click();
    await page.waitForURL(/\/test\/9002$/);
    await page.getByRole('button', { name: /AI Summary/i }).waitFor();
    assert(timedBatchBody?.complete === true, 'End Block did not use complete=true batch submission');
    assert(Array.isArray(timedBatchBody?.answers) && timedBatchBody.answers.length === 5, 'End Block did not submit the full question set');
    assert(timedStatus === 'completed', 'End Block did not complete the timed test');
    // Returning from Results remounts the completed AMBOSS exam with
    // calculator closed; do NOT toggle it open over the image.
    await page.locator('img[data-exam-image="stem"]').click();
    assert((await page.getByRole('dialog').locator('#aiv-title').innerText()).includes('Subarachnoid hemorrhage'),
      'Timed completed review did not restore the diagnostic title');
    await page.getByRole('dialog').getByText(/Hyperdensity \(green overlay\)/).waitFor();
    await page.getByRole('dialog').getByRole('button', { name:'Close image viewer' }).click();


    // Untouched Q2 is Omitted after End Block. Omitted remains a result state,
    // but completed review must expose the correct answer and explanations
    // without creating any new answer/draft mutation.
    const savesBeforeOmittedReview = timedSelectionSaves;
    const batchBeforeOmittedReview = JSON.stringify(timedBatchBody);
    await page.getByRole('button', { name: /NEXT/i }).click();
    await page.locator('.amboss-stem').getByText(/AMBOSS sample question 2/i).waitFor();

    const omittedReviewRows = page.locator('.amboss-option');
    assert(
      await omittedReviewRows.nth(7).evaluate((node) => node.classList.contains('is-correct')),
      'Completed Omitted review did not reveal the canonical correct answer',
    );
    assert(
      (await page.locator('.amboss-option-explanation').count()) === 0,
      'Untouched completed Omitted review auto-expanded explanations',
    );

    await omittedReviewRows.nth(1).click();
    await omittedReviewRows.nth(1).getByText(/Blob explanation for option B on question 3002/i).waitFor();
    assert(
      timedReviewExplanationFetches === 1,
      `Completed Omitted option click did not lazy-fetch explanation exactly once (got ${timedReviewExplanationFetches})`,
    );
    assert(
      timedSelectionSaves === savesBeforeOmittedReview,
      'Reviewing an Omitted question mutated Timed draft selection state',
    );
    assert(
      JSON.stringify(timedBatchBody) === batchBeforeOmittedReview,
      'Reviewing an Omitted question changed the completed batch result',
    );

    await page.getByRole('button', { name: /SHOW ALL EXPLANATIONS/i }).click();
    await page.waitForTimeout(100);
    assert(
      (await page.locator('.amboss-option-explanation').count()) === 8,
      'Completed Omitted SHOW ALL EXPLANATIONS did not expand every option',
    );
    assert(timedStatus === 'completed', 'Omitted review changed completed test status');

    await page.getByRole('button', { name: /PREVIOUS/i }).click();
    await page.locator('.amboss-stem').getByText('70% ethanol').waitFor();
    await page.getByRole('button', { name: /AI Summary/i }).click();
    await page.getByText('AI review summary for the completed timed question.').waitFor();
    assert(timedAiSummaryCalls === 1, 'AI Summary did not call the review-only AI endpoint');

    await page.screenshot({ path: `${outDir}/amboss-timed-toolbar.png`, fullPage: true });
    await context.close();
  }

  // Results visual polish: three viewport classes, one-decimal accuracy parity,
  // true empty recommendation behavior and real 1/40 answer distribution.
  for (const device of [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'tablet', width: 834, height: 1194 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const { context, page } = await preparePage(browser, {
      width: device.width, height: device.height,
    });
    await page.goto(baseUrl + '/test/9005/results', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Session Performance' }).waitFor();
    const accuracy = await page.getByTestId('results-metric-accuracy').innerText();
    const circleAccuracy = (await page.locator('.mp-results__donut-number').textContent())?.trim();
    assert(accuracy === '2.5%' && circleAccuracy === '2.5%',
      'Results accuracy must show identical one-decimal 2.5% in summary and donut');
    assert((await page.getByTestId('results-metric-correct').innerText()) === '1/40',
      'Results must preserve correct/total count');
    assert((await page.getByTestId('results-completed-count').innerText()).includes('1 of 40'),
      'Results must show completed/total count');
    assert((await page.getByTestId('results-recommendations-empty').count()) === 1,
      'Results must show a compact empty recommendation when no answers are wrong');
    assert((await page.getByText('39 questions were omitted', { exact: false }).count()) === 1,
      'Results must not mistake 39 omitted questions for topic mastery');
    assert((await page.locator('.mp-results__difficulty-row').count()) === 5,
      'Results five-tier difficulty breakdown is missing');
    const dims = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      emptyHeight: document.querySelector('.mp-results__recommendations')?.getBoundingClientRect().height,
      overviewHeight: document.querySelector('.mp-results__panels .mp-results__panel')?.getBoundingClientRect().height,
    }));
    assert(dims.scrollWidth <= dims.viewportWidth + 1,
      'Results ' + device.name + ' caused horizontal page overflow');
    assert(dims.emptyHeight < dims.overviewHeight,
      'Empty Study Recommendations must not inherit oversized Results card height');
    await page.screenshot({
      path: outDir + '/medpark-results-polished-' + device.name + '.png', fullPage: true,
    });
    await context.close();
  }

  // Same Results UI on a phone: no viewport-wide horizontal overflow.
  {
    const { context, page } = await preparePage(browser, { width: 390, height: 844 });
    await page.goto(`${baseUrl}/test/9002/results`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Session Performance' }).waitFor();
    assert(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)),
      'Results V1 caused mobile horizontal overflow');
    await page.getByRole('heading', { name: 'Study Recommendations' }).waitFor();
    await page.screenshot({ path: `${outDir}/medpark-results-v1-mobile.png`, fullPage: true });
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
    tutorPersistedTimeSpentSeconds = 0;
    const { context, page } = await preparePage(browser, { width: device.width, height: device.height });
    await page.goto(`${baseUrl}/test/9001`, { waitUntil: 'networkidle' });
    await page.locator('.amboss-stem').getByText('70% ethanol').waitFor();
    const mobileSerum = page.locator('.amboss-stem [data-medical-fixture="prenatal"]');
    const mobileTable = mobileSerum.locator('table');
    const tableScroll = await mobileSerum.evaluate((frame) => {
      const table = frame.querySelector('table');
      const rect = frame.getBoundingClientRect();
      return { overflow:getComputedStyle(frame).overflowX, left:rect.left, right:rect.right,
        scrollable:frame.scrollWidth > frame.clientWidth + 10,
        tableWidth:table.getBoundingClientRect().width, frameWidth:rect.width,
        display:getComputedStyle(table).display };
    });
    assert(tableScroll.display === 'table' && tableScroll.overflow === 'auto',
      device.name + ': AMBOSS table must keep native layout inside an overflow-capable frame: ' + JSON.stringify(tableScroll));
    assert(tableScroll.left >= -1 && tableScroll.right <= device.width + 1,
      device.name + ': imported medical table spills beyond card/screen: ' + JSON.stringify(tableScroll));
    assert(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)),
      device.name + ': medical table caused page-wide sideways overflow');
    if (tableScroll.scrollable) {
      await mobileSerum.evaluate(frame => { frame.scrollLeft = frame.scrollWidth; });
      assert((await mobileSerum.evaluate(frame => frame.scrollLeft)) > 0,
        device.name + ': rightmost HCG/Inhibin columns cannot be reached by local scrolling');
    } else {
      assert(device.name === 'ipad' && tableScroll.tableWidth <= tableScroll.frameWidth + 2,
        device.name + ': table columns are clipped without local scroll: ' + JSON.stringify(tableScroll));
    }
    if (device.name === 'mobile') {
      assert(tableScroll.scrollable, 'Phone must support horizontal panning for wide five-column markers');
    }
    const thumbBox = await page.locator('.amboss-stem-image-rail').boundingBox();
    assert(thumbBox && thumbBox.width <= device.width - 20, device.name + ': stem thumbnails overflow screen');
    await page.locator('img[data-exam-image="stem"]').click();
    const mobileViewer = page.getByRole('dialog');
    await mobileViewer.getByRole('button', { name:'SHOW OVERLAY' }).click();
    const modalBox = await mobileViewer.boundingBox();
    assert(modalBox && modalBox.x >= -1 && modalBox.width <= device.width + 1,
      device.name + ': viewer is not viewport-safe');
    assert(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)),
      device.name + ': modal caused horizontal overflow');
    await mobileViewer.getByRole('button', { name:'Close image viewer' }).click();

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

    // Responsive AMBOSS Library targets must center in their own reader, not
    // drag the outer viewport or light up an enclosing card/header.
    await page.goto(`${baseUrl}/library?source=amboss&article=SM0yLg&anchor=Ztreatment`, { waitUntil:'networkidle' });
    await page.locator('h2#Ztreatment.amboss-reference-spotlight').waitFor();
    await page.waitForTimeout(1450);
    const anchorPosition = await page.evaluate(() => {
      const element = document.getElementById('Ztreatment');
      const scrollport = document.getElementById('ascroll');
      const target = element.getBoundingClientRect();
      const reader = scrollport.getBoundingClientRect();
      return {
        drift:Math.abs((target.top+target.height/2)-(reader.top+reader.height/2)),
        signedDrift:(target.top+target.height/2)-(reader.top+reader.height/2),
        readerHeight:reader.height,
        scrollTop:scrollport.scrollTop,
        maxScroll:scrollport.scrollHeight-scrollport.clientHeight,
        targetTop:target.top,
        readerTop:reader.top,
        targetVisible:target.top >= reader.top - 4 && target.bottom <= reader.bottom + 4,
        ancestors:Array.from((function*() {
          for (let parent=element.parentElement;parent;parent=parent.parentElement) {
            yield { tag:parent.tagName,id:parent.id,overflow:getComputedStyle(parent).overflowY,
              scrollTop:parent.scrollTop,scrollHeight:parent.scrollHeight,clientHeight:parent.clientHeight };
          }
        })()).slice(0,10),
      };
    });
    assert(anchorPosition.targetVisible && anchorPosition.drift < 26,
      device.name + ': AMBOSS exact anchor did not center in mobile/tablet reader: ' + JSON.stringify(anchorPosition));
    await context.close();
  }

  console.log('AMBOSS_BROWSER_SMOKE_OK desktop=true ipad=true mobile=true clue=true hint=true labs=true notes=true mark=true first_answer_submit=true post_submit_inline=true show_all=true omitted=true blob_explanations=true last_option_explanation=true internal_library_link=true library_split=true library_new_tab=true timed_create_duration=true previous_tests_auto_name=true previous_tests_v2_responsive=true previous_tests_copy_id=true previous_tests_status_actions=true timed_timer_ticks=true tutor_timer_ticks=true tutor_suspend_navigation=true tutor_end_block=true marker_palette=true marker_dark_contrast=true tutor_pause_on_submit=true tutor_resume_unanswered=true tutor_submit_time_delta=true omitted_review_correct=true omitted_review_explanation_fetch=true omitted_review_no_mutation=true global_r2_media_origin=true relative_r2_images=true shared_image_viewer=true stem_image_rail=true missing_image_fallback=true library_image_regression=true tutor_image_reveal=true timed_image_reveal=true image_overlay_zoom=true overlay_bitmap_decodes=true diagnostic_title_hidden_before_answer=true image_option_no_submit=true precise_library_anchor=true same_article_anchor_no_refetch=true main_article_relation=true dotted_related_terms=true exact_anchor_center=true responsive_anchor_center=true semantic_medical_tables=true numeric_lab_tables=true scoped_table_headers=true dark_table_contrast=true responsive_table_scroll=true inline_anchor_spotlight=true amboss_article_create_test=true reduced_motion_anchor=true sidebar_stem_previews=true sidebar_progress=true sidebar_question_timer=true sidebar_exit_navigation=true pencil_palette=true');
} finally {
  await browser.close();
}

// PR14 browser-smoke retrigger
