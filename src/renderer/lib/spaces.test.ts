import { describe, expect, it } from 'vitest';
import type { RoomSummary } from '@/state/rooms';
import {
  LOBBY_ROOM_ID,
  getOrphanRooms,
  getSpaceTree,
  getTopLevelSpaces,
  isLobbyRoomId,
} from './spaces';

function room(
  id: string,
  overrides: Partial<RoomSummary> = {},
): RoomSummary {
  return {
    roomId: id,
    name: id,
    avatarMxc: null,
    isDirect: false,
    isSpace: false,
    isVoice: false,
    isEncrypted: false,
    isInvite: false,
    inviterUserId: null,
    memberCount: 1,
    unread: 0,
    highlights: 0,
    lastActivity: 0,
    parentSpaceIds: [],
    spaceChildIds: [],
    dmUserId: null,
    dmAvatarMxc: null,
    ...overrides,
  };
}

describe('getSpaceTree', () => {
  it('splits direct children into rooms and subspaces', () => {
    const org = room('!org', { isSpace: true, spaceChildIds: ['!general', '!eng'] });
    const general = room('!general');
    const eng = room('!eng', { isSpace: true, spaceChildIds: ['!backend'] });
    const backend = room('!backend');
    const tree = getSpaceTree([org, general, eng, backend], '!org');
    expect(tree.directRooms.map((r) => r.roomId)).toEqual(['!general']);
    expect(tree.subspaces).toHaveLength(1);
    expect(tree.subspaces[0].space.roomId).toBe('!eng');
    expect(tree.subspaces[0].rooms.map((r) => r.roomId)).toEqual(['!backend']);
  });

  it('flattens sub-subspaces into the nearest subspace category', () => {
    const org = room('!org', { isSpace: true, spaceChildIds: ['!eng'] });
    const eng = room('!eng', { isSpace: true, spaceChildIds: ['!frontend', '!infra'] });
    const frontend = room('!frontend');
    const infra = room('!infra', { isSpace: true, spaceChildIds: ['!k8s'] });
    const k8s = room('!k8s');
    const tree = getSpaceTree([org, eng, frontend, infra, k8s], '!org');
    expect(tree.subspaces).toHaveLength(1);
    expect(tree.subspaces[0].rooms.map((r) => r.roomId).sort()).toEqual([
      '!frontend',
      '!k8s',
    ]);
  });

  it('survives a cycle in m.space.child without hanging', () => {
    const a = room('!a', { isSpace: true, spaceChildIds: ['!b'] });
    const b = room('!b', { isSpace: true, spaceChildIds: ['!a', '!leaf'] });
    const leaf = room('!leaf');
    const tree = getSpaceTree([a, b, leaf], '!a');
    expect(tree.subspaces[0].rooms.map((r) => r.roomId)).toEqual(['!leaf']);
  });

  it('returns empty tree for an unknown or non-space id', () => {
    const r = room('!r');
    expect(getSpaceTree([r], '!missing').directRooms).toEqual([]);
    expect(getSpaceTree([r], '!r').directRooms).toEqual([]);
  });
});

describe('getOrphanRooms', () => {
  it('returns non-space, non-DM rooms that are not a child of any space', () => {
    const org = room('!org', { isSpace: true, spaceChildIds: ['!inside'] });
    const inside = room('!inside');
    const orphan = room('!orphan');
    const dm = room('!dm', { isDirect: true });
    const spaceRoom = room('!space', { isSpace: true });
    expect(
      getOrphanRooms([org, inside, orphan, dm, spaceRoom]).map((r) => r.roomId),
    ).toEqual(['!orphan']);
  });

  it('treats a room with a stale m.space.parent as orphan when no visible space claims it', () => {
    // Room declares a parent space via m.space.parent, but that space either
    // isn't visible to the user or no longer lists it as m.space.child. The
    // room must still surface somewhere — otherwise it becomes invisible.
    const stranded = room('!stranded', { parentSpaceIds: ['!gone'] });
    expect(getOrphanRooms([stranded]).map((r) => r.roomId)).toEqual(['!stranded']);
  });
});

describe('getTopLevelSpaces', () => {
  it('returns spaces that are not a child of any other space', () => {
    const org = room('!org', { isSpace: true, spaceChildIds: ['!eng'] });
    const eng = room('!eng', { isSpace: true });
    const other = room('!other', { isSpace: true });
    expect(getTopLevelSpaces([org, eng, other]).map((r) => r.roomId).sort()).toEqual(
      ['!org', '!other'],
    );
  });

  it('ignores non-space children listed under m.space.child', () => {
    // A space's m.space.child can list non-space rooms; those should not
    // affect which other spaces qualify as top-level.
    const org = room('!org', { isSpace: true, spaceChildIds: ['!general'] });
    const general = room('!general');
    const other = room('!other', { isSpace: true });
    expect(getTopLevelSpaces([org, general, other]).map((r) => r.roomId).sort()).toEqual(
      ['!org', '!other'],
    );
  });

  it('returns no spaces when none exist', () => {
    expect(getTopLevelSpaces([room('!a'), room('!b')])).toEqual([]);
  });
});

describe('isLobbyRoomId', () => {
  it('matches the sentinel id', () => {
    expect(isLobbyRoomId(LOBBY_ROOM_ID)).toBe(true);
  });

  it('does not match real room ids or null', () => {
    expect(isLobbyRoomId('!real')).toBe(false);
    expect(isLobbyRoomId(null)).toBe(false);
    expect(isLobbyRoomId('')).toBe(false);
  });
});

describe('getSpaceTree edge cases', () => {
  it('skips m.space.child entries pointing at unknown rooms', () => {
    const org = room('!org', { isSpace: true, spaceChildIds: ['!ghost', '!real'] });
    const real = room('!real');
    const tree = getSpaceTree([org, real], '!org');
    expect(tree.directRooms.map((r) => r.roomId)).toEqual(['!real']);
  });

  it('preserves the order of m.space.child', () => {
    const org = room('!org', {
      isSpace: true,
      spaceChildIds: ['!c', '!a', '!b'],
    });
    const a = room('!a');
    const b = room('!b');
    const c = room('!c');
    const tree = getSpaceTree([org, a, b, c], '!org');
    expect(tree.directRooms.map((r) => r.roomId)).toEqual(['!c', '!a', '!b']);
  });
});

describe('getOrphanRooms edge cases', () => {
  it('does not consider a space as an orphan room (spaces have their own surface)', () => {
    const lonely = room('!lonely', { isSpace: true });
    expect(getOrphanRooms([lonely])).toEqual([]);
  });

  it('does not consider DMs as orphans', () => {
    const dm = room('!dm', { isDirect: true });
    expect(getOrphanRooms([dm])).toEqual([]);
  });

  it('returns nothing on an empty input', () => {
    expect(getOrphanRooms([])).toEqual([]);
  });
});
