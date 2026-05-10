import { describe, expect, it, vi } from 'vitest';
import { smoothScrollIntoCenter, smoothScrollTo } from './smoothScroll';

function makeScrollable(scrollHeight = 1000, clientHeight = 200): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true });
  el.scrollTop = 0;
  return el;
}

describe('smoothScrollTo', () => {
  it('snaps directly when the delta is below the 2px threshold', () => {
    const el = makeScrollable();
    el.scrollTop = 100;
    smoothScrollTo(el, 101);
    expect(el.scrollTop).toBe(101);
  });

  it('clamps the target into [0, scrollHeight - clientHeight]', () => {
    const el = makeScrollable(1000, 200);
    smoothScrollTo(el, 999_999, 0); // duration 0 forces the snap path
    expect(el.scrollTop).toBe(800);

    smoothScrollTo(el, -50, 0);
    expect(el.scrollTop).toBe(0);
  });

  it('snaps immediately when duration is zero', () => {
    const el = makeScrollable();
    smoothScrollTo(el, 400, 0);
    expect(el.scrollTop).toBe(400);
  });

  it('schedules an animation frame for non-trivial deltas', () => {
    const raf = vi.fn().mockReturnValue(1);
    const original = window.requestAnimationFrame;
    window.requestAnimationFrame = raf as unknown as typeof window.requestAnimationFrame;
    try {
      const el = makeScrollable();
      smoothScrollTo(el, 400, 320);
      expect(raf).toHaveBeenCalled();
    } finally {
      window.requestAnimationFrame = original;
    }
  });
});

describe('smoothScrollIntoCenter', () => {
  it('schedules a tween towards the centered offset', () => {
    const raf = vi.fn().mockReturnValue(1);
    const original = window.requestAnimationFrame;
    window.requestAnimationFrame = raf as unknown as typeof window.requestAnimationFrame;
    try {
      const container = makeScrollable(2000, 400);
      const child = document.createElement('div');
      // Stub bounding rects so scrollIntoCenter can compute an offset.
      vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 400,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);
      vi.spyOn(child, 'getBoundingClientRect').mockReturnValue({
        top: 800,
        left: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 50,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);
      Object.defineProperty(child, 'clientHeight', { value: 50, configurable: true });
      smoothScrollIntoCenter(child, container);
      expect(raf).toHaveBeenCalled();
    } finally {
      window.requestAnimationFrame = original;
    }
  });
});
