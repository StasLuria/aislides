/**
 * File Extractor — extracts text content from uploaded files.
 * Supports: PDF, DOCX, TXT, PPTX, and images (via LLM vision).
 */
import mammoth from "mammoth";
import { invokeLLM } from "./_core/llm";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface ExtractionResult {
  text: string;
  pageCount?: number;
  error?: string;
}

// ═══════════════════════════════════════════════════════
// MAIN EXTRACTION FUNCTION
// ═══════════════════════════════════════════════════════

/**
 * Extract text from a file buffer based on MIME type.
 */
export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
  filename: string,
  s3Url?: string,
): Promise<ExtractionResult> {
  try {
    if (mimeType === "text/plain") {
      return extractFromText(buffer);
    }
    if (mimeType === "application/pdf") {
      return await extractFromPdf(buffer);
    }
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword"
    ) {
      return await extractFromDocx(buffer);
    }
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      mimeType === "application/vnd.ms-powerpoint"
    ) {
      return await extractFromPptx(buffer);
    }
    if (mimeType.startsWith("image/") && s3Url) {
      return await extractFromImage(s3Url, mimeType);
    }

    return { text: "", error: `Unsupported file type: ${mimeType}` };
  } catch (err: any) {
    console.error(`[FileExtractor] Error extracting from ${filename}:`, err);
    return { text: "", error: err.message };
  }
}

// ═══════════════════════════════════════════════════════
// FORMAT-SPECIFIC EXTRACTORS
// ═══════════════════════════════════════════════════════

function extractFromText(buffer: Buffer): ExtractionResult {
  const text = buffer.toString("utf-8");
  return { text: text.slice(0, 50000) }; // Limit to ~50k chars
}

async function extractFromPdf(buffer: Buffer): Promise<ExtractionResult> {
  try {
    // Dynamic import for pdf-parse
    const pdfModule: any = await import("pdf-parse");
    const pdfParse = pdfModule.default || pdfModule;
    const data = await pdfParse(buffer);
    return {
      text: data.text.slice(0, 50000),
      pageCount: data.numpages,
    };
  } catch (err: any) {
    console.error("[FileExtractor] PDF parse error:", err);
    return { text: "", error: `PDF extraction failed: ${err.message}` };
  }
}

async function extractFromDocx(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value.slice(0, 50000) };
  } catch (err: any) {
    return { text: "", error: `DOCX extraction failed: ${err.message}` };
  }
}

async function extractFromPptx(buffer: Buffer): Promise<ExtractionResult> {
  try {
    // PPTX is a ZIP containing XML files. Extract text from slide XML.
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);
    const slideTexts: string[] = [];

    // Get all slide files (slide1.xml, slide2.xml, etc.)
    const slideFiles = Object.keys(zip.files)
      .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0");
        const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0");
        return numA - numB;
      });

    for (const slidePath of slideFiles) {
      const xml = await zip.files[slidePath].async("text");
      // Extract text from XML tags like <a:t>text</a:t>
      const textMatches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
      const texts = textMatches.map((m: string) => m.replace(/<[^>]+>/g, "").trim()).filter(Boolean);
      if (texts.length > 0) {
        const slideNum = slidePath.match(/slide(\d+)/)?.[1] || "?";
        slideTexts.push(`--- Слайд ${slideNum} ---\n${texts.join("\n")}`);
      }
    }

    return {
      text: slideTexts.join("\n\n").slice(0, 50000),
      pageCount: slideFiles.length,
    };
  } catch (err: any) {
    return { text: "", error: `PPTX extraction failed: ${err.message}` };
  }
}

async function extractFromImage(s3Url: string, mimeType: string): Promise<ExtractionResult> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Ты помощник, который извлекает текст и описывает содержимое изображений для создания презентаций.

Если изображение содержит СТРУКТУРУ ПРЕЗЕНТАЦИИ (список слайдов с номерами, заголовками и описаниями), то:
1. Начни ответ с маркера: [PRESENTATION_OUTLINE]
2. Извлеки ТОЧНО все слайды в формате:
   SLIDE 1: Заголовок слайда
   PURPOSE: Описание/назначение слайда
   ---
   SLIDE 2: Заголовок слайда
   PURPOSE: Описание/назначение слайда
   ---
   (и так далее для каждого слайда)
3. Сохрани ТОЧНЫЕ заголовки и описания из изображения, не перефразируй.
4. В конце укажи: TOTAL_SLIDES: N

Если изображение НЕ содержит структуру презентации, а содержит другой контент (текст, графики, таблицы, диаграммы):
1. Опиши всё, что видишь на изображении
2. Если есть текст — приведи его дословно
3. Опиши графики, диаграммы, таблицы

Отвечай на русском.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text" as const,
              text: "Внимательно рассмотри это изображение. Если это структура/план презентации (список слайдов) — извлеки её точно. Если это другой контент — опиши его подробно.",
            },
            {
              type: "image_url" as const,
              image_url: {
                url: s3Url,
                detail: "high" as const,
              },
            },
          ] as any,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content : "";
    return { text };
  } catch (err: any) {
    return { text: "", error: `Image extraction failed: ${err.message}` };
  }
}

// ═══════════════════════════════════════════════════════
// SUPPORTED MIME TYPES
// ═══════════════════════════════════════════════════════

export const SUPPORTED_MIME_TYPES = [
  "text/plain",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_FILES_PER_MESSAGE = 5;

/**
 * Get a human-readable file type label.
 */
export function getFileTypeLabel(mimeType: string): string {
  const map: Record<string, string> = {
    "text/plain": "TXT",
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "application/msword": "DOC",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
    "application/vnd.ms-powerpoint": "PPT",
    "image/png": "PNG",
    "image/jpeg": "JPG",
    "image/webp": "WEBP",
    "image/gif": "GIF",
  };
  return map[mimeType] || "FILE";
}
