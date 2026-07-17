# ascii-animator

Turn any **image, emoji, or your webcam** into live, animated ASCII art in the browser.
Zero dependencies, one script tag, canvas-rendered for speed — with a `getText()`
escape hatch when you want the actual characters.

**[Live demo →](https://jeremy-xiang.github.io/ascii-animator/)**

## Quick start

```html
<canvas id="out"></canvas>
<script src="ascii.js"></script>
<script>
  const art = new AsciiAnimator(document.getElementById('out'), {
    cols: 120,               // horizontal character resolution
    color: 'mono',           // 'mono' | 'source' (sample the image's colors)
    ink: '#4dff88',          // mono ink
    animation: 'dissolve',   // 'dissolve' | 'wave' | 'none'
  });

  art.fromText('🔥');                  // emoji / any glyph
  // await art.fromImage('me.jpg');    // URL, <img>, File, Blob, or canvas
  // await art.fromCamera();           // live webcam ASCII (user gesture + HTTPS)
</script>
```

## API

| Method | What it does |
|---|---|
| `new AsciiAnimator(canvas, opts)` | Attach to a `<canvas>`; see options below |
| `await art.fromImage(src)` | Source from a URL, `<img>`, `File`, `Blob`, or canvas |
| `art.fromText(glyph, size?)` | Source from a text glyph (emoji) rendered offscreen |
| `await art.fromCamera(constraints?)` | Live webcam → ASCII (stops any prior source) |
| `art.getText()` | Current frame as a plain string (copy/paste-able) |
| `art.set({ … })` | Change any option live (resolution, charset, color, animation) |
| `art.destroy()` | Stop the loop and release the camera |

### Options

| Option | Default | Notes |
|---|---|---|
| `cols` | `120` | Character grid width; rows derive from source aspect |
| `charset` | `' .:-=+*#%@'` | Dark→bright ramp; try `' ░▒▓█'` or `' 01'` |
| `color` | `'mono'` | `'source'` colors each glyph from the image pixel |
| `ink` / `background` | green / near-black | Mono mode colors |
| `animation` | `'dissolve'` | `dissolve` = scramble-in resolve; `wave` = idle shimmer; live video ignores this |
| `fontSize` | `10` | Canvas glyph size in px |
| `fps` | `30` | Live-source sampling cap |

## How it works

The source draws onto a tiny offscreen canvas at exactly `cols × rows` pixels; each
pixel's **relative luminance** (`0.2126R + 0.7152G + 0.0722B`, alpha-weighted) indexes
into the charset ramp, and glyphs render onto the visible canvas at your font size.
Rows are scaled by `0.52` to compensate for monospace glyphs being roughly half as
wide as they are tall. The `dissolve` animation gives every cell a random resolve
delay — before it locks, it flickers through scramble glyphs at low alpha, which is
what makes the image feel like it's *decoding* rather than fading in.

Respects `prefers-reduced-motion` (renders the final frame, no scramble).

## Lift it into your stack

- **React:** create the instance in a `useEffect(() => { … return () => art.destroy() }, [])`
  with a `ref` on the canvas.
- **Hero background:** `fromImage(yourPortrait)` + `animation: 'wave'`, low `cols` (80),
  `color: 'mono'` matching your accent — subtle and cheap.
- **Easter egg:** wire `fromCamera()` to a key combo; it needs a user gesture and HTTPS.

## License

MIT © Jeremy Xiang
