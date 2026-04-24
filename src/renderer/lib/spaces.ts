import type { RoomSummary } from '@/state/rooms';

export interface SubspaceGroup {
  space: RoomSummary;
  rooms: RoomSummary[];
}

export interface SpaceTree {
  directRooms: RoomSummary[];
  subspaces: SubspaceGroup[];
}

export function getSpaceTree(rooms: RoomSummary[], spaceId: string): SpaceTree {
  const byId = new Map(rooms.map((r) => [r.roomId, r]));
  const space = byId.get(spaceId);
  if (!space || !space.isSpace) return { directRooms: [], subspaces: [] };

  const directRooms: RoomSummary[] = [];
  const subspaces: SubspaceGroup[] = [];

  for (const childId of space.spaceChildIds) {
    const child = byId.get(childId);
    if (!child) continue;
    if (child.isSpace) {
      subspaces.push({ space: child, rooms: collectDescendantRooms(child, byId) });
    } else {
      directRooms.push(child);
    }
  }

  return { directRooms, subspaces };
}

function collectDescendantRooms(
  root: RoomSummary,
  byId: Map<string, RoomSummary>,
): RoomSummary[] {
  const out: RoomSummary[] = [];
  const queue = [...root.spaceChildIds];
  const seen = new Set<string>([root.roomId]);
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const r = byId.get(id);
    if (!r) continue;
    if (r.isSpace) queue.push(...r.spaceChildIds);
    else out.push(r);
  }
  return out;
}

export function getOrphanRooms(rooms: RoomSummary[]): RoomSummary[] {
  const inSomeSpace = new Set<string>();
  for (const r of rooms) {
    if (!r.isSpace) continue;
    for (const childId of r.spaceChildIds) inSomeSpace.add(childId);
  }
  return rooms.filter(
    (r) =>
      !r.isSpace &&
      !r.isDirect &&
      r.parentSpaceIds.length === 0 &&
      !inSomeSpace.has(r.roomId),
  );
}

export function getTopLevelSpaces(rooms: RoomSummary[]): RoomSummary[] {
  const byId = new Map(rooms.map((r) => [r.roomId, r]));
  const childSpaces = new Set<string>();
  for (const r of rooms) {
    if (!r.isSpace) continue;
    for (const childId of r.spaceChildIds) {
      if (byId.get(childId)?.isSpace) childSpaces.add(childId);
    }
  }
  return rooms.filter((r) => r.isSpace && !childSpaces.has(r.roomId));
}
