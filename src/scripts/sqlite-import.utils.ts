export interface SQLiteQuestionIdentity {
  id: number | string;
  uworld_id?: number | string | null;
}

export function resolveQuestionExternalId(question: SQLiteQuestionIdentity): string {
  return String(question.uworld_id ?? question.id);
}
