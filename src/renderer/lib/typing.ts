import { useEffect, useState } from 'react';
import type { MatrixEvent, RoomMember } from 'matrix-js-sdk';
import { RoomMemberEvent } from 'matrix-js-sdk';
import { accountManager } from '@/matrix/AccountManager';

export interface TypingUser {
  userId: string;
  name: string;
}

/**
 * Subscribes to RoomMember.typing for the given room and returns the list of
 * remote members currently typing (the local user is excluded). The list is
 * sorted by display name for stable rendering.
 */
export function useTypingUsers(
  accountId: string | null,
  roomId: string | null,
): TypingUser[] {
  const [typing, setTyping] = useState<TypingUser[]>([]);

  useEffect(() => {
    setTyping([]);
    if (!accountId || !roomId) return;
    const client = accountManager.getClient(accountId);
    if (!client) return;
    const room = client.getRoom(roomId);
    if (!room) return;

    const myUserId = client.getUserId();

    const compute = () => {
      const members = room.getMembersWithMembership('join');
      const list: TypingUser[] = [];
      for (const m of members) {
        if (!m.typing) continue;
        if (m.userId === myUserId) continue;
        list.push({ userId: m.userId, name: m.name || m.userId });
      }
      list.sort((a, b) => a.name.localeCompare(b.name));
      setTyping(list);
    };

    compute();

    const onTyping = (_ev: MatrixEvent, member: RoomMember) => {
      if (member.roomId !== roomId) return;
      compute();
    };

    client.on(RoomMemberEvent.Typing, onTyping);
    return () => {
      client.off(RoomMemberEvent.Typing, onTyping);
    };
  }, [accountId, roomId]);

  return typing;
}

/**
 * Renders the canonical "X is typing..." string. Caps at three named users
 * before falling back to a count to keep the strip readable.
 */
export function formatTypingLabel(users: TypingUser[]): string {
  if (users.length === 0) return '';
  if (users.length === 1) return `${users[0].name} is typing…`;
  if (users.length === 2) return `${users[0].name} and ${users[1].name} are typing…`;
  if (users.length === 3) {
    return `${users[0].name}, ${users[1].name} and ${users[2].name} are typing…`;
  }
  return 'Several people are typing…';
}
