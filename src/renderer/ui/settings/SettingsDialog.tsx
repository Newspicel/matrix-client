import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useAccountsStore } from '@/state/accounts';
import { useUiStore } from '@/state/ui';
import { accountManager } from '@/matrix/AccountManager';
import {
  acceptIncomingVerification,
  ensureCryptoBootstrapped,
  unlockWithRecoveryKey,
  verifyOwnDevice,
  type SasHandle,
} from '@/matrix/verification';
import type { VerificationRequest } from 'matrix-js-sdk/lib/crypto-api/verification';
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api/CryptoEvent';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { EmojiPicker } from '@/ui/primitives/emoji-picker';
import { toast } from 'sonner';

interface Device {
  id: string;
  displayName?: string;
  lastSeenTs?: number;
  lastSeenIp?: string;
}

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const activeAccountId = useAccountsStore((s) => s.activeAccountId);
  const activeAccount = useAccountsStore((s) =>
    activeAccountId ? s.accounts[activeAccountId] : null,
  );
  const [devices, setDevices] = useState<Device[]>([]);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [incoming, setIncoming] = useState<VerificationRequest | null>(null);
  const [sas, setSas] = useState<SasHandle | null>(null);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const client = activeAccountId ? (accountManager.getClient(activeAccountId) ?? null) : null;

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await client.getDevices();
        if (cancelled) return;
        setDevices(
          res.devices.map((d) => ({
            id: d.device_id,
            displayName: d.display_name,
            lastSeenTs: d.last_seen_ts,
            lastSeenIp: d.last_seen_ip,
          })),
        );
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    if (!client) return;
    const handler = (request: VerificationRequest) => {
      if (!request.initiatedByMe) setIncoming(request);
    };
    client.on(CryptoEvent.VerificationRequestReceived, handler);
    return () => {
      client.off(CryptoEvent.VerificationRequestReceived, handler);
    };
  }, [client]);

  async function onBootstrap() {
    if (!client) return;
    setBootstrapping(true);
    try {
      await ensureCryptoBootstrapped(client);
      toast.success('Cross-signing set up.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBootstrapping(false);
    }
  }

  async function onVerify(deviceId: string) {
    if (!client) return;
    try {
      const handle = await verifyOwnDevice(client, deviceId);
      setSas(handle);
      handle.onDone.then(() => setSas(null)).catch(() => setSas(null));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function onAcceptIncoming() {
    if (!incoming) return;
    const handle = await acceptIncomingVerification(incoming);
    setIncoming(null);
    setSas(handle);
    handle.onDone.then(() => setSas(null)).catch(() => setSas(null));
  }

  async function onUnlockRecovery() {
    if (!client || !activeAccountId) return;
    setUnlocking(true);
    try {
      await unlockWithRecoveryKey(client, activeAccountId, recoveryKey);
      setRecoveryKey('');
      toast.success('Unlocked. Restoring encrypted history from key backup…');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setUnlocking(false);
    }
  }

  async function onSignOut() {
    if (!activeAccountId) return;
    setSigningOut(true);
    try {
      await accountManager.removeAccount(activeAccountId);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      setSigningOut(false);
      setConfirmingSignOut(false);
    }
  }

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-40 bg-[var(--color-backdrop)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity duration-150" />
        <DialogPrimitive.Popup
          aria-label="Settings"
          className="fixed left-1/2 top-1/2 z-50 flex h-[80vh] w-[820px] -translate-x-1/2 -translate-y-1/2 flex-col border border-[var(--color-divider)] bg-[var(--color-panel)] outline-none data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity duration-150"
        >
          <header className="flex h-12 items-center justify-between border-b border-[var(--color-divider)] bg-[var(--color-panel-2)] px-4">
            <DialogPrimitive.Title className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-strong)]">
              Settings
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Close" />
              }
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </header>

          <div className="flex-1 overflow-y-auto p-6">
            <section className="mb-6">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Encryption
              </h3>
              <p className="mb-3 text-xs text-[var(--color-text-muted)]">
                To decrypt messages sent before this device logged in, verify this device from
                another signed-in session, or enter your recovery key below.
              </p>
              <div className="flex flex-col gap-2 border border-[var(--color-divider)] bg-[var(--color-panel-2)] p-3">
                <label className="text-xs font-medium text-[var(--color-text-muted)]" htmlFor="recovery-key">
                  Recovery key
                </label>
                <Input
                  id="recovery-key"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="EsT1 2AbC 3dEf …"
                  value={recoveryKey}
                  onChange={(e) => setRecoveryKey(e.target.value)}
                  className="font-mono"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={onUnlockRecovery}
                    disabled={unlocking || !recoveryKey.trim()}
                  >
                    {unlocking ? 'Unlocking…' : 'Unlock key backup'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onBootstrap}
                    disabled={bootstrapping}
                    title="Only use this on a brand-new account with no existing backup"
                  >
                    {bootstrapping ? 'Setting up…' : 'First-time setup'}
                  </Button>
                </div>
              </div>
            </section>

            <section className="mb-6">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Devices
              </h3>
              <ul className="divide-y divide-[var(--color-divider)] border border-[var(--color-divider)] bg-[var(--color-panel-2)]">
                {devices.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium text-[var(--color-text-strong)]">{d.displayName || d.id}</div>
                      <div className="font-mono text-xs text-[var(--color-text-faint)]">
                        {d.id}
                        {d.lastSeenTs ? ` · ${new Date(d.lastSeenTs).toLocaleString()}` : ''}
                      </div>
                    </div>
                    {d.id !== client?.getDeviceId() && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={() => onVerify(d.id)}
                      >
                        Verify
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Quick reactions
              </h3>
              <p className="mb-3 text-xs text-[var(--color-text-muted)]">
                Emojis shown on hover over a message. Click a slot to change it, or use the “+” to add another.
              </p>
              <QuickReactionsEditor />
            </section>

            <section>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Account
              </h3>
              <div className="flex flex-col gap-3 border border-red-900/50 bg-red-950/30 p-3">
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-strong)]">
                    Sign out of {activeAccount?.displayName || activeAccount?.userId || 'this account'}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                    Invalidates this session on the server and removes local account data from this
                    computer. You will need your recovery key (or another verified session) to read
                    encrypted history when you sign back in.
                  </p>
                </div>
                {confirmingSignOut ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={onSignOut}
                      disabled={signingOut}
                      className="bg-red-500 text-white hover:bg-red-400"
                    >
                      {signingOut ? 'Signing out…' : 'Confirm sign out'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setConfirmingSignOut(false)}
                      disabled={signingOut}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    onClick={() => setConfirmingSignOut(true)}
                    className="self-start bg-red-500/80 text-white hover:bg-red-500"
                  >
                    Sign out & remove account
                  </Button>
                )}
              </div>
            </section>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>

      {incoming && (
        <VerificationIncoming
          onAccept={onAcceptIncoming}
          onDecline={async () => {
            await incoming.cancel();
            setIncoming(null);
          }}
        />
      )}
      {sas && <VerificationEmoji handle={sas} onClose={() => setSas(null)} />}
    </DialogPrimitive.Root>
  );
}

function VerificationIncoming({
  onAccept,
  onDecline,
}: {
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) void onDecline();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-[var(--color-backdrop-strong)]" />
        <DialogPrimitive.Popup
          aria-label="Incoming verification"
          className="fixed left-1/2 top-1/2 z-50 w-[360px] -translate-x-1/2 -translate-y-1/2 border border-[var(--color-divider)] bg-[var(--color-panel-2)] p-6 text-center outline-none"
        >
          <DialogPrimitive.Title className="mb-3 text-lg font-semibold">
            Incoming verification
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mb-4 text-sm text-[var(--color-text-muted)]">
            Another session wants to verify this one.
          </DialogPrimitive.Description>
          <div className="flex justify-center gap-2">
            <Button variant="secondary" onClick={onDecline}>
              Decline
            </Button>
            <Button onClick={onAccept}>Accept</Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function QuickReactionsEditor() {
  const quickReactions = useUiStore((s) => s.quickReactions);
  const setQuickReactions = useUiStore((s) => s.setQuickReactions);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  function replaceAt(i: number, emoji: string) {
    const next = [...quickReactions];
    if (i >= next.length) next.push(emoji);
    else next[i] = emoji;
    setQuickReactions(next);
  }

  function removeAt(i: number) {
    const next = quickReactions.filter((_, idx) => idx !== i);
    setQuickReactions(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border border-[var(--color-divider)] bg-[var(--color-panel-2)] p-3">
      {quickReactions.map((emoji, i) => (
        <div key={i} className="group relative">
          <EmojiPicker
            open={editingIndex === i}
            onOpenChange={(o) => setEditingIndex(o ? i : null)}
            side="bottom"
            onSelect={(next) => {
              replaceAt(i, next);
              setEditingIndex(null);
            }}
            trigger={
              <button
                type="button"
                className="flex h-10 w-12 items-center justify-center border border-[var(--color-divider)] bg-[var(--color-panel)] text-xl transition-colors hover:bg-[var(--color-surface)] aria-expanded:border-[var(--color-text-faint)] aria-expanded:bg-[var(--color-surface)]"
                aria-label={`Quick reaction ${i + 1}: ${emoji}. Click to change.`}
              >
                {emoji}
              </button>
            }
          />
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center bg-[var(--color-panel-2)] text-[var(--color-text-muted)] opacity-0 transition-colors group-hover:opacity-100 hover:bg-red-500 hover:text-white"
            aria-label={`Remove quick reaction ${emoji}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      ))}
      <EmojiPicker
        open={editingIndex === quickReactions.length}
        onOpenChange={(o) => setEditingIndex(o ? quickReactions.length : null)}
        side="bottom"
        onSelect={(next) => {
          replaceAt(quickReactions.length, next);
          setEditingIndex(null);
        }}
        trigger={
          <button
            type="button"
            className="flex h-10 w-12 items-center justify-center border border-dashed border-[var(--color-divider)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text-faint)] hover:bg-[var(--color-hover-overlay)] hover:text-[var(--color-text-strong)] aria-expanded:bg-[var(--color-hover-overlay)]"
            aria-label="Add quick reaction"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
          </button>
        }
      />
    </div>
  );
}

function VerificationEmoji({
  handle,
  onClose,
}: {
  handle: SasHandle;
  onClose: () => void;
}) {
  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-[var(--color-backdrop-strong)]" />
        <DialogPrimitive.Popup
          aria-label="Compare emojis"
          className="fixed left-1/2 top-1/2 z-50 w-[460px] -translate-x-1/2 -translate-y-1/2 border border-[var(--color-divider)] bg-[var(--color-panel-2)] p-6 text-center outline-none"
        >
          <DialogPrimitive.Title className="mb-1 text-lg font-semibold">
            Compare emojis
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mb-4 text-sm text-[var(--color-text-muted)]">
            Both devices should show the same emojis in the same order.
          </DialogPrimitive.Description>
          <div className="mb-4 flex flex-wrap justify-center gap-3">
            {handle.emoji.map(([emoji, label]) => (
              <div key={label} className="w-16">
                <div className="text-3xl">{emoji}</div>
                <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-2">
            <Button
              className="bg-red-600 text-white hover:bg-red-500"
              onClick={async () => {
                await handle.mismatch();
                onClose();
              }}
            >
              They don’t match
            </Button>
            <Button
              onClick={async () => {
                await handle.confirm();
              }}
            >
              They match
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
