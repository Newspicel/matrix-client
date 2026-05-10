import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MatrixClient, MatrixEvent, Room, RoomMember, RoomState } from 'matrix-js-sdk';
import { RoomEvent, RoomStateEvent } from 'matrix-js-sdk';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAccountsStore } from '@/state/accounts';
import { useUiStore } from '@/state/ui';
import { accountManager } from '@/matrix/AccountManager';
import { AuthedImage } from '@/lib/mxc';
import { InitialBadge } from '@/ui/primitives/InitialBadge';
import { useTypingUsers } from '@/lib/typing';
import { TypingDots } from '@/ui/primitives/TypingDots';

// Cinny-originated convention for naming power-level bands, used by several
// clients for interop. If the room has no such state event, we render a flat
// list rather than inventing names.
const POWER_LEVEL_TAGS_EVENT = 'in.cinny.room.power_level_tags';

interface PowerLevelTag {
  name?: string;
}

type PowerLevelTags = Record<string, PowerLevelTag>;

interface MemberView {
  userId: string;
  name: string;
  avatarMxc: string | null;
  powerLevel: number;
}

interface MemberGroup {
  key: string;
  label: string | null;
  members: MemberView[];
}

type Row =
  | { kind: 'header'; key: string; label: string; count: number }
  | { kind: 'member'; key: string; member: MemberView };

export function MemberList() {
  const activeAccountId = useAccountsStore((s) => s.activeAccountId);
  const activeRoomId = useAccountsStore((s) => s.activeRoomId);
  const openProfileCard = useUiStore((s) => s.openProfileCard);
  const client = activeAccountId ? accountManager.getClient(activeAccountId) : null;

  const [members, setMembers] = useState<MemberView[]>([]);
  const [tags, setTags] = useState<PowerLevelTags | null>(null);

  const memberKey = `${activeAccountId ?? ''}:${activeRoomId ?? ''}`;
  const [prevMemberKey, setPrevMemberKey] = useState(memberKey);
  if (prevMemberKey !== memberKey) {
    setPrevMemberKey(memberKey);
    setMembers([]);
    setTags(null);
  }

  useEffect(() => {
    if (!client || !activeRoomId) return;
    const room = client.getRoom(activeRoomId);
    if (!room) return;

    let cancelled = false;

    const rebuildMembers = () => {
      if (cancelled) return;
      setMembers(toMemberViews(room.getJoinedMembers()));
    };
    const rebuildTags = () => {
      if (cancelled) return;
      setTags(readPowerLevelTags(room));
    };

    rebuildMembers();
    rebuildTags();
    room
      .loadMembersIfNeeded()
      .then(rebuildMembers)
      .catch(() => {});

    const onMembers = (_ev: MatrixEvent, state: RoomState) => {
      if (state.roomId !== room.roomId) return;
      rebuildMembers();
    };
    const onEvents = (event: MatrixEvent, state: RoomState) => {
      if (state.roomId !== room.roomId) return;
      if (event.getType() === POWER_LEVEL_TAGS_EVENT) rebuildTags();
      if (event.getType() === 'm.room.power_levels') rebuildMembers();
    };
    // After accepting an invite the room transitions from stripped state to
    // full joined state — re-fetch members (loadMembersIfNeeded short-circuits
    // for invites because there's nothing to load) so the list populates.
    const onMyMembership = () => {
      room
        .loadMembersIfNeeded()
        .then(rebuildMembers)
        .catch(() => {});
      rebuildMembers();
      rebuildTags();
    };
    room.currentState.on(RoomStateEvent.Members, onMembers);
    room.currentState.on(RoomStateEvent.NewMember, onMembers);
    room.currentState.on(RoomStateEvent.Events, onEvents);
    room.on(RoomEvent.MyMembership, onMyMembership);

    return () => {
      cancelled = true;
      room.currentState.off(RoomStateEvent.Members, onMembers);
      room.currentState.off(RoomStateEvent.NewMember, onMembers);
      room.currentState.off(RoomStateEvent.Events, onEvents);
      room.off(RoomEvent.MyMembership, onMyMembership);
    };
  }, [client, activeRoomId]);

  const groups = useMemo(() => groupMembers(members, tags), [members, tags]);

  const typingUsers = useTypingUsers(activeAccountId, activeRoomId);
  const typingSet = useMemo(
    () => new Set(typingUsers.map((u) => u.userId)),
    [typingUsers],
  );

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const g of groups) {
      if (g.label) {
        out.push({
          kind: 'header',
          key: `h:${g.key}`,
          label: g.label,
          count: g.members.length,
        });
      }
      for (const m of g.members) {
        out.push({ kind: 'member', key: m.userId, member: m });
      }
    }
    return out;
  }, [groups]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (rows[i].kind === 'header' ? 32 : 32),
    overscan: 8,
    getItemKey: (i) => rows[i].key,
  });

  const handleSelect = useCallback(
    (userId: string, rect: DOMRect) => {
      if (!activeAccountId || !activeRoomId) return;
      openProfileCard({
        accountId: activeAccountId,
        roomId: activeRoomId,
        userId,
        anchor: { x: rect.left - 296, y: rect.top - 20 },
      });
    },
    [activeAccountId, activeRoomId, openProfileCard],
  );

  const showEmpty = !activeRoomId;
  const showLoading = !showEmpty && members.length === 0;
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <aside
      className="hidden h-full w-60 shrink-0 flex-col border-l border-[var(--color-divider)] bg-[var(--color-panel)] text-sm xl:flex"
      aria-label="Members"
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-divider)] px-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        <span>Members</span>
        {members.length > 0 && (
          <span className="tabular-nums text-[var(--color-text-faint)]">
            {members.length}
          </span>
        )}
      </header>
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto p-2 text-[var(--color-text-muted)]"
      >
        {showEmpty ? (
          <p className="px-2 pt-4 text-xs italic text-[var(--color-text-faint)]">
            Select a room to view members.
          </p>
        ) : showLoading ? (
          <p className="px-2 pt-4 text-xs italic text-[var(--color-text-faint)]">
            Loading members…
          </p>
        ) : (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: 'relative',
              width: '100%',
            }}
          >
            {virtualItems.map((vi) => {
              const row = rows[vi.index];
              return (
                <div
                  key={vi.key}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vi.start}px)`,
                  }}
                >
                  {row.kind === 'header' ? (
                    <div className="flex items-baseline justify-between px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                      <span>{row.label}</span>
                      <span className="tabular-nums text-[var(--color-text-faint)]">
                        {row.count}
                      </span>
                    </div>
                  ) : (
                    <MemberRow
                      member={row.member}
                      client={client}
                      isTyping={typingSet.has(row.member.userId)}
                      onSelect={handleSelect}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

interface MemberRowProps {
  member: MemberView;
  client: MatrixClient | null | undefined;
  isTyping: boolean;
  onSelect: (userId: string, rect: DOMRect) => void;
}

const MemberRow = memo(function MemberRow({
  member,
  client,
  isTyping,
  onSelect,
}: MemberRowProps) {
  return (
    <button
      type="button"
      onClick={(ev) => onSelect(member.userId, ev.currentTarget.getBoundingClientRect())}
      className="flex w-full items-center gap-2 px-2 py-1 text-left text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-hover-overlay-subtle)] hover:text-[var(--color-text-strong)]"
      title={isTyping ? `${member.userId} is typing…` : member.userId}
    >
      <AuthedImage
        client={client}
        mxc={member.avatarMxc}
        width={32}
        height={32}
        className="h-6 w-6 bg-[var(--color-surface)] object-cover"
        fallback={<InitialBadge text={member.name} className="h-6 w-6 text-[11px]" />}
      />
      <span className="flex-1 truncate">{member.name}</span>
      {isTyping && (
        <TypingDots className="shrink-0 text-[var(--color-text-muted)]" />
      )}
    </button>
  );
});

function toMemberViews(members: RoomMember[]): MemberView[] {
  return members
    .map((m) => ({
      userId: m.userId,
      name: m.name || m.userId,
      avatarMxc: m.getMxcAvatarUrl() ?? null,
      powerLevel: m.powerLevel,
    }))
    .sort((a, b) => {
      if (b.powerLevel !== a.powerLevel) return b.powerLevel - a.powerLevel;
      return a.name.localeCompare(b.name);
    });
}

function readPowerLevelTags(room: Room): PowerLevelTags | null {
  const event = room.currentState.getStateEvents(POWER_LEVEL_TAGS_EVENT, '');
  const content = event?.getContent<PowerLevelTags>();
  if (!content) return null;
  // Only keep entries that actually provide a name — an empty object wouldn't
  // give us anything to render and would just produce unlabeled buckets.
  const named: PowerLevelTags = {};
  for (const [k, v] of Object.entries(content)) {
    if (v && typeof v.name === 'string' && v.name.trim()) named[k] = v;
  }
  return Object.keys(named).length > 0 ? named : null;
}

function groupMembers(members: MemberView[], tags: PowerLevelTags | null): MemberGroup[] {
  if (!tags) {
    return members.length > 0
      ? [{ key: 'all', label: null, members }]
      : [];
  }

  const thresholds = Object.keys(tags)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a);

  const buckets = new Map<number, MemberView[]>(thresholds.map((t) => [t, []]));
  const uncategorized: MemberView[] = [];

  for (const m of members) {
    const threshold = thresholds.find((t) => m.powerLevel >= t);
    if (threshold === undefined) uncategorized.push(m);
    else buckets.get(threshold)!.push(m);
  }

  const groups: MemberGroup[] = [];
  for (const t of thresholds) {
    const bucket = buckets.get(t)!;
    if (bucket.length === 0) continue;
    groups.push({
      key: String(t),
      label: tags[String(t)]?.name ?? null,
      members: bucket,
    });
  }
  if (uncategorized.length > 0) {
    groups.push({ key: 'other', label: null, members: uncategorized });
  }
  return groups;
}
