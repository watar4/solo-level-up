import { useCallback, useEffect, useState } from 'react';
import {
  createApiKey,
  deleteApiKey,
  subscribeApiKeys,
} from '../lib/firestore';
import type { ApiKey, ApiKeyScope } from '../types';

export interface ApiKeysData {
  keys: ApiKey[];
  loading: boolean;
  // Returns the freshly-minted secret so the UI can show it once.
  generate: (label: string, scopes?: ApiKeyScope[]) => Promise<string>;
  revoke: (secret: string) => Promise<void>;
}

// Cryptographically strong 32-byte URL-safe random secret.
// We use base64url-encoded bytes for ~256 bits of entropy in 43 characters,
// which is short enough to copy by hand but completely uncrackable.
function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // Standard base64 → URL-safe base64 (no padding).
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function useApiKeys(uid: string | null): ApiKeysData {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setKeys([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeApiKeys(uid, (k) => {
      setKeys(k);
      setLoading(false);
    });
  }, [uid]);

  const generate = useCallback(
    async (label: string, scopes: ApiKeyScope[] = ['weight']): Promise<string> => {
      if (!uid) throw new Error('Not signed in');
      const secret = generateSecret();
      await createApiKey(uid, secret, label.trim() || 'API Key', scopes);
      return secret;
    },
    [uid]
  );

  const revoke = useCallback(async (secret: string): Promise<void> => {
    await deleteApiKey(secret);
  }, []);

  return { keys, loading, generate, revoke };
}
