import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createRulesEngine,
  webgpuAvailable,
  type CoachEngine,
  type CoachEngineKind,
} from '../lib/coach/engine';
import type { CoachContext } from '../lib/coach/context';
import type { CoachDigest } from '../lib/coach/digest';

// Manages the coach's active engine. The rules engine is always available and
// used by default (zero cost, no rate limit, every device). If the user opts in
// and downloads an on-device model, this hook swaps chat/narrate over to it and
// falls back to rules on any failure. Engine choice is a device capability, so
// the selected model id lives in localStorage (never synced to Firestore).

export type EngineStatus = 'rules' | 'loading' | 'ready' | 'error';

const modelKeyOf = (uid: string) => `slu:coachModel:${uid}`;

export interface CoachEngineApi {
  kind: CoachEngineKind;
  status: EngineStatus;
  webgpu: boolean;
  modelId: string | null; // the id the user has chosen / downloaded
  progress: { text: string; progress: number } | null;
  error: string | null;
  downloadModel: (id: string) => Promise<void>;
  removeModel: () => Promise<void>;
  narrate: (ctx: CoachContext, digest: CoachDigest) => Promise<string | null>;
  chat: CoachEngine['chat'];
}

export function useCoachEngine(uid: string | null): CoachEngineApi {
  const rules = useRef<CoachEngine>(createRulesEngine());
  const local = useRef<CoachEngine | null>(null);
  const [status, setStatus] = useState<EngineStatus>('rules');
  const [modelId, setModelId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ text: string; progress: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const webgpu = webgpuAvailable();

  // Restore the previously downloaded model id and, if its weights are still
  // cached, auto-load it so returning users get the local engine without a
  // second download.
  useEffect(() => {
    local.current = null;
    setStatus('rules');
    setModelId(null);
    setProgress(null);
    setError(null);
    if (!uid || !webgpu) return;
    let cancelled = false;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(modelKeyOf(uid));
    } catch {
      saved = null;
    }
    if (!saved) return;
    setModelId(saved);
    (async () => {
      try {
        const { isModelCached, loadLocalModel } = await import('../lib/coach/webllm');
        if (!(await isModelCached(saved))) return; // needs an explicit re-download
        if (cancelled) return;
        setStatus('loading');
        const engine = await loadLocalModel(saved, (p) => !cancelled && setProgress(p));
        if (cancelled) return;
        local.current = engine;
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        console.error('[coach] auto-load failed', err);
        setStatus('rules');
      } finally {
        if (!cancelled) setProgress(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, webgpu]);

  const downloadModel = useCallback(
    async (id: string) => {
      if (!webgpu) {
        setError('この端末は WebGPU に対応していないため、端末内AIを使えません。');
        return;
      }
      setError(null);
      setStatus('loading');
      setModelId(id);
      setProgress({ text: 'ダウンロードを準備しています…', progress: 0 });
      try {
        const { loadLocalModel } = await import('../lib/coach/webllm');
        const engine = await loadLocalModel(id, setProgress);
        local.current = engine;
        setStatus('ready');
        if (uid) {
          try {
            localStorage.setItem(modelKeyOf(uid), id);
          } catch {
            /* best effort */
          }
        }
      } catch (err) {
        console.error('[coach] model load failed', err);
        local.current = null;
        setStatus('error');
        setError(
          err instanceof Error
            ? `読み込みに失敗しました(メモリ不足の可能性): ${err.message}`
            : '読み込みに失敗しました。'
        );
      } finally {
        setProgress(null);
      }
    },
    [uid, webgpu]
  );

  const removeModel = useCallback(async () => {
    const id = modelId;
    local.current = null;
    setStatus('rules');
    setError(null);
    if (uid) {
      try {
        localStorage.removeItem(modelKeyOf(uid));
      } catch {
        /* best effort */
      }
    }
    if (id) {
      try {
        const { deleteLocalModel } = await import('../lib/coach/webllm');
        await deleteLocalModel(id);
      } catch (err) {
        console.error('[coach] delete failed', err);
      }
    }
    setModelId(null);
  }, [uid, modelId]);

  const active = () => (status === 'ready' && local.current ? local.current : rules.current);

  const narrate = useCallback(
    (ctx: CoachContext, digest: CoachDigest) => active().narrate(ctx, digest),
    [status]
  );

  const chat = useCallback<CoachEngine['chat']>(
    async (ctx, history, onToken) => {
      const engine = active();
      try {
        return await engine.chat(ctx, history, onToken);
      } catch (err) {
        console.error('[coach] chat failed, falling back to rules', err);
        return rules.current.chat(ctx, history, onToken);
      }
    },
    [status]
  );

  return {
    kind: active().kind,
    status,
    webgpu,
    modelId,
    progress,
    error,
    downloadModel,
    removeModel,
    narrate,
    chat,
  };
}
