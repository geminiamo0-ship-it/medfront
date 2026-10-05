import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { DataSource } from "typeorm";
import * as sqlite3 from "sqlite3";
import { promisify } from "util";
import { Subject } from "../entities/subject.entity";
import { System } from "../entities/system.entity";
import { Topic } from "../entities/topic.entity";
import { QuestionBank } from "../entities/question-bank.entity";
import { MainBank } from "../entities/main-bank.entity";
import { Question, QuestionDifficulty } from "../entities/question.entity";
import { QuestionOption } from "../entities/question-option.entity";
import { getStepLabel, USMLEStep } from "../entities/question-bank.entity";
import { resolveQuestionExternalId } from "./sqlite-import.utils";

// SQLite question structure (flexible – covers UWorld + Pass Medicine schemas)
interface SQLiteQuestion {
  id: number;
  uworld_id?: number | null;
  // UWorld / Amboss / NBME columns
  text_html?: string;
  explanation_html?: string;
  // Pass Medicine columns
  stem?: string;
  explanation?: string;
  // Shared
  subject?: string;
  system?: string;
  topic?: string;
  source?: string;
  created_at?: string;
  [key: string]: any; // catch-all
}

// SQLite option structure (flexible – different DBs use different column names)
interface SQLiteOption {
  id: number;
  question_id: number;
  text_html: string;
  is_correct: boolean | number;
  uworld_chosen_by?: number; // UWorld % chosen — null for other banks
  // Column names vary by source DB:
  option_order?: number; // UWorld / Amboss
  order?: number; // alternative name
  position?: number; // alternative name
  [key: string]: any; // catch-all for unknown schemas
}

// Import configuration
interface ImportConfig {
  sqlitePath: string;
  questionBankName: string;
  questionBankCode: string;
  step: USMLEStep;
  mainBankName?: string;
  mainBankCode?: string;
  batchSize?: number;
  skipExisting?: boolean;
}

// Statistics
interface ImportStats {
  totalQuestions: number;
  importedQuestions: number;
  skippedQuestions: number;
  totalOptions: number;
  importedOptions: number;
  errors: Array<{ questionId: number; error: string }>;
  newSubjects: string[];
  newSystems: string[];
  newTopics: string[];
}

class QuestionImporter {
  private dataSource: DataSource;
  private stats: ImportStats = {
    totalQuestions: 0,
    importedQuestions: 0,
    skippedQuestions: 0,
    totalOptions: 0,
    importedOptions: 0,
    errors: [],
    newSubjects: [],
    newSystems: [],
    newTopics: [],
  };

  // Cache for lookups
  private subjectCache = new Map<string, Subject>();
  private systemCache = new Map<string, System>();
  private topicCache = new Map<string, Topic>();
  private questionBankCache: QuestionBank | null = null;
  private mainBankCache = new Map<string, MainBank>();
  private optionsColumnCache = new Map<string, string>(); // db path → order column name

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  /**
   * Main import function
   */
  async import(config: ImportConfig): Promise<ImportStats> {
    console.log("🚀 Starting question import...");
    console.log(`📁 SQLite DB: ${config.sqlitePath}`);
    console.log(`📚 Question Bank: ${config.questionBankName}`);
    console.log(`📊 Step: ${config.step}`);
    console.log("─".repeat(60));

    try {
      // Step 1: Connect to SQLite
      const sqliteDb = await this.connectSQLite(config.sqlitePath);

      // Step 2: Get or create question bank
      await this.ensureQuestionBank(config);

      // Step 3: Load questions from SQLite
      const questions = await this.loadQuestionsFromSQLite(sqliteDb);
      this.stats.totalQuestions = questions.length;
      console.log(`✅ Found ${questions.length} questions in SQLite`);

      // Step 4: Import questions in batches
      const batchSize = config.batchSize || 100;
      for (let i = 0; i < questions.length; i += batchSize) {
        const batch = questions.slice(i, i + batchSize);
        await this.importBatch(batch, sqliteDb, config);

        const progress = Math.min(i + batchSize, questions.length);
        console.log(`📈 Progress: ${progress}/${questions.length} questions`);
      }

      // Step 5: Close SQLite connection
      sqliteDb.close();

      // Step 6: Update question bank statistics
      await this.updateQuestionBankStats();

      // Step 7: Print summary
      this.printSummary();

      return this.stats;
    } catch (error) {
      console.error("❌ Import failed:", error);
      throw error;
    }
  }

  /**
   * Connect to SQLite database
   */
  private async connectSQLite(path: string): Promise<sqlite3.Database> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(path, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log("✅ Connected to SQLite database");
          resolve(db);
        }
      });
    });
  }

  /**
   * Get columns of a table via PRAGMA
   */
  private async getTableColumns(
    db: sqlite3.Database,
    table: string,
  ): Promise<string[]> {
    const all = promisify(db.all.bind(db));
    const rows = (await all(`PRAGMA table_info(${table})`)) as Array<{
      name: string;
    }>;
    return rows.map((r) => r.name);
  }

  /**
   * Load all questions from SQLite – handles multiple schema variants
   */
  private async loadQuestionsFromSQLite(
    db: sqlite3.Database,
  ): Promise<SQLiteQuestion[]> {
    const all = promisify(db.all.bind(db));
    const cols = await this.getTableColumns(db, "questions");

    // Build a SELECT that normalises column names into our standard interface
    const textCol = cols.includes("text_html") ? "text_html" : "stem";
    const expCol = cols.includes("explanation_html")
      ? "explanation_html"
      : "explanation";
    const subjCol = cols.includes("subject") ? "subject" : "''";
    const sysCol = cols.includes("system") ? "system" : "''";
    const topicCol = cols.includes("topic") ? "topic" : "''";
    const sourceCol = cols.includes("source") ? "source" : "''";
    const uworldIdCol = cols.includes("uworld_id") ? "uworld_id" : "NULL";

    const sql = `
      SELECT
        id,
        ${uworldIdCol}    AS uworld_id,
        ${textCol}        AS text_html,
        ${expCol}         AS explanation_html,
        ${subjCol}        AS subject,
        ${sysCol}         AS system,
        ${topicCol}       AS topic,
        ${sourceCol}      AS source
      FROM questions
      ORDER BY id
    `;
    return all(sql) as Promise<SQLiteQuestion[]>;
  }

  /**
   * Detect the order column name in the options table for this specific DB
   */
  private async detectOptionsOrderColumn(
    db: sqlite3.Database,
    dbPath: string,
  ): Promise<string> {
    if (this.optionsColumnCache.has(dbPath)) {
      return this.optionsColumnCache.get(dbPath);
    }
    const all = promisify(db.all.bind(db));
    const columns = (await all("PRAGMA table_info(options)")) as Array<{
      name: string;
    }>;
    const names = columns.map((c) => c.name);
    // Try known column name variants in priority order
    const orderCol =
      ["option_order", "order", "position", "sort_order", "display_order"].find(
        (c) => names.includes(c),
      ) || null;
    this.optionsColumnCache.set(dbPath, orderCol);
    return orderCol;
  }

  /**
   * Load options for a specific question (schema-agnostic)
   */
  private async loadOptionsForQuestion(
    db: sqlite3.Database,
    questionId: number,
    dbPath: string,
  ): Promise<SQLiteOption[]> {
    const all = promisify(db.all.bind(db));
    const cols = await this.getTableColumns(db, "options");

    // Normalise text column: text_html (UWorld) vs text (Pass Medicine)
    const textCol = cols.includes("text_html") ? "text_html" : "text";

    // Normalise order column
    const orderCol =
      ["option_order", "order", "display_order", "position", "sort_order"].find(
        (c) => cols.includes(c),
      ) || null;

    // letter column (Pass Medicine uses 'A','B','C','D','E' directly)
    const letterCol = cols.includes("letter") ? "letter" : null;

    // UWorld % chosen column
    const uworldChosenCol = cols.includes("uworld_chosen_by")
      ? "uworld_chosen_by"
      : null;

    const orderClause = orderCol
      ? `ORDER BY ${orderCol}`
      : letterCol
        ? `ORDER BY ${letterCol}`
        : "ORDER BY id";

    const sql = `
      SELECT
        id,
        question_id,
        ${textCol}   AS text_html,
        is_correct
        ${orderCol ? `, ${orderCol} AS option_order` : ""}
        ${letterCol ? `, ${letterCol} AS letter` : ""}
        ${uworldChosenCol ? `, ${uworldChosenCol} AS uworld_chosen_by` : ""}
      FROM options
      WHERE question_id = ?
      ${orderClause}
    `;
    return all(sql, [questionId]) as Promise<SQLiteOption[]>;
  }

  /**
   * Ensure question bank exists
   */
  private async ensureQuestionBank(config: ImportConfig): Promise<void> {
    const qbRepo = this.dataSource.getRepository(QuestionBank);

    // 1. Ensure MainBank exists first
    const mainBank = await this.ensureMainBank(config);

    let questionBank = await qbRepo.findOne({
      where: { code: config.questionBankCode },
    });

    if (!questionBank) {
      console.log(`📦 Creating new question bank: ${config.questionBankName}`);
      questionBank = qbRepo.create({
        mainBankId: mainBank.id,
        name: config.questionBankName,
        code: config.questionBankCode,
        description: `${config.questionBankName} - ${getStepLabel(config.step)}`,
        step: config.step,
        totalQuestions: 0,
        isPremium: true,
        icon: "📚",
        gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        isActive: true,
      });
      questionBank = await qbRepo.save(questionBank);
    } else if (questionBank.mainBankId !== mainBank.id) {
      // Fix linking if it was wrong or missing
      questionBank.mainBankId = mainBank.id;
      questionBank = await qbRepo.save(questionBank);
      console.log(`🔗 Updated MainBank link for: ${config.questionBankCode}`);
    }

    this.questionBankCache = questionBank;
    console.log(
      `✅ Question Bank ready: ${questionBank.name} (ID: ${questionBank.id})`,
    );
  }

  /**
   * Ensure MainBank row exists for specific step
   */
  private async ensureMainBank(config: ImportConfig): Promise<MainBank> {
    // Determine base name/code
    let baseName = config.mainBankName;
    let baseCode = config.mainBankCode;

    if (!baseName || !baseCode) {
      // Try to guess from question bank name if not provided
      if (config.questionBankName.includes("UWorld")) {
        baseName = "UWorld";
        baseCode = "UWORLD";
      } else if (config.questionBankName.includes("Amboss")) {
        baseName = "AmBoss";
        baseCode = "AMBOSS";
      } else if (config.questionBankName.includes("Mehlman")) {
        baseName = "Mehlman";
        baseCode = "MEHLMAN";
      } else if (config.questionBankName.includes("Pass Medicine")) {
        baseName = "Pass Medicine";
        baseCode = "PASS_MED";
      } else if (config.questionBankName.includes("NBME")) {
        baseName = "NBME";
        baseCode = "NBME";
      } else if (config.questionBankName.includes("CMS")) {
        baseName = "CMS";
        baseCode = "CMS";
      } else {
        // Fallback: use QuestionBank name as base
        baseName = config.questionBankName.split("(")[0].trim();
        baseCode = config.questionBankCode.split("_")[0].trim();
      }
    }

    const stepLabel = getStepLabel(config.step);
    const hasExplicitStepIdentity =
      baseName.trim().toLowerCase() === stepLabel.toLowerCase();

    const stepSpecificCode = hasExplicitStepIdentity
      ? config.mainBankCode || config.questionBankCode
      : `${baseCode}_S${config.step}`;
    const stepSpecificName = hasExplicitStepIdentity
      ? baseName
      : `${baseName} - ${stepLabel}`;

    if (this.mainBankCache.has(stepSpecificCode)) {
      return this.mainBankCache.get(stepSpecificCode);
    }

    const repo = this.dataSource.getRepository(MainBank);
    let mb = await repo.findOne({ where: { code: stepSpecificCode } });

    if (!mb) {
      console.log(
        `🏦 Creating MainBank: ${stepSpecificName} [${stepSpecificCode}]`,
      );

      // Select icon/gradient based on code
      let icon = "📚";
      let gradient = "linear-gradient(135deg, #64748b 0%, #475569 100%)";

      if (baseCode.includes("UWORLD")) {
        icon = "🔵";
        gradient = "linear-gradient(135deg, #1e3c72 0%, #2a69ac 100%)";
      } else if (baseCode.includes("AMBOSS")) {
        icon = "🟣";
        gradient = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
      } else if (baseCode.includes("MEHLMAN")) {
        icon = "🟢";
        gradient = "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)";
      } else if (baseCode.includes("NBME")) {
        icon = "🔴";
        gradient = "linear-gradient(135deg, #c0392b 0%, #e74c3c 100%)";
      } else if (baseCode.includes("CMS")) {
        icon = "🟠";
        gradient = "linear-gradient(135deg, #f39c12 0%, #f1c40f 100%)";
      }

      mb = repo.create({
        name: stepSpecificName,
        code: stepSpecificCode,
        icon,
        gradient,
        description: `${baseName} question bank provider for ${stepLabel}`,
        isPremium: true,
        isActive: true,
      });
      mb = await repo.save(mb);
    }

    this.mainBankCache.set(stepSpecificCode, mb);
    return mb;
  }

  /**
   * Import a batch of questions
   */
  private async importBatch(
    questions: SQLiteQuestion[],
    sqliteDb: sqlite3.Database,
    config: ImportConfig,
  ): Promise<void> {
    for (const sqliteQuestion of questions) {
      try {
        await this.importSingleQuestion(sqliteQuestion, sqliteDb, config);
      } catch (error) {
        this.stats.errors.push({
          questionId: sqliteQuestion.id,
          error: error.message,
        });
        console.error(
          `❌ Error importing question ${sqliteQuestion.id}:`,
          error.message,
        );
      }
    }
  }

  /**
   * Import a single question with its options
   */
  private async importSingleQuestion(
    sqliteQuestion: SQLiteQuestion,
    sqliteDb: sqlite3.Database,
    config: ImportConfig,
  ): Promise<void> {
    const questionRepo = this.dataSource.getRepository(Question);
    const optionRepo = this.dataSource.getRepository(QuestionOption);

    const externalId = resolveQuestionExternalId(sqliteQuestion);
    let savedQuestion = await questionRepo.findOne({
      where: {
        externalId,
        questionBankId: this.questionBankCache.id,
      },
    });

    if (savedQuestion && config.skipExisting) {
      this.stats.skippedQuestions++;
      return;
    }

    // Get or create subject, system, topic
    const subject = await this.getOrCreateSubject(sqliteQuestion.subject);
    const system = await this.getOrCreateSystem(sqliteQuestion.system);
    const topic = await this.getOrCreateTopic(
      sqliteQuestion.topic,
      subject.id,
      system.id,
    );

    const basePayload = {
      questionBankId: this.questionBankCache.id,
      externalId,
      textHtml: sqliteQuestion.text_html,
      explanationHtml: sqliteQuestion.explanation_html,
      subjectId: subject.id,
      systemId: system.id,
      topicId: topic.id,
      difficulty: this.inferDifficulty(sqliteQuestion),
      step: config.step,
      source: sqliteQuestion.source || config.questionBankCode,
      imageUrls: this.extractImageUrls(sqliteQuestion.text_html),
      estimatedTimeSeconds: 90,
      isActive: true,
    };

    if (!savedQuestion) {
      const question = questionRepo.create({
        ...basePayload,
        timesAnswered: 0,
        timesCorrect: 0,
      });
      savedQuestion = await questionRepo.save(question);
      this.stats.importedQuestions++;
    } else {
      savedQuestion = await questionRepo.save({
        ...savedQuestion,
        ...basePayload,
      });
      this.stats.importedQuestions++;
    }

    // Import options
    await this.importOptionsForQuestion(
      sqliteDb,
      sqliteQuestion.id,
      savedQuestion.id,
      config.sqlitePath,
    );
  }

  /**
   * Import options for a question (schema-agnostic)
   */
  private async importOptionsForQuestion(
    sqliteDb: sqlite3.Database,
    sqliteQuestionId: number,
    pgQuestionId: number,
    dbPath: string,
  ): Promise<void> {
    const sqliteOptions = await this.loadOptionsForQuestion(
      sqliteDb,
      sqliteQuestionId,
      dbPath,
    );
    this.stats.totalOptions += sqliteOptions.length;

    const optionRepo = this.dataSource.getRepository(QuestionOption);

    const optionLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const numericOrders = sqliteOptions
      .map((opt) => {
        const raw =
          opt.option_order ?? opt.order ?? opt.position ?? opt.sort_order;
        const num = raw === null || raw === undefined ? NaN : Number(raw);
        return Number.isFinite(num) ? num : NaN;
      })
      .filter((val) => Number.isFinite(val)) as number[];
    const minOrder =
      numericOrders.length > 0 ? Math.min(...numericOrders) : null;
    const orderBase = minOrder === 0 ? 0 : 1;

    const entries = sqliteOptions.map((sqliteOption, idx) => {
      const letter =
        sqliteOption.letter && /^[A-Ha-h]$/.test(sqliteOption.letter)
          ? sqliteOption.letter.toUpperCase()
          : null;
      const rawOrder =
        sqliteOption.option_order ??
        sqliteOption.order ??
        sqliteOption.position ??
        sqliteOption.sort_order;
      const num =
        rawOrder === null || rawOrder === undefined ? NaN : Number(rawOrder);
      const orderVal = Number.isFinite(num) ? num : null;
      const normalizedIndex =
        orderVal === null ? null : orderBase === 0 ? orderVal : orderVal - 1;
      const computed =
        letter ??
        (normalizedIndex !== null &&
        normalizedIndex >= 0 &&
        normalizedIndex < optionLetters.length
          ? optionLetters[normalizedIndex]
          : null) ??
        optionLetters[idx] ??
        "A";
      const sortKey =
        orderVal !== null
          ? orderVal
          : letter
            ? Math.max(0, optionLetters.indexOf(letter))
            : idx;
      return { sqliteOption, idx, displayOrder: computed, sortKey };
    });

    const displayOrders = entries.map((entry) => entry.displayOrder);
    if (new Set(displayOrders).size !== displayOrders.length) {
      const sortedEntries = [...entries].sort((a, b) => {
        if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
        return a.idx - b.idx;
      });
      sortedEntries.forEach((entry, index) => {
        entry.displayOrder =
          optionLetters[index] ??
          optionLetters[optionLetters.length - 1] ??
          "A";
      });
    }

    const existingOptions = await optionRepo.find({
      where: { questionId: pgQuestionId },
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
        existing.textHtml = entry.sqliteOption.text_html;
        existing.isCorrect = Boolean(entry.sqliteOption.is_correct);
        existing.uworldChosenBy = entry.sqliteOption.uworld_chosen_by ?? null;
        await optionRepo.save(existing);
      } else {
        const option = optionRepo.create({
          questionId: pgQuestionId,
          textHtml: entry.sqliteOption.text_html,
          isCorrect: Boolean(entry.sqliteOption.is_correct),
          displayOrder: entry.displayOrder,
          uworldChosenBy: entry.sqliteOption.uworld_chosen_by ?? null,
          explanationHtml: null,
        });

        await optionRepo.save(option);
      }
      this.stats.importedOptions++;
    }
  }

  /**
   * Get or create subject
   */
  private async getOrCreateSubject(name: string): Promise<Subject> {
    name = (name || "General").trim().substring(0, 100) || "General";
    if (this.subjectCache.has(name)) return this.subjectCache.get(name);

    const subjectRepo = this.dataSource.getRepository(Subject);
    let subject = await subjectRepo.findOne({ where: { name } });
    if (subject) {
      this.subjectCache.set(name, subject);
      return subject;
    }

    // Generate base code
    let baseCode = name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .substring(0, 15);
    if (!baseCode) baseCode = "SUBJ";

    let attempts = 0;
    while (attempts < 20) {
      const code =
        attempts === 0 ? baseCode : `${baseCode.substring(0, 15)}_${attempts}`;
      try {
        subject = subjectRepo.create({
          name,
          code,
          description: `${name} subject`,
          icon: "📖",
          displayOrder: this.subjectCache.size + 1,
          isActive: true,
        });
        subject = await subjectRepo.save(subject);
        this.stats.newSubjects.push(name);
        console.log(`  ➕ Created new subject: ${name}`);
        break;
      } catch (e) {
        // Someone else created it or code collide
        subject = await subjectRepo.findOne({ where: { name } });
        if (subject) break;
        attempts++;
        if (attempts > 5) await new Promise((r) => setTimeout(r, 100));
      }
    }

    if (!subject) throw new Error(`Could not find or create subject: ${name}`);
    this.subjectCache.set(name, subject);
    return subject;
  }

  /**
   * Get or create system
   */
  private async getOrCreateSystem(name: string): Promise<System> {
    name = (name || "General").trim().substring(0, 100) || "General";
    if (this.systemCache.has(name)) return this.systemCache.get(name);

    const systemRepo = this.dataSource.getRepository(System);
    let system = await systemRepo.findOne({ where: { name } });
    if (system) {
      this.systemCache.set(name, system);
      return system;
    }

    // Generate base code
    let baseCode = name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .substring(0, 15);
    if (!baseCode) baseCode = "SYS";

    let attempts = 0;
    while (attempts < 20) {
      const code =
        attempts === 0 ? baseCode : `${baseCode.substring(0, 15)}_${attempts}`;
      try {
        system = systemRepo.create({
          name,
          code,
          description: `${name} system`,
          icon: "🫀",
          displayOrder: this.systemCache.size + 1,
          isActive: true,
        });
        system = await systemRepo.save(system);
        this.stats.newSystems.push(name);
        console.log(`  ➕ Created new system: ${name}`);
        break;
      } catch (e) {
        // Someone else created it or code collide
        system = await systemRepo.findOne({ where: { name } });
        if (system) break;
        attempts++;
        if (attempts > 5) await new Promise((r) => setTimeout(r, 100));
      }
    }

    if (!system) throw new Error(`Could not find or create system: ${name}`);
    this.systemCache.set(name, system);
    return system;
  }

  /**
   * Get or create topic
   */
  private async getOrCreateTopic(
    name: string,
    subjectId: number,
    systemId: number,
  ): Promise<Topic> {
    name = (name || "General").trim().substring(0, 200) || "General";

    const cacheKey = `${name}-${subjectId}-${systemId}`;
    if (this.topicCache.has(cacheKey)) {
      return this.topicCache.get(cacheKey);
    }

    const topicRepo = this.dataSource.getRepository(Topic);
    let topic = await topicRepo.findOne({
      where: { name, subjectId, systemId },
    });

    if (!topic) {
      try {
        topic = topicRepo.create({
          name,
          subjectId,
          systemId,
          description: `${name} topic`,
          displayOrder: this.topicCache.size + 1,
          isActive: true,
        });
        topic = await topicRepo.save(topic);
        this.stats.newTopics.push(name);
        console.log(`  ➕ Created new topic: ${name}`);
      } catch (e) {
        // Race condition: wait a bit and try finding again
        await new Promise((r) => setTimeout(r, 100));
        topic = await topicRepo.findOne({
          where: { name, subjectId, systemId },
        });
        if (!topic) throw e;
      }
    }

    this.topicCache.set(cacheKey, topic);
    return topic;
  }

  /**
   * Generate code from name
   */
  private usedCodes = new Map<string, number>();

  private generateUniqueCode(name: string, type: string): string {
    const base = name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .substring(0, 18);
    const key = `${type}:${base}`;
    const count = this.usedCodes.get(key) || 0;
    this.usedCodes.set(key, count + 1);
    return count === 0 ? base : `${base}_${count}`;
  }

  private generateCode(name: string): string {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "_")
      .substring(0, 20);
  }

  /**
   * Infer difficulty from question (can be enhanced)
   */
  private inferDifficulty(question: SQLiteQuestion): QuestionDifficulty {
    const textLength = question.text_html.length;
    if (textLength < 500) return QuestionDifficulty.EASY;
    if (textLength < 1500) return QuestionDifficulty.MEDIUM;
    return QuestionDifficulty.HARD;
  }

  /**
   * Extract image URLs from HTML
   */
  private extractImageUrls(html: string): string[] {
    const imgRegex = /<img[^>]+src="([^">]+)"/g;
    const urls: string[] = [];
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      urls.push(match[1]);
    }

    return urls;
  }

  /**
   * Update question bank statistics
   */
  private async updateQuestionBankStats(): Promise<void> {
    if (!this.questionBankCache) return;

    const questionRepo = this.dataSource.getRepository(Question);
    const count = await questionRepo.count({
      where: { questionBankId: this.questionBankCache.id },
    });

    const qbRepo = this.dataSource.getRepository(QuestionBank);
    await qbRepo.update(this.questionBankCache.id, {
      totalQuestions: count,
    });

    console.log(`✅ Updated question bank: ${count} total questions`);
  }

  /**
   * Print import summary
   */
  private printSummary(): void {
    console.log("\n" + "═".repeat(60));
    console.log("📊 IMPORT SUMMARY");
    console.log("═".repeat(60));
    console.log(
      `✅ Questions imported: ${this.stats.importedQuestions}/${this.stats.totalQuestions}`,
    );
    console.log(`⏭️  Questions skipped: ${this.stats.skippedQuestions}`);
    console.log(
      `✅ Options imported: ${this.stats.importedOptions}/${this.stats.totalOptions}`,
    );
    console.log(`❌ Errors: ${this.stats.errors.length}`);
    console.log("─".repeat(60));
    console.log(`📚 New subjects created: ${this.stats.newSubjects.length}`);
    if (this.stats.newSubjects.length > 0) {
      console.log(`   ${this.stats.newSubjects.join(", ")}`);
    }
    console.log(`🫀 New systems created: ${this.stats.newSystems.length}`);
    if (this.stats.newSystems.length > 0) {
      console.log(`   ${this.stats.newSystems.join(", ")}`);
    }
    console.log(`📖 New topics created: ${this.stats.newTopics.length}`);
    console.log("═".repeat(60));

    if (this.stats.errors.length > 0) {
      console.log("\n❌ ERRORS:");
      this.stats.errors.slice(0, 10).forEach((err) => {
        console.log(`  Question ${err.questionId}: ${err.error}`);
      });
      if (this.stats.errors.length > 10) {
        console.log(`  ... and ${this.stats.errors.length - 10} more errors`);
      }
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);

  const config: ImportConfig = {
    sqlitePath: "",
    questionBankName: "",
    questionBankCode: "",
    step: 1,
    batchSize: 100,
    skipExisting: false,
  };

  // Helper to collect all tokens until the next flag (handles spaces in paths/names)
  function collectValue(
    args: string[],
    startIndex: number,
  ): { value: string; consumed: number } {
    const parts: string[] = [];
    let i = startIndex;
    while (i < args.length && !args[i].startsWith("--")) {
      parts.push(args[i]);
      i++;
    }
    return { value: parts.join(" "), consumed: parts.length };
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--db") {
      const { value, consumed } = collectValue(args, i + 1);
      config.sqlitePath = value;
      i += consumed;
    } else if (args[i] === "--bank-name") {
      const { value, consumed } = collectValue(args, i + 1);
      config.questionBankName = value;
      i += consumed;
    } else if (args[i] === "--bank-code") {
      const { value, consumed } = collectValue(args, i + 1);
      config.questionBankCode = value;
      i += consumed;
    } else if (args[i] === "--step" && args[i + 1]) {
      config.step = parseInt(args[i + 1]) as USMLEStep;
      i++;
    } else if (args[i] === "--batch-size" && args[i + 1]) {
      config.batchSize = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === "--skip-existing") {
      config.skipExisting = true;
    }
  }

  if (
    !config.sqlitePath ||
    !config.questionBankName ||
    !config.questionBankCode
  ) {
    console.error("❌ Missing required arguments!");
    console.log("\nUsage:");
    console.log("  npm run import:sqlite -- \\");
    console.log('    --db "path/to/database.db" \\');
    console.log('    --bank-name "UWorld Step 1" \\');
    console.log('    --bank-code "UWORLD_STEP1" \\');
    console.log("    --step 1");
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  const dataSource = app.get(DataSource);

  const importer = new QuestionImporter(dataSource);
  await importer.import(config);

  await app.close();
  console.log("\n✨ Import completed successfully!");
  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { QuestionImporter, ImportConfig, ImportStats };
