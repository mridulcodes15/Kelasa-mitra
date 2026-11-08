// Tests read source files (CSS, backend data) with Node's fs; the app tsconfig has no Node types.
declare module 'node:fs' {
  export function readFileSync(path: string | URL, encoding: 'utf-8'): string;
}
