import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export interface SoundPlayer {
  tick(): void;
  chime(): void;
}

const TICK_VOICES = 4;

/**
 * Low-latency effects: sounds are preloaded once, and ticks rotate through a small
 * pool of players so rapid ticks overlap instead of cutting each other off.
 */
class ExpoSoundPlayer implements SoundPlayer {
  private ticks: AudioPlayer[] = [];
  private chimePlayer: AudioPlayer | null = null;
  private next = 0;
  private ready = false;

  private ensureLoaded() {
    if (this.ready) return;
    this.ready = true;
    // Like AVAudioSession.ambient: respects the silent switch and mixes with the user's music.
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(
      () => {},
    );
    for (let i = 0; i < TICK_VOICES; i++) {
      const p = createAudioPlayer(require('../../assets/sounds/tick.wav'));
      p.volume = 0.55;
      this.ticks.push(p);
    }
    this.chimePlayer = createAudioPlayer(require('../../assets/sounds/chime.wav'));
    this.chimePlayer.volume = 0.8;
  }

  preload() {
    this.ensureLoaded();
  }

  tick() {
    this.ensureLoaded();
    const p = this.ticks[this.next];
    this.next = (this.next + 1) % TICK_VOICES;
    if (!p) return;
    p.seekTo(0).catch(() => {});
    p.play();
  }

  chime() {
    this.ensureLoaded();
    const p = this.chimePlayer;
    if (!p) return;
    p.seekTo(0).catch(() => {});
    p.play();
  }
}

export const soundPlayer = new ExpoSoundPlayer();

export const silentPlayer: SoundPlayer = { tick() {}, chime() {} };
