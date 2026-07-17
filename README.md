# ascii-animator

Turn any **image, video, emoji, or your webcam** into live, animated ASCII art in the
browser. Zero dependencies, one script tag, canvas-rendered for speed — with a
`getText()` escape hatch when you want the actual characters, and `downloadPNG()` /
`downloadText()` when you want a file.

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
    animation: 'dissolve',   // 'dissolve' | 'wave' | 'typewriter' | 'none'
    edges: false,            // true = Sobel line art instead of a luminance ramp
  });

  art.fromText('🔥');                  // emoji / any glyph
  // await art.fromImage('me.jpg');    // URL, <img>, File, Blob, or canvas
  // await art.fromVideo('clip.mp4');  // any video file/URL/Blob, loops, muted autoplay
  // await art.fromCamera();           // live webcam ASCII (user gesture + HTTPS)
</script>
```

## API

| Method | What it does |
|---|---|
| `new AsciiAnimator(canvas, opts)` | Attach to a `<canvas>`; see options below |
| `await art.fromImage(src)` | Source from a URL, `<img>`, `File`, `Blob`, or canvas |
| `art.fromText(glyph, size?)` | Source from a text glyph (emoji) rendered offscreen |
| `await art.fromVideo(src)` | Source from a video URL, `File`, or `Blob` — loops, muted, not mirrored |
| `await art.fromCamera(constraints?)` | Live webcam → ASCII, mirrored (stops any prior source) |
| `art.pause()` / `art.play()` | Freeze on the current frame / resume (pauses video too) |
| `art.getText()` | Current frame as a plain string (copy/paste-able) |
| `art.downloadPNG(filename?)` | Save the rendered canvas as a `.png` |
| `art.downloadText(filename?)` | Save the current frame as a `.txt` |
| `art.set({ … })` | Change any option live (resolution, charset, color, animation, edges) |
| `art.destroy()` | Stop the loop and release the camera |

### Options

| Option | Default | Notes |
|---|---|---|
| `cols` | `120` | Character grid width; rows derive from source aspect |
| `charset` | `' .:-=+*#%@'` | Dark→bright ramp; try `' ░▒▓█'` or `' 01'` |
| `color` | `'mono'` | `'source'` colors each glyph from the image pixel |
| `ink` / `background` | green / near-black | Mono mode colors |
| `animation` | `'dissolve'` | `dissolve` = scramble-in resolve; `wave` = idle shimmer; `typewriter` = row-by-row reveal with a blinking cursor; live sources always use their own frame-driven reveal |
| `edges` | `false` | Renders a live Sobel-edge line-art look instead of the luminance ramp — works with any source, live or static |
| `fontSize` | `10` | Canvas glyph size in px |
| `fps` | `30` | Live-source (camera/video) sampling cap |

## How it works

The source draws onto a tiny offscreen canvas at exactly `cols × rows` pixels; each
pixel's **relative luminance** (`0.2126R + 0.7152G + 0.0722B`, alpha-weighted) indexes
into the charset ramp, and glyphs render onto the visible canvas at your font size.
Rows are scaled by `0.52` to compensate for monospace glyphs being roughly half as
wide as they are tall. The `dissolve` animation gives every cell a random resolve
delay — before it locks, it flickers through scramble glyphs at low alpha, which is
what makes the image feel like it's *decoding* rather than fading in. `typewriter`
instead reveals whole rows in order, holding a blinking block at the write head.

With `edges: true`, a Sobel operator runs over the luminance grid after every sample
to get a gradient magnitude per cell, normalized to the frame's own max — so it's a
live line-art mode that works on video and the camera, not just stills.

Respects `prefers-reduced-motion` (renders the final frame, no scramble/typewriter).

## Lift it into your stack

- **React:** create the instance in a `useEffect(() => { … return () => art.destroy() }, [])`
  with a `ref` on the canvas.
- **Hero background:** `fromImage(yourPortrait)` + `animation: 'wave'`, low `cols` (80),
  `color: 'mono'` matching your accent — subtle and cheap.
- **Easter egg:** wire `fromCamera()` to a key combo; it needs a user gesture and HTTPS.
- **Muted background video:** `fromVideo(url)` + `edges: true` reads as a moody line-art
  loop instead of a literal video — cheaper to look at than the real footage.
- **Export:** `downloadPNG()` after a `dissolve` finishes makes a shareable "decoded"
  still; `downloadText()` gets you the raw characters for a terminal splash or email sig.

## License

MIT © Jeremy Xiang
