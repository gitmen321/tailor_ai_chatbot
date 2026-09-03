# 3D machine models

`machine.glb` is the sewing machine shown on the splash screen. It **is**
committed to the repo — Netlify builds only ship what is in git, and without
the file the app silently falls back to a primitive box silhouette.

## Re-generating from a source model

The Sketchfab export is ~59 MB, almost entirely twelve 2048x2048 textures
(mostly uncompressed PNG). That is far too large to download on a phone, so it
is optimized before being committed:

```bash
npx @gltf-transform/cli optimize <source>.glb web/public/models/machine.glb \
  --texture-size 1024 --texture-compress webp --compress quantize --simplify false
```

That takes it from 59 MB to ~5.5 MB with no visible difference at the size the
model is rendered. `--compress quantize` is used instead of Draco or Meshopt
because it needs no extra decoder at runtime.

Keep raw source exports out of git; name them `*-source.glb` or `*.raw.glb`,
which are gitignored.
