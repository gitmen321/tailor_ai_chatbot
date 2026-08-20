import { createContext, useContext, useMemo, useState } from "react";

const STORAGE_KEY = "tailor_chat_wallpaper";
const CUSTOM_STORAGE_KEY = "tailor_chat_wallpaper_custom";

export const WALLPAPERS = [
  {
    id: "linen",
    label: "Linen",
    labelMl: "ലിനൻ",
    preview: "var(--wallpaper-linen)",
  },
  {
    id: "stitch",
    label: "Stitch",
    labelMl: "സ്റ്റിച്ച്",
    preview: "var(--wallpaper-stitch)",
  },
  {
    id: "thread",
    label: "Thread",
    labelMl: "ത്രെഡ്",
    preview: "var(--wallpaper-thread)",
  },
  {
    id: "soft-teal",
    label: "Soft teal",
    labelMl: "ടീൽ",
    preview: "var(--wallpaper-soft-teal)",
  },
  {
    id: "warm-plain",
    label: "Warm plain",
    labelMl: "സാധാരണം",
    preview: "var(--wallpaper-warm-plain)",
  },
];

const WallpaperContext = createContext(null);

async function fileToWallpaperDataUrl(file) {
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Image is too large. Please choose a photo under 8 MB.");
  }

  const bitmap = await createImageBitmap(file);
  const maxDim = 1200;
  let { width, height } = bitmap;

  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.85;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  const maxLen = 1_400_000;

  while (dataUrl.length > maxLen && quality > 0.45) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  if (dataUrl.length > maxLen) {
    throw new Error("Photo is too large to save. Try a smaller image.");
  }

  return dataUrl;
}

function readSavedWallpaperId(customSaved) {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "custom" && customSaved) return "custom";
  return WALLPAPERS.some((w) => w.id === saved) ? saved : "linen";
}

export function WallpaperProvider({ children }) {
  const [customWallpaper, setCustomWallpaper] = useState(
    () => localStorage.getItem(CUSTOM_STORAGE_KEY) || null
  );
  const [wallpaperId, setWallpaperIdState] = useState(() =>
    readSavedWallpaperId(localStorage.getItem(CUSTOM_STORAGE_KEY))
  );

  const value = useMemo(() => {
    const isCustom = wallpaperId === "custom" && customWallpaper;

    const wallpaperStyle = isCustom
      ? { backgroundImage: `url(${customWallpaper})` }
      : undefined;

    const wallpaperClass = isCustom
      ? "wallpaper-custom"
      : `wallpaper-${wallpaperId}`;

    return {
      wallpaperId,
      customWallpaper,
      wallpaper:
        isCustom
          ? { id: "custom", label: "Custom", labelMl: "സ്വന്തം" }
          : WALLPAPERS.find((w) => w.id === wallpaperId) ?? WALLPAPERS[0],
      wallpaperStyle,
      wallpaperClass,
      setWallpaperId: (id) => {
        if (id === "custom") {
          if (!customWallpaper) return;
          setWallpaperIdState("custom");
          localStorage.setItem(STORAGE_KEY, "custom");
          return;
        }
        if (!WALLPAPERS.some((w) => w.id === id)) return;
        setWallpaperIdState(id);
        localStorage.setItem(STORAGE_KEY, id);
      },
      setCustomWallpaperFromFile: async (file) => {
        const dataUrl = await fileToWallpaperDataUrl(file);
        setCustomWallpaper(dataUrl);
        setWallpaperIdState("custom");
        localStorage.setItem(CUSTOM_STORAGE_KEY, dataUrl);
        localStorage.setItem(STORAGE_KEY, "custom");
      },
      clearCustomWallpaper: () => {
        setCustomWallpaper(null);
        localStorage.removeItem(CUSTOM_STORAGE_KEY);
        const fallback = "linen";
        setWallpaperIdState(fallback);
        localStorage.setItem(STORAGE_KEY, fallback);
      },
    };
  }, [wallpaperId, customWallpaper]);

  return (
    <WallpaperContext.Provider value={value}>
      {children}
    </WallpaperContext.Provider>
  );
}

export function useWallpaper() {
  const ctx = useContext(WallpaperContext);
  if (!ctx) throw new Error("useWallpaper must be used within WallpaperProvider");
  return ctx;
}
