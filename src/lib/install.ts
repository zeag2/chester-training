import { useState } from 'react';
export function useInstallHint() { const [s] = useState(() => !(navigator as any).standalone && !matchMedia('(display-mode: standalone)').matches); return s; }
