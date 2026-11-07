const P: Record<string, string> = {
  home: 'M4 11 L12 4 L20 11 V20 H4 Z',
  tree: 'M6 12 m-2.5 0 a2.5 2.5 0 1 0 5 0 a2.5 2.5 0 1 0 -5 0 M18 6 m-2.5 0 a2.5 2.5 0 1 0 5 0 a2.5 2.5 0 1 0 -5 0 M18 18 m-2.5 0 a2.5 2.5 0 1 0 5 0 a2.5 2.5 0 1 0 -5 0 M8.3 11 L15.7 7 M8.3 13 L15.7 17',
  book: 'M5 4 H17 A2 2 0 0 1 19 6 V20 H7 A2 2 0 0 1 5 18 Z M5 18 A2 2 0 0 1 7 16 H19',
  plus: 'M12 5 V19 M5 12 H19',
  back: 'M15 5 L8 12 L15 19',
  close: 'M6 6 L18 18 M18 6 L6 18',
  search: 'M11 11 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 M16 16 L20 20',
  check: 'M5 12.5 L10 17 L19 7',
  lock: 'M5.5 10.5 H18.5 V20 H5.5 Z M8.5 10.5 V8 A3.5 3.5 0 0 1 15.5 8 V10.5',
  target: 'M12 12 m-7.5 0 a7.5 7.5 0 1 0 15 0 a7.5 7.5 0 1 0 -15 0 M12 12 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0',
  box: 'M4 9 H20 V19 H4 Z M7 9 V6 H17 V9 M10 13 H14',
  hand: 'M8 12 V6.5 A1.5 1.5 0 0 1 11 6.5 V11 M11 10 V5 A1.5 1.5 0 0 1 14 5 V11 M14 10.5 V6.5 A1.5 1.5 0 0 1 17 6.5 V14 A6 6 0 0 1 11 20 C8 20 6.5 18 5 15 L4 12.5 A1.5 1.5 0 0 1 6.8 11.4 L8 13',
  click: 'M6 9 A5 5 0 0 1 11 4 H13 A5 5 0 0 1 18 9 V15 A5 5 0 0 1 13 20 H11 A5 5 0 0 1 6 15 Z M12 10 m-2.5 0 a2.5 2.5 0 1 0 5 0 a2.5 2.5 0 1 0 -5 0',
  mat: 'M3 13 A4 4 0 0 1 7 9 H17 A4 4 0 0 1 21 13 A4 4 0 0 1 17 17 H7 A4 4 0 0 1 3 13 Z',
  ear: 'M9 18 C6 18 6 14 8 12 C10 10 9 7 12 6 C15 5 17 8 16 11 C15.5 13 13.5 13 13 15',
  yarn: 'M12 12 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M6 9 C10 11 14 9 18 11 M6.5 15 C10 13 14 15 17.5 13 M10 5.5 C12 9 12 15 14 18.5',
  star: 'M12 4 L14.5 9.5 L20 10 L16 14 L17 20 L12 17 L7 20 L8 14 L4 10 L9.5 9.5 Z',
  leaf: 'M5 19 C5 10 11 5 19 5 C19 13 14 19 5 19 Z M5 19 L13 11',
  pause: 'M8 5 V19 M16 5 V19', play: 'M7 5 L19 12 L7 19 Z',
  gear: 'M12 12 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M12 3 V5.5 M12 18.5 V21 M3 12 H5.5 M18.5 12 H21 M5.6 5.6 L7.4 7.4 M16.6 16.6 L18.4 18.4 M5.6 18.4 L7.4 16.6 M16.6 7.4 L18.4 5.6',
  sound: 'M4 10 H8 L13 6 V18 L8 14 H4 Z M16 9 C17.5 10.5 17.5 13.5 16 15', mute: 'M4 10 H8 L13 6 V18 L8 14 H4 Z M16 10 L20 14 M20 10 L16 14',
};
export const ICON_FOR: Record<string, string> = { Foundation: 'target', Care: 'hand', Manners: 'mat', Adventure: 'leaf', Tricks: 'star' };
export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ stroke: 'currentColor', fill: 'none', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d={P[name] ?? P.star} /></svg>;
}
export function Paw({ color = 'var(--ink)', size = 28 }: { color?: string; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"><ellipse cx="12" cy="15.5" rx="5" ry="4.2" style={{ fill: color }} /><ellipse cx="6" cy="10" rx="2" ry="2.6" style={{ fill: color }} /><ellipse cx="10" cy="6.5" rx="2" ry="2.6" style={{ fill: color }} /><ellipse cx="14" cy="6.5" rx="2" ry="2.6" style={{ fill: color }} /><ellipse cx="18" cy="10" rx="2" ry="2.6" style={{ fill: color }} /></svg>;
}
