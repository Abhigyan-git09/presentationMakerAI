/**
 * PDF Service
 * Client-side PDF text extraction using pdfjs-dist.
 */

let pdfLibraryPromise

async function getPdfLibrary() {
  if (!pdfLibraryPromise) {
    pdfLibraryPromise = import('pdfjs-dist').then(pdfjsLib => {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
      return pdfjsLib
    })
  }
  return pdfLibraryPromise
}

/**
 * Extract text from a PDF file.
 * @param {File} file - The PDF file object from input/drop.
 * @returns {Promise<string>} - Extracted text content.
 */
export async function extractTextFromPDF(file) {
  const pdfjsLib = await getPdfLibrary();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const textParts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    textParts.push(pageText);
  }

  return textParts.join('\n\n');
}

/**
 * Extract text from a TXT file.
 * @param {File} file - The TXT file object.
 * @returns {Promise<string>} - File text content.
 */
export async function extractTextFromTXT(file) {
  return await file.text();
}

/**
 * Extract text from any supported file.
 * @param {File} file - The uploaded file.
 * @returns {Promise<string>} - Extracted text.
 */
export async function extractTextFromFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'pdf') {
    return extractTextFromPDF(file);
  } else if (ext === 'txt') {
    return extractTextFromTXT(file);
  } else {
    throw new Error(`Unsupported file type: .${ext}. Please upload a PDF or TXT file.`);
  }
}
