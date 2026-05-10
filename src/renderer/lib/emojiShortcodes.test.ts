import { describe, expect, it } from 'vitest';
import type { CustomEmoji } from '@/matrix/customEmojis';
import {
  detectActiveShortcode,
  lookupShortcode,
  replaceShortcodeAtCursor,
  replaceShortcodes,
  searchCombined,
  searchShortcodes,
} from './emojiShortcodes';

function customEmoji(shortcode: string): CustomEmoji {
  return {
    shortcode,
    mxc: `mxc://example.org/${shortcode}`,
    usage: ['emoticon'],
    source: { kind: 'user' },
  };
}

describe('lookupShortcode', () => {
  it('resolves a well-known github shortcode to its emoji', () => {
    // Some glyphs come back with the FE0F variation selector — accept either.
    expect(lookupShortcode('thumbsup')).toMatch(/^👍/);
  });

  it('is case-insensitive', () => {
    expect(lookupShortcode('THUMBSUP')).toBe(lookupShortcode('thumbsup'));
  });

  it('returns null for unknown codes', () => {
    expect(lookupShortcode('definitely_not_real_xyz')).toBeNull();
  });
});

describe('replaceShortcodes', () => {
  it('substitutes every known shortcode in the string', () => {
    const out = replaceShortcodes('hello :thumbsup: world :heart:');
    expect(out).toContain('👍');
    expect(out).not.toContain(':thumbsup:');
    expect(out).not.toContain(':heart:');
  });

  it('leaves unknown shortcodes intact', () => {
    expect(replaceShortcodes(':notreal_xyz:')).toBe(':notreal_xyz:');
  });

  it('returns the string unchanged when there are no shortcodes', () => {
    expect(replaceShortcodes('plain text')).toBe('plain text');
  });
});

describe('searchShortcodes', () => {
  it('returns no results for an empty query', () => {
    expect(searchShortcodes('')).toEqual([]);
  });

  it('puts an exact match first', () => {
    const results = searchShortcodes('thumbsup', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].code).toBe('thumbsup');
    expect(results[0].emoji).toMatch(/^👍/);
  });

  it('caps results at the limit', () => {
    expect(searchShortcodes('a', 4).length).toBeLessThanOrEqual(4);
  });

  it('dedupes by emoji glyph', () => {
    const results = searchShortcodes('smile', 8);
    const glyphs = new Set(results.map((r) => r.emoji));
    expect(glyphs.size).toBe(results.length);
  });
});

describe('detectActiveShortcode', () => {
  it('detects a partial code at the cursor', () => {
    const text = 'hello :sm';
    const out = detectActiveShortcode(text, text.length);
    expect(out).toEqual({ start: 6, query: 'sm' });
  });

  it('detects an empty query when only the leading colon is typed', () => {
    const text = 'hi :';
    const out = detectActiveShortcode(text, text.length);
    expect(out).toEqual({ start: 3, query: '' });
  });

  it('returns null when there is no leading colon', () => {
    expect(detectActiveShortcode('hi sm', 5)).toBeNull();
  });

  it('does not trigger inside a URL-like preceding token', () => {
    // Word characters before the colon (e.g. `http`) disqualify the match.
    expect(detectActiveShortcode('http://x', 5)).toBeNull();
  });

  it('triggers at the start of the string', () => {
    expect(detectActiveShortcode(':sm', 3)).toEqual({ start: 0, query: 'sm' });
  });
});

describe('replaceShortcodeAtCursor', () => {
  it('replaces a typed `:thumbsup:` with the emoji and moves the caret', () => {
    const text = 'hi :thumbsup:';
    const out = replaceShortcodeAtCursor(text, text.length);
    expect(out).not.toBeNull();
    expect(out!.text).toMatch(/^hi 👍/);
    expect(out!.text).not.toContain(':thumbsup:');
    expect(out!.cursor).toBe(out!.text.length);
  });

  it('returns null when the cursor is not just past a closing colon', () => {
    expect(replaceShortcodeAtCursor('hi :thumbsup', 12)).toBeNull();
  });

  it('returns null when no shortcode body precedes the colon', () => {
    expect(replaceShortcodeAtCursor('::', 2)).toBeNull();
  });

  it('skips shortcodes listed in skipCodes', () => {
    const skip = new Set(['thumbsup']);
    expect(replaceShortcodeAtCursor('hi :thumbsup:', 13, skip)).toBeNull();
  });

  it('returns null for unknown shortcodes', () => {
    expect(replaceShortcodeAtCursor('hi :notreal_xyz:', 16)).toBeNull();
  });
});

describe('searchCombined', () => {
  it('returns nothing for an empty query', () => {
    expect(searchCombined('', [customEmoji('smile')])).toEqual([]);
  });

  it('puts custom emojis ahead of unicode at the same tier', () => {
    const customs = [customEmoji('thumbsup')];
    const results = searchCombined('thumbsup', customs, 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].kind).toBe('custom');
    if (results[0].kind === 'custom') {
      expect(results[0].emoji.shortcode).toBe('thumbsup');
    }
  });

  it('shadows a unicode shortcode with a custom one of the same name', () => {
    const customs = [customEmoji('thumbsup')];
    const results = searchCombined('thumbsup', customs, 10);
    const unicodeForSameCode = results.find(
      (r) => r.kind === 'unicode' && r.code === 'thumbsup',
    );
    expect(unicodeForSameCode).toBeUndefined();
  });

  it('respects the limit', () => {
    const results = searchCombined('a', [], 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('returns an empty list when no custom and no unicode matches', () => {
    expect(searchCombined('zzz_definitely_not_real', [])).toEqual([]);
  });
});
