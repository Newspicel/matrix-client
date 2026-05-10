import { describe, expect, it } from 'vitest';
import { EMOJI_CATEGORIES, searchEmojis } from './emojiData';

describe('EMOJI_CATEGORIES', () => {
  it('exposes the expected category ids in display order', () => {
    expect(EMOJI_CATEGORIES.map((c) => c.id)).toEqual([
      'smileys',
      'people',
      'animals',
      'food',
      'travel',
      'activities',
      'objects',
      'symbols',
      'flags',
    ]);
  });

  it('every category has at least one emoji entry', () => {
    for (const cat of EMOJI_CATEGORIES) {
      expect(cat.items.length).toBeGreaterThan(0);
    }
  });

  it('emoji entries carry both a glyph and a searchable name', () => {
    const sample = EMOJI_CATEGORIES[0].items[0];
    expect(sample.e.length).toBeGreaterThan(0);
    expect(sample.n.length).toBeGreaterThan(0);
    expect(sample.n).toBe(sample.n.toLowerCase());
  });

  it('does not include the components group (skin tones / regional indicators)', () => {
    // Group 2 in emojibase is "component". A search that would only match
    // those (e.g. "regional indicator") should yield nothing here.
    const results = searchEmojis('regional indicator');
    expect(results).toEqual([]);
  });
});

describe('searchEmojis', () => {
  it('returns nothing for empty/whitespace queries', () => {
    expect(searchEmojis('')).toEqual([]);
    expect(searchEmojis('   ')).toEqual([]);
  });

  it('matches against the keyword string case-insensitively', () => {
    const upper = searchEmojis('SMILE');
    const lower = searchEmojis('smile');
    expect(upper.length).toBeGreaterThan(0);
    expect(upper.length).toBe(lower.length);
  });

  it('caps results at 200', () => {
    // "a" is a frequent substring; the cap should kick in.
    const results = searchEmojis('a');
    expect(results.length).toBeLessThanOrEqual(200);
  });

  it('returns nothing for an obviously absent query', () => {
    expect(searchEmojis('zzz_definitely_not_real')).toEqual([]);
  });
});
