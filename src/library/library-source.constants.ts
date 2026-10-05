export enum LibrarySource {
  USMLE = "usmle",
  AMBOSS = "amboss",
  PASSMEDICINE = "passmedicine",
  PASTEST = "pastest",
  PASTEST_2 = "pastest_2",
  PM_DIAGRAMS = "pm_diagrams",
  PM_INDEX = "pm_index",
  ONE_EXAM_NOTES = "1exam_notes",
  PM_LIBRARY_PART_2 = "pm_library_part_2",
  ALL = "all",
}

export enum LibraryStoredSource {
  USMLE = "usmle",
  AMBOSS = "amboss",
  PASSMEDICINE = "passmedicine",
  PASTEST = "pastest",
  PASTEST_2 = "pastest_2",
  PM_DIAGRAMS = "pm_diagrams",
  PM_INDEX = "pm_index",
  ONE_EXAM_NOTES = "1exam_notes",
  PM_LIBRARY_PART_2 = "pm_library_part_2",
}

export enum LibraryQBank {
  PASSMED = "passmed",
  PASTEST = "pastest",
  PASTEST_2 = "pastest_2",
}

export type LibrarySourceFilter =
  | { source: LibraryStoredSource | LibrarySource.ALL }
  | { source: LibraryStoredSource; qbank: LibraryQBank };

export const LIBRARY_SOURCE_ALIASES: Record<string, LibrarySource> = {
  [LibraryQBank.PASSMED]: LibrarySource.PASSMEDICINE,
  [LibraryQBank.PASTEST]: LibrarySource.PASTEST,
  [LibraryQBank.PASTEST_2]: LibrarySource.PASTEST_2,
};
