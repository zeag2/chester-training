import { useEffect, useRef, useState } from 'react';

/** Camera barcode scanner (UPC/EAN on food bags and cans). The decoder is loaded only when a scan starts. */
export function Scanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let stop = () => {}; let done = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current!, (res) => {
          if (res && !done) { done = true; navigator.vibrate?.(30); onCode(res.getText()); }
        });
        stop = () => controls.stop();
        if (done) stop();
      } catch (e) {
        const m = String((e as Error)?.name ?? e);
        setErr(/NotAllowed|Permission/i.test(m) ? 'Camera access is off. Allow it for this app in Settings, or type the barcode numbers below.' : 'The camera isn’t available here. Type the barcode numbers below instead.');
      }
    })();
    return () => { done = true; stop(); };
  }, [onCode]);
  return <div className="scanner">
    <video ref={video} playsInline muted aria-label="Camera view for scanning a barcode" />
    <div className="scanframe" aria-hidden="true" />
    <p className="s scanhint">{err || 'Point the camera at the barcode on the bag or can.'}</p>
    <button className="btn2 scanclose" onClick={onClose}>Cancel</button>
  </div>;
}
