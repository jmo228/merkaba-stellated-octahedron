// Audio input for the audio-reactive mode: the microphone (Web Audio) when permitted,
// otherwise a simulated 120 BPM beat so the effect still demonstrates itself.

export class AudioInput {
  constructor() {
    this.mode = 'sim';
    this.ctx = null; this.analyser = null; this.bins = null; this.stream = null;
    this.peak = { bass: 0.2, mid: 0.2, treble: 0.2 };
    this.out = { bass: 0, mid: 0, treble: 0, level: 0 };
  }

  async startMic() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no microphone access (needs HTTPS).');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.6;
    src.connect(this.analyser);
    this.bins = new Uint8Array(this.analyser.frequencyBinCount);
    this.mode = 'mic';
  }

  stopMic() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.ctx?.close();
    this.ctx = this.analyser = this.stream = null;
    this.mode = 'sim';
  }

  // returns bands 0..1 with simple auto-gain
  read(t) {
    let raw;
    if (this.mode === 'mic' && this.analyser) {
      this.analyser.getByteFrequencyData(this.bins);
      const hzPerBin = this.ctx.sampleRate / this.analyser.fftSize;
      const avg = (lo, hi) => {
        const a = Math.max(1, Math.floor(lo / hzPerBin)), b = Math.min(this.bins.length - 1, Math.ceil(hi / hzPerBin));
        let s = 0; for (let i = a; i <= b; i++) s += this.bins[i];
        return s / (b - a + 1) / 255;
      };
      raw = { bass: avg(30, 160), mid: avg(160, 2000), treble: avg(2000, 9000) };
    } else {
      const beat = (t * 2) % 1;                       // 120 BPM
      const kick = Math.exp(-beat * 7);
      const snare = ((t * 2 + 0.5) % 2) < 1 ? Math.exp(-((t * 2 + 0.5) % 1) * 9) : 0;
      const hat = Math.exp(-((t * 8) % 1) * 12) * (0.5 + 0.5 * Math.sin(t * 13));
      raw = { bass: kick, mid: 0.25 + 0.6 * snare + 0.1 * Math.sin(t * 1.3), treble: 0.2 + 0.7 * hat };
    }
    for (const k of ['bass', 'mid', 'treble']) {
      this.peak[k] = Math.max(raw[k], this.peak[k] * 0.995, 0.08);
      const v = Math.min(1, raw[k] / this.peak[k]);
      this.out[k] = v > this.out[k] ? v : this.out[k] * 0.86 + v * 0.14;
    }
    this.out.level = (this.out.bass * 0.5 + this.out.mid * 0.3 + this.out.treble * 0.2);
    return this.out;
  }
}
