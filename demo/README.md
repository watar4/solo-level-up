# Adventure demo harness

Standalone harness to drive the story campaign (`AdventurePanel` + battle
engine) in a real browser **without Firebase auth**, for verification /
screenshots. Not part of the app build — Vite only bundles `index.html`, and
`tsconfig` only typechecks `src/`, so nothing here ships.

## Files
- `main.tsx` — mounts `AdventurePanel` with a mock Lv20 character and in-memory
  campaign state (Will kept topped up so a full chapter can be walked).
- `../adventure-demo.html` — Vite entry for the harness.
- `drive.mjs` — Playwright script: clicks through chapter 1 (dialogue → 5
  battles → lord) and writes screenshots.

## Run
```bash
# 1. dev server (base=/ so the demo html resolves at the root)
npx vite --base=/ --port 5175

# 2. in another shell — needs a Chromium binary. In the CC-web sandbox:
npm i --no-save playwright-core
node demo/drive.mjs            # screenshots go to the scratchpad dir in the script
```
`drive.mjs` hard-codes the sandbox Chromium path
(`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`); adjust `executablePath`
for other environments.
