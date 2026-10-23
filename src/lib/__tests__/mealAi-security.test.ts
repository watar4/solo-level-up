import { afterEach, expect, it, vi } from 'vitest';
import { requestMealReview } from '../mealAi';

afterEach(() => vi.unstubAllGlobals());
it('sends the API credential only as a header, never in the URL or body', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  expect(await requestMealReview({ apiKey: 'test-only-secret', model: 'gemini-2.5-flash', message: 'test' })).toBe('ok');
  const [url, init] = fetch.mock.calls[0];
  expect(String(url)).not.toContain('test-only-secret');
  expect(new URL(url).search).toBe('');
  expect(init.headers['x-goog-api-key']).toBe('test-only-secret');
  expect(init.body).not.toContain('test-only-secret');
});
