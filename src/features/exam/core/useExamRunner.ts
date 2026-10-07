import { useMemo, useState } from 'react';
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
  explanation: ExamExplanationResponse;
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

  const selectedOptionId = currentQuestion
    ? selectedByQuestion[currentQuestion.id] ??
      currentQuestion.userAnswer?.selectedOptionId ??
      null
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
    if (!currentQuestion || isRevealed) return;
    setSelectedByQuestion((current) => ({
      ...current,
      [currentQuestion.id]: optionId,
    }));
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
    mutationFn: async (question: ExamQuestion) => {
      const selected =
        selectedByQuestion[question.id] ??
        question.userAnswer?.selectedOptionId ??
        null;

      const answer = await submitExamAnswer(testId, {
        questionId: question.id,
        selectedOptionId: selected ?? undefined,
        answerSequence: selected ? [selected] : [],
      });
      const explanation = await getExamExplanation(testId, question.id);
      return { questionId: question.id, answer, explanation };
    },
    onSuccess: ({ questionId, answer, explanation }) => {
      setRevealedByQuestion((current) => ({
        ...current,
        [questionId]: {
          correctOptionId: answer.submission.correctOptionId,
          isCorrect: answer.submission.isCorrect,
          explanation,
        },
      }));
      void queryClient.invalidateQueries({ queryKey: ['exam-test', testId] });
    },
  });

  function showAnswer() {
    if (!currentQuestion || !isTutorLike || isRevealed) return;
    showAnswerMutation.mutate(currentQuestion);
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
