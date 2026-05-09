import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Direction, type MatrixClient } from 'matrix-js-sdk';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useAccountsStore } from '@/state/accounts';
import { useRoomsStore } from '@/state/rooms';
import { useTimelineStore, type TimelineEntry } from '@/state/timeline';
import { accountManager } from '@/matrix/AccountManager';
import { AuthedImage } from '@/lib/mxc';
import { InitialBadge } from '@/ui/primitives/InitialBadge';
import { MessageItem } from './Message';
import { smoothScrollTo } from '@/lib/smoothScroll';

const EMPTY_ENTRIES: TimelineEntry[] = [];
const STICK_TO_BOTTOM_PX = 120;
const PAGE_SIZE = 50;
// How far above the viewport the sentinel must be before pagination kicks in.
// Big enough that the user almost never sees the spinner mid-scroll.
const PAGINATE_ROOT_MARGIN = '600px 0px 0px 0px';

export function Timeline() {
  const activeAccountId = useAccountsStore((s) => s.activeAccountId);
  const activeRoomId = useAccountsStore((s) => s.activeRoomId);
  const entries = useTimelineStore((s) =>
    activeRoomId ? (s.byRoom[activeRoomId] ?? EMPTY_ENTRIES) : EMPTY_ENTRIES,
  );
  const roomSummary = useRoomsStore((s) => {
    if (!activeAccountId || !activeRoomId) return null;
    const rooms = s.byAccount[activeAccountId];
    return rooms?.find((r) => r.roomId === activeRoomId) ?? null;
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const topRegionRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const prevFirstIdRef = useRef<string | null>(null);
  const prevScrollHeightRef = useRef(0);
  const prevTopHeightRef = useRef(0);
  const loadingOlderRef = useRef(false);

  const [loadingOlder, setLoadingOlder] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  // The eventId we anchor the "New Messages" divider above. Captured once per
  // room open from the read receipt — doesn't move as new live events arrive
  // so the divider stays put while the user is reading. Captured during
  // render via the prev-props pattern so we don't trigger an extra paint.
  const [unreadCapture, setUnreadCapture] = useState<{
    roomId: string;
    eventId: string | null;
  }>({ roomId: '', eventId: null });

  const client = activeAccountId ? accountManager.getClient(activeAccountId) ?? null : null;

  // Derive hasMoreOlder from the SDK's pagination token. Recomputes every
  // render — the entries reference changes after each paginate (via
  // rebuildRoom), so this stays in sync with the SDK's state.
  let hasMoreOlder = true;
  if (client && activeRoomId) {
    const room = client.getRoom(activeRoomId);
    if (room) {
      hasMoreOlder = !!room.getLiveTimeline().getPaginationToken(Direction.Backward);
    }
  }

  // Capture the unread anchor synchronously during render the first time
  // entries are available for a given room.
  let unreadAnchor: string | null = null;
  if (activeRoomId && client) {
    if (unreadCapture.roomId !== activeRoomId && entries.length > 0) {
      const room = client.getRoom(activeRoomId);
      const userId = client.getUserId();
      let eventId: string | null = null;
      if (room && userId) {
        const readUpToId = room.getEventReadUpTo(userId);
        if (readUpToId) {
          const idx = entries.findIndex((e) => e.eventId === readUpToId);
          if (idx !== -1 && idx < entries.length - 1) {
            eventId = entries[idx + 1].eventId;
          }
        }
      }
      setUnreadCapture({ roomId: activeRoomId, eventId });
      unreadAnchor = eventId;
    } else if (unreadCapture.roomId === activeRoomId) {
      unreadAnchor = unreadCapture.eventId;
    }
  }

  // Hydrate timeline when room is selected.
  useEffect(() => {
    if (!activeAccountId || !activeRoomId || !client) return;
    useTimelineStore.getState().onTimelineAppend(activeAccountId, activeRoomId, client);
  }, [activeAccountId, activeRoomId, client]);

  // Reset state synchronously on room switch via the prev-props pattern, so
  // the next room never paints with stale loading/scroll state.
  const roomKey = `${activeAccountId ?? ''}:${activeRoomId ?? ''}`;
  const [prevRoomKey, setPrevRoomKey] = useState(roomKey);
  if (prevRoomKey !== roomKey) {
    setPrevRoomKey(roomKey);
    setLoadingOlder(false);
    setShowJumpToLatest(false);
  }
  // Refs reset in an effect — mutating refs during render is disallowed by
  // the React Compiler / lint rules.
  useEffect(() => {
    stickToBottomRef.current = true;
    loadingOlderRef.current = false;
    prevFirstIdRef.current = null;
    prevScrollHeightRef.current = 0;
    prevTopHeightRef.current = 0;
  }, [activeAccountId, activeRoomId]);

  // Clear unread markers while the user is viewing this room.
  useEffect(() => {
    if (!activeAccountId || !activeRoomId || !client) return;
    const room = client.getRoom(activeRoomId);
    if (!room) return;
    const events = room.getLiveTimeline().getEvents();
    let lastEvent: (typeof events)[number] | null = null;
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      const id = ev.getId();
      if (!id || id.startsWith('~') || ev.status) continue;
      lastEvent = ev;
      break;
    }
    if (!lastEvent) return;
    void client.sendReadReceipt(lastEvent).catch((err) => {
      console.warn('[receipt] sendReadReceipt failed', err);
    });
  }, [activeAccountId, activeRoomId, client, entries]);

  // Position the viewport after each render.
  //   - first render in a room → scroll to bottom
  //   - older events prepended (first id changed) → preserve viewport position
  //   - top region resized (loader appeared, beginning revealed) → compensate
  //     so the visible content stays put
  //   - user is near the bottom → stick to bottom for new live events
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const newHeight = el.scrollHeight;
    const prevHeight = prevScrollHeightRef.current;
    const newTopHeight = topRegionRef.current?.offsetHeight ?? 0;
    const prevTopHeight = prevTopHeightRef.current;
    const firstId = entries[0]?.eventId ?? null;
    const prevFirst = prevFirstIdRef.current;

    if (prevFirst === null) {
      if (firstId !== null) el.scrollTop = newHeight;
    } else if (firstId !== prevFirst) {
      el.scrollTop = el.scrollTop + (newHeight - prevHeight);
    } else if (newTopHeight !== prevTopHeight) {
      // Top region grew or shrank without entries changing (beginning-of-
      // conversation revealed). Compensate so visible content stays put —
      // unless the user was already at the very top, in which case we let
      // the new content (the begin marker) push into view naturally.
      if (el.scrollTop > 8) {
        el.scrollTop = el.scrollTop + (newTopHeight - prevTopHeight);
      }
    } else if (stickToBottomRef.current) {
      el.scrollTop = newHeight;
    }

    prevFirstIdRef.current = firstId;
    prevScrollHeightRef.current = newHeight;
    prevTopHeightRef.current = newTopHeight;
  });

  // Pagination via IntersectionObserver. Triggers when the top sentinel
  // enters a 600px buffer above the viewport — the user almost never sees
  // the spinner because the next page arrives well before they scroll to it.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root || !client || !activeRoomId) return;
    if (!hasMoreOlder) return;

    const io = new IntersectionObserver(
      (observerEntries) => {
        if (!observerEntries[0]?.isIntersecting) return;
        if (loadingOlderRef.current) return;
        const room = client.getRoom(activeRoomId);
        if (!room) return;
        const timeline = room.getLiveTimeline();
        if (!timeline.getPaginationToken(Direction.Backward)) return;
        loadingOlderRef.current = true;
        setLoadingOlder(true);
        client
          .paginateEventTimeline(timeline, { backwards: true, limit: PAGE_SIZE })
          .catch((err) => {
            console.warn('[timeline] paginate failed', err);
          })
          .finally(() => {
            loadingOlderRef.current = false;
            setLoadingOlder(false);
          });
      },
      { root, rootMargin: PAGINATE_ROOT_MARGIN, threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [hasMoreOlder, client, activeRoomId]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < STICK_TO_BOTTOM_PX;
    setShowJumpToLatest(distanceFromBottom > 600);
  }, []);

  const scrollToLatest = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    smoothScrollTo(el, el.scrollHeight - el.clientHeight, 320);
  }, []);

  const groups = useMemo(() => groupEntries(entries), [entries]);
  const datedGroups = useMemo(
    () => groups.map((group) => ({ group, dateKey: dayKey(group[0].ts) })),
    [groups],
  );

  const beginningInfo = useMemo(() => {
    if (!activeAccountId || !activeRoomId || !client) return null;
    const room = client.getRoom(activeRoomId);
    if (!room) return null;
    const createEvent = room.currentState.getStateEvents('m.room.create', '');
    const creatorId = createEvent?.getSender() ?? null;
    const creatorName = creatorId ? (room.getMember(creatorId)?.name ?? null) : null;
    return {
      client,
      name: roomSummary?.name ?? room.name,
      avatarMxc:
        roomSummary?.dmAvatarMxc ?? roomSummary?.avatarMxc ?? room.getMxcAvatarUrl() ?? null,
      creatorName,
      createdAt: createEvent?.getTs() ?? null,
    };
  }, [activeAccountId, activeRoomId, client, roomSummary]);

  if (!activeRoomId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-faint)]">
        Select a room
      </div>
    );
  }

  const showBeginning = !hasMoreOlder;
  const showInitialLoading = entries.length === 0 && hasMoreOlder;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        data-timeline-scroll
        className="flex-1 overflow-y-auto"
      >
        <div className="flex min-h-full flex-col py-3">
          <div className="mt-auto">
            {/* Top region — its height is tracked so the layout effect can
                compensate scrollTop when it changes (loader toggling,
                beginning-of-conversation appearing). The sentinel is observed
                for pagination. */}
            <div ref={topRegionRef}>
              <div ref={sentinelRef} aria-hidden className="h-px w-full" />
              {showBeginning && beginningInfo ? (
                <BeginningOfConversation info={beginningInfo} />
              ) : (
                <TopSpacer loading={loadingOlder} initialLoading={showInitialLoading} />
              )}
            </div>
            {datedGroups.map(({ group, dateKey }, i) => {
              const showDateDivider = dateKey !== datedGroups[i - 1]?.dateKey;
              return (
                <div key={`${group[0].eventId}-${i}`}>
                  {showDateDivider && <DateDivider ts={group[0].ts} />}
                  <div className="mt-4">
                    {group.map((entry, idx) => (
                      <Fragment key={entry.eventId}>
                        {entry.eventId === unreadAnchor && <NewMessagesDivider />}
                        <MessageItem entry={entry} showHeader={idx === 0} />
                      </Fragment>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showJumpToLatest && (
        <button
          type="button"
          onClick={scrollToLatest}
          className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 border border-[var(--color-divider)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-strong)] shadow-lg transition-colors hover:border-[var(--color-text-faint)] hover:bg-[var(--color-panel)] focus:outline-none focus:ring-1 focus:ring-[var(--color-text-strong)]"
          aria-label="Jump to latest"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          Jump to latest
        </button>
      )}
    </div>
  );
}

// Reserved-height area at the top of the message list. Always renders the
// same height while older history may exist, so toggling the spinner doesn't
// shift the visible content. Shows a spinner during pagination, plus an
// initial-load spinner the first time a room is opened.
function TopSpacer({ loading, initialLoading }: { loading: boolean; initialLoading: boolean }) {
  const visible = loading || initialLoading;
  return (
    <div
      role={visible ? 'status' : undefined}
      aria-label={visible ? 'Loading older messages' : undefined}
      className="flex h-12 items-center justify-center"
    >
      <Loader2
        className={`h-4 w-4 animate-spin text-[var(--color-text-faint)] transition-opacity duration-150 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}

function NewMessagesDivider() {
  return (
    <div className="mt-4 flex items-center gap-3 px-4">
      <div className="h-px flex-1 bg-emerald-600/60" />
      <span className="bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
        New Messages
      </span>
      <div className="h-px flex-1 bg-emerald-600/60" />
    </div>
  );
}

interface BeginningInfo {
  client: MatrixClient;
  name: string;
  avatarMxc: string | null;
  creatorName: string | null;
  createdAt: number | null;
}

const BEGINNING_TS_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function BeginningOfConversation({ info }: { info: BeginningInfo }) {
  return (
    <div className="px-4 pb-4 pt-16">
      <AuthedImage
        client={info.client}
        mxc={info.avatarMxc}
        width={80}
        height={80}
        className="h-16 w-16 bg-[var(--color-surface)] object-cover"
        fallback={<InitialBadge text={info.name} className="h-16 w-16 text-2xl uppercase tracking-wide" />}
      />
      <h2 className="mt-4 text-xl font-bold tracking-tight text-[var(--color-text-strong)]">
        {info.name}
      </h2>
      <p className="mt-1 text-sm text-[var(--color-text)]">
        This is the beginning of conversation.
      </p>
      {info.creatorName && info.createdAt !== null && (
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Created by{' '}
          <span className="font-medium text-[var(--color-text)]">@{info.creatorName}</span> on{' '}
          {BEGINNING_TS_FORMATTER.format(new Date(info.createdAt))}
        </p>
      )}
    </div>
  );
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function DateDivider({ ts }: { ts: number }) {
  return (
    <div className="mt-6 flex items-center gap-3 px-4">
      <div className="h-px flex-1 bg-[var(--color-divider)]" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
        {DATE_FORMATTER.format(new Date(ts))}
      </span>
      <div className="h-px flex-1 bg-[var(--color-divider)]" />
    </div>
  );
}

function groupEntries(entries: TimelineEntry[]): TimelineEntry[][] {
  const groups: TimelineEntry[][] = [];
  let current: TimelineEntry[] = [];
  let lastSender: string | null = null;
  let lastTs = 0;

  for (const entry of entries) {
    const sameSender = entry.sender === lastSender;
    const sameMinute = entry.ts - lastTs < 5 * 60_000;
    if (current.length === 0 || !(sameSender && sameMinute)) {
      if (current.length) groups.push(current);
      current = [entry];
    } else {
      current.push(entry);
    }
    lastSender = entry.sender;
    lastTs = entry.ts;
  }
  if (current.length) groups.push(current);
  return groups;
}
