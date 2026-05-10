import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { discoverRtcFoci } from './discovery';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

beforeEach(() => {
  // Each test uses a unique homeserver origin so the module-level cache
  // doesn't leak results between tests.
});

describe('discoverRtcFoci', () => {
  it('returns the livekit foci advertised in .well-known/matrix/client', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        'org.matrix.msc4143.rtc_foci': [
          {
            type: 'livekit',
            livekit_service_url: 'https://livekit.example.org',
          },
          { type: 'something_else' },
        ],
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const out = await discoverRtcFoci('https://hs1.example.org');
    expect(out).toEqual([
      {
        type: 'livekit',
        livekit_service_url: 'https://livekit.example.org',
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hs1.example.org/.well-known/matrix/client',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('returns an empty list when the response is not ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    }) as unknown as typeof fetch;
    const out = await discoverRtcFoci('https://hs2.example.org');
    expect(out).toEqual([]);
  });

  it('returns an empty list when fetch throws', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    const out = await discoverRtcFoci('https://hs3.example.org');
    expect(out).toEqual([]);
  });

  it('caches results per homeserver url', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        'org.matrix.msc4143.rtc_foci': [
          { type: 'livekit', livekit_service_url: 'https://lk.example.org' },
        ],
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await discoverRtcFoci('https://hs4.example.org');
    await discoverRtcFoci('https://hs4.example.org');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('drops foci entries that lack a valid livekit_service_url', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        'org.matrix.msc4143.rtc_foci': [
          { type: 'livekit' }, // missing service url
          { type: 'livekit', livekit_service_url: 42 }, // wrong type
          { type: 'livekit', livekit_service_url: 'https://ok.example.org' },
        ],
      }),
    }) as unknown as typeof fetch;

    const out = await discoverRtcFoci('https://hs5.example.org');
    expect(out).toEqual([
      { type: 'livekit', livekit_service_url: 'https://ok.example.org' },
    ]);
  });

  it('returns an empty list when the response has no rtc_foci field', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as unknown as typeof fetch;
    const out = await discoverRtcFoci('https://hs6.example.org');
    expect(out).toEqual([]);
  });
});
