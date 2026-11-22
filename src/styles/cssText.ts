/** Tests only: app.css with every plain token (space, type size, radius, duration, shadow) written out as its value
    from tokens.css, so a test can check a rule is still exactly what phones had before the tokens. */
export async function appCssResolved(): Promise<string> {
  const fs = 'node:fs'; // read the files themselves: vitest drops CSS imports
  const read: (f: string, e: string) => string = (await import(/* @vite-ignore */ fs)).readFileSync;
  const tokens = read('src/styles/tokens.css', 'utf8'), css = read('src/styles/app.css', 'utf8');
  const root = tokens.slice(tokens.indexOf(':root{'), tokens.indexOf('@media'));
  const val = new Map([...root.matchAll(/--((?:sp|fs|r|dur|shadow)-?[\w-]*):([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  return css.replace(/var\(--([\w-]+)\)/g, (all, name: string) => val.get(name) ?? all);
}
