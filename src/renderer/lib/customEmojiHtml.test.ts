import { describe, expect, it } from 'vitest';
import type { CustomEmoji } from '@/matrix/customEmojis';
import { bodyToFormattedHtml, emoteImgTag, parseEmoteImg } from './customEmojiHtml';

function emoji(shortcode: string, mxc = `mxc://example.org/${shortcode}`): CustomEmoji {
  return {
    shortcode,
    mxc,
    usage: ['emoticon'],
    source: { kind: 'user' },
  };
}

describe('emoteImgTag', () => {
  it('emits an MSC2545 inline image tag with alt + title + clamped height', () => {
    const html = emoteImgTag(emoji('smile'));
    expect(html).toContain('data-mx-emoticon');
    expect(html).toContain('src="mxc://example.org/smile"');
    expect(html).toContain('alt=":smile:"');
    expect(html).toContain('title=":smile:"');
    expect(html).toContain('height="32"');
  });

  it('escapes attribute-special characters in the mxc url and shortcode', () => {
    const html = emoteImgTag(emoji('a"b', 'mxc://example.org/<bad>'));
    expect(html).not.toContain('mxc://example.org/<bad>');
    expect(html).toContain('mxc://example.org/&lt;bad&gt;');
    expect(html).not.toContain('alt=":a"b:"');
    expect(html).toContain('&quot;');
  });
});

describe('bodyToFormattedHtml', () => {
  const resolve = (code: string): CustomEmoji | null =>
    code === 'smile' ? emoji('smile') : null;

  it('returns touched=false and html-escaped body when no shortcodes match', () => {
    const out = bodyToFormattedHtml('hello <world>', resolve);
    expect(out.touched).toBe(false);
    expect(out.html).toBe('hello &lt;world&gt;');
  });

  it('substitutes a known shortcode and reports touched=true', () => {
    const out = bodyToFormattedHtml('hi :smile:', resolve);
    expect(out.touched).toBe(true);
    expect(out.html).toContain('hi ');
    expect(out.html).toContain('data-mx-emoticon');
    expect(out.html).toContain('mxc://example.org/smile');
  });

  it('leaves unknown shortcodes alone, escaped as text', () => {
    const out = bodyToFormattedHtml('hi :nope:', resolve);
    expect(out.touched).toBe(false);
    expect(out.html).toBe('hi :nope:');
  });

  it('replaces every occurrence', () => {
    const out = bodyToFormattedHtml(':smile: :smile:', resolve);
    const matches = out.html.match(/data-mx-emoticon/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it('matches shortcodes case-insensitively', () => {
    const out = bodyToFormattedHtml(':SMILE:', resolve);
    expect(out.touched).toBe(true);
    expect(out.html).toContain('data-mx-emoticon');
  });
});

describe('parseEmoteImg', () => {
  function makeImg(attrs: Record<string, string>): HTMLImageElement {
    const img = document.createElement('img');
    for (const [k, v] of Object.entries(attrs)) img.setAttribute(k, v);
    return img;
  }

  it('returns null when data-mx-emoticon is missing', () => {
    expect(parseEmoteImg(makeImg({ src: 'mxc://x/y' }))).toBeNull();
  });

  it('returns null when src is not mxc://', () => {
    expect(
      parseEmoteImg(makeImg({ 'data-mx-emoticon': '', src: 'https://x.test/y' })),
    ).toBeNull();
  });

  it('returns mxc + alt + numeric height when valid', () => {
    const out = parseEmoteImg(
      makeImg({
        'data-mx-emoticon': '',
        src: 'mxc://x/y',
        alt: ':smile:',
        height: '24',
      }),
    );
    expect(out).toEqual({ mxc: 'mxc://x/y', alt: ':smile:', height: 24 });
  });

  it('falls back to title when alt is missing, then to a default', () => {
    const titled = parseEmoteImg(
      makeImg({ 'data-mx-emoticon': '', src: 'mxc://x/y', title: ':t:' }),
    );
    expect(titled?.alt).toBe(':t:');

    const defaulted = parseEmoteImg(
      makeImg({ 'data-mx-emoticon': '', src: 'mxc://x/y' }),
    );
    expect(defaulted?.alt).toBe(':emoji:');
  });

  it('treats a non-numeric height as undefined', () => {
    const out = parseEmoteImg(
      makeImg({ 'data-mx-emoticon': '', src: 'mxc://x/y', height: 'big' }),
    );
    expect(out?.height).toBeUndefined();
  });
});
