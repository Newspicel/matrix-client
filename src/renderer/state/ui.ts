import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LightboxImage {
  mxc?: string | null;
  file?: unknown;
  mimetype?: string | undefined;
  alt?: string;
}

export interface ProfileCardAnchor {
  x: number;
  y: number;
}

export interface ProfileCardTarget {
  userId: string;
  accountId: string;
  roomId: string | null;
  anchor: ProfileCardAnchor;
}

const DEFAULT_REACTIONS = ['👍', '❤️', '😂', '🎉', '🙏'];

interface UiState {
  memberListOpen: boolean;
  toggleMemberList: () => void;
  setMemberListOpen: (open: boolean) => void;

  threadRootId: string | null;
  setThreadRoot: (id: string | null) => void;

  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;

  loginAnotherOpen: boolean;
  setLoginAnotherOpen: (open: boolean) => void;

  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  lightbox: LightboxImage | null;
  openLightbox: (image: LightboxImage) => void;
  closeLightbox: () => void;

  profileCard: ProfileCardTarget | null;
  openProfileCard: (target: ProfileCardTarget) => void;
  closeProfileCard: () => void;

  // Persisted: user's preferred quick-reaction emoji list.
  quickReactions: string[];
  setQuickReactions: (list: string[]) => void;

  // Persisted: last-selected room per "view". The key is
  //   `${accountId}::space::${spaceRoomId}` or `${accountId}::home`
  // so home vs each space each get their own memory.
  lastRoomByView: Record<string, string>;
  rememberRoomForView: (key: string, roomId: string) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      memberListOpen: true,
      toggleMemberList: () => set((s) => ({ memberListOpen: !s.memberListOpen })),
      setMemberListOpen: (open) => set({ memberListOpen: open }),

      threadRootId: null,
      setThreadRoot: (id) => set({ threadRootId: id }),

      settingsOpen: false,
      setSettingsOpen: (open) => set({ settingsOpen: open }),

      loginAnotherOpen: false,
      setLoginAnotherOpen: (open) => set({ loginAnotherOpen: open }),

      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

      lightbox: null,
      openLightbox: (image) => set({ lightbox: image }),
      closeLightbox: () => set({ lightbox: null }),

      profileCard: null,
      openProfileCard: (target) => set({ profileCard: target }),
      closeProfileCard: () => set({ profileCard: null }),

      quickReactions: DEFAULT_REACTIONS,
      setQuickReactions: (list) => set({ quickReactions: list }),

      lastRoomByView: {},
      rememberRoomForView: (key, roomId) =>
        set((s) => ({ lastRoomByView: { ...s.lastRoomByView, [key]: roomId } })),
    }),
    {
      name: 'ui',
      partialize: (state) => ({
        quickReactions: state.quickReactions,
        lastRoomByView: state.lastRoomByView,
        memberListOpen: state.memberListOpen,
      }),
    },
  ),
);

export function viewKeyFor(accountId: string, spaceId: string | null): string {
  return spaceId ? `${accountId}::space::${spaceId}` : `${accountId}::home`;
}
