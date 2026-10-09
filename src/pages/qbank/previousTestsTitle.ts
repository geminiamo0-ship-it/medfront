import type { SystemWithTopics } from '@/api/tests';

const MAX_TITLE_LENGTH = 200;

/**
 * Generate a persisted, user-visible test title from selected taxonomy names.
 * The backend still validates titles and remains the authority for selection;
 * this helper never reconstructs question pools from a saved test.
 */
export function buildAutomaticTestTitle({
  bankName,
  isCustom,
  modes,
  selectedSystemIds,
  selectedTopicIds,
  systems,
}: {
  bankName: string | undefined;
  isCustom: boolean;
  modes: string[];
  selectedSystemIds: number[];
  selectedTopicIds: number[];
  systems: SystemWithTopics[];
}): string {
  const selectedSystems = new Set(isCustom ? [] : selectedSystemIds);
  const selectedTopics = new Set(isCustom ? [] : selectedTopicIds);
  const names: string[] = [];
  const seen = new Set<string>();

  function add(label: string, name: string) {
    const normalized = name.replace(/\s+/g, ' ').trim();
    if (!normalized) return;
    const key = label + ':' + normalized.toLocaleLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(label + ': ' + normalized);
  }

  for (const system of systems) {
    if (selectedSystems.has(system.id)) add('System', system.name);
    for (const topic of system.topics ?? []) {
      if (selectedTopics.has(topic.id)) add('Topic', topic.name);
    }
  }

  const fallbackMode = isCustom ? 'Custom' : modes.length > 1 ? 'Mixed' : modes[0] || 'All';
  const fallbackName = (bankName?.trim() || 'Question Bank') + ' — ' + fallbackMode;
  if (!names.length) return Array.from(fallbackName).slice(0, MAX_TITLE_LENGTH).join('');

  const output: string[] = [];
  for (let index = 0; index < names.length; index += 1) {
    const proposed = [...output, names[index]].join(' · ');
    const omitted = names.length - index - 1;
    const withSuffix = proposed + (omitted ? ' · +' + omitted + ' more' : '');
    if (Array.from(withSuffix).length <= MAX_TITLE_LENGTH) {
      output.push(names[index]);
    } else {
      break;
    }
  }

  if (!output.length) {
    // A single pathological taxonomy name must not exceed the 200-char DTO.
    const first = Array.from(names[0]).slice(0, MAX_TITLE_LENGTH - 2).join('');
    return first + '…';
  }

  const remaining = names.length - output.length;
  return output.join(' · ') + (remaining ? ' · +' + remaining + ' more' : '');
}
