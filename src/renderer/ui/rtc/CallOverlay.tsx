import { useRtcStore } from '@/state/rtc';
import { leaveCall, toggleCamera, toggleMicrophone, toggleScreenShare } from '@/matrix/rtc/controls';
import { Mic, MicOff, Monitor, PhoneOff, Video, VideoOff } from 'lucide-react';
import { TileGrid } from './TileGrid';
import { Button } from '@/ui/primitives/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/primitives/tooltip';

/**
 * Floating call window shown when a MatrixRTC session is active.
 * Full rendering logic is in M6.
 */
export function CallOverlay() {
  const call = useRtcStore((s) => s.activeCall);
  if (!call) return null;

  return (
    <div className="pointer-events-auto absolute inset-x-10 bottom-10 top-16 z-50 flex flex-col rounded-xl border border-[var(--color-divider)] bg-[color-mix(in_srgb,var(--color-bg)_95%,transparent)] shadow-2xl">
      <header className="flex h-10 items-center border-b border-[var(--color-divider)] px-4 text-sm font-semibold">
        Call — {call.roomName}
      </header>
      <div className="relative flex-1 p-4">
        <TileGrid />
      </div>
      <footer className="flex items-center justify-center gap-3 border-t border-[var(--color-divider)] p-3">
        <CallButton
          onClick={toggleMicrophone}
          active={!call.micMuted}
          icon={call.micMuted ? MicOff : Mic}
          label={call.micMuted ? 'Unmute' : 'Mute'}
        />
        <CallButton
          onClick={toggleCamera}
          active={call.cameraOn}
          icon={call.cameraOn ? Video : VideoOff}
          label={call.cameraOn ? 'Stop video' : 'Start video'}
        />
        <CallButton
          onClick={toggleScreenShare}
          active={call.screenSharing}
          icon={Monitor}
          label={call.screenSharing ? 'Stop sharing' : 'Share screen'}
        />
        <CallButton onClick={leaveCall} active={false} icon={PhoneOff} variant="danger" label="Leave call" />
      </footer>
    </div>
  );
}

function CallButton({
  onClick,
  active,
  icon: Icon,
  variant = 'default',
  label,
}: {
  onClick: () => void;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'danger';
  label: string;
}) {
  const color =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-500 text-white'
      : active
        ? 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]'
        : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-panel)]';
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            onClick={onClick}
            aria-label={label}
            className={`h-10 w-10 rounded-full p-0 ${color}`}
          />
        }
      >
        <Icon className="h-5 w-5" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
