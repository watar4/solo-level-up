import { useCallback, useEffect, useState } from 'react';

// Per-user AI (Anthropic) settings stored in localStorage, keyed by uid.
//
// The Anthropic API key is a *billing* secret, so unlike the rest of the app's
// state we deliberately keep it ONLY in the browser — it is never uploaded to
// Firestore/Google. This is the "bring your own key" (Option B) model: the key
// travels straight from this browser to api.anthropic.com and nowhere else.
// Scoping the storage key by uid means each signed-in user manages their own
// key on this device. Tradeoff: it does not sync across devices (re-enter per
// device), which is an acceptable posture for a secret that bills the user.

const DEFAULT_MODEL = 'claude-3-5-sonnet-latest';

const keyOf = (uid: string) => `slu:anthropicKey:${uid}`;
const modelOf = (uid: string) => `slu:anthropicModel:${uid}`;

export interface AiSettings {
  apiKey: string;
  model: string;
  hasKey: boolean;
  setApiKey: (key: string) => void;
  setModel: (model: string) => void;
  clearKey: () => void;
}

export function useAiSettings(uid: string | null): AiSettings {
  const [apiKey, setApiKeyState] = useState('');
  const [model, setModelState] = useState(DEFAULT_MODEL);

  useEffect(() => {
    if (!uid) {
      setApiKeyState('');
      setModelState(DEFAULT_MODEL);
      return;
    }
    try {
      setApiKeyState(localStorage.getItem(keyOf(uid)) ?? '');
      setModelState(localStorage.getItem(modelOf(uid)) || DEFAULT_MODEL);
    } catch {
      // localStorage can throw in private mode / when storage is disabled.
      setApiKeyState('');
      setModelState(DEFAULT_MODEL);
    }
  }, [uid]);

  const setApiKey = useCallback(
    (key: string) => {
      const trimmed = key.trim();
      setApiKeyState(trimmed);
      if (!uid) return;
      try {
        if (trimmed) localStorage.setItem(keyOf(uid), trimmed);
        else localStorage.removeItem(keyOf(uid));
      } catch {
        /* ignore — best effort */
      }
    },
    [uid]
  );

  const setModel = useCallback(
    (m: string) => {
      const trimmed = m.trim() || DEFAULT_MODEL;
      setModelState(trimmed);
      if (!uid) return;
      try {
        localStorage.setItem(modelOf(uid), trimmed);
      } catch {
        /* ignore — best effort */
      }
    },
    [uid]
  );

  const clearKey = useCallback(() => setApiKey(''), [setApiKey]);

  return { apiKey, model, hasKey: apiKey.length > 0, setApiKey, setModel, clearKey };
}
