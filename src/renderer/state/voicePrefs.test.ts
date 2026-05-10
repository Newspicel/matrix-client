import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_DEVICE, useDeafenStore, useVoicePrefs } from './voicePrefs';

beforeEach(() => {
  useVoicePrefs.setState({
    micDeviceId: DEFAULT_DEVICE,
    speakerDeviceId: DEFAULT_DEVICE,
    cameraDeviceId: DEFAULT_DEVICE,
    outputVolume: 1,
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
  });
  useDeafenStore.setState({ deafened: false });
});

describe('useVoicePrefs', () => {
  it('clamps output volume into [0, 2]', () => {
    useVoicePrefs.getState().setOutputVolume(-1);
    expect(useVoicePrefs.getState().outputVolume).toBe(0);
    useVoicePrefs.getState().setOutputVolume(5);
    expect(useVoicePrefs.getState().outputVolume).toBe(2);
    useVoicePrefs.getState().setOutputVolume(0.5);
    expect(useVoicePrefs.getState().outputVolume).toBe(0.5);
  });

  it('coerces NaN volume to 0', () => {
    useVoicePrefs.getState().setOutputVolume(Number.NaN);
    expect(useVoicePrefs.getState().outputVolume).toBe(0);
  });

  it('updates each device id independently', () => {
    useVoicePrefs.getState().setMicDevice('mic-1');
    useVoicePrefs.getState().setSpeakerDevice('spk-1');
    useVoicePrefs.getState().setCameraDevice('cam-1');
    const state = useVoicePrefs.getState();
    expect(state.micDeviceId).toBe('mic-1');
    expect(state.speakerDeviceId).toBe('spk-1');
    expect(state.cameraDeviceId).toBe('cam-1');
  });

  it('stores the audio processing toggles', () => {
    useVoicePrefs.getState().setNoiseSuppression(false);
    useVoicePrefs.getState().setEchoCancellation(false);
    useVoicePrefs.getState().setAutoGainControl(false);
    const s = useVoicePrefs.getState();
    expect(s.noiseSuppression).toBe(false);
    expect(s.echoCancellation).toBe(false);
    expect(s.autoGainControl).toBe(false);
  });
});

describe('useDeafenStore', () => {
  it('toggles deafened state', () => {
    expect(useDeafenStore.getState().deafened).toBe(false);
    useDeafenStore.getState().toggle();
    expect(useDeafenStore.getState().deafened).toBe(true);
    useDeafenStore.getState().toggle();
    expect(useDeafenStore.getState().deafened).toBe(false);
  });

  it('respects an explicit set', () => {
    useDeafenStore.getState().setDeafened(true);
    expect(useDeafenStore.getState().deafened).toBe(true);
    useDeafenStore.getState().setDeafened(false);
    expect(useDeafenStore.getState().deafened).toBe(false);
  });
});
