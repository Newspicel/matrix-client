import { useMemo } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { useAccountsStore } from '@/state/accounts';
import { useRoomsStore, type RoomSummary } from '@/state/rooms';
import { accountManager } from '@/matrix/AccountManager';
import { getOrphanRooms } from '@/lib/spaces';
import { RoomRow, SpaceTree } from '@/ui/shell/SpaceTree';
import { UserPanel } from '@/ui/shell/UserPanel';

const EMPTY_ROOMS: RoomSummary[] = [];

export function RoomList() {
  const activeAccountId = useAccountsStore((s) => s.activeAccountId);
  const activeRoomId = useAccountsStore((s) => s.activeRoomId);
  const activeSpaceId = useAccountsStore((s) => s.activeSpaceId);
  const allRooms = useRoomsStore((s) =>
    activeAccountId ? (s.byAccount[activeAccountId] ?? EMPTY_ROOMS) : EMPTY_ROOMS,
  );
  const setActiveRoom = useAccountsStore((s) => s.setActiveRoom);
  const client: MatrixClient | null =
    (activeAccountId ? accountManager.getClient(activeAccountId) : null) ?? null;

  const activeSpace = useMemo(
    () =>
      activeSpaceId ? allRooms.find((r) => r.roomId === activeSpaceId) ?? null : null,
    [allRooms, activeSpaceId],
  );

  return (
    <aside
      className="flex h-full w-60 shrink-0 flex-col bg-[var(--color-panel)] text-sm"
      aria-label="Room list"
    >
      <header className="flex h-12 items-center border-b border-[var(--color-divider)] px-4 font-semibold shadow-sm">
        <span className="truncate">
          {activeSpace ? activeSpace.name : 'Direct Messages'}
        </span>
      </header>
      <div className="flex-1 overflow-y-auto p-2">
        {activeSpace ? (
          <SpaceTree
            space={activeSpace}
            rooms={allRooms}
            activeRoomId={activeRoomId}
            onSelect={setActiveRoom}
            client={client}
          />
        ) : (
          <HomeView
            rooms={allRooms}
            activeRoomId={activeRoomId}
            onSelect={setActiveRoom}
            client={client}
          />
        )}
      </div>
      <UserPanel />
    </aside>
  );
}

function HomeView({
  rooms,
  activeRoomId,
  onSelect,
  client,
}: {
  rooms: RoomSummary[];
  activeRoomId: string | null;
  onSelect: (roomId: string) => void;
  client: MatrixClient | null;
}) {
  const { dms, orphans } = useMemo(() => {
    const dms = rooms.filter((r) => !r.isSpace && r.isDirect);
    const orphans = getOrphanRooms(rooms);
    return { dms, orphans };
  }, [rooms]);

  if (dms.length === 0 && orphans.length === 0) {
    return (
      <p className="px-2 pt-4 text-xs italic text-[var(--color-text-faint)]">
        No direct messages yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <GroupSection title="Direct messages" rooms={dms}>
        {dms.map((r) => (
          <RoomRow
            key={r.roomId}
            room={r}
            active={r.roomId === activeRoomId}
            onClick={() => onSelect(r.roomId)}
            client={client}
          />
        ))}
      </GroupSection>
      <GroupSection title="Other rooms" rooms={orphans}>
        {orphans.map((r) => (
          <RoomRow
            key={r.roomId}
            room={r}
            active={r.roomId === activeRoomId}
            onClick={() => onSelect(r.roomId)}
            client={client}
          />
        ))}
      </GroupSection>
    </div>
  );
}

function GroupSection({
  title,
  rooms,
  children,
}: {
  title: string;
  rooms: RoomSummary[];
  children: React.ReactNode;
}) {
  if (rooms.length === 0) return null;
  return (
    <div>
      <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {title}
      </div>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}
