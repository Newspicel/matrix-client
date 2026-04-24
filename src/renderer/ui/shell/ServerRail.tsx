import { Home, Plus } from 'lucide-react';
import type { MatrixClient } from 'matrix-js-sdk';
import { cn } from '@/lib/utils';
import { useAccountsStore } from '@/state/accounts';
import { useRoomsStore, type RoomSummary } from '@/state/rooms';
import { useUiStore } from '@/state/ui';
import { accountManager } from '@/matrix/AccountManager';
import { AuthedImage } from '@/lib/mxc';
import { getTopLevelSpaces } from '@/lib/spaces';
import type { AccountMetadata } from '@shared/types';

interface AccountNotifs {
  unread: number;
  highlights: number;
}

function notifsFor(rooms: RoomSummary[] | undefined): AccountNotifs {
  if (!rooms) return { unread: 0, highlights: 0 };
  let unread = 0;
  let highlights = 0;
  for (const r of rooms) {
    if (r.isSpace) continue;
    unread += r.unread;
    highlights += r.highlights;
  }
  return { unread, highlights };
}

export function ServerRail() {
  const accounts = useAccountsStore((s) => s.accounts);
  const activeAccountId = useAccountsStore((s) => s.activeAccountId);
  const activeSpaceId = useAccountsStore((s) => s.activeSpaceId);
  const setActiveAccount = useAccountsStore((s) => s.setActiveAccount);
  const setActiveSpace = useAccountsStore((s) => s.setActiveSpace);
  const byAccount = useRoomsStore((s) => s.byAccount);
  const setLoginAnotherOpen = useUiStore((s) => s.setLoginAnotherOpen);

  const accountList = Object.values(accounts);
  const activeAccount = activeAccountId ? accounts[activeAccountId] : null;
  const activeClient = (activeAccountId ? accountManager.getClient(activeAccountId) : null) ?? null;
  const activeRooms = activeAccountId ? byAccount[activeAccountId] ?? [] : [];
  const topSpaces = getTopLevelSpaces(activeRooms);

  const otherAccounts = accountList.filter((a) => a.id !== activeAccountId);

  return (
    <nav
      className="flex h-full w-[72px] shrink-0 flex-col items-stretch bg-[var(--color-rail)] py-3"
      aria-label="Accounts and spaces"
    >
      {/* px-2: overflow-y:auto forces overflow-x:auto too, so the selection
          ring needs horizontal room to not get clipped. */}
      <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto px-2">
        {activeAccount && (
          <HomeButton
            account={activeAccount}
            active={activeSpaceId === null}
            onClick={() => {
              setActiveAccount(activeAccount.id);
              setActiveSpace(null);
            }}
          />
        )}
        {topSpaces.length > 0 && <RailDivider />}
        {topSpaces.map((space) => (
          <SpaceButton
            key={space.roomId}
            space={space}
            client={activeClient}
            active={activeSpaceId === space.roomId}
            onClick={() => {
              setActiveSpace(activeSpaceId === space.roomId ? null : space.roomId);
            }}
          />
        ))}
        {otherAccounts.length > 0 && <RailDivider />}
        {otherAccounts.map((account) => {
          const client = accountManager.getClient(account.id);
          if (!client) return null;
          return (
            <AccountButton
              key={account.id}
              account={account}
              client={client}
              notifs={notifsFor(byAccount[account.id])}
              onClick={() => setActiveAccount(account.id)}
            />
          );
        })}
        <RailIconButton
          label="Add account"
          onClick={() => setLoginAnotherOpen(true)}
          icon={<Plus className="h-5 w-5" />}
        />
      </div>
    </nav>
  );
}

function HomeButton({
  account,
  active,
  onClick,
}: {
  account: AccountMetadata;
  active: boolean;
  onClick: () => void;
}) {
  const label = `Direct messages (${account.displayName ?? account.userId})`;
  return (
    <RailItem active={active}>
      <button
        type="button"
        onClick={onClick}
        title={label}
        aria-label={label}
        className={cn(
          'group flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-150 hover:rounded-xl',
          active
            ? 'rounded-xl bg-[var(--color-accent)] text-white'
            : 'bg-[var(--color-panel)] text-[var(--color-text-muted)] hover:bg-[var(--color-accent)] hover:text-white',
        )}
      >
        <Home className="h-5 w-5" />
      </button>
    </RailItem>
  );
}

function SpaceButton({
  space,
  client,
  active,
  onClick,
}: {
  space: RoomSummary;
  client: MatrixClient | null;
  active: boolean;
  onClick: () => void;
}) {
  const hasNotif = space.highlights > 0 || space.unread > 0;
  return (
    <RailItem active={active} unread={hasNotif && !active}>
      <button
        type="button"
        onClick={onClick}
        title={space.name}
        aria-label={space.name}
        className={cn(
          'group relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl transition-all duration-150 hover:rounded-xl',
          active
            ? 'rounded-xl ring-2 ring-inset ring-[var(--color-accent)]'
            : 'bg-[var(--color-panel)] text-[var(--color-text-muted)] hover:bg-[var(--color-accent)] hover:text-white',
        )}
      >
        <AuthedImage
          client={client}
          mxc={space.avatarMxc}
          width={48}
          height={48}
          className="h-full w-full object-cover"
          fallback={
            <span className="flex h-full w-full items-center justify-center font-semibold">
              {initialFrom(space.name)}
            </span>
          }
        />
      </button>
      {space.highlights > 0 && <RailHighlightBadge count={space.highlights} />}
    </RailItem>
  );
}

function AccountButton({
  account,
  client,
  notifs,
  onClick,
}: {
  account: AccountMetadata;
  client: MatrixClient;
  notifs: AccountNotifs;
  onClick: () => void;
}) {
  const hasUnread = notifs.unread > 0 || notifs.highlights > 0;
  const label = account.displayName ?? account.userId;
  return (
    <RailItem active={false} unread={hasUnread}>
      <button
        type="button"
        onClick={onClick}
        title={`Switch to ${label}`}
        aria-label={`Switch to ${label}`}
        className="group relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-[var(--color-panel)] text-[var(--color-text-muted)] transition-all duration-150 hover:rounded-xl hover:bg-[var(--color-accent)] hover:text-white"
      >
        <AuthedImage
          client={client}
          mxc={account.avatarUrl}
          width={48}
          height={48}
          className="h-full w-full object-cover"
          fallback={
            <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
              {initialFrom(label)}
            </span>
          }
        />
      </button>
      {notifs.highlights > 0 && <RailHighlightBadge count={notifs.highlights} />}
    </RailItem>
  );
}

function RailItem({
  active,
  unread,
  children,
}: {
  active: boolean;
  unread?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center justify-center">
      <ActivePill visible={active} unread={!!unread} />
      {children}
    </div>
  );
}

function ActivePill({ visible, unread }: { visible: boolean; unread: boolean }) {
  const height = visible ? 'h-8' : unread ? 'h-2' : 'h-0';
  return (
    <span
      aria-hidden
      className={cn(
        'absolute -left-2 w-1 rounded-r bg-[var(--color-text-strong)] transition-all duration-150',
        height,
      )}
    />
  );
}

function RailHighlightBadge({ count }: { count: number }) {
  return (
    <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-[var(--color-rail)]">
      {count > 9 ? '9+' : count}
    </span>
  );
}

function RailDivider() {
  return <div aria-hidden className="my-1 h-px w-8 rounded-full bg-[var(--color-divider)]" />;
}

function RailIconButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-rail-hover)] text-[var(--color-text-muted)] transition-all duration-150 hover:rounded-xl hover:bg-[var(--color-accent)] hover:text-white"
    >
      {icon}
    </button>
  );
}

function initialFrom(name: string): string {
  return name.replace(/^[#@]/, '').charAt(0).toUpperCase() || '?';
}
