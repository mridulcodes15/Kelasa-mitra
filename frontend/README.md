# Kelasa Mitra frontend

React 19.3.1 + Vite 8.3.6 + Tailwind CSS 4.3.5 app (TypeScript 7.0.2, Framer Motion 14.10.1, Zustand 5.1.0) for Kelasa Mitra. What it does, how to run it (Windows and
Docker), the live demo and the test results are in the [project README](../README.md); the
design is in [PLAN.md](../PLAN.md).

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api to the backend on port 8000
npm test           # vitest
npx tsc --noEmit -p tsconfig.app.json
npm run build
```
