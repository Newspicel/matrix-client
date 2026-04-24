import { create } from 'zustand';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';

export interface TimelineEntry {
  eventId: string;
  sender: string;
  senderDisplayName: string;
  senderAvatarMxc: string | null;
  type: string;
  content: unknown;
  ts: number;
  isEncrypted: boolean;
  isDecryptionFailure: boolean;
  isRedacted: boolean;
  replyToId?: string;
  threadRootId?: string;
  editedFromId?: string;
  reactions: Record<string, { count: number; byMe: boolean }>;
}

interface TimelineState {
  byRoom: Record<string, TimelineEntry[]>;
  onTimelineAppend: (accountId: string, roomId: string, client: MatrixClient) => void;
  prune: (roomId: string) => void;
}

const RENDERED_TYPES = new Set([
  'm.room.message',
  'm.room.encrypted',
  'm.sticker',
  'org.matrix.msc3381.poll.start',
  'm.poll.start',
]);

function toEntry(event: MatrixEvent, memberLookup?: (userId: string) => { name?: string; avatarMxc?: string | null } | null): TimelineEntry | null {
  const type = event.getType();
  if (!RENDERED_TYPES.has(type)) return null;
  if (event.isState()) return null;

  const eventId = event.getId();
  const sender = event.getSender();
  if (!eventId || !sender) return null;

  const relates = (event.getContent() as { 'm.relates_to'?: { rel_type?: string; event_id?: string } })[
    'm.relates_to'
  ];

  const member = memberLookup?.(sender) ?? null;

  return {
    eventId,
    sender,
    senderDisplayName: member?.name || sender,
    senderAvatarMxc: member?.avatarMxc ?? null,
    type,
    content: event.getContent(),
    ts: event.getTs(),
    isEncrypted: event.isEncrypted(),
    isDecryptionFailure: event.isDecryptionFailure(),
    isRedacted: event.isRedacted(),
    replyToId:
      relates?.rel_type === 'm.thread'
        ? relates.event_id
        : (event.getContent() as { 'm.relates_to'?: { 'm.in_reply_to'?: { event_id?: string } } })[
            'm.relates_to'
          ]?.['m.in_reply_to']?.event_id,
    threadRootId: event.threadRootId,
    editedFromId: relates?.rel_type === 'm.replace' ? relates.event_id : undefined,
    reactions: {},
  };
}

// Per-room debounce: a burst of RoomEvent.Timeline / MatrixEventEvent.Decrypted
// callbacks (e.g. after a paginate) collapses into a single rebuild per frame.
const pendingRefresh = new Map<string, number>();

export const useTimelineStore = create<TimelineState>((set) => ({
  byRoom: {},

  onTimelineAppend: (_accountId, roomId, client) => {
    if (pendingRefresh.has(roomId)) return;
    const handle = requestAnimationFrame(() => {
      pendingRefresh.delete(roomId);
      rebuildRoom(roomId, client, set);
    });
    pendingRefresh.set(roomId, handle);
  },

  prune: (roomId) =>
    set((state) => {
      const { [roomId]: _removed, ...rest } = state.byRoom;
      return { byRoom: rest };
    }),
}));

function rebuildRoom(
  roomId: string,
  client: MatrixClient,
  set: (partial: (state: TimelineState) => Partial<TimelineState>) => void,
) {
  const room = client.getRoom(roomId);
  if (!room) return;
  const events = room.getLiveTimeline().getEvents();
  const lookupMember = (userId: string) => {
    const m = room.getMember(userId);
    if (!m) return null;
    return { name: m.name, avatarMxc: m.getMxcAvatarUrl() ?? null };
  };
  const entries: TimelineEntry[] = [];
  for (const ev of events) {
    const entry = toEntry(ev, lookupMember);
    if (entry) entries.push(entry);
  }

  // Collapse edits — keep only the latest edit's content but keep the original event id.
  const byOriginalId = new Map<string, TimelineEntry>();
  for (const entry of entries) {
    if (entry.editedFromId) {
      const root = byOriginalId.get(entry.editedFromId);
      if (root) {
        const newContent = (entry.content as { 'm.new_content'?: unknown })['m.new_content'];
        root.content = newContent ?? entry.content;
        root.editedFromId = entry.eventId; // marker that it was edited
      }
    } else {
      byOriginalId.set(entry.eventId, entry);
    }
  }

  // Aggregate reactions from non-rendered events too.
  for (const ev of events) {
    if (ev.getType() !== 'm.reaction') continue;
    const content = ev.getContent<{
      'm.relates_to'?: { rel_type?: string; event_id?: string; key?: string };
    }>();
    const rel = content['m.relates_to'];
    if (rel?.rel_type !== 'm.annotation' || !rel.event_id || !rel.key) continue;
    const target = byOriginalId.get(rel.event_id);
    if (!target) continue;
    const mine = ev.getSender() === client.getUserId();
    const slot = target.reactions[rel.key] ?? { count: 0, byMe: false };
    target.reactions[rel.key] = { count: slot.count + 1, byMe: slot.byMe || mine };
  }

  const final = Array.from(byOriginalId.values()).sort((a, b) => a.ts - b.ts);
  set((state) => ({ byRoom: { ...state.byRoom, [roomId]: final } }));
}
