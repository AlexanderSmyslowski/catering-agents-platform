import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import pdf from "pdf-parse";
const PDF_PARSE_TIMEOUT_MS = 3000;
const execFileAsync = promisify(execFile);
function decodeText(buffer) {
    return buffer.toString("utf8").replace(/\0/g, "").trim();
}
function decodePrintableSegments(buffer) {
    const latin1 = buffer.toString("latin1");
    const matches = latin1.match(/[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 ,.:;!?()/%+\-_'"&\n]{3,}/g);
    if (!matches) {
        return "";
    }
    return matches
        .map((part) => part.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n")
        .trim();
}
function looksCorruptedText(value) {
    return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
}
function wordCount(value) {
    return (value.match(/[A-Za-zÀ-ÿ0-9]{2,}/g) ?? []).length;
}
function preferReadableText(primary, fallback) {
    const cleanedPrimary = primary.trim();
    const cleanedFallback = fallback.trim();
    if (!cleanedPrimary) {
        return cleanedFallback;
    }
    if (looksCorruptedText(cleanedPrimary)) {
        const strippedPrimary = cleanedPrimary.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
        if (wordCount(strippedPrimary) >= 4) {
            return strippedPrimary;
        }
        return cleanedFallback || strippedPrimary;
    }
    return cleanedPrimary;
}
function fallbackDocumentText(buffer) {
    const utf8 = decodeText(buffer);
    const printable = decodePrintableSegments(buffer);
    if (utf8.length >= 24 && !looksCorruptedText(utf8)) {
        return preferReadableText(utf8, printable);
    }
    if (printable.length >= 24) {
        return printable;
    }
    return preferReadableText(utf8, printable);
}
async function parsePdfWithTimeout(buffer) {
    return await Promise.race([
        pdf(buffer).then((result) => result.text.trim()),
        new Promise((resolve) => {
            setTimeout(() => resolve(""), PDF_PARSE_TIMEOUT_MS);
        })
    ]);
}
async function extractTextFromPagesPreview(document) {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "catering-pages-"));
    const inputPath = path.join(tempRoot, document.filename || "document.pages");
    const outputDir = path.join(tempRoot, "preview");
    try {
        await writeFile(inputPath, document.content);
        await execFileAsync("qlmanage", ["-o", outputDir, "-p", inputPath]);
        const previewEntries = await readdir(outputDir, { withFileTypes: true });
        const previewDir = previewEntries.find((entry) => entry.isDirectory() && entry.name.endsWith(".qlpreview"));
        if (!previewDir) {
            return "";
        }
        const attachmentDir = path.join(outputDir, previewDir.name);
        const attachmentFiles = (await readdir(attachmentDir))
            .filter((name) => name.toLowerCase().endsWith(".pdf"))
            .sort();
        const extractedParts = [];
        for (const attachment of attachmentFiles) {
            const attachmentBuffer = await readFile(path.join(attachmentDir, attachment));
            const text = await parsePdfWithTimeout(attachmentBuffer);
            if (text) {
                extractedParts.push(text);
            }
        }
        return extractedParts.join("\n").trim();
    }
    catch {
        return "";
    }
    finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
}
export async function extractTextFromDocument(document) {
    const filename = document.filename.toLowerCase();
    if (filename.endsWith(".pages")) {
        const text = await extractTextFromPagesPreview(document);
        if (text) {
            return text;
        }
        return fallbackDocumentText(document.content);
    }
    if (document.mimeType.includes("pdf")) {
        try {
            const text = await parsePdfWithTimeout(document.content);
            if (text && !looksCorruptedText(text)) {
                return text;
            }
        }
        catch {
            return fallbackDocumentText(document.content);
        }
        return fallbackDocumentText(document.content);
    }
    return fallbackDocumentText(document.content);
}
