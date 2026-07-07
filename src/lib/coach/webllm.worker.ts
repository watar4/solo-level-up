// Web Worker host for the on-device coach model (docs/redesign/09-ai-coach.md).
//
// Running the model here — not on the main thread — is the whole point: loading
// a multi-hundred-MB model and doing WebGPU inference on the UI thread hangs or
// OOM-crashes the tab (especially on mobile), which manifests as the whole app
// (and the coach with it) vanishing. Isolating it in a worker keeps the UI
// alive and lets failures surface as errors instead of a dead tab.

import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
