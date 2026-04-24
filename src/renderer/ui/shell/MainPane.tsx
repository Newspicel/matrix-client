import { Hash, Lock, Phone, Users, Volume2 } from 'lucide-react';
import { useAccountsStore } from '@/state/accounts';
import { useRoomsStore } from '@/state/rooms';
import { Timeline } from '@/ui/timeline/Timeline';
import { Composer } from '@/ui/composer/Composer';
import { VoiceChannelView } from '@/ui/rtc/VoiceChannelView';
import { useUiStore } from '@/state/ui';
import { startCall } from '@/matrix/rtc/RtcSession';
import { accountManager } from '@/matrix/AccountManager';

export function MainPane() {
  const activeAccountId = useAccountsStore((s) => s.activeAccountId);
  const activeRoomId = useAccountsStore((s) => s.activeRoomId);
  const toggleMembers = useUiStore((s) => s.toggleMemberList);

  const room = useRoomsStore((s) => {
    if (!activeAccountId || !activeRoomId) return null;
    const rooms = s.byAccount[activeAccountId];
    if (!rooms) return null;
    return rooms.find((r) => r.roomId === activeRoomId) ?? null;
  });

  async function onStartCall() {
    if (!activeAccountId || !activeRoomId) return;
    const client = accountManager.getClient(activeAccountId);
    if (!client) return;
    await startCall(client, activeAccountId, activeRoomId);
  }

  return (
    <section className="flex h-full flex-1 flex-col bg-[var(--color-panel-2)]">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--color-divider)] px-4 shadow-sm">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <HeaderRoomIcon
            isVoice={!!room?.isVoice}
            isEncrypted={!!room?.isEncrypted}
          />
          <h1 className="truncate font-semibold">{room?.name ?? 'Select a room'}</h1>
          {room?.topic && (
            <span className="ml-2 truncate text-xs text-[var(--color-text-muted)]">
              — {room.topic}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {room && !room.isVoice && (
            <button
              type="button"
              className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-hover-overlay)] hover:text-[var(--color-text-strong)]"
              title="Start call"
              onClick={onStartCall}
            >
              <Phone className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-hover-overlay)] hover:text-[var(--color-text-strong)]"
            title="Toggle member list"
            onClick={toggleMembers}
          >
            <Users className="h-5 w-5" />
          </button>
        </div>
      </header>

      {room?.isVoice ? (
        <VoiceChannelView room={room} />
      ) : (
        <>
          <Timeline />
          <Composer />
        </>
      )}
    </section>
  );
}

function HeaderRoomIcon({
  isVoice,
  isEncrypted,
}: {
  isVoice: boolean;
  isEncrypted: boolean;
}) {
  const Icon = isVoice ? Volume2 : Hash;
  return (
    <span className="relative inline-flex h-5 w-5 items-center justify-center text-[var(--color-text-muted)]">
      <Icon className="h-5 w-5" />
      {isEncrypted && (
        <span
          aria-label="Encrypted"
          title="End-to-end encrypted"
          className="absolute -bottom-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-[var(--color-panel-2)] text-emerald-500 ring-1 ring-[var(--color-panel-2)]"
        >
          <Lock className="h-2 w-2" strokeWidth={3} />
        </span>
      )}
    </span>
  );
}
