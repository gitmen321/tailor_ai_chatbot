# 3D machine models

`machine.glb` is the sewing machine shown on the splash screen. It **is**
committed to the repo — Netlify builds only ship what is in git, and without
the file the app silently falls back to a primitive box silhouette.

## Budget

The splash screen blocks on this file, so it has to arrive within a few
seconds on a phone. Keep it **under ~1.5 MB**. An earlier 5.5 MB version never
finished downloading before the splash timed out, so users only ever saw an
empty tile.

It is also preloaded from `index.html` and precached by the service worker, so
growing it slows down first paint and the PWA install alike.

## Re-generating from a source model

The Sketchfab export is ~59 MB, almost entirely twelve 2048x2048 textures
(mostly uncompressed PNG):

```bash
npx @gltf-transform/cli resize <source>.glb a.glb --width 512 --height 512
npx @gltf-transform/cli webp a.glb b.glb --quality 78
npx @gltf-transform/cli prune b.glb c.glb
npx @gltf-transform/cli weld c.glb w.glb
npx @gltf-transform/cli simplify w.glb s.glb --ratio 0.4 --error 0.001
npx @gltf-transform/cli meshopt s.glb web/public/models/machine.glb --level high
```

That takes 59 MB to ~1.2 MB with no visible difference at the size the model is
rendered, and cuts GPU memory from ~67 MB to ~17 MB, which matters on older
phones. Meshopt needs a decoder at runtime, but drei's `useGLTF` enables it by
default, so no extra setup is required.

The model is normalised to a fixed size at runtime (see `MachineModel.jsx`), so
a replacement does not need to match this one's scale to be framed correctly.

Keep raw source exports out of git; name them `*-source.glb` or `*.raw.glb`,
which are gitignored.
