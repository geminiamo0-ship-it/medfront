import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateQbankProgressQueries } from '@/lib/qbankProgressQueries';
import {
  completeExamTest,
  getExamAiSummary,
  getExamExplanation,
  getExamTest,
  getLabValues,
  getQuestionNote,
  resumeExamTest,
  saveQuestionNote,
  saveTimedSelection,
  setExamQuestionMark,
  submitExamAnswer,
  submitTimedExamBlock,
  suspendExamTest,
  updateExamHighlights,
} from '../api';
import type {
  ExamExplanationResponse,
  ExamHighlight,
  ExamQuestion,
  TimedBatchAnswer,
} from '../types';

interface RevealedQuestion {
  correctOptionId: number | null;
  isCorrect: boolean;
  submittedOptionId: number | null;
  explanation: ExamExplanationResponse;
}

interface TutorSubmitInput {
  question: ExamQuestion;
  selectedOptionId: number | null;
  timeSpentSeconds?: number;
}

interface TutorClockState {
  testId: number | null;
  baseSeconds: number;
  localAccumulatedMs: number;
  questionAccumulatedMs: Record<number, number>;
  activeQuestionId: number | null;
  activeStartedAt: number | null;
}

const EMPTY_TUTOR_CLOCK: TutorClockState = {
  testId: null,
  baseSeconds: 0,
  localAccumulatedMs: 0,
  questionAccumulatedMs: {},
  activeQuestionId: null,
  activeStartedAt: null,
};

export function useExamRunner(testIdParam: string | undefined) {
  const queryClient = useQueryClient();
  const testId = Number(testIdParam);
  const validTestId = Number.isInteger(testId) && testId > 0;

  const testQuery = useQuery({
    queryKey: ['exam-test', testId],
    queryFn: () => getExamTest(testId),
    enabled: validTestId,
  });

  const test = testQuery.data;
  const [currentQuestionId, setCurrentQuestionId] = useState<number | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());

  const [selectedByQuestion, setSelectedByQuestion] = useState<Record<number, number | null>>({});
  const [revealedByQuestion, setRevealedByQuestion] = useState<Record<number, RevealedQuestion>>({});
  const [markOverrides, setMarkOverrides] = useState<Record<number, boolean>>({});
  const [highlightOverrides, setHighlightOverrides] = useState<Record<number, ExamHighlight[]>>({});
  const [timedDraftError, setTimedDraftError] = useState<string | null>(null);
  const [tutorClock, setTutorClock] = useState<TutorClockState>(EMPTY_TUTOR_CLOCK);

  const timedSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const autoEndTriggeredRef = useRef(false);

  const resumeQuestion = useMemo(() => {
    if (!test?.questions.length) return null;
    if (currentQuestionId) {
      const selected = test.questions.find((question) => question.id === currentQuestionId);
      if (selected) return selected;
    }
    if (test.resumeQuestionId) {
      const resume = test.questions.find((question) => question.id === test.resumeQuestionId);
      if (resume) return resume;
    }
    return test.questions[0];
  }, [currentQuestionId, test]);

  const currentQuestion = resumeQuestion;
  const currentIndex = currentQuestion && test
    ? test.questions.findIndex((question) => question.id === currentQuestion.id)
    : -1;

  const isTutorLike = test?.type === 'tutor' || test?.type === 'mixed';
  const isTutor = test?.type === 'tutor';
  const isTimed = test?.type === 'timed';
  const isSuspended = test?.status === 'suspended';
  const isCompleted = test?.status === 'completed';

  function hasLocalSubmissionIntent(questionId: number) {
    return Object.prototype.hasOwnProperty.call(selectedByQuestion, questionId);
  }

  function getSelectedOptionId(question: ExamQuestion): number | null {
    if (hasLocalSubmissionIntent(question.id)) {
      return selectedByQuestion[question.id] ?? null;
    }
    if (question.draftSelectedOptionId !== undefined) {
      return question.draftSelectedOptionId ?? null;
    }
    return question.userAnswer?.selectedOptionId ?? null;
  }

  const selectedOptionId = currentQuestion ? getSelectedOptionId(currentQuestion) : null;

  const serverAlreadyRevealed =
    !!currentQuestion?.userAnswer &&
    currentQuestion.userAnswer.isCorrect !== undefined &&
    currentQuestion.options.some((option) => option.isCorrect !== undefined);

  const currentReveal = currentQuestion
    ? revealedByQuestion[currentQuestion.id] ?? null
    : null;

  const isRevealed = !!currentReveal || serverAlreadyRevealed;

  const currentTutorQuestionShouldRun =
    !!(
      isTutor &&
      test?.status === 'in_progress' &&
      currentQuestion &&
      !currentQuestion.userAnswer &&
      !hasLocalSubmissionIntent(currentQuestion.id)
    );

  // Before the first local clock event, derive an initial clock from the
  // loaded test snapshot. Once an interaction occurs, tutorClock owns the
  // in-session active-time state and is intentionally not rebased by answer
  // refetches (which would otherwise double-count submitted deltas).
  const effectiveTutorClock: TutorClockState =
    isTutor && test && tutorClock.testId !== test.id
      ? {
          testId: test.id,
          baseSeconds: Math.max(0, Number(test.timeSpentSeconds || 0)),
          localAccumulatedMs: 0,
          questionAccumulatedMs: {},
          activeQuestionId:
            currentTutorQuestionShouldRun && currentQuestion ? currentQuestion.id : null,
          activeStartedAt:
            currentTutorQuestionShouldRun
              ? Math.max(0, testQuery.dataUpdatedAt || clockNow)
              : null,
        }
      : tutorClock;

  const tutorClockRunning =
    !!(
      currentTutorQuestionShouldRun &&
      currentQuestion &&
      effectiveTutorClock.activeQuestionId === currentQuestion.id &&
      effectiveTutorClock.activeStartedAt != null
    );

  function settleTutorClock(now = Date.now()): TutorClockState {
    const state = effectiveTutorClock;
    if (
      state.activeQuestionId == null ||
      state.activeStartedAt == null
    ) {
      return state;
    }

    const deltaMs = Math.max(0, now - state.activeStartedAt);
    const questionId = state.activeQuestionId;
    return {
      ...state,
      localAccumulatedMs: state.localAccumulatedMs + deltaMs,
      questionAccumulatedMs: {
        ...state.questionAccumulatedMs,
        [questionId]: (state.questionAccumulatedMs[questionId] || 0) + deltaMs,
      },
      activeQuestionId: null,
      activeStartedAt: null,
    };
  }

  function getTutorNetElapsedSeconds(now = Date.now()) {
    if (!isTutor || !test) return 0;
    const activeMs =
      tutorClockRunning && effectiveTutorClock.activeStartedAt != null
        ? Math.max(0, now - effectiveTutorClock.activeStartedAt)
        : 0;
    return (
      effectiveTutorClock.baseSeconds +
      Math.floor((effectiveTutorClock.localAccumulatedMs + activeMs) / 1000)
    );
  }

  function pauseTutorForSubmit(questionId: number) {
    if (!isTutor) return undefined;
    const now = Date.now();
    const settled = settleTutorClock(now);
    setTutorClock(settled);
    setClockNow(now);
    return Math.max(
      0,
      Math.floor((settled.questionAccumulatedMs[questionId] || 0) / 1000),
    );
  }

  const tutorElapsedSeconds = isTutor ? getTutorNetElapsedSeconds(clockNow) : 0;

  const nonTutorElapsedSeconds = useMemo(() => {
    if (!test || test.type === 'tutor') return 0;

    const persisted = Math.max(0, Number(test.timeSpentSeconds || 0));
    const serverSnapshot = Number(test.timerElapsedSeconds);
    const hasServerSnapshot = Number.isFinite(serverSnapshot) && serverSnapshot >= 0;
    const baseline = hasServerSnapshot ? serverSnapshot : persisted;

    if (
      test.status !== 'in_progress' ||
      (test.type === 'mixed' && test.timeLimitSeconds)
    ) {
      return baseline;
    }

    if (hasServerSnapshot && testQuery.dataUpdatedAt > 0) {
      const sinceSnapshot = Math.max(
        0,
        Math.floor((clockNow - testQuery.dataUpdatedAt) / 1000),
      );
      return baseline + sinceSnapshot;
    }

    if (!test.startedAt) return baseline;
    const startedAt = new Date(test.startedAt).getTime();
    if (!Number.isFinite(startedAt)) return baseline;
    return persisted + Math.max(0, Math.floor((clockNow - startedAt) / 1000));
  }, [clockNow, test, testQuery.dataUpdatedAt]);

  const elapsedSeconds = isTutor ? tutorElapsedSeconds : nonTutorElapsedSeconds;

  const remainingSeconds = useMemo(() => {
    if (!test?.timeLimitSeconds) return null;
    return Math.max(0, Number(test.timeLimitSeconds) - elapsedSeconds);
  }, [elapsedSeconds, test?.timeLimitSeconds]);

  useEffect(() => {
    if (test?.status !== 'in_progress') return;
    if (isTutor && !tutorClockRunning) return;

    const tick = () => setClockNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 1000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isTutor, test?.id, test?.status, tutorClockRunning]);

  function queueTimedSelection(questionId: number, optionId: number | null) {
    setTimedDraftError(null);
    const next = timedSaveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        await saveTimedSelection(testId, questionId, optionId);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Could not save timed selection.';
        setTimedDraftError(message);
      });
    timedSaveQueueRef.current = next;
  }

  async function flushTimedSelectionQueue() {
    await timedSaveQueueRef.current;
    if (!isTimed) return;

    // Re-write only locally changed answers once before Suspend. This closes the
    // small race where the user clicks Suspend immediately after a selection.
    const changed = Object.entries(selectedByQuestion);
    for (const [questionId, optionId] of changed) {
      await saveTimedSelection(testId, Number(questionId), optionId);
    }
    setTimedDraftError(null);
  }

  function selectOption(optionId: number) {
    if (!currentQuestion || isRevealed || showAnswerMutation.isPending || isSuspended || isCompleted) return;

    if (isTimed) {
      setSelectedByQuestion((current) => ({
        ...current,
        [currentQuestion.id]: optionId,
      }));
      queueTimedSelection(currentQuestion.id, optionId);
      return;
    }

    if (!isTutorLike) return;

    const timeSpentSeconds = isTutor
      ? pauseTutorForSubmit(currentQuestion.id)
      : undefined;

    setCurrentQuestionId(currentQuestion.id);
    setSelectedByQuestion((current) => ({
      ...current,
      [currentQuestion.id]: optionId,
    }));
    showAnswerMutation.mutate({
      question: currentQuestion,
      selectedOptionId: optionId,
      timeSpentSeconds,
    });
  }

  function goToQuestion(questionId: number) {
    if (!test) return;
    const target = test.questions.find((question) => question.id === questionId);
    if (!target) return;

    if (isTutor) {
      const now = Date.now();
      let nextClock = settleTutorClock(now);
      const targetShouldRun =
        test.status === 'in_progress' &&
        !target.userAnswer &&
        !hasLocalSubmissionIntent(target.id);

      nextClock = {
        ...nextClock,
        activeQuestionId: targetShouldRun ? target.id : null,
        activeStartedAt: targetShouldRun ? now : null,
      };
      setTutorClock(nextClock);
      setClockNow(now);
    }

    setCurrentQuestionId(questionId);
  }

  function goPrevious() {
    if (!test || currentIndex <= 0) return;
    goToQuestion(test.questions[currentIndex - 1].id);
  }

  function goNext() {
    if (!test || currentIndex < 0 || currentIndex >= test.questions.length - 1) return;
    goToQuestion(test.questions[currentIndex + 1].id);
  }

  const showAnswerMutation = useMutation({
    mutationFn: async ({
      question,
      selectedOptionId: submittedOptionId,
      timeSpentSeconds,
    }: TutorSubmitInput) => {
      const answer = await submitExamAnswer(testId, {
        questionId: question.id,
        selectedOptionId: submittedOptionId,
        timeSpentSeconds,
        answerSequence: submittedOptionId != null ? [submittedOptionId] : [],
      });
      const explanation = await getExamExplanation(testId, question.id);
      return { questionId: question.id, submittedOptionId, answer, explanation };
    },
    onSuccess: ({ questionId, submittedOptionId, answer, explanation }) => {
      setSelectedByQuestion((current) => ({
        ...current,
        [questionId]: answer.submission.selectedOptionId ?? submittedOptionId,
      }));
      setRevealedByQuestion((current) => ({
        ...current,
        [questionId]: {
          correctOptionId: answer.submission.correctOptionId,
          isCorrect: answer.submission.isCorrect,
          submittedOptionId: answer.submission.selectedOptionId ?? submittedOptionId,
          explanation,
        },
      }));
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['exam-test', testId] }),
        invalidateQbankProgressQueries(queryClient),
      ]);
    },
    onError: (_error, variables) => {
      setSelectedByQuestion((current) => {
        const next = { ...current };
        delete next[variables.question.id];
        return next;
      });

      if (test?.type === 'tutor' && test.status === 'in_progress' && !variables.question.userAnswer) {
        const now = Date.now();
        setTutorClock((current) => {
          const seed =
            current.testId === test.id
              ? current
              : {
                  ...EMPTY_TUTOR_CLOCK,
                  testId: test.id,
                  baseSeconds: Math.max(0, Number(test.timeSpentSeconds || 0)),
                };
          return {
            ...seed,
            activeQuestionId: variables.question.id,
            activeStartedAt: now,
          };
        });
        setClockNow(now);
      }
    },
  });

  function showAnswer() {
    if (
      !currentQuestion ||
      !isTutorLike ||
      isRevealed ||
      showAnswerMutation.isPending ||
      isSuspended ||
      isCompleted
    ) {
      return;
    }

    const timeSpentSeconds = isTutor
      ? pauseTutorForSubmit(currentQuestion.id)
      : undefined;

    setCurrentQuestionId(currentQuestion.id);
    setSelectedByQuestion((current) => ({
      ...current,
      [currentQuestion.id]: null,
    }));
    showAnswerMutation.mutate({
      question: currentQuestion,
      selectedOptionId: null,
      timeSpentSeconds,
    });
  }

  const markMutation = useMutation({
    mutationFn: async ({ questionId, isMarked }: { questionId: number; isMarked: boolean }) =>
      setExamQuestionMark(testId, questionId, isMarked),
    onMutate: ({ questionId, isMarked }) => {
      setMarkOverrides((current) => ({ ...current, [questionId]: isMarked }));
    },
    onError: (_error, variables) => {
      setMarkOverrides((current) => {
        const next = { ...current };
        delete next[variables.questionId];
        return next;
      });
    },
    onSuccess: ({ isMarked }, variables) => {
      setMarkOverrides((current) => ({ ...current, [variables.questionId]: isMarked }));
      void invalidateQbankProgressQueries(queryClient);
    },
  });

  function isQuestionMarked(question: ExamQuestion) {
    return markOverrides[question.id] ?? question.isMarked;
  }

  function toggleCurrentMark() {
    if (!currentQuestion) return;
    markMutation.mutate({
      questionId: currentQuestion.id,
      isMarked: !isQuestionMarked(currentQuestion),
    });
  }

  function getQuestionHighlights(question: ExamQuestion): ExamHighlight[] {
    return highlightOverrides[question.id] ?? question.highlightData?.highlights ?? [];
  }

  const highlightMutation = useMutation({
    mutationFn: ({ questionId, highlights }: { questionId: number; highlights: ExamHighlight[] }) =>
      updateExamHighlights(testId, questionId, highlights),
    onMutate: ({ questionId, highlights }) => {
      setHighlightOverrides((current) => ({ ...current, [questionId]: highlights }));
    },
  });

  function saveQuestionHighlights(questionId: number, highlights: ExamHighlight[]) {
    highlightMutation.mutate({ questionId, highlights });
  }

  const noteQuery = useQuery({
    queryKey: ['question-note', currentQuestion?.id],
    queryFn: () => getQuestionNote(currentQuestion!.id),
    enabled: !!currentQuestion,
  });

  const saveNoteMutation = useMutation({
    mutationFn: ({ questionId, content }: { questionId: number; content: string }) =>
      saveQuestionNote(questionId, content),
    onSuccess: (note) => {
      queryClient.setQueryData(['question-note', note.questionId], note);
    },
  });

  function saveCurrentNote(content: string) {
    if (!currentQuestion || !content.trim()) return;
    saveNoteMutation.mutate({ questionId: currentQuestion.id, content: content.trim() });
  }

  const labsQuery = useQuery({
    queryKey: ['lab-values'],
    queryFn: getLabValues,
    enabled: false,
    staleTime: 24 * 60 * 60 * 1000,
  });

  function ensureLabsLoaded() {
    if (!labsQuery.data && !labsQuery.isFetching) {
      void labsQuery.refetch();
    }
  }

  const suspendMutation = useMutation({
    mutationFn: async () => {
      if (isTimed) await flushTimedSelectionQueue();
      const lifecycleElapsed = isTutor
        ? getTutorNetElapsedSeconds(Date.now())
        : elapsedSeconds;
      await suspendExamTest(testId, lifecycleElapsed);
      return getExamTest(testId);
    },
    onSuccess: (freshTest) => {
      if (freshTest.type === 'tutor') {
        setTutorClock({
          ...EMPTY_TUTOR_CLOCK,
          testId: freshTest.id,
          baseSeconds: Math.max(0, Number(freshTest.timeSpentSeconds || 0)),
        });
      }
      queryClient.setQueryData(['exam-test', testId], freshTest);
      void invalidateQbankProgressQueries(queryClient);
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      await resumeExamTest(testId);
      return getExamTest(testId);
    },
    onSuccess: (freshTest) => {
      autoEndTriggeredRef.current = false;
      const now = Date.now();

      if (freshTest.type === 'tutor') {
        const targetId =
          currentQuestionId ??
          freshTest.resumeQuestionId ??
          freshTest.questions[0]?.id ??
          null;
        const target = targetId
          ? freshTest.questions.find((question) => question.id === targetId) ?? null
          : null;
        const shouldRun =
          freshTest.status === 'in_progress' &&
          !!target &&
          !target.userAnswer &&
          !hasLocalSubmissionIntent(target.id);

        setTutorClock({
          ...EMPTY_TUTOR_CLOCK,
          testId: freshTest.id,
          baseSeconds: Math.max(0, Number(freshTest.timeSpentSeconds || 0)),
          activeQuestionId: shouldRun && target ? target.id : null,
          activeStartedAt: shouldRun ? now : null,
        });
      }

      setClockNow(now);
      queryClient.setQueryData(['exam-test', testId], freshTest);
      void invalidateQbankProgressQueries(queryClient);
    },
  });

  const completeTestMutation = useMutation({
    mutationFn: (totalTimeSpentSeconds: number) =>
      completeExamTest(testId, totalTimeSpentSeconds),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['exam-test', testId] }),
        invalidateQbankProgressQueries(queryClient),
      ]);
      await testQuery.refetch();
    },
  });

  const timedBlockMutation = useMutation({
    mutationFn: async () => {
      if (!test || !isTimed) throw new Error('Timed test is not available.');
      await timedSaveQueueRef.current;
      const answers: TimedBatchAnswer[] = test.questions.map((question) => {
        const selected = getSelectedOptionId(question);
        return {
          questionId: question.id,
          selectedOptionId: selected ?? undefined,
        };
      });
      return submitTimedExamBlock(testId, answers, elapsedSeconds);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['exam-test', testId] }),
        invalidateQbankProgressQueries(queryClient),
      ]);
      await testQuery.refetch();
    },
    onError: () => {
      autoEndTriggeredRef.current = false;
    },
  });

  function endBlock() {
    if (!test || isCompleted) return;

    if (isTimed) {
      if (timedBlockMutation.isPending) return;
      autoEndTriggeredRef.current = true;
      timedBlockMutation.mutate();
      return;
    }

    if (test.type === 'tutor' && !completeTestMutation.isPending) {
      const now = Date.now();
      const settled = settleTutorClock(now);
      const finalTutorElapsed =
        settled.baseSeconds + Math.floor(settled.localAccumulatedMs / 1000);
      setTutorClock(settled);
      setClockNow(now);
      completeTestMutation.mutate(finalTutorElapsed);
    }
  }

  useEffect(() => {
    if (
      !isTimed ||
      test?.status !== 'in_progress' ||
      remainingSeconds !== 0 ||
      timedBlockMutation.isPending ||
      autoEndTriggeredRef.current
    ) {
      return;
    }
    autoEndTriggeredRef.current = true;
    timedBlockMutation.mutate();
  }, [isTimed, remainingSeconds, test?.status, timedBlockMutation]);

  const aiSummaryQuery = useQuery({
    queryKey: ['exam-ai-summary', testId, currentQuestion?.id],
    queryFn: () => getExamAiSummary(testId, currentQuestion!.id),
    enabled: false,
    retry: false,
  });

  function loadAiSummary() {
    if (!isCompleted || !currentQuestion) return;
    void aiSummaryQuery.refetch();
  }

  const answeredCount = test
    ? test.questions.filter((question) => getSelectedOptionId(question) != null).length
    : 0;
  const unansweredCount = test ? Math.max(0, test.totalQuestions - answeredCount) : 0;
  const markedCount = test
    ? test.questions.filter((question) => isQuestionMarked(question)).length
    : 0;

  return {
    testId,
    test,
    testQuery,
    currentQuestion,
    currentIndex,
    selectedOptionId,
    getSelectedOptionId,
    currentReveal,
    isRevealed,
    isOmitted:
      currentQuestion?.isOmitted === true ||
      (!!currentReveal && currentReveal.submittedOptionId === null),
    isTutorLike,
    isTimed,
    isSuspended,
    isCompleted,
    elapsedSeconds,
    remainingSeconds,
    timerSeconds: isTimed && remainingSeconds != null ? remainingSeconds : elapsedSeconds,
    timerCountsDown: isTimed && remainingSeconds != null,
    answeredCount,
    unansweredCount,
    markedCount,
    timedDraftError,
    selectOption,
    goToQuestion,
    goPrevious,
    goNext,
    showAnswer,
    showAnswerMutation,
    isQuestionMarked,
    toggleCurrentMark,
    markMutation,
    getQuestionHighlights,
    currentQuestionHighlights: currentQuestion ? getQuestionHighlights(currentQuestion) : [],
    saveQuestionHighlights,
    highlightMutation,
    note: noteQuery.data ?? null,
    noteQuery,
    saveCurrentNote,
    saveNoteMutation,
    labs: labsQuery.data,
    labsQuery,
    ensureLabsLoaded,
    suspendTest: () => suspendMutation.mutate(),
    suspendTestAsync: () => suspendMutation.mutateAsync(),
    resumeTest: () => resumeMutation.mutate(),
    suspendMutation,
    resumeMutation,
    endBlock,
    completeTestMutation,
    timedBlockMutation,
    aiSummary: aiSummaryQuery.data ?? null,
    aiSummaryQuery,
    loadAiSummary,
  };
}

export type ExamRunnerController = ReturnType<typeof useExamRunner>;
