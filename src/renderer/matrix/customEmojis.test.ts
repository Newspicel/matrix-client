import { describe, expect, it } from 'vitest';
import {
  canonicaliseShortcode,
  normaliseRoomPack,
  normaliseUserPack,
  type MSC2545EmotesContent,
} from './customEmojis';

describe('canonicaliseShortcode', () => {
  it('strips a wrapping pair of colons', () => {
    expect(canonicaliseShortcode(':smile:')).toBe('smile');
  });

  it('lowercases and trims', () => {
    expect(canonicaliseShortcode('  SMILE  ')).toBe('smile');
  });

  it('rejects shortcodes shorter than 2 chars', () => {
    expect(canonicaliseShortcode('a')).toBeNull();
  });

  it('rejects shortcodes longer than 32 chars', () => {
    expect(canonicaliseShortcode('a'.repeat(33))).toBeNull();
  });

  it('rejects shortcodes with disallowed characters', () => {
    expect(canonicaliseShortcode('hello world')).toBeNull();
    expect(canonicaliseShortcode('emoji!')).toBeNull();
    expect(canonicaliseShortcode('über')).toBeNull();
  });

  it('accepts the allowed alphabet (a-z, 0-9, _, +, -)', () => {
    expect(canonicaliseShortcode('a_b-c+d1')).toBe('a_b-c+d1');
  });
});

describe('normaliseUserPack', () => {
  it('returns an empty pack with the fallback name when raw is null', () => {
    const pack = normaliseUserPack(null);
    expect(pack.displayName).toBe('My emojis');
    expect(pack.emoticons).toEqual([]);
    expect(pack.stickers).toEqual([]);
    expect(pack.source).toEqual({ kind: 'user' });
  });

  it('keeps a custom display name when present', () => {
    const raw: MSC2545EmotesContent = {
      images: {},
      pack: { display_name: 'Cool Pack' },
    };
    expect(normaliseUserPack(raw).displayName).toBe('Cool Pack');
  });

  it('falls back to the default name when display_name is whitespace', () => {
    const raw: MSC2545EmotesContent = {
      images: {},
      pack: { display_name: '   ' },
    };
    expect(normaliseUserPack(raw).displayName).toBe('My emojis');
  });

  it('drops images with non-mxc urls', () => {
    const raw: MSC2545EmotesContent = {
      images: {
        good: { url: 'mxc://x/y' },
        bad: { url: 'https://example.org/y.png' },
      },
    };
    const pack = normaliseUserPack(raw);
    expect(pack.emoticons.map((e) => e.shortcode)).toEqual(['good']);
  });

  it('drops images whose shortcode cannot be canonicalised', () => {
    const raw: MSC2545EmotesContent = {
      images: {
        'bad name': { url: 'mxc://x/y' },
        ok: { url: 'mxc://x/y' },
      },
    };
    const pack = normaliseUserPack(raw);
    expect(pack.emoticons.map((e) => e.shortcode)).toEqual(['ok']);
  });

  it('sorts emoticons alphabetically by shortcode', () => {
    const raw: MSC2545EmotesContent = {
      images: {
        cherry: { url: 'mxc://x/c' },
        apple: { url: 'mxc://x/a' },
        banana: { url: 'mxc://x/b' },
      },
    };
    expect(normaliseUserPack(raw).emoticons.map((e) => e.shortcode)).toEqual([
      'apple',
      'banana',
      'cherry',
    ]);
  });

  it('routes images by usage', () => {
    const raw: MSC2545EmotesContent = {
      images: {
        emo: { url: 'mxc://x/1', usage: ['emoticon'] },
        sti: { url: 'mxc://x/2', usage: ['sticker'] },
        both: { url: 'mxc://x/3', usage: ['emoticon', 'sticker'] },
      },
    };
    const pack = normaliseUserPack(raw);
    expect(pack.emoticons.map((e) => e.shortcode).sort()).toEqual(['both', 'emo']);
    expect(pack.stickers.map((e) => e.shortcode).sort()).toEqual(['both', 'sti']);
  });

  it('uses the pack-level usage when an image omits its own', () => {
    const raw: MSC2545EmotesContent = {
      images: { sti: { url: 'mxc://x/1' } },
      pack: { usage: ['sticker'] },
    };
    const pack = normaliseUserPack(raw);
    expect(pack.emoticons).toEqual([]);
    expect(pack.stickers.map((e) => e.shortcode)).toEqual(['sti']);
  });

  it('defaults to emoticon when no usage is declared at any level', () => {
    const raw: MSC2545EmotesContent = { images: { xx: { url: 'mxc://x/1' } } };
    const pack = normaliseUserPack(raw);
    expect(pack.emoticons.map((e) => e.shortcode)).toEqual(['xx']);
    expect(pack.stickers).toEqual([]);
  });

  it('ignores invalid usage strings', () => {
    const raw: MSC2545EmotesContent = {
      images: {
        xx: { url: 'mxc://x/1', usage: ['something_invalid' as unknown as 'emoticon'] },
      },
    };
    // No valid usage left → falls back to pack default (emoticon).
    expect(normaliseUserPack(raw).emoticons.map((e) => e.shortcode)).toEqual(['xx']);
  });
});

describe('normaliseRoomPack', () => {
  it('uses the fallback name when no display_name is provided', () => {
    const raw: MSC2545EmotesContent = { images: {} };
    const pack = normaliseRoomPack('!room', '', raw, 'Room pack');
    expect(pack.displayName).toBe('Room pack');
    expect(pack.source).toEqual({ kind: 'room', roomId: '!room', stateKey: '' });
  });

  it('exposes attribution and avatar when set', () => {
    const raw: MSC2545EmotesContent = {
      images: {},
      pack: { attribution: 'CC-BY', avatar_url: 'mxc://x/avatar' },
    };
    const pack = normaliseRoomPack('!r', 'k', raw, 'Pack');
    expect(pack.attribution).toBe('CC-BY');
    expect(pack.avatarMxc).toBe('mxc://x/avatar');
  });

  it('drops empty/whitespace attribution to undefined', () => {
    const raw: MSC2545EmotesContent = { images: {}, pack: { attribution: '' } };
    const pack = normaliseRoomPack('!r', 'k', raw, 'Pack');
    expect(pack.attribution).toBeUndefined();
  });
});
