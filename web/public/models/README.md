# 3D machine models

Place the sewing-machine GLB at:

```
web/public/models/machine.glb
```

`MachineModel.jsx` loads this file when present and falls back to a
primitive silhouette if it is missing.

The real model can be large (tens of MB). Keep `.glb` files out of git;
copy locally (or from Netlify large-media storage) before `npm run dev`.
