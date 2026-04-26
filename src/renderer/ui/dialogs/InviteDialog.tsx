import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAccountsStore } from '@/state/accounts';
import { useRoomsStore } from '@/state/rooms';
import { useUiStore } from '@/state/ui';
import { accountManager } from '@/matrix/AccountManager';
import { inviteToRoom, isValidUserId } from '@/matrix/roomOps';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { DialogActions, DialogField, DialogShell } from './DialogShell';

export function InviteDialog() {
  const roomId = useUiStore((s) => s.inviteForRoomId);
  const setRoomId = useUiStore((s) => s.setInviteForRoomId);
  const activeAccountId = useAccountsStore((s) => s.activeAccountId);
  const room = useRoomsStore((s) => {
    if (!activeAccountId || !roomId) return null;
    return s.byAccount[activeAccountId]?.find((r) => r.roomId === roomId) ?? null;
  });

  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!roomId) {
      setValue('');
      setBusy(false);
    }
  }, [roomId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomId || !activeAccountId || busy) return;
    const id = value.trim();
    if (!isValidUserId(id)) {
      toast.error('Invalid Matrix user ID. Expected @user:server.tld.');
      return;
    }
    const client = accountManager.getClient(activeAccountId);
    if (!client) return;
    setBusy(true);
    try {
      await inviteToRoom(client, roomId, [id]);
      toast.success(`Invited ${id}.`);
      setRoomId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const title = room?.isSpace
    ? `Invite to ${room.name}`
    : room?.name
      ? `Invite to ${room.name}`
      : 'Invite';

  return (
    <DialogShell open={!!roomId} onClose={() => setRoomId(null)} title={title}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <DialogField label="User ID" hint="Format: @user:server.tld" htmlFor="invite-user-id">
          <Input
            id="invite-user-id"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="@alice:matrix.org"
            autoFocus
            disabled={busy}
          />
        </DialogField>
        <DialogActions>
          <Button type="button" variant="secondary" onClick={() => setRoomId(null)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={!value.trim() || busy}>
            {busy ? 'Inviting…' : 'Send invite'}
          </Button>
        </DialogActions>
      </form>
    </DialogShell>
  );
}
