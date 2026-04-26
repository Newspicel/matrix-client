import { useEffect, useMemo, useState } from 'react';
import { useUiStore } from '@/state/ui';
import { accountManager } from '@/matrix/AccountManager';
import { AuthedImage } from '@/lib/mxc';
import { Popover as PopoverPrimitive } from '@base-ui/react/popover';

interface Profile {
  displayName: string;
  avatarMxc: string | null;
  presence?: string;
  powerLevel?: number;
}

const CARD_WIDTH = 280;

export function ProfileCard() {
  const target = useUiStore((s) => s.profileCard);
  const close = useUiStore((s) => s.closeProfileCard);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!target) {
      setProfile(null);
      return;
    }
    const client = accountManager.getClient(target.accountId);
    if (!client) return;

    const room = target.roomId ? client.getRoom(target.roomId) : null;
    const member = room?.getMember(target.userId) ?? null;

    setProfile({
      displayName: member?.name || target.userId,
      avatarMxc: member?.getMxcAvatarUrl() ?? null,
      powerLevel: member?.powerLevel,
    });

    let cancelled = false;
    // Fall back to a network profile lookup when we don't have a room member
    // record — otherwise we'd show a blank card for e.g. DM targets that
    // lazy-load.
    if (!member) {
      client
        .getProfileInfo(target.userId)
        .then((info) => {
          if (cancelled) return;
          setProfile((prev) => ({
            displayName: info?.displayname || prev?.displayName || target.userId,
            avatarMxc: info?.avatar_url ?? prev?.avatarMxc ?? null,
            powerLevel: prev?.powerLevel,
          }));
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [target]);

  // Base UI expects an Element or VirtualElement for anchoring. We only have
  // click coords, so wrap them in a zero-size virtual element — floating-ui
  // will place the popup relative to that point.
  const virtualAnchor = useMemo(() => {
    if (!target) return null;
    const { x, y } = target.anchor;
    return {
      getBoundingClientRect: () =>
        ({
          x,
          y,
          width: 0,
          height: 0,
          top: y,
          left: x,
          right: x,
          bottom: y,
          toJSON: () => ({}),
        }) as DOMRect,
    };
  }, [target]);

  if (!target || !profile) return null;

  const client = accountManager.getClient(target.accountId) ?? null;

  return (
    <PopoverPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <PopoverPrimitive.Portal>
        {/* Transparent click-trap: any click outside the card lands here
            first and only closes the card, so the underlying click target
            (another username, a button, the composer, etc.) is not also
            activated by the same gesture. */}
        <div
          aria-hidden
          className="fixed inset-0 z-40"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            close();
          }}
        />
        <PopoverPrimitive.Positioner
          anchor={virtualAnchor}
          side="right"
          align="start"
          sideOffset={0}
          collisionPadding={16}
          className="isolate z-50 outline-none"
        >
          <PopoverPrimitive.Popup
            aria-label={`Profile — ${profile.displayName}`}
            style={{ width: CARD_WIDTH }}
            className="overflow-hidden border border-[var(--color-divider)] bg-[var(--color-panel-2)] outline-none data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity duration-150"
          >
            <div className="flex items-start gap-3 border-b border-[var(--color-divider)] bg-[var(--color-panel)] p-4">
              <AuthedImage
                client={client}
                mxc={profile.avatarMxc}
                width={80}
                height={80}
                className="h-14 w-14 shrink-0 bg-[var(--color-surface)] object-cover"
                fallback={
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center bg-[var(--color-surface)] text-lg font-semibold uppercase tracking-wide text-[var(--color-text-strong)]">
                    {initialOf(profile.displayName)}
                  </span>
                }
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-[var(--color-text-strong)]">
                  {profile.displayName}
                </div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--color-text-muted)]">
                  {target.userId}
                </div>
              </div>
            </div>
            {profile.powerLevel !== undefined && profile.powerLevel > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 text-[11px]">
                <span className="font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Power Level
                </span>
                <span className="tabular-nums text-[var(--color-text-strong)]">
                  {profile.powerLevel}
                </span>
              </div>
            )}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function initialOf(name: string): string {
  return name.replace(/^[@#]/, '').charAt(0).toUpperCase() || '?';
}
