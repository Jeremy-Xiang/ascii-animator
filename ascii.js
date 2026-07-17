/*!
 * ascii-animator — turn any image, emoji, or video into live animated ASCII art.
 * Zero dependencies. Canvas-rendered for speed and color; getText() returns the
 * plain-text frame for copy/paste.
 *
 * Usage:
 *   const art = new AsciiAnimator(document.querySelector('#out'), {
 *     cols: 120,                     // horizontal character resolution
 *     charset: ' .:-=+*#%@',        // dark → bright ramp
 *     color: 'mono',                // 'mono' (single ink) | 'source' (sampled)
 *     ink: '#4dff88',               // mono ink color
 *     background: '#0a0c0a',
 *     animation: 'dissolve',        // 'dissolve' | 'wave' | 'none'  (static sources)
 *     fontSize: 10,                 // px, canvas render size
 *   });
 *   await art.fromImage('portrait.jpg');   // or an <img>, File, Blob, canvas
 *   art.fromText('🔥', 280);               // emoji / glyph source
 *   await art.fromCamera();                // live webcam ASCII
 *   art.getText();                         // current frame as a string
 *   art.destroy();
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AsciiAnimator = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULTS = {
    cols: 120,
    charset: ' .:-=+*#%@',
    color: 'mono',
    ink: '#4dff88',
    background: '#0a0c0a',
    animation: 'dissolve',
    fontSize: 10,
    fps: 30,            // live-source sampling cap
    aspect: 0.52,       // monospace glyphs are ~half as wide as tall
  };

  class AsciiAnimator {
    constructor(canvas, opts = {}) {
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error('AsciiAnimator: pass a <canvas> element');
      }
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.opts = { ...DEFAULTS, ...opts };
      this.sample = document.createElement('canvas');
      this.sctx = this.sample.getContext('2d', { willReadFrequently: true });
      this.cells = null;        // {lum, r, g, b} per cell
      this.rows = 0;
      this.live = null;         // video element when in live mode
      this.stream = null;
      this._raf = 0;
      this._t0 = performance.now();
      this._lastLive = 0;
      this._reduced = typeof matchMedia === 'function'
        && matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /* ── sources ─────────────────────────────────────────── */

    async fromImage(src) {
      this._stopLive();
      let img = src;
      if (typeof src === 'string') {
        img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = src;
      } else if (src instanceof Blob) {
        img = new Image();
        img.src = URL.createObjectURL(src);
      }
      if (img instanceof Image && !img.complete) {
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      }
      this._grid(img.naturalWidth || img.width, img.naturalHeight || img.height);
      this._sampleFrom(img);
      this._restartAnimation();
      return this;
    }

    /** Render a text glyph (emoji!) as the source. */
    fromText(glyph, size = 280) {
      this._stopLive();
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const x = c.getContext('2d');
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.font = `${size * 0.8}px system-ui, sans-serif`;
      x.fillText(glyph, size / 2, size / 2 + size * 0.04);
      this._grid(size, size);
      this._sampleFrom(c);
      this._restartAnimation();
      return this;
    }

    /** Live webcam → ASCII. Resolves once frames are flowing. */
    async fromCamera(constraints = { video: { width: 640, height: 480 } }) {
      this._stopLive();
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      this.live = video;
      this.stream = stream;
      this._grid(video.videoWidth, video.videoHeight, true);
      this._restartAnimation();
      return this;
    }

    /* ── output ──────────────────────────────────────────── */

    /** Current frame as plain text (what's on screen, minus color). */
    getText() {
      if (!this.cells) return '';
      const { charset } = this.opts;
      let out = '';
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.opts.cols; x++) {
          const cell = this.cells[y * this.opts.cols + x];
          const i = Math.min(charset.length - 1, Math.round(cell.lum * (charset.length - 1)));
          out += charset[i];
        }
        out += '\n';
      }
      return out;
    }

    set(opts) {
      Object.assign(this.opts, opts);
      if (this.live) this._grid(this.live.videoWidth, this.live.videoHeight, true);
      else if (this._srcDims) this._grid(this._srcDims.w, this._srcDims.h);
      if (this._lastSource && !this.live) this._sampleFrom(this._lastSource);
      this._restartAnimation();
      return this;
    }

    destroy() {
      cancelAnimationFrame(this._raf);
      this._stopLive();
      this.cells = null;
    }

    /* ── internals ───────────────────────────────────────── */

    _stopLive() {
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
      this.live = null;
      this.stream = null;
    }

    _grid(w, h, mirror = false) {
      this._srcDims = { w, h };
      const cols = this.opts.cols;
      this.rows = Math.max(1, Math.round((h / w) * cols * this.opts.aspect));
      this.sample.width = cols;
      this.sample.height = this.rows;
      this.sctx.setTransform(1, 0, 0, 1, 0, 0);
      if (mirror) this.sctx.setTransform(-1, 0, 0, 1, cols, 0);
      const f = this.opts.fontSize;
      const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
      this.cellW = f * 0.6;
      this.cellH = f;
      this.canvas.width = cols * this.cellW * dpr;
      this.canvas.height = this.rows * this.cellH * dpr;
      this.canvas.style.width = `${cols * this.cellW}px`;
      this.canvas.style.height = `${this.rows * this.cellH}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.font = `${f}px ui-monospace, Menlo, monospace`;
      this.ctx.textBaseline = 'top';
    }

    _sampleFrom(source) {
      this._lastSource = source;
      const cols = this.opts.cols;
      this.sctx.clearRect(0, 0, cols, this.rows);
      this.sctx.drawImage(source, 0, 0, cols, this.rows);
      const data = this.sctx.getImageData(0, 0, cols, this.rows).data;
      const n = cols * this.rows;
      this.cells = new Array(n);
      for (let i = 0; i < n; i++) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
        const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 * (a / 255);
        this.cells[i] = {
          lum, r, g, b,
          delay: Math.random() * 1200,          // dissolve schedule, ms
          seed: (Math.random() * 94) | 0,       // scramble glyph
        };
      }
    }

    _restartAnimation() {
      cancelAnimationFrame(this._raf);
      this._t0 = performance.now();
      const loop = (now) => {
        this._raf = requestAnimationFrame(loop);
        if (this.live) {
          if (now - this._lastLive < 1000 / this.opts.fps) return;
          this._lastLive = now;
          if (this.live.videoWidth) this._sampleFrom(this.live);
          this._draw(now, 'live');
        } else {
          this._draw(now, this._reduced ? 'none' : this.opts.animation);
        }
      };
      this._raf = requestAnimationFrame(loop);
    }

    _draw(now, mode) {
      if (!this.cells) return;
      const { cols, charset, color, ink, background } = this.opts;
      const t = now - this._t0;
      const ctx = this.ctx;
      const ramp = charset.length - 1;

      ctx.fillStyle = background;
      ctx.fillRect(0, 0, cols * this.cellW, this.rows * this.cellH);

      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < cols; x++) {
          const cell = this.cells[y * cols + x];
          let lum = cell.lum;
          let ch = null;
          let alpha = 1;

          if (mode === 'dissolve' && t < cell.delay + 350) {
            if (t < cell.delay) {
              if (cell.lum < 0.04) continue;           // dark cells stay dark
              ch = charset[1 + ((cell.seed + ((t / 55) | 0)) % ramp)];
              alpha = 0.3;
            } else {
              alpha = 0.3 + 0.7 * ((t - cell.delay) / 350);
            }
          } else if (mode === 'wave') {
            lum = lum * (0.86 + 0.14 * Math.sin(x * 0.28 + y * 0.11 + t / 320));
          }

          if (lum < 0.03 && !ch) continue;
          if (!ch) ch = charset[Math.min(ramp, Math.round(lum * ramp))];
          if (ch === ' ') continue;

          if (color === 'source') {
            ctx.fillStyle = `rgba(${cell.r},${cell.g},${cell.b},${alpha})`;
          } else {
            ctx.fillStyle = alpha === 1 ? ink : this._inkAlpha(ink, alpha);
          }
          ctx.fillText(ch, x * this.cellW, y * this.cellH);
        }
      }
    }

    _inkAlpha(hex, a) {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }
  }

  return AsciiAnimator;
});
