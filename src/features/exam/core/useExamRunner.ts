import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getExamExplanation,
  getExamTest,
  getLabValues,
  getQuestionNote,
  saveQuestionNote,
  setExamQuestionMark,
  submitExamAnswer,
  submitTimedExamBlock,
} from '../api';
import type {
  ExamExplanationResponse,
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
}

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

  // Lock the initial resume position into local navigation state. Without
  // this, every post-submit refetch can change test.resumeQuestionId to the
  // next unanswered question and silently jump the user away before the
  // current inline explanation is shown.
  useEffect(() => {
    if (currentQuestionId !== null || !test?.questions.length) return;

    const initialQuestionId =
      test.resumeQuestionId &&
      test.questions.some((question) => question.id === test.resumeQuestionId)
        ? test.resumeQuestionId
        : test.questions[0].id;

    setCurrentQuestionId(initialQuestionId);
  }, [currentQuestionId, test]);
  const [selectedByQuestion, setSelectedByQuestion] = useState<Record<number, number | null>>({});
  const [revealedByQuestion, setRevealedByQuestion] = useState<Record<number, RevealedQuestion>>({});
  const [markOverrides, setMarkOverrides] = useState<Record<number, boolean>>({});

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

  const hasLocalSelection = currentQuestion
    ? Object.prototype.hasOwnProperty.call(selectedByQuestion, currentQuestion.id)
    : false;
  const selectedOptionId = currentQuestion
    ? hasLocalSelection
      ? selectedByQuestion[currentQuestion.id] ?? null
      : currentQuestion.userAnswer?.selectedOptionId ?? null
    : null;

  const serverAlreadyRevealed =
    !!currentQuestion?.userAnswer &&
    currentQuestion.userAnswer.isCorrect !== undefined &&
    currentQuestion.options.some((option) => option.isCorrect !== undefined);

  const currentReveal = currentQuestion
    ? revealedByQuestion[currentQuestion.id] ?? null
    : null;

  const isRevealed = !!currentReveal || serverAlreadyRevealed;
  const isTutorLike = test?.type === 'tutor' || test?.type === 'mixed';
  const isTimed = test?.type === 'timed';

  function selectOption(optionId: number) {
    if (!currentQuestion || isRevealed || showAnswerMutation.isPending) return;

    // Timed keeps local selections until the canonical End Block batch.
    if (isTimed) {
      setSelectedByQuestion((current) => ({
        ...current,
        [currentQuestion.id]: optionId,
      }));
      return;
    }

    // AMBOSS Tutor/Mixed semantics: the FIRST option click is the submit.
    // Later option clicks are explanation-only and never reach this controller
    // because the theme handles them locally once the question is revealed.
    if (!isTutorLike) return;

    setSelectedByQuestion((current) => ({
      ...current,
      [currentQuestion.id]: optionId,
    }));
    showAnswerMutation.mutate({
      question: currentQuestion,
      selectedOptionId: optionId,
    });
  }

  function goToQuestion(questionId: number) {
    if (!test?.questions.some((question) => question.id === questionId)) return;
    setCurrentQuestionId(questionId);
  }

  function goPrevious() {
    if (!test || currentIndex <= 0) return;
    setCurrentQuestionId(test.questions[currentIndex - 1].id);
  }

  function goNext() {
    if (!test || currentIndex < 0 || currentIndex >= test.questions.length - 1) return;
    setCurrentQuestionId(test.questions[currentIndex + 1].id);
  }

  const showAnswerMutation = useMutation({
    mutationFn: async ({ question, selectedOptionId: submittedOptionId }: TutorSubmitInput) => {
      const answer = await submitExamAnswer(testId, {
        questionId: question.id,
        // null is deliberate: SHOW ANSWER with no first choice = omitted.
        selectedOptionId: submittedOptionId,
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
      void queryClient.invalidateQueries({ queryKey: ['exam-test', testId] });
    },
  });

  function showAnswer() {
    if (
      !currentQuestion ||
      !isTutorLike ||
      isRevealed ||
      showAnswerMutation.isPending
    ) {
      return;
    }

    // No selected option exists in Tutor/Mixed before first submit because an
    // option click submits immediately. SHOW ANSWER therefore means omission.
    setSelectedByQuestion((current) => ({
      ...current,
      [currentQuestion.id]: null,
    }));
    showAnswerMutation.mutate({
      question: currentQuestion,
      selectedOptionId: null,
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

  const timedBlockMutation = useMutation({
    mutationFn: (answers: TimedBatchAnswer[]) =>
      submitTimedExamBlock(testId, answers, test?.timeSpentSeconds ?? undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['exam-test', testId] });
    },
  });

  function endTimedBlock() {
    if (!test || !isTimed) return;
    const answers = test.questions.map((question) => {
      const selected =
        selectedByQuestion[question.id] ??
        question.userAnswer?.selectedOptionId ??
        null;
      return {
        questionId: question.id,
        selectedOptionId: selected ?? undefined,
      };
    });
    timedBlockMutation.mutate(answers);
  }

  return {
    testId,
    test,
    testQuery,
    currentQuestion,
    currentIndex,
    selectedOptionId,
    currentReveal,
    isRevealed,
    isOmitted:
      currentQuestion?.isOmitted === true ||
      (!!currentReveal && currentReveal.submittedOptionId === null),
    isTutorLike,
    isTimed,
    selectOption,
    goToQuestion,
    goPrevious,
    goNext,
    showAnswer,
    showAnswerMutation,
    isQuestionMarked,
    toggleCurrentMark,
    markMutation,
    note: noteQuery.data ?? null,
    noteQuery,
    saveCurrentNote,
    saveNoteMutation,
    labs: labsQuery.data,
    labsQuery,
    ensureLabsLoaded,
    endTimedBlock,
    timedBlockMutation,
  };
}

export type ExamRunnerController = ReturnType<typeof useExamRunner>;
