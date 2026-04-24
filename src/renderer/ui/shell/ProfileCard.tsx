import { useEffect, useRef, useState } from 'react';
import { useUiStore } from '@/state/ui';
import { accountManager } from '@/matrix/AccountManager';
import { AuthedImage } from '@/lib/mxc';

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
  const cardRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!target) return;
    function onDocMouseDown(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [target, close]);

  if (!target || !profile) return null;

  const client = accountManager.getClient(target.accountId) ?? null;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const left = Math.min(target.anchor.x, viewportWidth - CARD_WIDTH - 16);
  const top = Math.min(target.anchor.y, viewportHeight - 280);

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={`Profile — ${profile.displayName}`}
      style={{ left: Math.max(16, left), top: Math.max(16, top), width: CARD_WIDTH }}
      className="pointer-events-auto fixed z-50 overflow-hidden rounded-xl border border-[var(--color-divider)] bg-[var(--color-panel-2)] shadow-2xl"
    >
      <div className="h-16 bg-[var(--color-accent)]/30" />
      <div className="-mt-10 flex flex-col items-start gap-2 px-4 pb-4">
        <AuthedImage
          client={client}
          mxc={profile.avatarMxc}
          width={80}
          height={80}
          className="h-20 w-20 rounded-full border-4 border-[var(--color-panel-2)] bg-[var(--color-surface)] object-cover"
          fallback={
            <span className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[var(--color-panel-2)] bg-[var(--color-accent)] text-2xl font-semibold text-white">
              {initialOf(profile.displayName)}
            </span>
          }
        />
        <div className="w-full">
          <div className="truncate text-base font-semibold text-[var(--color-text-strong)]">
            {profile.displayName}
          </div>
          <div className="truncate font-mono text-xs text-[var(--color-text-muted)]">
            {target.userId}
          </div>
          {profile.powerLevel !== undefined && profile.powerLevel > 0 && (
            <div className="mt-1 text-xs text-[var(--color-text-faint)]">
              Power level — {profile.powerLevel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function initialOf(name: string): string {
  return name.replace(/^[@#]/, '').charAt(0).toUpperCase() || '?';
}
