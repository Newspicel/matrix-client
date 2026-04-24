export function MemberList() {
  return (
    <aside
      className="hidden h-full w-60 shrink-0 flex-col bg-[var(--color-panel)] text-sm xl:flex"
      aria-label="Members"
    >
      <header className="flex h-12 items-center border-b border-[var(--color-divider)] px-4 font-semibold text-[var(--color-text-muted)] shadow-sm titlebar-drag">
        Members
      </header>
      <div className="flex-1 overflow-y-auto p-2 text-[var(--color-text-muted)]">
        <div className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide">
          Online — 0
        </div>
        <p className="px-2 pt-4 text-xs italic text-[var(--color-text-faint)]">No members — placeholder.</p>
      </div>
    </aside>
  );
}
