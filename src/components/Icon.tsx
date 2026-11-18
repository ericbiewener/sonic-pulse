import type { ReactNode } from "react";

export type IconName =
  | "pulse"
  | "play"
  | "stop"
  | "shuffle"
  | "sliders"
  | "volume"
  | "mute"
  | "infinity"
  | "arrow";

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    pulse: <path d="M2 12h5l3-8 5 16 3-8h4" />,
    play: <path d="m8 5 11 7-11 7Z" fill="currentColor" strokeWidth="0" />,
    stop: (
      <rect
        x="6"
        y="6"
        width="12"
        height="12"
        rx="2"
        fill="currentColor"
        strokeWidth="0"
      />
    ),
    shuffle: (
      <>
        <path d="m18 3 3 3-3 3M3 6h3c5 0 7 12 12 12h3M18 15l3 3-3 3M3 18h3c1.5 0 2.7-1 3.8-2.5M14.2 8.5C15.3 7 16.5 6 18 6h3" />
      </>
    ),
    sliders: (
      <>
        <path d="M5 3v7m0 4v7M12 3v12m0 4v2M19 3v3m0 4v11M2 10h6M9 15h6M16 6h6" />
      </>
    ),
    volume: (
      <>
        <path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
      </>
    ),
    mute: (
      <>
        <path d="m11 4-6 5H2v6h3l6 5ZM16 9l6 6m0-6-6 6" />
      </>
    ),
    infinity: <path d="M12 12C8 5 2 6 2 12s6 7 10 0 10-6 10 0-6 7-10 0Z" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
