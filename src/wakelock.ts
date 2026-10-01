/** Keep the display awake while the light is showing. */
export class WakeLock {
  private sentinel: WakeLockSentinel | null = null;

  constructor(private onChange: (held: boolean) => void) {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.acquire();
    });
    // Some browsers only grant the lock after a user gesture.
    const retry = () => { if (!this.sentinel) this.acquire(); };
    window.addEventListener('pointerdown', retry, { passive: true });
    window.addEventListener('keydown', retry);
  }

  static supported() {
    return 'wakeLock' in navigator;
  }

  async acquire() {
    if (!WakeLock.supported() || this.sentinel || document.hidden) return;
    try {
      const s = await navigator.wakeLock.request('screen');
      this.sentinel = s;
      this.onChange(true);
      s.addEventListener('release', () => {
        if (this.sentinel === s) this.sentinel = null;
        this.onChange(false);
      });
    } catch {
      this.onChange(false);
    }
  }
}
