import type { ExamQuestionBank, ExamTest } from './types';

export type ExamThemeId = 'amboss' | 'uworld' | 'standard';

const AMBOSS_BANK_ID = 1;
const AMBOSS_MAIN_BANK_ID = 1;

function isAmbossBank(bank?: ExamQuestionBank | null) {
  if (!bank) return false;
  if (bank.id === AMBOSS_BANK_ID || bank.mainBankId === AMBOSS_MAIN_BANK_ID) return true;
  return /AMBOSS/i.test(`${bank.code} ${bank.name}`);
}

export function resolveExamTheme(test: ExamTest): ExamThemeId {
  if (test.questions.some((question) => isAmbossBank(question.questionBank))) {
    return 'amboss';
  }
  const metadata = test.questions.map(q => `${q.questionBank?.code ?? ''} ${q.questionBank?.name ?? ''}`).join(' ');
  if (/uworld|u-world|u_world/i.test(`${test.viewerThemeProfileSnapshot ?? ''} ${metadata}`)) return 'uworld';
  return 'standard';
}
