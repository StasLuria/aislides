/**
 * File Extractor — extracts text content from uploaded files (PDF, DOCX, TXT, PPTX).
 * Used to provide source material context for presentation generation.
 */
import { PDFParse } from "pdf-parse";
import JSZip from "jszip";
import mammoth from "mammoth";
import { invokeLLM } from "../_core/llm";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface ExtractedContent {
  /** Original filename */
  filename: string;
  /** Detected file type */
  fileType: "pdf" | "docx" | "txt" | "pptx" | "unknown";
  /** Raw extracted text */
  rawText: string;
  /** Truncated text for LLM context (max ~8000 chars) */
  contextText: string;
  /** Number of pages/slides (if applicable) */
  pageCount?: number;
  /** Word count of raw text */
  wordCount: number;
  /** Whether text was truncated for context */
  wasTruncated: boolean;
}

export interface FileUploadResult {
  fileId: string;
  filename: string;
  fileType: string;
  s3Url: string;
  extractedContent: ExtractedContent;
}

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

/** Maximum file size: 10MB */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Maximum context text length sent to LLM (chars) */
const MAX_CONTEXT_LENGTH = 8000;

/** Allowed MIME types */
export const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "text/markdown": "txt",
  "text/csv": "txt",
};

/** Allowed file extensions */
export const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".pptx", ".md", ".csv"];

// ═══════════════════════════════════════════════════════
// EXTRACTION FUNCTIONS
// ═══════════════════════════════════════════════════════

/**
 * Extract text from a PDF buffer.
 */
async function extractFromPdf(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return {
      text: result.text || "",
      pageCount: result.total || 0,
    };
  } finally {
    await parser.destroy().catch(() => {});
  }
}

/**
 * Extract text from a DOCX buffer.
 */
async function extractFromDocx(buffer: Buffer): Promise<{ text: string }> {
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value || "" };
}

/**
 * Extract text from a plain text buffer.
 */
async function extractFromTxt(buffer: Buffer): Promise<{ text: string }> {
  return { text: buffer.toString("utf-8") };
}

/**
 * Extract text from a PPTX buffer.
 * PPTX is a ZIP containing XML files. We extract text from slide XML files.
 */
async function extractFromPptx(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  // PPTX is a ZIP file. We use a simple approach: extract XML text nodes.
  // Dynamic import to avoid issues if not available
  const zip = await JSZip.loadAsync(buffer);

  const slideTexts: string[] = [];
  const slideFiles = Object.keys(zip.files)
    .filter((name) => name.match(/^ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0");
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0");
      return numA - numB;
    });

  for (const slideFile of slideFiles) {
    const xml = await zip.files[slideFile].async("text");
    // Extract text content from XML tags (simple regex approach)
    const textMatches = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g);
    if (textMatches) {
      const slideText = textMatches
        .map((match: string) => match.replace(/<[^>]+>/g, "").trim())
        .filter(Boolean)
        .join(" ");
      if (slideText) {
        slideTexts.push(`[Slide ${slideTexts.length + 1}] ${slideText}`);
      }
    }
  }

  return {
    text: slideTexts.join("\n\n"),
    pageCount: slideFiles.length,
  };
}

// ═══════════════════════════════════════════════════════
// MAIN EXTRACTION
// ═══════════════════════════════════════════════════════

/**
 * Detect file type from filename and MIME type.
 */
export function detectFileType(
  filename: string,
  mimeType?: string,
): "pdf" | "docx" | "txt" | "pptx" | "unknown" {
  // Check MIME type first
  if (mimeType && ALLOWED_MIME_TYPES[mimeType]) {
    return ALLOWED_MIME_TYPES[mimeType] as any;
  }

  // Fallback to extension
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "pdf":
      return "pdf";
    case "docx":
      return "docx";
    case "pptx":
      return "pptx";
    case "txt":
    case "md":
    case "csv":
      return "txt";
    default:
      return "unknown";
  }
}

/**
 * Validate file before processing.
 */
export function validateFile(
  filename: string,
  size: number,
  mimeType?: string,
): { valid: boolean; error?: string } {
  if (size > MAX_FILE_SIZE) {
    return { valid: false, error: `Файл слишком большой (${(size / 1024 / 1024).toFixed(1)}MB). Максимум: 10MB` };
  }

  const fileType = detectFileType(filename, mimeType);
  if (fileType === "unknown") {
    return { valid: false, error: `Неподдерживаемый формат файла. Допустимые: PDF, DOCX, TXT, PPTX` };
  }

  return { valid: true };
}

/**
 * Extract text content from a file buffer.
 */
export async function extractTextFromFile(
  buffer: Buffer,
  filename: string,
  mimeType?: string,
): Promise<ExtractedContent> {
  const fileType = detectFileType(filename, mimeType);

  let rawText = "";
  let pageCount: number | undefined;

  try {
    switch (fileType) {
      case "pdf": {
        const result = await extractFromPdf(buffer);
        rawText = result.text;
        pageCount = result.pageCount;
        break;
      }
      case "docx": {
        const result = await extractFromDocx(buffer);
        rawText = result.text;
        break;
      }
      case "pptx": {
        const result = await extractFromPptx(buffer);
        rawText = result.text;
        pageCount = result.pageCount;
        break;
      }
      case "txt": {
        const result = await extractFromTxt(buffer);
        rawText = result.text;
        break;
      }
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (err: any) {
    console.error(`[FileExtractor] Failed to extract text from ${filename}:`, err);
    throw new Error(`Не удалось извлечь текст из файла: ${err.message}`);
  }

  // Clean up text
  rawText = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  const wordCount = rawText.split(/\s+/).filter(Boolean).length;
  const wasTruncated = rawText.length > MAX_CONTEXT_LENGTH;

  // Truncate for LLM context if needed
  let contextText = rawText;
  if (wasTruncated) {
    contextText = rawText.substring(0, MAX_CONTEXT_LENGTH) + "\n\n[... текст обрезан, показаны первые ~8000 символов ...]";
  }

  return {
    filename,
    fileType: fileType as ExtractedContent["fileType"],
    rawText,
    contextText,
    pageCount,
    wordCount,
    wasTruncated,
  };
}

/**
 * Summarize extracted content using LLM for very large files.
 * Returns a condensed version that preserves key facts, numbers, and structure.
 */
export async function summarizeExtractedContent(
  content: ExtractedContent,
): Promise<string> {
  // If content is small enough, return as-is
  if (!content.wasTruncated && content.rawText.length <= MAX_CONTEXT_LENGTH) {
    return content.contextText;
  }

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a document summarizer. Extract and preserve ALL key information from the document:
- All specific numbers, statistics, percentages, and financial data
- Key facts, findings, and conclusions
- Names, dates, and important entities
- Structure and main sections
- Any data that could be used in presentation slides

Output a structured summary in the SAME language as the document. Keep ALL numerical data intact.
Maximum output: 6000 characters.`,
        },
        {
          role: "user",
          content: `Summarize this document (${content.filename}, ${content.wordCount} words, ${content.pageCount || "unknown"} pages):\n\n${content.rawText.substring(0, 15000)}`,
        },
      ],
    });

    const summary = typeof response.choices?.[0]?.message?.content === "string"
      ? response.choices[0].message.content
      : content.contextText;

    return `[Резюме документа "${content.filename}" (${content.wordCount} слов)]\n\n${summary}`;
  } catch (err) {
    console.error("[FileExtractor] Summarization failed, using truncated text:", err);
    return content.contextText;
  }
}

/**
 * Format extracted content for injection into agent prompts.
 */
export function formatContentForPrompt(content: ExtractedContent, summary?: string): string {
  const text = summary || content.contextText;
  return `<source_document>
<filename>${content.filename}</filename>
<file_type>${content.fileType}</file_type>
<word_count>${content.wordCount}</word_count>
${content.pageCount ? `<page_count>${content.pageCount}</page_count>` : ""}
<content>
${text}
</content>
</source_document>`;
}
