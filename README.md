# @48 — The Weekend Reality Checker (Bengaluru Edition)

Buildathon starter: client-side React/Vite/TypeScript app with a deterministic two-day feasibility engine.

## Requirements
- Node.js 22.12+ or 24 LTS
- Git

## Run locally (PowerShell)
From the folder containing `package.json`:

```powershell
npm install
npm run test:engine:offline
npm test
npm run build
npm run dev
```

Then open the localhost link printed by Vite (usually http://localhost:5173/). Keep the terminal open while testing. Stop it with Ctrl+C.

## Deployment
Push the repository to GitHub, import it on Vercel. Vite preset, build command `npm run build`, output directory `dist`. The existing `vercel.json` supplies SPA fallback rewrites.

## Disclosure
Travel times, many activity data points and costs are labelled as estimates or assumptions. This app does **not** provide real-time traffic forecasts or location tracking. Use the source/evidence annotations in `src/data/destinations.ts` and verify before real-world decisions.

**Save & Resume** is planned after a working core build; it is not yet in this package.
