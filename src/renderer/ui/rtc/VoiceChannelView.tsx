import { useEffect, useMemo, useState } from 'react';
import type { MatrixClient, MatrixEvent, Room, RoomState } from 'matrix-js-sdk';
import { RoomStateEvent } from 'matrix-js-sdk';
import { Headphones, Mic, Phone, PhoneOff } from 'lucide-react';
import type { RoomSummary } from '@/state/rooms';
import { useAccountsStore } from '@/state/accounts';
import { useRtcStore } from '@/state/rtc';
import { accountManager } from '@/matrix/AccountManager';
import { AuthedImage } from '@/lib/mxc';
import { startCall } from '@/matrix/rtc/RtcSession';
import { leaveCall } from '@/matrix/rtc/controls';

const CALL_MEMBER_STATE = 'org.matrix.msc3401.call.member';

interface VoiceMember {
  userId: string;
  name: string;
  avatarMxc: string | null;
}

function readMembers(room: Room): VoiceMember[] {
  const events = room.currentState.getStateEvents(CALL_MEMBER_STATE);
  const active: VoiceMember[] = [];
  for (const ev of events) {
    const content = ev.getContent() as { memberships?: unknown[] };
    if (!Array.isArray(content.memberships) || content.memberships.length === 0) continue;
    const userId = ev.getStateKey()?.split('_')[0] ?? ev.getSender();
    if (!userId) continue;
    const member = room.getMember(userId);
    active.push({
      userId,
      name: member?.name || userId,
      avatarMxc: member?.getMxcAvatarUrl() ?? null,
    });
  }
  // De-dup per user (a user can register multiple devices).
  const seen = new Set<string>();
  return active.filter((m) => (seen.has(m.userId) ? false : (seen.add(m.userId), true)));
}

export function VoiceChannelView({ room }: { room: RoomSummary }) {
  const activeAccountId = useAccountsStore((s) => s.activeAccountId);
  const client = activeAccountId ? accountManager.getClient(activeAccountId) : null;
  const activeCall = useRtcStore((s) => s.activeCall);

  const [members, setMembers] = useState<VoiceMember[]>([]);

  useEffect(() => {
    if (!client) return;
    const mxRoom = client.getRoom(room.roomId);
    if (!mxRoom) return;
    setMembers(readMembers(mxRoom));

    const onEvents = (_ev: MatrixEvent, state: RoomState) => {
      if (state.roomId !== mxRoom.roomId) return;
      setMembers(readMembers(mxRoom));
    };
    mxRoom.currentState.on(RoomStateEvent.Events, onEvents);
    return () => {
      mxRoom.currentState.off(RoomStateEvent.Events, onEvents);
    };
  }, [client, room.roomId]);

  const isConnectedHere = useMemo(
    () => activeCall?.roomId === room.roomId,
    [activeCall, room.roomId],
  );

  async function onJoin() {
    if (!client || !activeAccountId) return;
    await startCall(client, activeAccountId, room.roomId);
  }

  function onLeave() {
    void leaveCall();
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-[var(--color-panel-2)] px-6 py-10">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
        <Headphones className="h-10 w-10" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-[var(--color-text-strong)]">
        {room.name}
      </h2>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        {members.length === 0
          ? 'No one is connected yet.'
          : `${members.length} connected`}
      </p>

      {members.length > 0 && (
        <ParticipantAvatars members={members} client={client} />
      )}

      <div className="mt-8 flex items-center gap-3">
        {isConnectedHere ? (
          <button
            type="button"
            onClick={onLeave}
            className="flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-red-500"
          >
            <PhoneOff className="h-4 w-4" />
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={onJoin}
            disabled={!client}
            className="flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50"
          >
            <Phone className="h-4 w-4" />
            Join channel
          </button>
        )}
      </div>

      {room.topic && (
        <p className="mt-8 max-w-lg text-center text-sm text-[var(--color-text-muted)]">
          {room.topic}
        </p>
      )}

      <div className="mt-10 flex items-center gap-1.5 text-[11px] text-[var(--color-text-faint)]">
        <Mic className="h-3 w-3" />
        <span>Voice channel</span>
      </div>
    </div>
  );
}

function ParticipantAvatars({
  members,
  client,
}: {
  members: VoiceMember[];
  client: MatrixClient | null | undefined;
}) {
  return (
    <div className="mt-6 flex flex-wrap justify-center gap-4">
      {members.map((m) => (
        <div key={m.userId} className="flex w-24 flex-col items-center gap-2">
          <AuthedImage
            client={client}
            mxc={m.avatarMxc}
            width={56}
            height={56}
            className="h-14 w-14 rounded-full bg-[var(--color-surface)] object-cover ring-2 ring-emerald-500"
            fallback={
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)] text-lg font-semibold text-white ring-2 ring-emerald-500">
                {m.name.replace(/^[@#]/, '').charAt(0).toUpperCase()}
              </div>
            }
          />
          <span className="max-w-full truncate text-xs text-[var(--color-text)]">
            {m.name}
          </span>
        </div>
      ))}
    </div>
  );
}
