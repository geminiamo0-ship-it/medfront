/**
 * Scans one import root and imports all SQLite banks for that step/track.
 *
 * Supported targets:
 * - step1
 * - step2
 * - step3
 * - library
 * - MRCP Passmedicine 1
 * - MRCP Passmedicine 2
 */

import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { DataSource } from "typeorm";
import * as fs from "fs";
import * as path from "path";
import * as sqlite3 from "sqlite3";
import { promisify } from "util";
import { MainBank } from "../entities/main-bank.entity";
import {
  getStepLabel,
  isExamStep,
  QuestionBank,
  resolveViewerThemeProfileForBankCode,
  USMLEStep,
} from "../entities/question-bank.entity";
import { Question, QuestionDifficulty } from "../entities/question.entity";
import { QuestionOption } from "../entities/question-option.entity";
import { Subject } from "../entities/subject.entity";
import { System } from "../entities/system.entity";
import { Topic } from "../entities/topic.entity";
import { resolveQuestionExternalId } from "./sqlite-import.utils";

interface MainBankDef {
  name: string;
  code: string;
  icon: string;
  gradient: string;
  displayOrder: number;
  isBlockBank?: boolean;
  blockSize?: number;
  // When set, a single DB sitting directly in this folder is imported as a
  // distinct question bank with this name/code UNDER the main bank resolved
  // from name/code above (instead of deriving them from the folder).
  bankName?: string;
  bankCode?: string;
}

const FOLDER_TO_MAIN_BANK: Record<string, MainBankDef> = {
  uworld: {
    name: "UWorld",
    code: "UWORLD",
    icon: "U",
    gradient: "linear-gradient(135deg, #1e3c72 0%, #2a69ac 100%)",
    displayOrder: 1,
  },
  amboss: {
    name: "Amboss",
    code: "Amboss",
    icon: "A",
    gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    displayOrder: 2,
  },
  mehlman: {
    name: "Mehlman",
    code: "MEHLMAN",
    icon: "M",
    gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
    displayOrder: 3,
  },
  nbme: {
    name: "NBME",
    code: "NBME",
    icon: "N",
    gradient: "linear-gradient(135deg, #c0392b 0%, #e74c3c 100%)",
    displayOrder: 4,
  },
  cms: {
    name: "CMS",
    code: "CMS",
    icon: "C",
    gradient: "linear-gradient(135deg, #f39c12 0%, #f1c40f 100%)",
    displayOrder: 5,
  },
  "pass-medicine": {
    name: "Pass Medicine",
    code: "PASS_MED",
    icon: "P",
    gradient: "linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)",
    displayOrder: 6,
  },
  library: {
    name: "Library",
    code: "LIBRARY",
    icon: "L",
    gradient: "linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)",
    displayOrder: 7,
  },
  "mrcp-part-1": {
    name: "MRCP Passmedicine 1",
    code: "MRCP_PART_1",
    icon: "M1",
    gradient: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
    displayOrder: 8,
  },
  "mrcp-part-2": {
    name: "MRCP Passmedicine 2",
    code: "MRCP_PART_2",
    icon: "M2",
    gradient: "linear-gradient(135deg, #b45309 0%, #f59e0b 100%)",
    displayOrder: 9,
  },
  pastest: {
    name: "Pastest",
    code: "PASTEST",
    icon: "PT",
    gradient: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
    displayOrder: 10,
  },
  "past-papers": {
    name: "Past Papers",
    code: "PAST_PAPERS",
    icon: "PP",
    gradient: "linear-gradient(135deg, #475569 0%, #334155 100%)",
    displayOrder: 11,
    isBlockBank: true,
    blockSize: 100,
  },
  // "one_exam" subfolder under all_db/mrcp p 1/. Imports as its OWN provider /
  // main bank ("One Exam", code ONEXAM_S4) in the MRCP Part 1 track — a separate
  // card alongside MRCP Passmedicine 1, Pastest and Past Papers. The question
  // bank keeps the MRCP_PART_1_ONE_EXAM code so a re-import RE-LINKS the existing
  // row to this new main bank (no duplicate) and keeps the MRCP viewer theme via
  // that code prefix.
  one_exam: {
    name: "One Exam",
    code: "ONEXAM",
    icon: "OE",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
    displayOrder: 12,
    bankName: "One Exam",
    bankCode: "MRCP_PART_1_ONE_EXAM",
  },
  // "1exam part2" subfolder under all_db/mrcp p 2/. The One Exam provider's
  // MRCP Part 2 bank — its OWN main-bank card ("1exam - MRCP Passmedicine 2",
  // code ONEXAM_S5) in the MRCP Part 2 track, mirroring how One Exam sits in
  // Part 1. Question bank code MRCP_PART_2_ONE_EXAM keeps the MRCP viewer theme
  // via that prefix and lets a re-import RE-LINK the same row (no duplicate).
  // Folder key = the normalized subfolder name so `import:mrcp2` auto-discovers
  // it when the db is placed at all_db/mrcp p 2/1exam part2/.
  "1exam_part2": {
    name: "1exam",
    code: "ONEXAM2",
    icon: "OE",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
    displayOrder: 13,
    bankName: "One Exam",
    bankCode: "MRCP_PART_2_ONE_EXAM",
  },
};

type ImportStep = 0 | USMLEStep;

interface FixedRootBankDef {
  dirName: string;
  // Alternate on-disk folder names accepted for this step, besides dirName.
  // Lets an operator drop e.g. "mrcp part 2" when the canonical folder is
  // "mrcp p 2" without the scan failing. First existing candidate wins.
  altDirNames?: string[];
  fileName: string;
  mainBankFolder: keyof typeof FOLDER_TO_MAIN_BANK;
  bankName: string;
  bankCode: string;
  step: USMLEStep;
}

const FIXED_ROOT_BANKS: Record<
  USMLEStep.MRCP_PART_1 | USMLEStep.MRCP_PART_2,
  FixedRootBankDef
> = {
  [USMLEStep.MRCP_PART_1]: {
    dirName: "mrcp p 1",
    altDirNames: ["mrcp part 1"],
    fileName: "my_course_bank.db",
    mainBankFolder: "mrcp-part-1",
    bankName: "MRCP Passmedicine 1",
    bankCode: "MRCP_PART_1",
    step: USMLEStep.MRCP_PART_1,
  },
  [USMLEStep.MRCP_PART_2]: {
    dirName: "mrcp p 2",
    altDirNames: ["mrcp part 2"],
    fileName: "my_course_bank.db",
    mainBankFolder: "mrcp-part-2",
    bankName: "MRCP Passmedicine 2",
    bankCode: "MRCP_PART_2",
    step: USMLEStep.MRCP_PART_2,
  },
};

interface ImportTargetContext {
  label: string;
  dirName: string;
}

interface SQLiteQuestion {
  id: number;
  uworld_id?: number | null;
  text_html?: string;
  explanation_html?: string;
  subject?: string;
  system?: string;
  topic?: string;
  source?: string;
  article_id?: number | null;
  library_name?: string | null;
  [key: string]: any;
}

interface SQLiteOptionRow {
  id: number;
  question_id: number;
  text_html?: string;
  is_correct?: boolean | number | null;
  option_order?: number | string | null;
  letter?: string | null;
  uworld_chosen_by?: number | null;
  [key: string]: any;
}

interface DiscoveredBank {
  dbPath: string;
  mainBankFolder: string;
  bankName: string;
  bankCode: string;
  step: ImportStep;
  isBlockBank?: boolean;
  blockSize?: number;
}

interface ImportResult {
  bankName: string;
  bankCode: string;
  status: "success" | "failed" | "skipped";
  imported: number;
  skipped: number;
  errors: number;
  durationMs: number;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function humanize(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function toCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 50);
}

function deriveBankNameAndCode(
  mainBankDef: MainBankDef,
  segments: string[],
  step: ImportStep,
): { name: string; code: string } {
  const isLibrary = step === 0;
  const stepSuffix = isLibrary ? "(Library)" : `(${getStepLabel(step)})`;
  const codeStep = isLibrary ? "_LIB" : `_S${step}`;

  if (segments.length === 0) {
    return {
      name: `${mainBankDef.name} ${stepSuffix}`,
      code: `${mainBankDef.code}${codeStep}`,
    };
  }

  const allNumeric = segments.every((segment) => /^\d+$/.test(segment.trim()));
  if (allNumeric) {
    return {
      name: `${mainBankDef.name} ${segments.join(" ")} ${stepSuffix}`,
      code: toCode(`${mainBankDef.code}_${segments.join("_")}${codeStep}`),
    };
  }

  const combined = segments.map(humanize).join(" ");
  const clean = combined
    .replace(/step \d+/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    name: `${clean} ${stepSuffix}`,
    code: toCode(`${mainBankDef.code}_${segments.join("_")}${codeStep}`),
  };
}

function discover(
  dir: string,
  mainFolderKey: string,
  mainBankDef: MainBankDef,
  step: ImportStep,
  segments: string[],
  out: DiscoveredBank[],
): void {
  const entries = fs.readdirSync(dir);
  const dbFiles = entries.filter((entry) =>
    entry.toLowerCase().endsWith(".db"),
  );

  for (const dbFile of dbFiles) {
    // A folder can pin an explicit bank name/code (e.g. "One Exam" under the
    // MRCP Passmedicine 1 main bank); otherwise derive it from the folder.
    const { name, code } =
      segments.length === 0 && mainBankDef.bankName && mainBankDef.bankCode
        ? { name: mainBankDef.bankName, code: mainBankDef.bankCode }
        : deriveBankNameAndCode(mainBankDef, segments, step);
    out.push({
      dbPath: path.join(dir, dbFile),
      mainBankFolder: mainFolderKey,
      bankName: name,
      bankCode: code,
      step,
      isBlockBank: mainBankDef.isBlockBank,
      blockSize: mainBankDef.blockSize,
    });
  }

  const subdirs = entries.filter((entry) =>
    fs.statSync(path.join(dir, entry)).isDirectory(),
  );

  for (const subdir of subdirs) {
    discover(
      path.join(dir, subdir),
      mainFolderKey,
      mainBankDef,
      step,
      [...segments, subdir],
      out,
    );
  }
}

function scanStepFolder(stepDir: string, step: ImportStep): DiscoveredBank[] {
  const discovered: DiscoveredBank[] = [];

  if (!fs.existsSync(stepDir)) {
    console.error(`Directory not found: ${stepDir}`);
    return discovered;
  }

  const fixedRootBank =
    step === 0
      ? null
      : FIXED_ROOT_BANKS[step as USMLEStep.MRCP_PART_1 | USMLEStep.MRCP_PART_2];

  if (fixedRootBank) {
    const dbPath = path.join(stepDir, fixedRootBank.fileName);
    if (!fs.existsSync(dbPath)) {
      console.warn(
        `Root database not found: ${dbPath}, continuing to subdirectories.`,
      );
    } else {
      discovered.push({
        dbPath,
        mainBankFolder: fixedRootBank.mainBankFolder,
        bankName: fixedRootBank.bankName,
        bankCode: fixedRootBank.bankCode,
        step: fixedRootBank.step,
      });
    }
  }

  const mainBankFolders = fs
    .readdirSync(stepDir)
    .filter((entry) => fs.statSync(path.join(stepDir, entry)).isDirectory());

  for (const mainFolder of mainBankFolders) {
    const mainFolderKey = mainFolder.toLowerCase().trim().replace(/\s+/g, "_");
    const mainBankDef = FOLDER_TO_MAIN_BANK[mainFolderKey];

    if (!mainBankDef) {
      console.warn(`Unknown main bank folder "${mainFolder}", skipping`);
      continue;
    }

    discover(
      path.join(stepDir, mainFolder),
      mainFolderKey,
      mainBankDef,
      step,
      [],
      discovered,
    );
  }

  if (step === 0) {
    const libraryDef = FOLDER_TO_MAIN_BANK.library;
    const rootDbFiles = fs
      .readdirSync(stepDir)
      .filter((entry) => entry.toLowerCase().endsWith(".db"));

    for (const dbFile of rootDbFiles) {
      const { name, code } = deriveBankNameAndCode(libraryDef, [], step);
      discovered.push({
        dbPath: path.join(stepDir, dbFile),
        mainBankFolder: "library",
        bankName: name,
        bankCode: code,
        step,
      });
    }
  }

  return discovered;
}

function resolveImportTargetContext(step: ImportStep): ImportTargetContext {
  if (step === 0) {
    return { label: "Library", dirName: "Library" };
  }

  const fixedRootBank =
    FIXED_ROOT_BANKS[step as USMLEStep.MRCP_PART_1 | USMLEStep.MRCP_PART_2];

  return {
    label: getStepLabel(step),
    dirName: fixedRootBank?.dirName ?? `step${step}`,
  };
}

// On-disk folder-name candidates for a step, canonical first. MRCP steps also
// accept an "mrcp part N" spelling of the canonical "mrcp p N".
function stepDirCandidates(step: ImportStep): string[] {
  if (step === 0) return ["Library"];
  const fixed =
    FIXED_ROOT_BANKS[step as USMLEStep.MRCP_PART_1 | USMLEStep.MRCP_PART_2];
  if (fixed) {
    return [fixed.dirName, ...(fixed.altDirNames ?? [])];
  }
  return [`step${step}`];
}

// Resolve the absolute all_db/<step> directory, returning the first candidate
// that exists on disk (so "mrcp part 2" works when the canonical "mrcp p 2" is
// absent). Falls back to the canonical name when none exist, preserving the
// existing "Directory not found" error path.
function resolveStepDir(step: ImportStep): string {
  const candidates = stepDirCandidates(step);
  for (const name of candidates) {
    const abs = path.resolve(process.cwd(), "all_db", name);
    if (fs.existsSync(abs)) {
      return abs;
    }
  }
  return path.resolve(process.cwd(), "all_db", candidates[0]);
}

class StepImporter {
  private subjectCache = new Map<string, Subject>();
  private systemCache = new Map<string, System>();
  private topicCache = new Map<string, Topic>();
  private mainBankCache = new Map<string, MainBank>();
  private sqliteColumnCache = new Map<string, string[]>();
  private readonly mainBankRepo = this.ds.getRepository(MainBank);
  private readonly questionBankRepo = this.ds.getRepository(QuestionBank);
  private readonly questionRepo = this.ds.getRepository(Question);
  private readonly optionRepo = this.ds.getRepository(QuestionOption);
  private readonly subjectRepo = this.ds.getRepository(Subject);
  private readonly systemRepo = this.ds.getRepository(System);
  private readonly topicRepo = this.ds.getRepository(Topic);

  constructor(private readonly ds: DataSource) {}

  async importBank(
    bank: DiscoveredBank,
    skipExisting: boolean,
  ): Promise<{ imported: number; skipped: number; errors: number }> {
    const stats = { imported: 0, skipped: 0, errors: 0 };
    const bankStartedAt = Date.now();

    const mainBankDef = FOLDER_TO_MAIN_BANK[bank.mainBankFolder];
    const mainBank = await this.ensureMainBank(mainBankDef, bank.step);
    const questionBank = await this.ensureQuestionBank(bank, mainBank.id);
    const db = await this.openSQLite(bank.dbPath);

    try {
      const questions = await this.loadQuestions(db);
      const optionsByQuestionId = await this.loadOptionsByQuestionId(db);
      console.log(`  ${questions.length} questions found in SQLite`);
      console.log(
        `  Loaded ${optionsByQuestionId.size} question option sets from SQLite`,
      );

      // ── Phase 1: Pre-warm dimension caches ──
      console.log("  Phase 1: Pre-warming subject/system/topic caches...");
      const uniqueSubjects = new Set(
        questions.map(
          (q) => (q.subject || "General").trim().substring(0, 100) || "General",
        ),
      );
      const uniqueSystems = new Set(
        questions.map(
          (q) => (q.system || "General").trim().substring(0, 100) || "General",
        ),
      );
      for (const name of uniqueSubjects) await this.ensureSubject(name);
      for (const name of uniqueSystems) await this.ensureSystem(name);
      const uniqueTopicKeys = new Set<string>();
      for (const q of questions) {
        const sName =
          (q.subject || "General").trim().substring(0, 100) || "General";
        const yName =
          (q.system || "General").trim().substring(0, 100) || "General";
        const tName =
          (q.topic || "General").trim().substring(0, 200) || "General";
        const subj = this.subjectCache.get(sName)!;
        const sys = this.systemCache.get(yName)!;
        const key = `${subj.id}:${sys.id}:${tName}`;
        if (!uniqueTopicKeys.has(key)) {
          uniqueTopicKeys.add(key);
          await this.ensureTopic(tName, subj.id, sys.id);
        }
      }
      console.log(
        `  Cached ${uniqueSubjects.size} subjects, ${uniqueSystems.size} systems, ${uniqueTopicKeys.size} topics`,
      );

      // ── Phase 2: Bulk-load existing DB data ──
      console.log("  Phase 2: Loading existing questions & options...");
      const existingQuestions = await this.questionRepo.find({
        where: { questionBankId: questionBank.id },
      });
      const existingQMap = new Map<string, Question>();
      for (const q of existingQuestions) existingQMap.set(q.externalId, q);

      const existingOptionsMap = new Map<number, QuestionOption[]>();
      if (existingQuestions.length > 0) {
        const ids = existingQuestions.map((q) => q.id);
        for (let c = 0; c < ids.length; c += 1000) {
          const chunk = ids.slice(c, c + 1000);
          const opts = await this.optionRepo
            .createQueryBuilder("opt")
            .where("opt.questionId IN (:...ids)", { ids: chunk })
            .getMany();
          for (const opt of opts) {
            const list = existingOptionsMap.get(opt.questionId);
            if (list) list.push(opt);
            else existingOptionsMap.set(opt.questionId, [opt]);
          }
        }
      }
      console.log(
        `  Loaded ${existingQuestions.length} existing questions, ${[...existingOptionsMap.values()].reduce((s, a) => s + a.length, 0)} existing options`,
      );

      // ── Phase 3: Batch upsert questions + options ──
      console.log("  Phase 3: Batch upserting...");
      const BATCH = 200;
      for (let i = 0; i < questions.length; i += BATCH) {
        const batch = questions.slice(i, i + BATCH);

        // Build question payloads
        const toInsert: any[] = [];
        const toUpdate: any[] = [];
        const batchExternalIds: string[] = [];

        for (const sq of batch) {
          const externalId = resolveQuestionExternalId(sq);
          batchExternalIds.push(externalId);
          const existing = existingQMap.get(externalId);
          if (existing && skipExisting) {
            stats.skipped++;
            continue;
          }

          const sName =
            (sq.subject || "General").trim().substring(0, 100) || "General";
          const yName =
            (sq.system || "General").trim().substring(0, 100) || "General";
          const tName =
            (sq.topic || "General").trim().substring(0, 200) || "General";
          const subj = this.subjectCache.get(sName)!;
          const sys = this.systemCache.get(yName)!;
          const topic = this.topicCache.get(`${subj.id}:${sys.id}:${tName}`)!;

          const processHtml = (html: string) => {
            if (!html) return "";
            return html.replace(
              /data-lxid="([^"]+)"/g,
              'data-external_caller="$1"',
            );
          };

          const payload = {
            questionBankId: questionBank.id,
            externalId,
            textHtml: processHtml(sq.text_html || ""),
            explanationHtml: processHtml(sq.explanation_html || ""),
            subjectId: subj.id,
            systemId: sys.id,
            topicId: topic.id,
            step: bank.step === 0 ? USMLEStep.STEP_1 : bank.step,
            source: sq.source || questionBank.code,
            imageUrls: this.extractImages(sq.text_html || ""),
            estimatedTimeSeconds: 90,
            articleId: sq.article_id ?? null,
            libraryName: sq.library_name ?? null,
            isActive: true,
          };

          if (existing) {
            toUpdate.push({ ...existing, ...payload });
          } else {
            toInsert.push({ ...payload, timesAnswered: 0, timesCorrect: 0 });
          }
        }

        // ── Bulk INSERT new questions (1 query for all) ──
        if (toInsert.length > 0) {
          const qCols = [
            '"questionBankId"',
            '"externalId"',
            '"textHtml"',
            '"explanationHtml"',
            '"subjectId"',
            '"systemId"',
            '"topicId"',
            '"step"',
            '"source"',
            '"imageUrls"',
            '"estimatedTimeSeconds"',
            '"articleId"',
            '"libraryName"',
            '"isActive"',
            '"timesAnswered"',
            '"timesCorrect"',
          ];
          const qParams: any[] = [];
          const qRows: string[] = [];
          for (const q of toInsert) {
            const off = qParams.length;
            qParams.push(
              q.questionBankId,
              q.externalId,
              q.textHtml,
              q.explanationHtml,
              q.subjectId,
              q.systemId,
              q.topicId,
              q.step,
              q.source,
              JSON.stringify(q.imageUrls || []),
              q.estimatedTimeSeconds,
              q.articleId,
              q.libraryName,
              q.isActive,
              q.timesAnswered,
              q.timesCorrect,
            );
            qRows.push(`(${qCols.map((_, k) => `$${off + k + 1}`).join(",")})`);
          }
          const inserted: Array<{ id: number; externalId: string }> =
            await this.ds.query(
              `INSERT INTO questions (${qCols.join(",")}) VALUES ${qRows.join(",")} RETURNING id,"externalId"`,
              qParams,
            );
          for (let j = 0; j < inserted.length; j++) {
            const q = { ...toInsert[j], id: inserted[j].id } as any;
            existingQMap.set(q.externalId, q);
          }
          stats.imported += toInsert.length;
        }

        // ── Bulk UPDATE existing questions (1 query for all) ──
        if (toUpdate.length > 0) {
          const uParams: any[] = [];
          const uRows: string[] = [];
          const UC = 14; // columns per row
          for (const q of toUpdate) {
            const off = uParams.length;
            uParams.push(
              q.id,
              q.textHtml,
              q.explanationHtml,
              q.subjectId,
              q.systemId,
              q.topicId,
              q.step,
              q.source,
              JSON.stringify(q.imageUrls || []),
              q.estimatedTimeSeconds,
              q.articleId,
              q.libraryName,
              q.isActive,
              q.externalId,
            );
            uRows.push(
              `(${Array.from({ length: UC }, (_, k) => `$${off + k + 1}`).join(",")})`,
            );
          }
          await this.ds.query(
            `
            UPDATE questions AS q SET
              "textHtml" = v.c2, "explanationHtml" = v.c3,
              "subjectId" = v.c4::int, "systemId" = v.c5::int, "topicId" = v.c6::int,
              "step" = v.c7::int, "source" = v.c8, "imageUrls" = v.c9::json,
              "estimatedTimeSeconds" = v.c10::int, "articleId" = v.c11::int,
              "libraryName" = v.c12, "isActive" = v.c13::boolean, "updatedAt" = NOW()
            FROM (VALUES ${uRows.join(",")}) AS v(c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14)
            WHERE q.id = v.c1::int
          `,
            uParams,
          );
          for (const q of toUpdate) existingQMap.set(q.externalId, q as any);
          stats.imported += toUpdate.length;
        }

        // ── Build option payloads ──
        const allOptInserts: any[] = [];
        const allOptUpdates: any[] = [];
        for (const sq of batch) {
          const externalId = resolveQuestionExternalId(sq);
          const dbQ = existingQMap.get(externalId);
          if (!dbQ) continue;
          const sqlOpts = optionsByQuestionId.get(sq.id) ?? [];
          const entries = this.computeOptionEntries(sqlOpts);
          const existOpts = existingOptionsMap.get(dbQ.id) || [];
          const optByDisplay = new Map<string, QuestionOption>();
          for (const o of existOpts) {
            if (!optByDisplay.has(o.displayOrder))
              optByDisplay.set(o.displayOrder, o);
          }
          for (const entry of entries) {
            const ex = optByDisplay.get(entry.displayOrder);
            if (ex) {
              const rawChosen = entry.option.uworld_chosen_by;
              allOptUpdates.push({
                id: ex.id,
                textHtml: entry.option.text_html || "",
                isCorrect: Boolean(entry.option.is_correct),
                uworldChosenBy:
                  rawChosen != null ? Math.round(Number(rawChosen)) : null,
              });
            } else {
              const rawChosen2 = entry.option.uworld_chosen_by;
              allOptInserts.push({
                questionId: dbQ.id,
                textHtml: entry.option.text_html || "",
                isCorrect: Boolean(entry.option.is_correct),
                displayOrder: entry.displayOrder,
                uworldChosenBy:
                  rawChosen2 != null ? Math.round(Number(rawChosen2)) : null,
                explanationHtml: null,
              });
            }
          }
        }

        // ── Bulk UPDATE existing options (1 query) ──
        if (allOptUpdates.length > 0) {
          const oParams: any[] = [];
          const oRows: string[] = [];
          for (const o of allOptUpdates) {
            const off = oParams.length;
            oParams.push(o.id, o.textHtml, o.isCorrect, o.uworldChosenBy);
            oRows.push(`(${[1, 2, 3, 4].map((k) => `$${off + k}`).join(",")})`);
          }
          await this.ds.query(
            `
            UPDATE question_options AS o SET
              "textHtml" = v.c2, "isCorrect" = v.c3::boolean,
              "uworld_chosen_by" = CASE WHEN v.c4 IS NULL THEN NULL ELSE ROUND(v.c4::numeric)::int END, "updatedAt" = NOW()
            FROM (VALUES ${oRows.join(",")}) AS v(c1, c2, c3, c4)
            WHERE o.id = v.c1::int
          `,
            oParams,
          );
        }

        // ── Bulk INSERT new options (1 query) ──
        if (allOptInserts.length > 0) {
          const oCols = [
            '"questionId"',
            '"textHtml"',
            '"isCorrect"',
            '"displayOrder"',
            '"uworld_chosen_by"',
            '"explanationHtml"',
          ];
          const oParams: any[] = [];
          const oRows: string[] = [];
          for (const o of allOptInserts) {
            const off = oParams.length;
            oParams.push(
              o.questionId,
              o.textHtml,
              o.isCorrect,
              o.displayOrder,
              o.uworldChosenBy,
              o.explanationHtml,
            );
            oRows.push(`(${oCols.map((_, k) => `$${off + k + 1}`).join(",")})`);
          }
          await this.ds.query(
            `INSERT INTO question_options (${oCols.join(",")}) VALUES ${oRows.join(",")}`,
            oParams,
          );
        }

        // Progress
        const processed = Math.min(i + BATCH, questions.length);
        const elapsedMs = Date.now() - bankStartedAt;
        const rate =
          processed > 0 ? processed / Math.max(elapsedMs / 1000, 1) : 0;
        const remaining = Math.max(questions.length - processed, 0);
        const etaSeconds = rate > 0 ? remaining / rate : 0;
        console.log(
          `  Progress ${processed}/${questions.length} | imported=${stats.imported} skipped=${stats.skipped} errors=${stats.errors} | elapsed=${formatDuration(elapsedMs)} | eta=${formatDuration(etaSeconds * 1000)} | rate=${rate.toFixed(1)}/s`,
        );
      }

      const total = await this.questionRepo.count({
        where: { questionBankId: questionBank.id },
      });
      await this.questionBankRepo.update(questionBank.id, {
        totalQuestions: total,
      });
    } finally {
      db.close();
    }

    return stats;
  }

  private computeOptionEntries(
    options: SQLiteOptionRow[],
  ): Array<{ option: any; displayOrder: string }> {
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const numericOrders = options
      .map((opt) => {
        const raw =
          (opt as any).option_order ??
          (opt as any).order ??
          (opt as any).position;
        const num = raw === null || raw === undefined ? NaN : Number(raw);
        return Number.isFinite(num) ? num : NaN;
      })
      .filter((val) => Number.isFinite(val)) as number[];
    const minOrder =
      numericOrders.length > 0 ? Math.min(...numericOrders) : null;
    const orderBase = minOrder === 0 ? 0 : 1;

    const entries = options.map((option: any, index: number) => {
      const letter =
        option.letter && /^[A-Ha-h]$/.test(option.letter)
          ? option.letter.toUpperCase()
          : null;
      const rawOrder = option.option_order ?? option.order ?? option.position;
      const num =
        rawOrder === null || rawOrder === undefined ? NaN : Number(rawOrder);
      const orderVal = Number.isFinite(num) ? num : null;
      const normalizedIndex =
        orderVal === null ? null : orderBase === 0 ? orderVal : orderVal - 1;
      const computed =
        letter ??
        (normalizedIndex !== null &&
        normalizedIndex >= 0 &&
        normalizedIndex < letters.length
          ? letters[normalizedIndex]
          : null) ??
        letters[index] ??
        "A";
      const sortKey =
        orderVal !== null
          ? orderVal
          : letter
            ? Math.max(0, letters.indexOf(letter))
            : index;
      return { option, index, displayOrder: computed, sortKey };
    });

    const displayOrders = entries.map((e) => e.displayOrder);
    if (new Set(displayOrders).size !== displayOrders.length) {
      const sorted = [...entries].sort((a, b) =>
        a.sortKey !== b.sortKey ? a.sortKey - b.sortKey : a.index - b.index,
      );
      sorted.forEach((entry, idx) => {
        entry.displayOrder = letters[idx] ?? letters[letters.length - 1] ?? "A";
      });
    }
    return entries;
  }

  private async ensureMainBank(
    def: MainBankDef,
    step: ImportStep,
  ): Promise<MainBank> {
    const isLibrary = step === 0;
    const stepLabel = isLibrary ? "Library" : getStepLabel(step);
    const hasExplicitStepIdentity = !isLibrary && def.name === stepLabel;
    const stepSpecificCode = isLibrary
      ? `${def.code}_LIB`
      : hasExplicitStepIdentity
        ? def.code
        : `${def.code}_S${step}`;
    const stepSpecificName =
      isLibrary || hasExplicitStepIdentity
        ? def.name
        : `${def.name} - ${stepLabel}`;

    if (this.mainBankCache.has(stepSpecificCode)) {
      return this.mainBankCache.get(stepSpecificCode)!;
    }

    let mainBank = await this.mainBankRepo.findOne({
      where: { code: stepSpecificCode },
    });
    if (!mainBank) {
      mainBank = this.mainBankRepo.create({
        name: stepSpecificName,
        code: stepSpecificCode,
        icon: def.icon,
        gradient: def.gradient,
        displayOrder: def.displayOrder,
        description: `${def.name} question bank provider for ${stepLabel}`,
        isPremium: true,
        isActive: true,
      });
      mainBank = await this.mainBankRepo.save(mainBank);
      console.log(
        `  Created MainBank: ${stepSpecificName} [${stepSpecificCode}]`,
      );
    }

    this.mainBankCache.set(stepSpecificCode, mainBank);
    return mainBank;
  }

  private async ensureQuestionBank(
    bank: DiscoveredBank,
    mainBankId: number,
  ): Promise<QuestionBank> {
    let questionBank = await this.questionBankRepo.findOne({
      where: { code: bank.bankCode },
    });

    if (!questionBank) {
      questionBank = this.questionBankRepo.create({
        mainBankId,
        name: bank.bankName,
        code: bank.bankCode,
        step: bank.step === 0 ? USMLEStep.STEP_1 : bank.step,
        description: `${bank.bankName} question bank`,
        totalQuestions: 0,
        isPremium: true,
        isBlockBank: bank.isBlockBank ?? false,
        blockSize: bank.blockSize ?? 20,
        isActive: true,
        displayOrder: 0,
        viewerThemeProfile: resolveViewerThemeProfileForBankCode(bank.bankCode),
      });
      questionBank = await this.questionBankRepo.save(questionBank);
      console.log(
        `  Created QuestionBank: ${bank.bankName} [${bank.bankCode}]${bank.isBlockBank ? ` (block bank, blockSize=${bank.blockSize})` : ""}`,
      );
    } else if (questionBank.mainBankId !== mainBankId) {
      questionBank.mainBankId = mainBankId;
      questionBank.viewerThemeProfile = resolveViewerThemeProfileForBankCode(
        questionBank.code,
      );
      questionBank = await this.questionBankRepo.save(questionBank);
      console.log(`  Updated MainBank link for: ${bank.bankCode}`);
    } else {
      const expectedViewerThemeProfile = resolveViewerThemeProfileForBankCode(
        questionBank.code,
      );
      if (questionBank.viewerThemeProfile !== expectedViewerThemeProfile) {
        questionBank.viewerThemeProfile = expectedViewerThemeProfile;
        questionBank = await this.questionBankRepo.save(questionBank);
        console.log(`  Updated Viewer Theme Profile for: ${bank.bankCode}`);
      }
    }

    return questionBank;
  }

  private openSQLite(dbPath: string): Promise<sqlite3.Database> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(db);
        }
      });
    });
  }

  private async getColumns(
    db: sqlite3.Database,
    table: string,
  ): Promise<string[]> {
    const cacheKey = `${table}:${(db as any).filename ?? "sqlite"}`;
    const cached = this.sqliteColumnCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const all = promisify(db.all.bind(db));
    const rows = (await all(`PRAGMA table_info(${table})`)) as Array<{
      name: string;
    }>;
    const columns = rows.map((row) => row.name);
    this.sqliteColumnCache.set(cacheKey, columns);
    return columns;
  }

  private async loadQuestions(db: sqlite3.Database): Promise<SQLiteQuestion[]> {
    const all = promisify(db.all.bind(db));
    const cols = await this.getColumns(db, "questions");

    const textCol = cols.includes("text_html") ? "text_html" : "stem";
    const explanationCol = cols.includes("explanation_html")
      ? "explanation_html"
      : "explanation";
    const subjectCol = cols.includes("subject") ? "subject" : "''";
    const systemCol = cols.includes("system") ? "system" : "''";
    const topicCol = cols.includes("topic") ? "topic" : "''";
    const sourceCol = cols.includes("source") ? "source" : "''";
    const uworldIdCol = cols.includes("uworld_id") ? "uworld_id" : "NULL";
    const articleIdCol = cols.includes("article_id") ? "article_id" : "NULL";
    const libraryNameCol = cols.includes("library_name")
      ? "library_name"
      : "NULL";

    return all(`
      SELECT
        id,
        ${uworldIdCol} AS uworld_id,
        ${textCol} AS text_html,
        ${explanationCol} AS explanation_html,
        ${subjectCol} AS subject,
        ${systemCol} AS system,
        ${topicCol} AS topic,
        ${sourceCol} AS source,
        ${articleIdCol} AS article_id,
        ${libraryNameCol} AS library_name
      FROM questions
      ORDER BY id
    `) as Promise<SQLiteQuestion[]>;
  }

  private async loadOptionsByQuestionId(
    db: sqlite3.Database,
  ): Promise<Map<number, SQLiteOptionRow[]>> {
    const all = promisify(db.all.bind(db));
    const cols = await this.getColumns(db, "options");

    const textCol = cols.includes("text_html") ? "text_html" : "text";
    const orderCol =
      ["option_order", "order", "display_order", "position", "sort_order"].find(
        (column) => cols.includes(column),
      ) ?? null;
    const letterCol = cols.includes("letter") ? "letter" : null;
    const uworldChosenCol = cols.includes("uworld_chosen_by")
      ? "uworld_chosen_by"
      : null;
    const orderClause = orderCol
      ? `ORDER BY question_id, ${orderCol}`
      : letterCol
        ? `ORDER BY question_id, ${letterCol}`
        : "ORDER BY question_id, id";

    const rows = (await all(
      `
      SELECT
        id,
        question_id,
        ${textCol} AS text_html,
        is_correct
        ${orderCol ? `, ${orderCol} AS option_order` : ""}
        ${letterCol ? `, ${letterCol} AS letter` : ""}
        ${uworldChosenCol ? `, ${uworldChosenCol} AS uworld_chosen_by` : ""}
      FROM options
      ${orderClause}
    `,
    )) as SQLiteOptionRow[];

    const grouped = new Map<number, SQLiteOptionRow[]>();
    for (const row of rows) {
      const list = grouped.get(row.question_id);
      if (list) {
        list.push(row);
      } else {
        grouped.set(row.question_id, [row]);
      }
    }
    return grouped;
  }

  private async importQuestion(
    sqliteQuestion: SQLiteQuestion,
    options: SQLiteOptionRow[],
    questionBank: QuestionBank,
    step: ImportStep,
    skipExisting: boolean,
  ): Promise<boolean> {
    const externalId = resolveQuestionExternalId(sqliteQuestion);

    let savedQuestion = await this.questionRepo.findOne({
      where: { externalId, questionBankId: questionBank.id },
    });

    if (savedQuestion && skipExisting) {
      return true;
    }

    const subject = await this.ensureSubject(
      sqliteQuestion.subject || "General",
    );
    const system = await this.ensureSystem(sqliteQuestion.system || "General");
    const topic = await this.ensureTopic(
      sqliteQuestion.topic || "General",
      subject.id,
      system.id,
    );

    const processHtml = (html: string) => {
      if (!html) return "";
      return html.replace(/data-lxid="([^"]+)"/g, 'data-external_caller="$1"');
    };

    const basePayload = {
      questionBankId: questionBank.id,
      externalId,
      textHtml: processHtml(sqliteQuestion.text_html || ""),
      explanationHtml: processHtml(sqliteQuestion.explanation_html || ""),
      subjectId: subject.id,
      systemId: system.id,
      topicId: topic.id,
      difficulty: this.inferDifficulty(sqliteQuestion.text_html || ""),
      step: step === 0 ? USMLEStep.STEP_1 : step,
      source: sqliteQuestion.source || questionBank.code,
      imageUrls: this.extractImages(sqliteQuestion.text_html || ""),
      estimatedTimeSeconds: 90,
      articleId: sqliteQuestion.article_id ?? null,
      libraryName: sqliteQuestion.library_name ?? null,
      isActive: true,
    };

    if (!savedQuestion) {
      savedQuestion = await this.questionRepo.save(
        this.questionRepo.create({
          ...basePayload,
          timesAnswered: 0,
          timesCorrect: 0,
        }),
      );
    } else {
      savedQuestion = await this.questionRepo.save({
        ...savedQuestion,
        ...basePayload,
      });
    }

    const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const numericOrders = options
      .map((opt) => {
        const raw = opt.option_order ?? opt.order ?? opt.position;
        const num = raw === null || raw === undefined ? NaN : Number(raw);
        return Number.isFinite(num) ? num : NaN;
      })
      .filter((val) => Number.isFinite(val)) as number[];
    const minOrder =
      numericOrders.length > 0 ? Math.min(...numericOrders) : null;
    const orderBase = minOrder === 0 ? 0 : 1;

    const entries = options.map((option: any, index: number) => {
      const letter =
        option.letter && /^[A-Ha-h]$/.test(option.letter)
          ? option.letter.toUpperCase()
          : null;
      const rawOrder = option.option_order ?? option.order ?? option.position;
      const num =
        rawOrder === null || rawOrder === undefined ? NaN : Number(rawOrder);
      const orderVal = Number.isFinite(num) ? num : null;
      const normalizedIndex =
        orderVal === null ? null : orderBase === 0 ? orderVal : orderVal - 1;
      const computed =
        letter ??
        (normalizedIndex !== null &&
        normalizedIndex >= 0 &&
        normalizedIndex < letters.length
          ? letters[normalizedIndex]
          : null) ??
        letters[index] ??
        "A";
      const sortKey =
        orderVal !== null
          ? orderVal
          : letter
            ? Math.max(0, letters.indexOf(letter))
            : index;
      return { option, index, displayOrder: computed, sortKey };
    });

    const displayOrders = entries.map((entry) => entry.displayOrder);
    if (new Set(displayOrders).size !== displayOrders.length) {
      const sortedEntries = [...entries].sort((a, b) => {
        if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
        return a.index - b.index;
      });
      sortedEntries.forEach((entry, idx) => {
        entry.displayOrder = letters[idx] ?? letters[letters.length - 1] ?? "A";
      });
    }

    const existingOptions = await this.optionRepo.find({
      where: { questionId: savedQuestion.id },
    });
    const optionByDisplay = new Map<string, QuestionOption>();
    existingOptions.forEach((opt) => {
      if (!optionByDisplay.has(opt.displayOrder)) {
        optionByDisplay.set(opt.displayOrder, opt);
      }
    });

    for (const entry of entries) {
      const existing = optionByDisplay.get(entry.displayOrder);
      if (existing) {
        existing.textHtml = entry.option.text_html || "";
        existing.isCorrect = Boolean(entry.option.is_correct);
        existing.uworldChosenBy = entry.option.uworld_chosen_by ?? null;
        await this.optionRepo.save(existing);
      } else {
        await this.optionRepo.save(
          this.optionRepo.create({
            questionId: savedQuestion.id,
            textHtml: entry.option.text_html || "",
            isCorrect: Boolean(entry.option.is_correct),
            displayOrder: entry.displayOrder,
            uworldChosenBy: entry.option.uworld_chosen_by ?? null,
            explanationHtml: null,
          }),
        );
      }
    }

    return false;
  }

  private async ensureSubject(name: string): Promise<Subject> {
    const normalizedName =
      (name || "General").trim().substring(0, 100) || "General";
    if (this.subjectCache.has(normalizedName)) {
      return this.subjectCache.get(normalizedName)!;
    }

    let subject = await this.subjectRepo.findOne({
      where: { name: normalizedName },
    });
    if (!subject) {
      const baseCode =
        normalizedName
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "")
          .substring(0, 15) || "SUBJ";

      for (let attempt = 0; attempt < 20; attempt++) {
        const code =
          attempt === 0 ? baseCode : `${baseCode.substring(0, 15)}_${attempt}`;
        try {
          subject = await this.subjectRepo.save(
            this.subjectRepo.create({
              name: normalizedName,
              code,
              description: normalizedName,
              icon: "S",
              displayOrder: 0,
              isActive: true,
            }),
          );
          break;
        } catch {
          subject = await this.subjectRepo.findOne({
            where: { name: normalizedName },
          });
          if (subject) {
            break;
          }
          if (attempt > 5) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      }
    }

    if (!subject) {
      throw new Error(`Could not find or create subject: ${normalizedName}`);
    }

    this.subjectCache.set(normalizedName, subject);
    return subject;
  }

  private async ensureSystem(name: string): Promise<System> {
    const normalizedName =
      (name || "General").trim().substring(0, 100) || "General";
    if (this.systemCache.has(normalizedName)) {
      return this.systemCache.get(normalizedName)!;
    }

    let system = await this.systemRepo.findOne({
      where: { name: normalizedName },
    });
    if (!system) {
      const baseCode =
        normalizedName
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "")
          .substring(0, 15) || "SYS";

      for (let attempt = 0; attempt < 20; attempt++) {
        const code =
          attempt === 0 ? baseCode : `${baseCode.substring(0, 15)}_${attempt}`;
        try {
          system = await this.systemRepo.save(
            this.systemRepo.create({
              name: normalizedName,
              code,
              description: normalizedName,
              icon: "Y",
              displayOrder: 0,
              isActive: true,
            }),
          );
          break;
        } catch {
          system = await this.systemRepo.findOne({
            where: { name: normalizedName },
          });
          if (system) {
            break;
          }
          if (attempt > 5) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      }
    }

    if (!system) {
      throw new Error(`Could not find or create system: ${normalizedName}`);
    }

    this.systemCache.set(normalizedName, system);
    return system;
  }

  private async ensureTopic(
    name: string,
    subjectId: number,
    systemId: number,
  ): Promise<Topic> {
    const normalizedName =
      (name || "General").trim().substring(0, 200) || "General";
    const key = `${subjectId}:${systemId}:${normalizedName}`;

    if (this.topicCache.has(key)) {
      return this.topicCache.get(key)!;
    }

    let topic = await this.topicRepo.findOne({
      where: { name: normalizedName, subjectId, systemId },
    });

    if (!topic) {
      try {
        topic = await this.topicRepo.save(
          this.topicRepo.create({
            name: normalizedName,
            subjectId,
            systemId,
            description: normalizedName,
            displayOrder: 0,
            isActive: true,
          }),
        );
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
        topic = await this.topicRepo.findOne({
          where: { name: normalizedName, subjectId, systemId },
        });
      }
    }

    if (!topic) {
      throw new Error(`Could not find or create topic: ${normalizedName}`);
    }

    this.topicCache.set(key, topic);
    return topic;
  }

  private inferDifficulty(html: string): QuestionDifficulty {
    const length = (html || "").length;
    if (length < 800) {
      return QuestionDifficulty.EASY;
    }
    if (length < 1800) {
      return QuestionDifficulty.MEDIUM;
    }
    return QuestionDifficulty.HARD;
  }

  private extractImages(html: string): string[] {
    if (!html) {
      return [];
    }
    const matches =
      html.match(/src="([^"]+\.(jpg|jpeg|png|gif|webp))"/gi) || [];
    return matches.map((match) => match.replace(/src="([^"]+)"/, "$1"));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const skipExisting = args.includes("--skip-existing");
  const dryRun = args.includes("--dry-run");
  const stepArg = args.find((arg) => arg.startsWith("--step="))?.split("=")[1];

  const isLibrary = stepArg === "library";
  const parsedStep = isLibrary
    ? 0
    : stepArg
      ? parseInt(stepArg, 10)
      : USMLEStep.STEP_1;

  if (!isLibrary && !isExamStep(parsedStep)) {
    console.error(`Unsupported step value: ${stepArg}`);
    process.exit(1);
  }

  const step = parsedStep as ImportStep;
  const { label: importLabel } = resolveImportTargetContext(step);
  const stepDir = resolveStepDir(step);

  console.log(`\n${"=".repeat(64)}`);
  console.log(`  MedPark - ${importLabel} Importer`);
  console.log("=".repeat(64));
  console.log(`  Scanning: ${stepDir}`);
  console.log(`  Skip existing: ${skipExisting} | Dry run: ${dryRun}`);
  console.log(`${"=".repeat(64)}\n`);

  const banks = scanStepFolder(stepDir, step);
  if (banks.length === 0) {
    console.error("No databases found. Check your folder structure.");
    process.exit(1);
  }

  console.log(`Discovered ${banks.length} database(s):\n`);
  banks.forEach((bank, index) => {
    console.log(`  [${index + 1}] ${bank.bankName}`);
    console.log(`       Code: ${bank.bankCode}`);
    console.log(`       Path: ${bank.dbPath}`);
  });

  if (dryRun) {
    console.log("\nDry run complete. No data was written.");
    process.exit(0);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  const dataSource = app.get(DataSource);
  const importer = new StepImporter(dataSource);

  const results: ImportResult[] = [];
  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (let index = 0; index < banks.length; index++) {
    const bank = banks[index];
    console.log(`\n${"-".repeat(64)}`);
    console.log(`[${index + 1}/${banks.length}] ${bank.bankName}`);
    console.log(`  ${bank.dbPath}`);
    console.log("-".repeat(64));

    const startedAt = Date.now();
    try {
      const { imported, skipped, errors } = await importer.importBank(
        bank,
        skipExisting,
      );
      const durationMs = Date.now() - startedAt;

      totalImported += imported;
      totalSkipped += skipped;
      totalErrors += errors;
      results.push({
        bankName: bank.bankName,
        bankCode: bank.bankCode,
        status: errors > 0 ? "failed" : "success",
        imported,
        skipped,
        errors,
        durationMs,
      });

      console.log(
        `  ${imported} imported, ${skipped} skipped, ${errors} errors (${(
          durationMs / 1000
        ).toFixed(1)}s)`,
      );
    } catch (error: any) {
      const durationMs = Date.now() - startedAt;
      console.error(`  FAILED: ${error.message}`);
      results.push({
        bankName: bank.bankName,
        bankCode: bank.bankCode,
        status: "failed",
        imported: 0,
        skipped: 0,
        errors: 1,
        durationMs,
      });
      totalErrors++;
    }
  }

  const failed = results.filter((result) => result.status === "failed");
  console.log(`\n\n${"=".repeat(64)}`);
  console.log(`  ${importLabel.toUpperCase()} IMPORT COMPLETE`);
  console.log("=".repeat(64));
  console.log(`  Banks: ${results.length - failed.length} / ${results.length}`);
  console.log(`  Imported: ${totalImported.toLocaleString()} questions`);
  console.log(`  Skipped: ${totalSkipped.toLocaleString()} questions`);
  console.log(`  Errors: ${totalErrors}`);

  if (failed.length > 0) {
    console.log("\n  Failed banks:");
    failed.forEach((result) => {
      console.log(`    ${result.bankCode} - ${result.bankName}`);
    });
  }

  console.log("\n  Per-bank results:");
  results.forEach((result) => {
    console.log(
      `  ${result.bankCode.padEnd(20)} ${String(result.imported).padStart(6)} imported ${String(
        result.skipped,
      ).padStart(6)} skipped ${(result.durationMs / 1000).toFixed(1)}s`,
    );
  });

  console.log(`\n${"=".repeat(64)}\n`);

  await app.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal:", error);
    process.exit(1);
  });
}

export {
  FIXED_ROOT_BANKS,
  resolveImportTargetContext,
  resolveStepDir,
  scanStepFolder,
  StepImporter,
};
export type { DiscoveredBank, ImportStep };
