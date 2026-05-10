import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore, viewKeyFor } from './ui';

function reset() {
  useUiStore.setState({
    theme: 'system',
    memberListOpen: true,
    threadRootId: null,
    replyToId: null,
    settingsOpen: false,
    loginAnotherOpen: false,
    commandPaletteOpen: false,
    startDmOpen: false,
    createRoomOpen: null,
    createSpaceOpen: null,
    roomSettingsForId: null,
    spaceSettingsForId: null,
    inviteForRoomId: null,
    lightbox: null,
    profileCard: null,
    lastRoomByView: {},
  });
}

describe('viewKeyFor', () => {
  it('returns the home key when no space is selected', () => {
    expect(viewKeyFor('acct1', null)).toBe('acct1::home');
  });

  it('returns a space-scoped key when a space id is given', () => {
    expect(viewKeyFor('acct1', '!s')).toBe('acct1::space::!s');
  });

  it('keeps account ids and space ids separated', () => {
    expect(viewKeyFor('a', null)).not.toBe(viewKeyFor('b', null));
    expect(viewKeyFor('a', '!s')).not.toBe(viewKeyFor('b', '!s'));
  });
});

describe('useUiStore', () => {
  beforeEach(reset);

  it('toggles the member list', () => {
    expect(useUiStore.getState().memberListOpen).toBe(true);
    useUiStore.getState().toggleMemberList();
    expect(useUiStore.getState().memberListOpen).toBe(false);
    useUiStore.getState().toggleMemberList();
    expect(useUiStore.getState().memberListOpen).toBe(true);
  });

  it('opens and closes the lightbox', () => {
    useUiStore.getState().openLightbox({ mxc: 'mxc://x/y' });
    expect(useUiStore.getState().lightbox).toEqual({ mxc: 'mxc://x/y' });
    useUiStore.getState().closeLightbox();
    expect(useUiStore.getState().lightbox).toBeNull();
  });

  it('remembers per-view room selection', () => {
    const key = viewKeyFor('a', null);
    useUiStore.getState().rememberRoomForView(key, '!room1');
    expect(useUiStore.getState().lastRoomByView[key]).toBe('!room1');
    useUiStore.getState().rememberRoomForView(key, '!room2');
    expect(useUiStore.getState().lastRoomByView[key]).toBe('!room2');
  });

  it('toggles the profile card off when re-opened for the same user', () => {
    const t = {
      userId: '@u:s',
      accountId: 'a',
      roomId: null,
      anchor: { x: 0, y: 0 },
    };
    useUiStore.getState().openProfileCard(t);
    expect(useUiStore.getState().profileCard?.userId).toBe('@u:s');
    useUiStore.getState().openProfileCard(t);
    expect(useUiStore.getState().profileCard).toBeNull();
  });

  it('replaces the profile card target when opened for a different user', () => {
    useUiStore.getState().openProfileCard({
      userId: '@u1:s',
      accountId: 'a',
      roomId: null,
      anchor: { x: 0, y: 0 },
    });
    useUiStore.getState().openProfileCard({
      userId: '@u2:s',
      accountId: 'a',
      roomId: null,
      anchor: { x: 1, y: 1 },
    });
    expect(useUiStore.getState().profileCard?.userId).toBe('@u2:s');
  });

  it('captures and reverts theme preference', () => {
    useUiStore.getState().setTheme('dark');
    expect(useUiStore.getState().theme).toBe('dark');
    useUiStore.getState().setTheme('light');
    expect(useUiStore.getState().theme).toBe('light');
    useUiStore.getState().setTheme('system');
    expect(useUiStore.getState().theme).toBe('system');
  });

  it('tracks reply and thread targets independently', () => {
    useUiStore.getState().setReplyTo('$reply');
    useUiStore.getState().setThreadRoot('$thread');
    expect(useUiStore.getState().replyToId).toBe('$reply');
    expect(useUiStore.getState().threadRootId).toBe('$thread');
    useUiStore.getState().setReplyTo(null);
    expect(useUiStore.getState().replyToId).toBeNull();
    expect(useUiStore.getState().threadRootId).toBe('$thread');
  });
});
