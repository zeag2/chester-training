import { useEffect, useRef, useState } from 'react';
import { validBarcode } from '../lib/petfood';

/** Camera barcode scanner for the UPC/EAN codes on food bags and cans.
    - The camera starts once and keeps running: the parent re-rendering (a sync, a store update) never restarts it.
    - It asks for a sharp, continuously focused rear camera, and looks only for UPC/EAN, several times a second.
    - Uses the phone's own barcode reader when the browser has one (Chrome on Android); otherwise ZXing, loaded on demand.
    - Only codes with a valid check digit are accepted, so a half-read code is never looked up. */
export function Scanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const cb = useRef(onCode); cb.current = onCode;
  const [err, setErr] = useState('');
  const [torch, setTorch] = useState<null | boolean>(null); // null = this camera has no light
  const track = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    let over = false; let stream: MediaStream | null = null; let timer = 0; let zx: { stop(): void } | null = null;
    const cleanup = () => { over = true; window.clearTimeout(timer); zx?.stop(); stream?.getTracks().forEach((t) => t.stop()); };
    const found = (raw: string) => {
      const code = raw.replace(/\D/g, '');
      if (over || !validBarcode(code)) return;
      cleanup(); navigator.vibrate?.(30); cb.current(code);
    };
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
          facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 },
          advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
        } });
        if (over) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = video.current!; v.srcObject = stream; await v.play().catch(() => {});
        const t = stream.getVideoTracks()[0]; track.current = t;
        const caps = (t.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean; focusMode?: string[] };
        if (caps.torch) setTorch(false);
        if (caps.focusMode?.includes('continuous')) await t.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {});

        const BD = (window as any).BarcodeDetector;
        const formats: string[] = BD ? await BD.getSupportedFormats().catch(() => []) : [];
        const want = ['ean_13', 'ean_8', 'upc_a', 'upc_e'].filter((f) => formats.includes(f));
        if (want.length) {
          const det = new BD({ formats: want });
          const tick = async () => {
            if (over) return;
            if (v.readyState >= 2) { try { const hits = await det.detect(v); for (const h of hits) found(h.rawValue); } catch { /* frame not ready */ } }
            timer = window.setTimeout(tick, 120);
          };
          void tick();
          return;
        }
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
        if (over) return;
        const hints = new Map<any, any>([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]], [DecodeHintType.TRY_HARDER, true]]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });
        zx = await reader.decodeFromStream(stream, v, (res) => { if (res) found(res.getText()); });
        if (over) zx.stop();
      } catch (e) {
        if (over) return;
        const m = String((e as Error)?.name ?? e);
        setErr(/NotAllowed|Permission|Security/i.test(m) ? 'Camera access is off. Allow it for this app in Settings, or type the barcode numbers below.' : 'The camera isn’t available here. Type the barcode numbers below instead.');
      }
    })();
    return cleanup;
  }, []);

  const light = async () => {
    const t = track.current; if (!t || torch === null) return;
    try { await t.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] }); setTorch(!torch); } catch { setTorch(null); }
  };
  return <div className="scanner">
    <video ref={video} playsInline muted autoPlay aria-label="Camera view for scanning a barcode" />
    <div className="scanframe" aria-hidden="true"><i className="scanline" /></div>
    <p className="s scanhint">{err || 'Fill the box with the barcode. Hold steady about a hand’s width away.'}</p>
    {torch !== null && <button className="btn2 scantorch" aria-pressed={torch} onClick={light}>{torch ? 'Light off' : 'Light'}</button>}
    <button className="btn2 scanclose" onClick={onClose}>Cancel</button>
  </div>;
}
