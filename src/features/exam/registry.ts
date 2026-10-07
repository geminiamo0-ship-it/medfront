import type { ExamQuestionBank, ExamTest } from './types';

export type ExamThemeId = 'amboss' | 'standard';

const AMBOSS_MAIN_BANK_ID = 1;

function isAmbossBank(bank?: ExamQuestionBank | null) {
  if (!bank) return false;
  if (bank.mainBankId === AMBOSS_MAIN_BANK_ID) return true;
  return /AMBOSS/i.test(`${bank.code} ${bank.name}`);
}

export function resolveExamTheme(test: ExamTest): ExamThemeId {
  if (test.questions.some((question) => isAmbossBank(question.questionBank))) {
    return 'amboss';
  }
  return 'standard';
}
