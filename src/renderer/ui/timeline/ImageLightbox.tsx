import { X } from 'lucide-react';
import type { EncryptedFile } from '@/lib/mxc';
import { AuthedImage } from '@/lib/mxc';
import { useAccountsStore } from '@/state/accounts';
import { accountManager } from '@/matrix/AccountManager';
import { useUiStore } from '@/state/ui';

export function ImageLightbox() {
  const lightbox = useUiStore((s) => s.lightbox);
  const close = useUiStore((s) => s.closeLightbox);
  const activeAccountId = useAccountsStore((s) => s.activeAccountId);
  const client = activeAccountId ? accountManager.getClient(activeAccountId) : null;

  if (!lightbox) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-backdrop-strong)]"
      onClick={close}
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
      >
        <X className="h-5 w-5" />
      </button>
      <div
        className="flex max-h-full max-w-full items-center justify-center p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <AuthedImage
          client={client}
          mxc={lightbox.mxc ?? null}
          file={(lightbox.file as EncryptedFile | null) ?? null}
          mimetype={lightbox.mimetype}
          alt={lightbox.alt ?? ''}
          className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          fallback={
            <span className="text-sm text-[var(--color-text-muted)]">loading…</span>
          }
        />
      </div>
    </div>
  );
}
