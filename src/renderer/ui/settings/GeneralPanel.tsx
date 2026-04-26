import { useState } from 'react';
import { Monitor, Moon, Plus, Sun, X } from 'lucide-react';
import { useUiStore, type ThemePreference } from '@/state/ui';
import { EmojiPicker } from '@/ui/primitives/emoji-picker';
import { cn } from '@/lib/utils';
import { SettingsPanel, SettingsRow, SettingsSection } from './SettingsPrimitives';

const THEME_OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}> = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
];

export function GeneralPanel() {
  return (
    <SettingsPanel title="General">
      <SettingsSection label="Appearance">
        <SettingsRow label="Theme" hint="Switch the app between dark, light, or your OS preference.">
          <ThemePicker />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection label="Quick reactions">
        <p className="text-xs text-[var(--color-text-muted)]">
          Emojis shown on hover over a message. Click a slot to change it, or use the “+” to add
          another.
        </p>
        <QuickReactionsEditor />
      </SettingsSection>
    </SettingsPanel>
  );
}

function ThemePicker() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex border border-[var(--color-divider)] bg-[var(--color-panel)]"
    >
      {THEME_OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(option.value)}
            className={cn(
              'flex h-8 items-center gap-1.5 px-2.5 text-xs font-medium transition-colors',
              active
                ? 'bg-[var(--color-surface)] text-[var(--color-text-strong)]'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-hover-overlay)] hover:text-[var(--color-text-strong)]',
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
            {option.label}
          </button>
        );
      })}
    </div>
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
