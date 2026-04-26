import { useEffect, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { toast } from 'sonner';
import { Button } from '@/ui/primitives/button';
import { verifyOwnDevice, type SasHandle } from '@/matrix/verification';
import { SettingsPanel, SettingsSection } from './SettingsPrimitives';

interface Device {
  id: string;
  displayName?: string;
  lastSeenTs?: number;
  lastSeenIp?: string;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; devices: Device[] };

export function DevicesPanel({
  client,
  onSasStart,
}: {
  client: MatrixClient | null;
  onSasStart: (handle: SasHandle) => void;
}) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!client) {
      setState({ kind: 'error', message: 'No active account.' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    (async () => {
      try {
        const res = await client.getDevices();
        if (cancelled) return;
        const devices: Device[] = res.devices.map((d) => ({
          id: d.device_id,
          displayName: d.display_name,
          lastSeenTs: d.last_seen_ts,
          lastSeenIp: d.last_seen_ip,
        }));
        // Stable sort: this device first, then most-recently-seen first.
        const myId = client.getDeviceId();
        devices.sort((a, b) => {
          if (a.id === myId) return -1;
          if (b.id === myId) return 1;
          return (b.lastSeenTs ?? 0) - (a.lastSeenTs ?? 0);
        });
        setState({ kind: 'ready', devices });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        console.error('[devices] getDevices failed', err);
        setState({ kind: 'error', message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, reloadTick]);

  async function onVerify(deviceId: string) {
    if (!client) return;
    try {
      const handle = await verifyOwnDevice(client, deviceId);
      onSasStart(handle);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <SettingsPanel title="Devices">
      <SettingsSection label="Signed-in sessions">
        {state.kind === 'loading' && (
          <div className="border border-[var(--color-divider)] bg-[var(--color-panel-2)] px-3 py-3 text-sm text-[var(--color-text-muted)]">
            Loading devices…
          </div>
        )}
        {state.kind === 'error' && (
          <div className="flex items-center justify-between border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-[var(--color-text)]">
            <span>Couldn’t load devices: {state.message}</span>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => setReloadTick((t) => t + 1)}
            >
              Retry
            </Button>
          </div>
        )}
        {state.kind === 'ready' && state.devices.length === 0 && (
          <div className="border border-[var(--color-divider)] bg-[var(--color-panel-2)] px-3 py-3 text-sm text-[var(--color-text-muted)]">
            No devices reported by the homeserver.
          </div>
        )}
        {state.kind === 'ready' && state.devices.length > 0 && (
          <ul className="divide-y divide-[var(--color-divider)] border border-[var(--color-divider)] bg-[var(--color-panel-2)]">
            {state.devices.map((d) => {
              const isThisDevice = d.id === client?.getDeviceId();
              return (
                <li
                  key={d.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-[var(--color-text-strong)]">
                        {d.displayName || d.id}
                      </span>
                      {isThisDevice && (
                        <span className="bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                          This device
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs text-[var(--color-text-faint)]">
                      {d.id}
                      {d.lastSeenTs ? ` · ${new Date(d.lastSeenTs).toLocaleString()}` : ''}
                    </div>
                  </div>
                  {!isThisDevice && (
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
              );
            })}
          </ul>
        )}
      </SettingsSection>
    </SettingsPanel>
  );
}
