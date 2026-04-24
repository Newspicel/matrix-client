import { ChevronDown, ChevronRight, Hash, Lock, Volume2 } from 'lucide-react';
import type { MatrixClient } from 'matrix-js-sdk';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AuthedImage } from '@/lib/mxc';
import type { RoomSummary } from '@/state/rooms';
import { getSpaceTree } from '@/lib/spaces';

export function channelIconFor(room: RoomSummary) {
  if (room.isVoice) return Volume2;
  return Hash;
}

export function SpaceTree({
  space,
  rooms,
  activeRoomId,
  onSelect,
  client,
}: {
  space: RoomSummary;
  rooms: RoomSummary[];
  activeRoomId: string | null;
  onSelect: (roomId: string) => void;
  client: MatrixClient | null;
}) {
  const tree = useMemo(() => getSpaceTree(rooms, space.roomId), [rooms, space.roomId]);

  return (
    <div className="space-y-2">
      {tree.directRooms.length > 0 && (
        <ul className="space-y-0.5 pt-1">
          {tree.directRooms.map((r) => (
            <RoomRow
              key={r.roomId}
              room={r}
              active={r.roomId === activeRoomId}
              onClick={() => onSelect(r.roomId)}
              client={client}
            />
          ))}
        </ul>
      )}
      {tree.subspaces.map((sub) => (
        <SubspaceCategory
          key={sub.space.roomId}
          space={sub.space}
          rooms={sub.rooms}
          activeRoomId={activeRoomId}
          onSelect={onSelect}
          client={client}
        />
      ))}
      {tree.directRooms.length === 0 && tree.subspaces.length === 0 && (
        <p className="px-2 pt-4 text-xs italic text-[var(--color-text-faint)]">
          No rooms in this space yet.
        </p>
      )}
    </div>
  );
}

function SubspaceCategory({
  space,
  rooms,
  activeRoomId,
  onSelect,
  client,
}: {
  space: RoomSummary;
  rooms: RoomSummary[];
  activeRoomId: string | null;
  onSelect: (roomId: string) => void;
  client: MatrixClient | null;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <span className="truncate">{space.name}</span>
      </button>
      {open && (
        <ul className="space-y-0.5">
          {rooms.length === 0 ? (
            <li className="px-3 py-1 text-xs italic text-[var(--color-text-faint)]">
              Empty
            </li>
          ) : (
            rooms.map((r) => (
              <RoomRow
                key={r.roomId}
                room={r}
                active={r.roomId === activeRoomId}
                onClick={() => onSelect(r.roomId)}
                client={client}
              />
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export function RoomRow({
  room,
  active,
  onClick,
  client,
}: {
  room: RoomSummary;
  active: boolean;
  onClick: () => void;
  client: MatrixClient | null;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors',
          active
            ? 'bg-[var(--color-surface)] text-[var(--color-text-strong)]'
            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-panel-2)] hover:text-[var(--color-text-strong)]',
          (room.unread > 0 || room.highlights > 0) &&
            !active &&
            'font-semibold text-[var(--color-text-strong)]',
        )}
      >
        <RoomIcon room={room} client={client} />
        <span className="flex-1 truncate">{room.name}</span>
        {room.highlights > 0 ? (
          <span className="rounded bg-red-600 px-1.5 text-[10px] font-bold">
            {room.highlights}
          </span>
        ) : room.unread > 0 ? (
          <span className="rounded bg-[var(--color-surface)] px-1.5 text-[10px]">
            {room.unread}
          </span>
        ) : null}
      </button>
    </li>
  );
}

function RoomIcon({
  room,
  client,
}: {
  room: RoomSummary;
  client: MatrixClient | null;
}) {
  if (room.isDirect) {
    return (
      <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
        <AuthedImage
          client={client}
          mxc={room.dmAvatarMxc ?? room.avatarMxc}
          width={28}
          height={28}
          className="h-5 w-5 rounded-full bg-[var(--color-surface)] object-cover"
          fallback={<InitialBadge text={room.name} />}
        />
        {room.isEncrypted && <EncryptedBadge />}
      </span>
    );
  }

  const Icon = channelIconFor(room);
  return (
    <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
      <AuthedImage
        client={client}
        mxc={room.avatarMxc}
        width={28}
        height={28}
        className="h-5 w-5 rounded-full bg-[var(--color-surface)] object-cover"
        fallback={<Icon className="h-4 w-4 text-[var(--color-text-faint)]" />}
      />
      {room.isEncrypted && <EncryptedBadge />}
    </span>
  );
}

function EncryptedBadge() {
  return (
    <span
      aria-label="Encrypted"
      title="End-to-end encrypted"
      className="absolute -bottom-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-[var(--color-panel)] text-emerald-500 ring-1 ring-[var(--color-panel)]"
    >
      <Lock className="h-2 w-2" strokeWidth={3} />
    </span>
  );
}

function InitialBadge({ text }: { text: string }) {
  const initial = text.replace(/^[#@]/, '').charAt(0).toUpperCase() || '?';
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-semibold text-white">
      {initial}
    </span>
  );
}
