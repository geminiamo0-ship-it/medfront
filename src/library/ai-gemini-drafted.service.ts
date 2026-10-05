import {
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenAI } from "@google/genai";

export interface QuestionContext {
  questionText: string;
  options: Array<{
    letter: string;
    text: string;
    isCorrect: boolean;
    chosenByPercent?: number | null;
    optionExplanation?: string | null;
  }>;
  subject?: string;
  system?: string;
  topic?: string;
  globalAccuracyRate?: number;
}

@Injectable()
export class AIGeminiDraftedService {
  private client: GoogleGenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>("GEMINI_API_KEY");
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined in environment variables.");
    }
    this.client = new GoogleGenAI({ apiKey: apiKey || "" });
  }

  /** Strip HTML and truncate */
  private cleanHtml(html: string, maxLen = 10000): string {
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, maxLen);
  }

  /**
   * Generates a comprehensive Professor-level summary for an entire article.
   * Used by the "Explain with AI" button in the article header (premium feature).
   */
  async analyzeFullArticle(
    articleTitle: string,
    articleContent: string,
  ): Promise<string> {
    try {
      // Strip HTML tags for cleaner context
      const plainText = articleContent
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 12000); // Cap at ~12k chars to stay within token limits

      const prompt = `
You are a Professor-level Medical Educator and USMLE Step exam specialist. 
A medical student has opened the following article and wants a deep, structured overview of it.

**Article Title:** ${articleTitle}

**Article Content:**
${plainText}

---

Please generate a comprehensive **Board-Review Style Summary** of this article. Structure your response EXACTLY as follows:

## 📚 ${articleTitle}: Complete Study Guide

---

### 🎯 Learning Objectives
List 3-5 key learning objectives from this article as bullet points. What should the student know after reading this?

---

### 🔬 Core Concepts
Provide a concise overview of the main concepts in this article. Explain any complex mechanisms in plain English with helpful analogies.

---

### ⚡ High-Yield Clinicals (USMLE Focus)
- List the most testable, high-yield clinical facts and associations
- Use the format: **[Term/Concept]** → [why it matters clinically]
- Include any critical numbers, cutoffs, or thresholds
- 🔥 Mark the most critical "Must-Know" pearls with this emoji

---

### 💊 Management & Workup (if applicable)
Summarize the diagnostic approach and management principles covered in the article. Use numbered steps if describing a workup algorithm.

---

### 🧠 Mnemonics & Memory Aids
Provide 2-3 catchy mnemonics or memory frameworks to help remember the key concepts from this article.

---

### 🔗 Similar Conditions / Differentials (if applicable)
List associated conditions or key differentials that a student should compare with the topic of this article.

---

Use **bold** for all key medical terms. Keep it concise but comprehensive. Format everything in clean Markdown.
      `;

      const response = await this.client.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      if (!response || !response.text) {
        throw new Error("No response text returned from Gemini API");
      }

      return response.text;
    } catch (error) {
      console.error("AI Full Article Analysis Error:", error);
      throw new InternalServerErrorException(
        "Failed to generate AI article summary.",
      );
    }
  }

  /**
   * Generates a focused, rich explanation of a test question to help a
   * student understand what is being asked.
   * Includes ALL answer options so the AI can reference key distractors,
   * plus subject/system/topic metadata for targeted teaching.
   */
  async generateQuestionAnalysis(ctx: QuestionContext): Promise<string> {
    try {
      const cleanQuestion = this.cleanHtml(ctx.questionText);

      const optionsBlock = ctx.options
        .map(
          (o) =>
            `${o.letter}. ${this.cleanHtml(o.text, 2000)}${
              o.chosenByPercent != null ? ` [chosen by ${o.chosenByPercent}% of students]` : ""
            }`,
        )
        .join("\n");

      const metaLines: string[] = [];
      if (ctx.subject) metaLines.push(`Subject: ${ctx.subject}`);
      if (ctx.system) metaLines.push(`System: ${ctx.system}`);
      if (ctx.topic) metaLines.push(`Topic: ${ctx.topic}`);
      if (ctx.globalAccuracyRate != null)
        metaLines.push(
          `Global accuracy: ${ctx.globalAccuracyRate.toFixed(0)}% of students answer correctly`,
        );

      const prompt = `
You are a world-class Medical Board Exam (USMLE/MRCP) Tutor with decades of teaching experience.
A medical student is struggling with the following question and wants you to break it down clearly.

${metaLines.length > 0 ? `**Question Metadata:**\n${metaLines.join("\n")}\n` : ""}
**Question Stem:**
${cleanQuestion}

**Answer Options:**
${optionsBlock}

---

Provide a clear, structured breakdown using this format:

**🔍 Clinical Snapshot**
In 2-3 sentences, summarise the core clinical scenario. What type of patient is this? What are they presenting with?

**🔑 Key Clues & Buzzwords**
List 3-5 critical findings from the stem as bullet points. For each, briefly explain what it points to clinically. Use the format:
• **"[exact phrase from stem]"** → suggests [clinical significance]

**❓ What This Question Is Really Asking**
Rephrase the actual question in one simple, plain-English sentence.

**🧭 How to Approach It**
In 2-3 sentences, describe the thought process a top student would use to arrive at the answer. Guide them through the reasoning without explicitly revealing which letter is correct.

Keep your total response under 250 words. Use **bold** for key medical terms. Be warm, encouraging, and precise.
      `;

      const response = await this.client.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      if (!response || !response.text) {
        throw new Error("No response text returned from Gemini API");
      }

      return response.text;
    } catch (error) {
      console.error("AI Question Analysis Error:", error);
      throw new InternalServerErrorException(
        "Failed to generate AI question analysis.",
      );
    }
  }

  /**
   * Generates a tailored, personalised explanation after a student has
   * submitted their answer. Includes full option context so the AI can
   * explain why every distractor is wrong and the correct answer is right.
   */
  async generateSubmissionAnalysis(
    ctx: QuestionContext,
    explanationText: string,
    selectedOptionLetter: string,
    selectedOptionText: string,
    isCorrect: boolean,
  ): Promise<string> {
    try {
      const cleanQuestion = this.cleanHtml(ctx.questionText);
      const cleanExplanation = this.cleanHtml(explanationText, 6000);
      const cleanSelected = this.cleanHtml(selectedOptionText, 2000);

      const correctOption = ctx.options.find((o) => o.isCorrect);
      const correctLetter = correctOption?.letter || "?";
      const correctText = correctOption
        ? this.cleanHtml(correctOption.text, 2000)
        : "";

      const allOptionsBlock = ctx.options
        .map((o) => {
          const markers: string[] = [];
          if (o.isCorrect) markers.push("✅ CORRECT");
          if (o.letter === selectedOptionLetter) markers.push("👤 Student's choice");
          if (o.chosenByPercent != null) markers.push(`${o.chosenByPercent}% chose this`);
          const markerStr = markers.length > 0 ? ` [${markers.join(" | ")}]` : "";
          const optExp = o.optionExplanation
            ? `\n   Explanation: ${this.cleanHtml(o.optionExplanation, 1000)}`
            : "";
          return `${o.letter}. ${this.cleanHtml(o.text, 2000)}${markerStr}${optExp}`;
        })
        .join("\n\n");

      const metaLines: string[] = [];
      if (ctx.subject) metaLines.push(`Subject: ${ctx.subject}`);
      if (ctx.system) metaLines.push(`System: ${ctx.system}`);
      if (ctx.topic) metaLines.push(`Topic: ${ctx.topic}`);
      if (ctx.globalAccuracyRate != null)
        metaLines.push(
          `Global accuracy: ${ctx.globalAccuracyRate.toFixed(0)}%`,
        );

      const prompt = `
You are a world-class Medical Board Exam (USMLE/MRCP) Tutor.
A student just answered a practice question. They selected **Option ${selectedOptionLetter}** which was **${isCorrect ? "CORRECT ✅" : "INCORRECT ❌"}**.

${metaLines.length > 0 ? `**Question Metadata:**\n${metaLines.join("\n")}\n` : ""}
**Question Stem:**
${cleanQuestion}

**All Answer Options (with data):**
${allOptionsBlock}

**Official Explanation:**
${cleanExplanation}

**Student's Pick:** ${selectedOptionLetter}. ${cleanSelected} → ${isCorrect ? "CORRECT" : "INCORRECT"}
${!isCorrect ? `**Correct Answer:** ${correctLetter}. ${correctText}` : ""}

---

Provide a personalised response using this EXACT format:

${isCorrect ? "**🎉 Great Job!**" : "**💡 Let's Learn From This**"}
${
  isCorrect
    ? "Start with a brief, specific acknowledgment of *why* this is the best answer. Reference the key clinical reasoning that leads to this choice."
    : `Start by explaining *why Option ${selectedOptionLetter} is a reasonable but incorrect choice* — validate the student's thinking, then clearly explain the critical distinction that makes ${correctLetter} the correct answer.`
}

**🔬 Option-by-Option Breakdown**
For each option (A through ${ctx.options[ctx.options.length - 1]?.letter || "E"}), write ONE concise sentence explaining why it is correct or incorrect in this context. Mark the correct one with ✅ and the student's wrong pick with ❌.

**🧠 High-Yield Pearl**
End with a single, memorable clinical pearl or rule-of-thumb related to this topic that the student should commit to memory.

Keep total response under 350 words. Use **bold** for key medical terms. Be warm, encouraging, and precise — never condescending.
      `;

      const response = await this.client.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      if (!response || !response.text) {
        throw new Error("No response text returned from Gemini API");
      }

      return response.text;
    } catch (error) {
      console.error("AI Submission Analysis Error:", error);
      throw new InternalServerErrorException(
        "Failed to generate AI submission analysis.",
      );
    }
  }
}
