// Tween scrollTop to a target with easeOutCubic. Browsers' native
// `scrollTo({ behavior: 'smooth' })` honors prefers-reduced-motion and varies
// in duration across platforms; we want a consistent, snappy feel for jumps.

export function smoothScrollTo(el: HTMLElement, target: number, duration = 320): void {
  const start = el.scrollTop;
  const max = el.scrollHeight - el.clientHeight;
  const clamped = Math.max(0, Math.min(target, max));
  const delta = clamped - start;
  if (Math.abs(delta) < 2 || duration <= 0) {
    el.scrollTop = clamped;
    return;
  }
  const t0 = performance.now();
  function step(now: number) {
    const t = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.scrollTop = start + delta * eased;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// Scrolls so the target element sits roughly centered in its scroll container.
// Used for jump-to-message from a reply preview.
export function smoothScrollIntoCenter(el: HTMLElement, container: HTMLElement, duration = 380): void {
  const elRect = el.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const elTopInContainer = container.scrollTop + (elRect.top - containerRect.top);
  const target = elTopInContainer - (container.clientHeight - el.clientHeight) / 2;
  smoothScrollTo(container, target, duration);
}
