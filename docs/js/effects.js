// Demo effects. Each effect fills `out` (RGB 0..1, one triple per pixel in DMX order).
// Pixel order = universe/address order, so a "chase" here runs the way data flows
// through the real daisy chain.

export function hsv(h, s, v) {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
}

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const put = (out, i, c, k = 1) => { out[i * 3] = c[0] * k; out[i * 3 + 1] = c[1] * k; out[i * 3 + 2] = c[2] * k; };

export const EFFECTS = {
  rainbow: {
    label: 'Rainbow chase',
    run({ t, speed, px, out }) {
      const n = px.length;
      for (let i = 0; i < n; i++) put(out, i, hsv(i / n * 3 - t * speed * 0.35, 1, 1));
    },
  },
  pulse: {
    label: 'Pulse',
    run({ t, speed, px, out }) {
      const hue = t * speed * 0.05;
      const phase = { A: 0, B: Math.PI, O: Math.PI / 2 };
      for (let i = 0; i < px.length; i++) {
        const p = px[i];
        const v = 0.5 + 0.5 * Math.sin(t * speed * 3 + phase[p.shape] - p.pos[1] * 1.5);
        put(out, i, hsv(hue + (p.shape === 'O' ? 0.33 : 0), 0.85, v * v));
      }
    },
  },
  shapes: {
    label: 'Shape colours',
    run({ t, speed, px, out, shapeColors }) {
      for (let i = 0; i < px.length; i++) {
        const p = px[i];
        const breathe = 0.78 + 0.22 * Math.sin(t * speed * 1.6 + p.pos[1] * 2.2);
        put(out, i, shapeColors[p.shape], breathe);
      }
    },
  },
  strobe: {
    label: 'Strobe',
    flashing: true,
    run({ t, speed, px, out }) {
      const hz = Math.min(10, Math.max(1, speed * 4)); // capped at 10 Hz
      const on = (t * hz) % 1 < 0.22;
      out.fill(on ? 1 : 0, 0, px.length * 3);
      return `${hz.toFixed(1)} Hz`;
    },
  },
  audio: {
    label: 'Audio reactive',
    run({ t, px, out, shapeColors, audio }) {
      const band = { A: audio.mid, B: audio.treble, O: audio.bass };
      const wave = audio.level;
      for (let i = 0; i < px.length; i++) {
        const p = px[i];
        const r = Math.hypot(...p.pos);
        const ring = Math.max(0, 1 - Math.abs(r - wave * 1.6) * 2.5) * wave;
        const v = Math.min(1, band[p.shape] * 1.1 + ring * 0.6);
        const c = shapeColors[p.shape];
        const glint = 0.15 * Math.max(0, Math.sin(t * 7 + i));
        put(out, i, [c[0] + glint * audio.treble, c[1] + glint * audio.treble, c[2] + glint * audio.treble], v);
      }
    },
  },
  address: {
    label: 'Address test',
    run({ t, speed, px, out, model }) {
      const step = Math.floor(t * speed * 1.5) % model.chain.length;
      const c = model.chain[step];
      for (let i = 0; i < px.length; i++) {
        const p = px[i];
        if (p.order === step) put(out, i, hsv(p.local / (model.variant.pixelsPerTube * 1.4), 1, 1));
        else put(out, i, [0.06, 0.06, 0.08]);
      }
      return `U${c.universe} @${c.startAddress} · ${model.tubes[c.tubeIndex].id} (${c.from}→${c.to})`;
    },
  },
};
