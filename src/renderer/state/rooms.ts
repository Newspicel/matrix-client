import { create } from 'zustand';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import { EventType, NotificationCountType } from 'matrix-js-sdk';

// Voice/video "room" types used in the wild. Matrix has no single standard;
// MSC3417 (`m.call`) is what Element Call rooms carry, and several older
// clients still emit the unstable prefix.
const VOICE_ROOM_TYPES = new Set([
  'm.call',
  'org.matrix.msc3417.call',
  'm.voice',
]);

export interface RoomSummary {
  roomId: string;
  name: string;
  avatarMxc: string | null;
  topic?: string;
  isDirect: boolean;
  isSpace: boolean;
  isVoice: boolean;
  isEncrypted: boolean;
  memberCount: number;
  unread: number;
  highlights: number;
  lastActivity: number;
  parentSpaceIds: string[];
  spaceChildIds: string[];
  dmUserId: string | null;
  dmAvatarMxc: string | null;
}

interface RoomsState {
  byAccount: Record<string, RoomSummary[]>;
  refreshRooms: (accountId: string, client: MatrixClient) => void;
  removeAccount: (accountId: string) => void;
}

function summarize(room: Room, client: MatrixClient): RoomSummary {
  const topicEvent = room.currentState.getStateEvents('m.room.topic', '');
  const topic = topicEvent?.getContent<{ topic?: string }>().topic;

  const ownUserId = client.getUserId() ?? '';
  const memberEvent = room.getMember(ownUserId);
  const directContent = client
    .getAccountData(EventType.Direct)
    ?.getContent<Record<string, string[]>>();
  const directRoomIds = directContent ? Object.values(directContent).flat() : [];
  const isDirect = directRoomIds.includes(room.roomId);

  const parentSpaces = room.currentState
    .getStateEvents('m.space.parent')
    .map((e) => e.getStateKey())
    .filter((k): k is string => !!k);

  const isSpace = room.isSpaceRoom();
  const roomType = room.getType();
  const isVoice = roomType ? VOICE_ROOM_TYPES.has(roomType) : false;
  const spaceChildIds = isSpace
    ? room.currentState
        .getStateEvents('m.space.child')
        .filter((e) => Object.keys(e.getContent()).length > 0)
        .map((e) => e.getStateKey())
        .filter((k): k is string => !!k)
    : [];

  const timeline = room.getLiveTimeline().getEvents();
  const lastEvent = timeline[timeline.length - 1];

  let dmUserId: string | null = null;
  let dmAvatarMxc: string | null = null;
  if (isDirect) {
    const other = room
      .getJoinedMembers()
      .find((m) => m.userId !== ownUserId);
    if (other) {
      dmUserId = other.userId;
      dmAvatarMxc = other.getMxcAvatarUrl() ?? null;
    }
  }

  return {
    roomId: room.roomId,
    name: room.name,
    avatarMxc: room.getMxcAvatarUrl(),
    topic,
    isDirect,
    isSpace,
    isVoice,
    isEncrypted: room.hasEncryptionStateEvent(),
    memberCount: room.getJoinedMemberCount(),
    unread: room.getUnreadNotificationCount(),
    highlights: room.getUnreadNotificationCount(NotificationCountType.Highlight),
    lastActivity: lastEvent?.getTs() ?? memberEvent?.events.member?.getTs() ?? 0,
    parentSpaceIds: parentSpaces,
    spaceChildIds,
    dmUserId,
    dmAvatarMxc,
  };
}

export const useRoomsStore = create<RoomsState>((set) => ({
  byAccount: {},

  refreshRooms: (accountId, client) => {
    const rooms = client.getVisibleRooms().map((r) => summarize(r, client));
    rooms.sort((a, b) => b.lastActivity - a.lastActivity);
    set((state) => ({ byAccount: { ...state.byAccount, [accountId]: rooms } }));
  },

  removeAccount: (accountId) =>
    set((state) => {
      const { [accountId]: _removed, ...rest } = state.byAccount;
      return { byAccount: rest };
    }),
}));
