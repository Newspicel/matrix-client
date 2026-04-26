import { useEffect } from 'react';
import { Hash, Volume2, Lock } from 'lucide-react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/ui/primitives/command';
import { useAccountsStore } from '@/state/accounts';
import { useRoomsStore } from '@/state/rooms';
import { useUiStore } from '@/state/ui';

/**
 * Cmd/Ctrl+K jump-to-room palette. Searches all rooms across all accounts
 * and jumps directly into the selected room on Enter.
 */
export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const accounts = useAccountsStore((s) => s.accounts);
  const activeAccountId = useAccountsStore((s) => s.activeAccountId);
  const setActiveAccount = useAccountsStore((s) => s.setActiveAccount);
  const setActiveRoom = useAccountsStore((s) => s.setActiveRoom);
  const setActiveSpace = useAccountsStore((s) => s.setActiveSpace);
  const byAccount = useRoomsStore((s) => s.byAccount);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!open);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  function jumpTo(accountId: string, roomId: string) {
    setActiveAccount(accountId);
    setActiveSpace(null);
    setActiveRoom(roomId);
    setOpen(false);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-[var(--color-backdrop)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity duration-150" />
        <DialogPrimitive.Popup
          aria-label="Jump to room"
          className="fixed left-1/2 top-[20%] z-50 w-[560px] max-w-[calc(100%-2rem)] -translate-x-1/2 overflow-hidden border border-[var(--color-divider)] bg-[var(--color-panel)] outline-none"
        >
          <Command loop>
            <CommandInput placeholder="Jump to a room…" autoFocus />
            <CommandList>
              <CommandEmpty>No rooms match.</CommandEmpty>
              {Object.values(accounts).map((account) => {
                const rooms = (byAccount[account.id] ?? []).filter((r) => !r.isSpace);
                if (rooms.length === 0) return null;
                const accountLabel =
                  account.id === activeAccountId
                    ? account.displayName || account.userId
                    : `${account.displayName || account.userId} (other account)`;
                return (
                  <CommandGroup key={account.id} heading={accountLabel}>
                    {rooms.map((room) => {
                      const Icon = room.isVoice ? Volume2 : Hash;
                      return (
                        <CommandItem
                          key={`${account.id}:${room.roomId}`}
                          value={`${room.name} ${room.roomId}`}
                          onSelect={() => jumpTo(account.id, room.roomId)}
                        >
                          <Icon className="text-[var(--color-text-faint)]" />
                          <span className="flex-1 truncate">{room.name}</span>
                          {room.isEncrypted && (
                            <Lock className="size-3 text-emerald-500" />
                          )}
                          {room.highlights > 0 && (
                            <span className="bg-red-500 px-1.5 text-[10px] font-bold text-white">
                              {room.highlights}
                            </span>
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                );
              })}
            </CommandList>
          </Command>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
