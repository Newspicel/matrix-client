import { useEffect, useRef, useState } from 'react';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { Paperclip, SendHorizontal, X, FileIcon, ImageIcon } from 'lucide-react';
import { accountManager } from '@/matrix/AccountManager';
import { useAccountsStore } from '@/state/accounts';
import { composeTextContent } from '@/lib/markdown';
import { uploadAndSendFile } from '@/matrix/attachments';
import { Button } from '@/ui/primitives/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/primitives/tooltip';

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl: string | null;
}

function makePending(file: File): PendingAttachment {
  const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
  return { id: crypto.randomUUID(), file, previewUrl };
}

export function Composer() {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const activeAccountId = useAccountsStore((s) => s.activeAccountId);
  const activeRoomId = useAccountsStore((s) => s.activeRoomId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const disabled = !activeAccountId || !activeRoomId;

  useEffect(() => {
    return () => {
      for (const a of attachments) {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      }
    };
  }, [attachments]);

  useEffect(() => {
    setAttachments((prev) => {
      for (const a of prev) {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      }
      return [];
    });
    setValue('');
  }, [activeRoomId, activeAccountId]);

  async function send() {
    if (disabled) return;
    const client = accountManager.getClient(activeAccountId!);
    if (!client) return;
    const body = value.trim();
    const pending = attachments;
    if (!body && pending.length === 0) return;

    setValue('');
    setAttachments([]);

    try {
      for (const a of pending) {
        await uploadAndSendFile(client, activeRoomId!, a.file);
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      }
      if (body) {
        const content = composeTextContent(body) as unknown as RoomMessageEventContent;
        await client.sendMessage(activeRoomId!, content);
      }
    } catch (err) {
      console.error('send failed', err);
      // Restore so the user doesn't lose their draft on transient failure.
      setValue((cur) => cur || body);
      setAttachments((cur) => (cur.length > 0 ? cur : pending));
    }
  }

  function addFiles(files: Iterable<File>) {
    const next: PendingAttachment[] = [];
    for (const f of files) next.push(makePending(f));
    if (next.length === 0) return;
    setAttachments((cur) => [...cur, ...next]);
  }

  function removeAttachment(id: string) {
    setAttachments((cur) => {
      const match = cur.find((a) => a.id === id);
      if (match?.previewUrl) URL.revokeObjectURL(match.previewUrl);
      return cur.filter((a) => a.id !== id);
    });
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) addFiles(Array.from(files));
    e.target.value = '';
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.files);
    if (files.length === 0) return;
    e.preventDefault();
    addFiles(files);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const canSend = !disabled && (value.trim().length > 0 || attachments.length > 0);

  return (
    <div className="shrink-0 border-t border-[var(--color-divider)] p-4">
      <div
        className={`flex flex-col gap-2 rounded-lg bg-[var(--color-surface)] px-3 py-2 transition-opacity ${
          disabled ? 'opacity-50' : ''
        }`}
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {attachments.map((a) => (
              <AttachmentChip
                key={a.id}
                attachment={a}
                onRemove={() => removeAttachment(a.id)}
              />
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <label
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--color-text-muted)] ${
                    disabled
                      ? 'cursor-not-allowed'
                      : 'cursor-pointer hover:bg-[var(--color-hover-overlay)] hover:text-[var(--color-text)]'
                  }`}
                />
              }
            >
              <Paperclip className="h-5 w-5" />
              <input
                type="file"
                multiple
                className="hidden"
                onChange={onFileChange}
                disabled={disabled}
              />
            </TooltipTrigger>
            <TooltipContent>Attach file</TooltipContent>
          </Tooltip>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            disabled={disabled}
            placeholder={disabled ? 'Select a chat to send messages' : 'Message'}
            rows={1}
            className="max-h-40 flex-1 resize-none self-center bg-transparent py-1 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-faint)] disabled:cursor-not-allowed"
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  onClick={send}
                  disabled={!canSend}
                  variant={canSend ? 'default' : 'ghost'}
                  size="icon-sm"
                  aria-label="Send message"
                />
              }
            >
              <SendHorizontal className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>Send</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: PendingAttachment;
  onRemove: () => void;
}) {
  const { file, previewUrl } = attachment;
  const isImage = file.type.startsWith('image/');
  return (
    <div className="group relative flex items-center gap-2 rounded-md bg-[var(--color-panel)] px-2 py-1.5 pr-7 text-xs">
      {isImage && previewUrl ? (
        <img
          src={previewUrl}
          alt={file.name}
          className="h-10 w-10 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--color-surface)] text-[var(--color-text-muted)]">
          {isImage ? <ImageIcon className="h-5 w-5" /> : <FileIcon className="h-5 w-5" />}
        </div>
      )}
      <div className="max-w-[180px]">
        <div className="truncate font-medium text-[var(--color-text)]">{file.name}</div>
        <div className="text-[10px] text-[var(--color-text-faint)]">
          {formatBytes(file.size)}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-red-600 hover:text-white"
        aria-label={`Remove ${file.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
