// Copies the on-device text recognition files (Tesseract worker, engine, English data) into public/ocr,
// so PalDex serves them itself instead of loading them from a CDN. Runs before dev and build.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
const out = 'public/ocr';
mkdirSync(out, { recursive: true });
const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
];
for (const [from, to] of files) {
  if (!existsSync(from)) { console.error('missing ' + from); process.exit(1); }
  cpSync(from, `${out}/${to}`);
}
console.log('ocr files ready in ' + out);
