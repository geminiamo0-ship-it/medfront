export interface StepInfo {
  step: number;
  title: string;
  subtitle: string;
}

/** The five exam tracks shown as tabs on the dashboard. */
export const STEPS: StepInfo[] = [
  { step: 1, title: 'Step 1', subtitle: 'Foundation' },
  { step: 2, title: 'Step 2', subtitle: 'Intermediate' },
  { step: 3, title: 'Step 3', subtitle: 'Advanced' },
  { step: 4, title: 'MRCP Part 1', subtitle: 'Core Medicine' },
  { step: 5, title: 'MRCP Part 2', subtitle: 'Clinical Reasoning' },
];

export function stepLabel(step: number): string {
  return STEPS.find((s) => s.step === step)?.title ?? `Step ${step}`;
}

export interface LibrarySource {
  id: string;
  label: string;
}

/** Library sources, matching the recovered library page's switcher. */
export const LIBRARY_SOURCES: LibrarySource[] = [
  { id: 'usmle', label: 'USMLE Step 1-3' },
  { id: 'amboss', label: 'Amboss' },
  { id: 'passmedicine', label: 'PassMedicine' },
  { id: 'pm_library_part_2', label: 'PM Part 2' },
  { id: 'pastest', label: 'Pastest' },
  { id: 'pastest_2', label: 'Pastest 2' },
  { id: '1exam_notes', label: '1Exam Notes' },
  { id: 'pm_index', label: 'PM Index' },
  { id: 'pm_diagrams', label: 'PM Diagrams' },
];