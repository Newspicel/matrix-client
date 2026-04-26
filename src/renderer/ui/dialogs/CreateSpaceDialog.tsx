import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAccountsStore } from '@/state/accounts';
import { useUiStore } from '@/state/ui';
import { useRoomsStore } from '@/state/rooms';
import { accountManager } from '@/matrix/AccountManager';
import { createSpace } from '@/matrix/roomOps';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { DialogActions, DialogField, DialogShell } from './DialogShell';

export function CreateSpaceDialog() {
  const target = useUiStore((s) => s.createSpaceOpen);
  const setOpen = useUiStore((s) => s.setCreateSpaceOpen);
  const activeAccountId = useAccountsStore((s) => s.activeAccountId);
  const setActiveSpace = useAccountsStore((s) => s.setActiveSpace);
  const allRooms = useRoomsStore((s) =>
    activeAccountId ? s.byAccount[activeAccountId] ?? [] : [],
  );

  const parentSpaceId = target?.parentSpaceId ?? null;
  const parentSpace = useMemo(
    () =>
      parentSpaceId ? allRooms.find((r) => r.roomId === parentSpaceId) ?? null : null,
    [allRooms, parentSpaceId],
  );

  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!target) {
      setName('');
      setTopic('');
      setIsPublic(false);
      setBusy(false);
    }
  }, [target]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !activeAccountId) return;
    const client = accountManager.getClient(activeAccountId);
    if (!client) return;
    setBusy(true);
    try {
      const roomId = await createSpace(client, {
        name: name.trim(),
        topic: topic.trim() || undefined,
        isPublic,
        parentSpaceId,
      });
      // Top-level: jump into the new space. Subspace: stay in the parent so
      // the new category appears under it in the SpaceTree.
      if (!parentSpaceId) setActiveSpace(roomId);
      toast.success(parentSpaceId ? 'Category created.' : 'Space created.');
      setOpen(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const isSubspace = !!parentSpaceId;
  const title = isSubspace ? 'Create category' : 'Create space';
  const description = parentSpace
    ? `New category inside “${parentSpace.name}”. Categories group related rooms.`
    : 'Spaces group rooms together. You can add rooms after creating the space.';

  return (
    <DialogShell
      open={target !== null}
      onClose={() => setOpen(null)}
      title={title}
      description={description}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <DialogField label="Name" htmlFor="create-space-name">
          <Input
            id="create-space-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isSubspace ? 'Engineering' : 'My team'}
            autoFocus
            disabled={busy}
          />
        </DialogField>
        <DialogField
          label="Description"
          htmlFor="create-space-topic"
          hint="Optional, shown to people you invite."
        >
          <Input
            id="create-space-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={isSubspace ? 'What rooms live here?' : 'What is this space for?'}
            disabled={busy}
          />
        </DialogField>
        <label className="flex cursor-pointer items-start justify-between gap-3 border border-[var(--color-divider)] bg-[var(--color-panel-2)] px-3 py-2.5">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-[var(--color-text-strong)]">Public</span>
            <span className="text-xs text-[var(--color-text-muted)]">
              Anyone with the link can join.
            </span>
          </span>
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            disabled={busy}
            className="mt-1 h-4 w-4 cursor-pointer accent-[var(--color-text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>
        <DialogActions>
          <Button type="button" variant="secondary" onClick={() => setOpen(null)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || busy}>
            {busy ? 'Creating…' : isSubspace ? 'Create category' : 'Create space'}
          </Button>
        </DialogActions>
      </form>
    </DialogShell>
  );
}
