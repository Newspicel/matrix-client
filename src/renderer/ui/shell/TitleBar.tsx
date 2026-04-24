const IS_MAC = window.native.platform === 'darwin';

/**
 * On macOS we use `titleBarStyle: 'hiddenInset'`, which means the traffic
 * lights float over the top-left of the window. Without a reserved strip
 * they overlap the rail. This component is that strip: a full-width 44px
 * drag region with padding to clear the lights. No visible chrome — just
 * a quiet band so the rest of the UI can start below it on one line.
 *
 * Non-macOS platforms render a zero-height sentinel; the OS frame handles
 * dragging and there's nothing to reserve.
 */
export function TitleBar() {
  if (!IS_MAC) return <div aria-hidden className="h-0" />;
  return (
    <div
      aria-hidden
      className="titlebar-strip flex items-center border-b border-[var(--color-divider)] bg-[var(--color-rail)] pl-[80px]"
    />
  );
}
