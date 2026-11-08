/* Get the text out of a vet document on the phone: PDFs give their text directly; photos and scanned PDFs
   go through on-device text recognition (Tesseract). Both libraries load only when a document is added. */

async function ocr(images: (Blob | HTMLCanvasElement)[], onProgress?: (p: number) => void): Promise<string[]> {
  const { createWorker } = await import('tesseract.js');
  const base = new URL(import.meta.env.BASE_URL + 'ocr/', location.href).toString();
  const worker = await createWorker('eng', 1, { workerPath: base + 'worker.min.js', corePath: base, langPath: base, gzip: true, logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') onProgress?.(m.progress); } });
  try {
    const out: string[] = [];
    for (const img of images) out.push((await worker.recognize(img)).data.text);
    return out;
  } finally { await worker.terminate(); }
}

async function pdfText(file: Blob, onProgress?: (p: number) => void): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = Math.min(doc.numPages, 40);
  const texts: string[] = [];
  for (let n = 1; n <= pages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    // rebuild lines: items on the same baseline belong together
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of content.items as { str: string; transform: number[] }[]) {
      if (!it.str?.trim()) continue;
      const y = Math.round(it.transform[5] / 3);
      (rows.get(y) ?? rows.set(y, []).get(y)!).push({ x: it.transform[4], s: it.str });
    }
    texts.push([...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, r]) => r.sort((a, b) => a.x - b.x).map((c) => c.s).join(' ')).join('\n'));
    onProgress?.(n / pages * 0.3);
  }
  if (texts.join('').replace(/\s/g, '').length >= 40 * Math.min(pages, 2)) return texts;
  // a scan with no text layer: draw each page and read it
  const canvases: HTMLCanvasElement[] = [];
  for (let n = 1; n <= Math.min(pages, 8); n++) {
    const page = await doc.getPage(n); const vp = page.getViewport({ scale: 2 });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    await page.render({ canvas: c, canvasContext: c.getContext('2d')!, viewport: vp }).promise;
    canvases.push(c);
  }
  return ocr(canvases, onProgress);
}

/** The text of a photo or PDF, one string per page. */
export async function textFromFile(file: File, onProgress?: (p: number) => void): Promise<string[]> {
  const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  return pdf ? pdfText(file, onProgress) : ocr([file], onProgress);
}
