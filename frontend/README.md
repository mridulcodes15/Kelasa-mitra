# Kelasa Mitra frontend

React 19 + Vite 8 + Tailwind 4 app for Kelasa Mitra. How to run it, test it and what it does:
see the [project README](../README.md) and [PLAN.md](../PLAN.md).

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api to the backend on port 8000
npm test           # vitest
npx tsc --noEmit -p tsconfig.app.json
npm run build
```
