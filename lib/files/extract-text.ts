// Text extraction for the signal-intake "extract from a source" panel. Runs
// server-side only — PDF/.docx parsing needs Node, and it keeps the raw file
// out of the browser bundle. Nothing here persists the file; it is parsed in
// memory and discarded, matching the propose-only flow it feeds
// (lib/ai/derivations/signal-extraction.ts already caps input at 20k chars).

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_CHARS = 20000;

const PLAIN_TEXT_EXTENSIONS = new Set([".txt", ".text", ".md", ".markdown"]);

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

export async function extractTextFromUpload(file: File): Promise<string> {
  if (file.size === 0) throw new Error("That file is empty.");
  if (file.size > MAX_BYTES) throw new Error("File is too large (max 10MB).");

  const ext = extensionOf(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());

  let text: string;
  if (ext === ".pdf" || file.type === "application/pdf") {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const result = await extractText(pdf, { mergePages: true });
    text = result.text;
  } else if (ext === ".docx" || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    text = value;
  } else if (ext === ".doc") {
    throw new Error("Legacy .doc files aren't supported — save as .docx and re-upload.");
  } else if (PLAIN_TEXT_EXTENSIONS.has(ext) || file.type.startsWith("text/")) {
    text = Buffer.from(bytes).toString("utf-8");
  } else {
    throw new Error(`Unsupported file type "${ext || file.type || "unknown"}". Upload a PDF, .docx, .md, or .txt file.`);
  }

  text = text.trim();
  if (!text) throw new Error("No extractable text found in that file.");
  return text.slice(0, MAX_CHARS);
}
