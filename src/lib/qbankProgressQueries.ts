import type { QueryClient } from '@tanstack/react-query';

/**
 * QBank surfaces that depend on per-user question state.
 *
 * Mark them stale after any exam mutation that can change a status filter:
 * assignment/create, answer/omission, mark, suspend/resume, complete/end-block,
 * or delete. refetchType:'none' avoids delaying the current exam interaction;
 * the next mounted QBank surface refetches immediately.
 */
export const QBANK_PROGRESS_QUERY_PREFIXES = [
  'test-counts',
  'test-availability',
  'qbank-statistics',
  'question-banks',
  'question-bank',
  'previous-tests',
] as const;

export async function invalidateQbankProgressQueries(
  queryClient: QueryClient,
): Promise<void> {
  await Promise.all(
    QBANK_PROGRESS_QUERY_PREFIXES.map((prefix) =>
      queryClient.invalidateQueries({
        queryKey: [prefix],
        refetchType: 'none',
      }),
    ),
  );
}
