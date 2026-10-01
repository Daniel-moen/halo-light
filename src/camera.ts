/**
 * Optional mirrored self-view. The stream never leaves the page, and every
 * track is stopped the moment the preview is hidden (or the page goes into the
 * background) so Zoom, Teams or Meet can take the camera.
 */
export class CameraPreview {
  private stream: MediaStream | null = null;
  private starting = false;

  constructor(private video: HTMLVideoElement, private onChange: (on: boolean) => void) {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop();
    });
    window.addEventListener('pagehide', () => this.stop());
  }

  get on() {
    return this.stream !== null;
  }

  static supported() {
    return !!navigator.mediaDevices?.getUserMedia;
  }

  async toggle(): Promise<string | null> {
    if (this.on) {
      this.stop();
      return null;
    }
    return this.start();
  }

  async start(): Promise<string | null> {
    if (this.on || this.starting) return null;
    if (!CameraPreview.supported()) {
      return window.isSecureContext
        ? 'This browser has no camera access.'
        : 'Camera preview needs HTTPS (or localhost).';
    }
    this.starting = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      // Hidden while the permission prompt was up? Release straight away.
      if (document.hidden) {
        stream.getTracks().forEach((t) => t.stop());
        return null;
      }
      this.stream = stream;
      this.video.srcObject = stream;
      await this.video.play().catch(() => {});
      this.onChange(true);
      return null;
    } catch (e) {
      const name = (e as DOMException)?.name;
      return name === 'NotAllowedError'
        ? 'Camera permission was denied.'
        : name === 'NotFoundError'
          ? 'No camera found.'
          : name === 'NotReadableError'
            ? 'The camera is busy in another app.'
            : 'Could not start the camera.';
    } finally {
      this.starting = false;
    }
  }

  stop() {
    if (!this.stream) return;
    this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.onChange(false);
  }
}
