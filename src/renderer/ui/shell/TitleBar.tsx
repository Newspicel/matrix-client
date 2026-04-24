import { Home } from 'lucide-react';
import { useAccountsStore } from '@/state/accounts';
import { useRoomsStore } from '@/state/rooms';
import { accountManager } from '@/matrix/AccountManager';
import { AuthedImage } from '@/lib/mxc';

const IS_MAC = window.native.platform === 'darwin';

/**
 * On macOS we use `titleBarStyle: 'hiddenInset'`, which means the traffic
 * lights float over the top-left of the window. Without a reserved strip
 * they overlap the rail. This component is that strip: a full-width 44px
 * drag region. The center shows the active space (icon + name) — or the
 * Home/Direct Messages label when no space is selected — Discord-style.
 *
 * Non-macOS platforms render a zero-height sentinel; the OS frame handles
 * dragging and there's nothing to reserve.
 */
export function TitleBar() {
  const activeAccountId = useAccountsStore((s) => s.activeAccountId);
  const activeSpaceId = useAccountsStore((s) => s.activeSpaceId);
  const activeSpace = useRoomsStore((s) => {
    if (!activeAccountId || !activeSpaceId) return null;
    const rooms = s.byAccount[activeAccountId];
    if (!rooms) return null;
    return rooms.find((r) => r.roomId === activeSpaceId) ?? null;
  });
  const client =
    (activeAccountId ? accountManager.getClient(activeAccountId) : null) ?? null;

  if (!IS_MAC) return <div aria-hidden className="h-0" />;

  return (
    <div className="titlebar-strip flex items-center justify-center border-b border-[var(--color-divider)] bg-[var(--color-rail)] pl-[80px] pr-[80px]">
      <div className="flex min-w-0 max-w-full items-center gap-2 text-sm font-semibold text-[var(--color-text-strong)]">
        {activeSpace ? (
          <>
            <AuthedImage
              client={client}
              mxc={activeSpace.avatarMxc}
              width={40}
              height={40}
              className="h-5 w-5 shrink-0 rounded-full bg-[var(--color-surface)] object-cover"
              fallback={
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-semibold text-white">
                  {initialFrom(activeSpace.name)}
                </span>
              }
            />
            <span className="truncate">{activeSpace.name}</span>
          </>
        ) : (
          <>
            <Home className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
            <span className="truncate">Direct Messages</span>
          </>
        )}
      </div>
    </div>
  );
}

function initialFrom(name: string): string {
  return name.replace(/^[#@]/, '').charAt(0).toUpperCase() || '?';
}
