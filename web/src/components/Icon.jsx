/**
 * Stroke icon set drawn on a 24x24 grid so weights stay consistent at any size.
 * Replaces emoji glyphs, which render differently on every platform.
 */
const PATHS = {
  "volume-on": (
    <>
      <path d="M11 5.5 6.6 9.2H3.8a.8.8 0 0 0-.8.8v4a.8.8 0 0 0 .8.8h2.8L11 18.5a.6.6 0 0 0 1-.46V5.96a.6.6 0 0 0-1-.46Z" />
      <path d="M15.6 9.4a3.6 3.6 0 0 1 0 5.2" />
      <path d="M18.3 6.6a7.4 7.4 0 0 1 0 10.8" />
    </>
  ),
  "volume-off": (
    <>
      <path d="M11 5.5 6.6 9.2H3.8a.8.8 0 0 0-.8.8v4a.8.8 0 0 0 .8.8h2.8L11 18.5a.6.6 0 0 0 1-.46V5.96a.6.6 0 0 0-1-.46Z" />
      <path d="m16.5 9.75 4.5 4.5" />
      <path d="m21 9.75-4.5 4.5" />
    </>
  ),
  stop: <rect x="6.75" y="6.75" width="10.5" height="10.5" rx="2.6" fill="currentColor" stroke="none" />,
  trash: (
    <>
      <path d="M4.5 6.75h15" />
      <path d="M9.25 6.75V5.4A1.4 1.4 0 0 1 10.65 4h2.7a1.4 1.4 0 0 1 1.4 1.4v1.35" />
      <path d="m6.9 6.75.79 11.4A1.9 1.9 0 0 0 9.58 20h4.84a1.9 1.9 0 0 0 1.9-1.85l.78-11.4" />
      <path d="M10.4 10.6v5.6M13.6 10.6v5.6" />
    </>
  ),
  user: (
    <>
      <path d="M12 11.6a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6Z" />
      <path d="M4.6 20.2a7.4 7.4 0 0 1 14.8 0" />
    </>
  ),
  settings: (
    <>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.2 14.4a1.5 1.5 0 0 0 .3 1.65l.06.05a1.82 1.82 0 1 1-2.58 2.58l-.05-.06a1.5 1.5 0 0 0-1.65-.3 1.5 1.5 0 0 0-.9 1.37v.16a1.82 1.82 0 1 1-3.64 0v-.09a1.5 1.5 0 0 0-.98-1.37 1.5 1.5 0 0 0-1.65.3l-.05.06A1.82 1.82 0 1 1 5.48 16.2l.06-.05a1.5 1.5 0 0 0 .3-1.65 1.5 1.5 0 0 0-1.37-.9h-.16a1.82 1.82 0 1 1 0-3.64h.09a1.5 1.5 0 0 0 1.37-.98 1.5 1.5 0 0 0-.3-1.65l-.06-.05A1.82 1.82 0 1 1 7.99 4.7l.05.06a1.5 1.5 0 0 0 1.65.3h.07a1.5 1.5 0 0 0 .91-1.37v-.16a1.82 1.82 0 1 1 3.64 0v.09a1.5 1.5 0 0 0 .9 1.37 1.5 1.5 0 0 0 1.66-.3l.05-.06a1.82 1.82 0 1 1 2.58 2.58l-.06.05a1.5 1.5 0 0 0-.3 1.65v.07a1.5 1.5 0 0 0 1.37.91h.16a1.82 1.82 0 1 1 0 3.64h-.09a1.5 1.5 0 0 0-1.37.9Z" />
    </>
  ),
  "arrow-left": (
    <>
      <path d="M19 12H5.2" />
      <path d="m11 18.4-6.4-6.4L11 5.6" />
    </>
  ),
  camera: (
    <>
      <path d="M3 9.4a2.6 2.6 0 0 1 2.6-2.6h1.5a1.6 1.6 0 0 0 1.33-.71l.67-1a1.6 1.6 0 0 1 1.33-.71h3.14a1.6 1.6 0 0 1 1.33.71l.67 1a1.6 1.6 0 0 0 1.33.71h1.5A2.6 2.6 0 0 1 21 9.4v7.4a2.6 2.6 0 0 1-2.6 2.6H5.6A2.6 2.6 0 0 1 3 16.8Z" />
      <path d="M12 16.1a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6Z" />
    </>
  ),
  mic: (
    <>
      <path d="M12 3.2a2.9 2.9 0 0 0-2.9 2.9v5.3a2.9 2.9 0 1 0 5.8 0V6.1A2.9 2.9 0 0 0 12 3.2Z" />
      <path d="M5.6 11.1a6.4 6.4 0 0 0 12.8 0" />
      <path d="M12 17.5v3.3" />
    </>
  ),
  send: (
    <>
      <path d="M21.35 2.65 2.9 9.9a.62.62 0 0 0 .04 1.17l7.34 2.36a1 1 0 0 1 .64.64l2.36 7.34a.62.62 0 0 0 1.17.04Z" />
      <path d="M21.35 2.65 10.32 13.68" />
    </>
  ),
  close: (
    <>
      <path d="m6.4 6.4 11.2 11.2" />
      <path d="M17.6 6.4 6.4 17.6" />
    </>
  ),
  play: (
    <>
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
      <path d="m10.4 8.7 5 3.3-5 3.3Z" fill="currentColor" />
    </>
  ),
  refresh: (
    <>
      <path d="M20.2 12a8.2 8.2 0 1 1-2.4-5.8" />
      <path d="M20.4 4v4.4H16" />
    </>
  ),
  check: <path d="m5.2 12.6 4.6 4.6L18.8 7.4" />,
  "chevron-right": <path d="m9.6 5.4 6.6 6.6-6.6 6.6" />,
  sun: (
    <>
      <path d="M12 16.6a4.6 4.6 0 1 0 0-9.2 4.6 4.6 0 0 0 0 9.2Z" />
      <path d="M12 2.2v1.9M12 19.9v1.9M4.07 4.07l1.35 1.35M18.58 18.58l1.35 1.35M2.2 12h1.9M19.9 12h1.9M4.07 19.93l1.35-1.35M18.58 5.42l1.35-1.35" />
    </>
  ),
  moon: <path d="M20.4 14.3A8.6 8.6 0 0 1 9.7 3.6a8.6 8.6 0 1 0 10.7 10.7Z" />,
  monitor: (
    <>
      <rect x="2.8" y="4.2" width="18.4" height="12.2" rx="2.2" />
      <path d="M8.6 20.4h6.8M12 16.4v4" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.4v11.2" />
      <path d="m7.6 10.2 4.4 4.4 4.4-4.4" />
      <path d="M4.4 17.6v1.4a1.8 1.8 0 0 0 1.8 1.8h11.6a1.8 1.8 0 0 0 1.8-1.8v-1.4" />
    </>
  ),
  share: (
    <>
      <path d="M12 15.2V3.4" />
      <path d="m8.2 7.2 3.8-3.8 3.8 3.8" />
      <path d="M5.2 11.6v7.2a2 2 0 0 0 2 2h9.6a2 2 0 0 0 2-2v-7.2" />
    </>
  ),
  image: (
    <>
      <rect x="3.2" y="4.6" width="17.6" height="14.8" rx="2.6" />
      <path d="M9 10.6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
      <path d="m3.6 16.6 4.3-4.1a2 2 0 0 1 2.7-.05l3.2 2.85a2 2 0 0 0 2.62.02l4.16-3.4" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3.2 13.7 8a2 2 0 0 0 1.2 1.2l4.8 1.7-4.8 1.7A2 2 0 0 0 13.7 14L12 18.8 10.3 14a2 2 0 0 0-1.2-1.2L4.3 11l4.8-1.7A2 2 0 0 0 10.3 8Z" />
      <path d="M18.6 16.4 19.2 18l1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6Z" />
    </>
  ),
  palette: (
    <>
      <path d="M12 20.8a8.8 8.8 0 1 1 8.8-8.8c0 2-1.7 2.9-3.2 2.9h-1.5a2.1 2.1 0 0 0-1.6 3.5 1.7 1.7 0 0 1-1.3 2.4Z" />
      <path d="M7.7 12.4a1.15 1.15 0 1 0 0-2.3 1.15 1.15 0 0 0 0 2.3ZM10.4 8.3a1.15 1.15 0 1 0 0-2.3 1.15 1.15 0 0 0 0 2.3ZM15.4 8.8a1.15 1.15 0 1 0 0-2.3 1.15 1.15 0 0 0 0 2.3Z" fill="currentColor" stroke="none" />
    </>
  ),
  needle: (
    <>
      <path d="M20.4 3.6 9.8 14.2" />
      <path d="m8.1 12.5 3.4 3.4-4.6 1.2Z" />
      <path d="M17.8 6.2c-2.6-1.5-5.2-.7-5.9 1.4-.6 1.9 1.6 3 2.9 1.8 1-1 .4-2.6-1.2-2.8-2.6-.3-4.8 1.9-4.5 4.4" />
    </>
  ),
  machine: (
    <>
      <path d="M3.4 15.6h17.2a.8.8 0 0 0 .8-.8v-1.4a.8.8 0 0 0-.8-.8H3.4a.8.8 0 0 0-.8.8v1.4a.8.8 0 0 0 .8.8Z" />
      <path d="M6.2 12.6V7.4a2 2 0 0 1 2-2h9.2a2 2 0 0 1 2 2v1.2" />
      <path d="M16.6 8.6v2.6M16.6 12.6v1.4" />
      <path d="M4.6 15.6v1.8a1.6 1.6 0 0 0 1.6 1.6h11.6a1.6 1.6 0 0 0 1.6-1.6v-1.8" />
    </>
  ),
  waveform: (
    <>
      <path d="M4 10.6v2.8M8 7.6v8.8M12 4.8v14.4M16 8.4v7.2M20 11v2" />
    </>
  ),
  clock: (
    <>
      <path d="M12 20.8a8.8 8.8 0 1 0 0-17.6 8.8 8.8 0 0 0 0 17.6Z" />
      <path d="M12 7.2V12l3 1.8" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.2 4.8 6v5.4c0 4.3 2.9 8.3 7.2 9.4 4.3-1.1 7.2-5.1 7.2-9.4V6Z" />
      <path d="m9.2 11.9 2 2 3.6-3.9" />
    </>
  ),
};

export default function Icon({ name, size = 20, className = "", ...rest }) {
  const content = PATHS[name];
  if (!content) return null;

  return (
    <svg
      className={`ui-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {content}
    </svg>
  );
}

/** Brand mark: needle + thread loop inside a jewelled tile. */
export function BrandMark({ size = 40, className = "" }) {
  return (
    <svg
      className={`brand-mark ${className}`}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="bm-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent-bright)" />
          <stop offset="100%" stopColor="var(--accent-deep)" />
        </linearGradient>
        <linearGradient id="bm-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.38" />
          <stop offset="60%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#bm-tile)" />
      <rect width="48" height="48" rx="14" fill="url(#bm-sheen)" />
      <path
        d="M33.5 13.5 20.8 26.2"
        stroke="var(--gold)"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="m19.2 24.6 4.2 4.2-6 1.8Z"
        stroke="var(--gold)"
        strokeWidth="1.9"
        strokeLinejoin="round"
        fill="var(--gold)"
        fillOpacity="0.22"
      />
      <path
        d="M30.6 16.4c-3.3-2-6.9-1-7.9 1.9-.8 2.4 2 3.9 3.7 2.4 1.3-1.2.6-3.4-1.5-3.6-3.4-.4-6.3 2.4-5.9 5.7"
        stroke="#fff"
        strokeOpacity="0.92"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}
