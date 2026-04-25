import type { EncryptedFile } from '@/lib/mxc';
import { AuthedImage } from '@/lib/mxc';
import { useAccountsStore } from '@/state/accounts';
import { accountManager } from '@/matrix/AccountManager';
import { useUiStore } from '@/state/ui';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

export function ImageLightbox() {
  const lightbox = useUiStore((s) => s.lightbox);
  const close = useUiStore((s) => s.closeLightbox);
  const activeAccountId = useAccountsStore((s) => s.activeAccountId);
  const client = activeAccountId ? accountManager.getClient(activeAccountId) : null;

  return (
    <DialogPrimitive.Root
      open={!!lightbox}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-[var(--color-backdrop-strong)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity duration-150" />
        <DialogPrimitive.Popup
          aria-label={lightbox?.alt ?? 'Image preview'}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 outline-none"
        >
          {lightbox && (
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
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
