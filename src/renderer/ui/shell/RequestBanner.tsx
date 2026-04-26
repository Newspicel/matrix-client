import { useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { EventType } from 'matrix-js-sdk';
import { AuthedImage } from '@/lib/mxc';
import { useAccountsStore } from '@/state/accounts';
import type { RoomSummary } from '@/state/rooms';

export function RequestBanner({
  room,
  client,
}: {
  room: RoomSummary;
  client: MatrixClient;
}) {
  const setActiveRoom = useAccountsStore((s) => s.setActiveRoom);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inviterId = room.inviterUserId ?? room.dmUserId;
  const inviterName = room.name || inviterId || 'Someone';

  async function onAccept() {
    if (busy) return;
    setBusy('accept');
    setError(null);
    try {
      await client.joinRoom(room.roomId);
      if (room.isDirect && inviterId) {
        await markAsDirect(client, inviterId, room.roomId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept');
      setBusy(null);
    }
  }

  async function onDecline() {
    if (busy) return;
    setBusy('decline');
    setError(null);
    try {
      await client.leave(room.roomId);
      // Drop the active selection so the list can pick a sensible next room.
      setActiveRoom(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline');
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-[var(--color-panel-2)] p-8">
      <div className="flex w-full max-w-md flex-col items-center gap-4 border border-[var(--color-divider)] bg-[var(--color-panel)] p-6 text-center">
        <span className="inline-flex h-16 w-16 items-center justify-center bg-[var(--color-surface)]">
          <AuthedImage
            client={client}
            mxc={room.dmAvatarMxc ?? room.avatarMxc}
            width={96}
            height={96}
            className="h-16 w-16 object-cover"
            fallback={
              <span className="text-xl font-semibold uppercase text-[var(--color-text-strong)]">
                {(inviterName.replace(/^[#@]/, '').charAt(0) || '?').toUpperCase()}
              </span>
            }
          />
        </span>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-[var(--color-text-strong)]">
            {inviterName}
          </h2>
          {inviterId && (
            <p className="text-xs text-[var(--color-text-muted)]">{inviterId}</p>
          )}
          <p className="pt-2 text-sm text-[var(--color-text-muted)]">
            wants to start a direct message with you.
          </p>
        </div>
        {error && (
          <p className="text-xs text-red-500" role="alert">
            {error}
          </p>
        )}
        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={onDecline}
            disabled={busy !== null}
            className="flex-1 border border-[var(--color-divider)] px-3 py-2 text-sm text-[var(--color-text-strong)] transition-colors hover:bg-[var(--color-hover-overlay-subtle)] disabled:opacity-50"
          >
            {busy === 'decline' ? 'Declining…' : 'Decline'}
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={busy !== null}
            className="flex-1 bg-[var(--color-text-strong)] px-3 py-2 text-sm font-semibold text-[var(--color-panel)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy === 'accept' ? 'Accepting…' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Mirror what the inviter wrote into their m.direct account data so this room
// keeps appearing under DMs (rather than as a plain orphan room) after the
// invite is accepted. The server doesn't replicate m.direct between users —
// each side maintains its own list.
async function markAsDirect(
  client: MatrixClient,
  otherUserId: string,
  roomId: string,
): Promise<void> {
  const existing = client
    .getAccountData(EventType.Direct)
    ?.getContent<Record<string, string[]>>();
  const next: Record<string, string[]> = existing ? { ...existing } : {};
  const list = new Set(next[otherUserId] ?? []);
  list.add(roomId);
  next[otherUserId] = Array.from(list);
  await client.setAccountData(EventType.Direct, next);
}
