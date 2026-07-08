// AI coach — on-device LLM engine (docs/redesign/09-ai-coach.md §3-1).
//
// Wraps @mlc-ai/web-llm so the coach can run a small model entirely in the
// browser via WebGPU: free, no rate limit, offline, and the logs never leave
// the device. The library is several MB, so it is ALWAYS pulled via dynamic
// import() — it must never land in the initial bundle.
//
// Model weights (~0.4–1.4GB) download once into Cache Storage on first use and
// are reused thereafter, so this is strictly opt-in behind an explicit consent.

import type { CoachContext } from './context';
import type { CoachDigest } from './digest';
import type { CoachEngine, CoachMessage } from './engine';
import { contextToPrompt } from './context';

export interface CoachModelOption {
  id: string; // must exist in web-llm's prebuiltAppConfig.model_list
  label: string;
  sizeLabel: string;
  note: string;
}

// Preferred model ids in priority order. The list web-llm actually ships from
// changes across versions, so we resolve against the live model_list at runtime
// (see listAvailableModels) and never hard-depend on any single id existing.
// Ordered smallest-first: on phones the model must fit in limited GPU memory or
// inference OOM-crashes the tab. Lead with the lightest so mobile users pick a
// model that actually runs; heavier/higher-quality options are for desktops.
const PREFERRED: CoachModelOption[] = [
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 0.5B', sizeLabel: '約0.4GB', note: 'スマホ推奨。最軽量で落ちにくい' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B', sizeLabel: '約0.7GB', note: '軽量。中位の端末向け' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 1.5B', sizeLabel: '約1.0GB', note: '日本語が得意。PC・高性能端末向け' },
  { id: 'gemma-2-2b-it-q4f16_1-MLC', label: 'Gemma 2 2B', sizeLabel: '約1.4GB', note: '高品質。PC向け(スマホは非推奨)' },
];

const SYSTEM_PROMPT = `あなたは育成アプリ「ソロ・レベルアップ」に組み込まれた習慣化コーチ「アリア」です。
プレイヤーの記録(クエストの連続日数・体重・食事・貯金など)をもとに、日本語で励ましと助言を返してください。

方針:
- 落ち着いた、丁寧で前向きな「です・ます」口調。絵文字とMarkdown見出しは使わない。
- 数値は必ず、与えられたコンテキストに書かれている値だけを引用する。書かれていない数字を作らない。
- まず良い点を1つ認め、次にすぐ実行できる具体的な一手を1〜2個示す。
- 医療・極端な制限などの危険な助言はしない。
- 短く、全体で200〜300字程度にまとめる。`;

// Resolve which preferred models are actually available in this web-llm build.
export async function listAvailableModels(): Promise<CoachModelOption[]> {
  const webllm = await import('@mlc-ai/web-llm');
  const ids = new Set(webllm.prebuiltAppConfig.model_list.map((m) => m.model_id));
  const available = PREFERRED.filter((m) => ids.has(m.id));
  // If none of our curated ids survive a library bump, fall back to the first
  // few small instruct models the build offers so the feature still works.
  if (available.length === 0) {
    return webllm.prebuiltAppConfig.model_list
      .filter((m) => /instruct/i.test(m.model_id) && (m.low_resource_required ?? false))
      .slice(0, 4)
      .map((m) => ({ id: m.model_id, label: m.model_id, sizeLabel: '', note: '' }));
  }
  return available;
}

export function defaultModelId(options: CoachModelOption[]): string | null {
  return options.length ? options[0].id : null;
}

export interface LoadProgress {
  text: string;
  progress: number; // 0..1
}

// How many recent chat messages to send to the model. Small models have a
// small KV cache; a long transcript inflates memory and can OOM-crash the tab
// mid-inference. Keep only the last few turns.
const MAX_HISTORY = 6;

// Build a chat message array for the model from context + history.
function toMessages(ctx: CoachContext, history: CoachMessage[]) {
  return [
    { role: 'system' as const, content: `${SYSTEM_PROMPT}\n\n# 現在の記録\n${contextToPrompt(ctx)}` },
    ...history.slice(-MAX_HISTORY).map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.text,
    })),
  ];
}

// Download (if needed) and initialise a model, returning a ready CoachEngine.
// `onProgress` fires during weight download / GPU shader compilation. Throws on
// unsupported GPU or OOM — callers should catch and fall back to the rules engine.
export async function loadLocalModel(
  modelId: string,
  onProgress: (p: LoadProgress) => void
): Promise<CoachEngine> {
  const webllm = await import('@mlc-ai/web-llm');
  // Run the model in a dedicated Web Worker: downloading the weights and doing
  // WebGPU inference on the main thread hangs / OOM-crashes the tab (the coach
  // "disappearing"). The worker isolates that so the UI stays alive and errors
  // are catchable. Vite bundles this worker URL form natively.
  const worker = new Worker(new URL('./webllm.worker.ts', import.meta.url), { type: 'module' });
  const engine = await webllm.CreateWebWorkerMLCEngine(worker, modelId, {
    initProgressCallback: (r) => onProgress({ text: r.text, progress: r.progress }),
  });

  return {
    kind: 'webllm',
    async narrate(ctx, digest: CoachDigest) {
      try {
        const reply = await engine.chat.completions.create({
          messages: [
            { role: 'system', content: `${SYSTEM_PROMPT}\n\n# 現在の記録\n${contextToPrompt(ctx)}` },
            {
              role: 'user',
              content: `次の要点を、あなたの言葉で2〜3文にまとめて、今日の一手を添えてください:\n${digest.bullets.join('\n')}\n提案: ${digest.callToAction}`,
            },
          ],
          max_tokens: 220,
          temperature: 0.7,
        });
        const text = reply.choices[0]?.message?.content?.trim() ?? '';
        return validate(text) ? text : null;
      } catch (err) {
        console.error('[coach] narrate failed', err);
        return null;
      }
    },
    async chat(ctx, history, onToken) {
      const chunks = await engine.chat.completions.create({
        messages: toMessages(ctx, history),
        max_tokens: 256,
        temperature: 0.7,
        stream: true,
      });
      let full = '';
      for await (const chunk of chunks) {
        const delta = chunk.choices[0]?.delta?.content ?? '';
        if (delta) {
          full += delta;
          onToken?.(delta);
        }
      }
      return full.trim();
    },
  };
}

// Loose sanity check on a small model's output before trusting it over the
// deterministic text: non-empty, not absurdly long, few line breaks.
function validate(text: string): boolean {
  if (text.length < 10 || text.length > 500) return false;
  if ((text.match(/\n/g)?.length ?? 0) > 10) return false;
  return true;
}

export async function deleteLocalModel(modelId: string): Promise<void> {
  const webllm = await import('@mlc-ai/web-llm');
  await webllm.deleteModelAllInfoInCache(modelId);
}

export async function isModelCached(modelId: string): Promise<boolean> {
  try {
    const webllm = await import('@mlc-ai/web-llm');
    return await webllm.hasModelInCache(modelId, webllm.prebuiltAppConfig);
  } catch {
    return false;
  }
}
