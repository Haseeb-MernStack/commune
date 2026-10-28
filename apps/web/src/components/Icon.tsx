import type { CSSProperties } from "react";

/** One consistent outline icon set (24px grid, 1.8px stroke) used across the whole app. */
const PATHS = {
  home: "M3 11l9-7.5L21 11M5.5 9.5V20h13V9.5",
  compass: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z",
  news: "M5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11A2.5 2.5 0 0 1 5.5 4zM7.5 8.5h5M7.5 12.5h9M7.5 16h9",
  users: "M9 5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2.5 20c.5-3.6 3.2-5.5 6.5-5.5s6 1.9 6.5 5.5M16 5.2a3.5 3.5 0 0 1 0 6.6M18.5 14.8c1.7.7 2.8 2.3 3 5.2",
  bell: "M6 17v-6a6 6 0 1 1 12 0v6l1.5 2h-15zM10 21a2 2 0 0 0 4 0",
  mail: "M5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9A2.5 2.5 0 0 1 5.5 5zM3.5 7.5 12 13.5l8.5-6",
  user: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 20.5c.8-4 4-6 8-6s7.2 2 8 6",
  sparkle: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z",
  chart: "M6 20v-8M12 20V5M18 20v-5",
  shield: "M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z",
  contact: "M5.5 5h13A2.5 2.5 0 0 1 21 7.5v6a2.5 2.5 0 0 1-2.5 2.5H10l-5 4v-4h-.5A2.5 2.5 0 0 1 2 13.5v-6A2.5 2.5 0 0 1 4.5 5z",
  card: "M5.5 6h13A2.5 2.5 0 0 1 21 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 15.5v-7A2.5 2.5 0 0 1 5.5 6zM3 10.5h18",
  search: "M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.2-4.2",
  plus: "M12 5v14M5 12h14",
  heart: "M12 20.5s-8-4.9-8-11A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.5c0 6.1-8 11-8 11z",
  comment: "M20 12a8 8 0 0 1-11.5 7.2L4 20.5l1.3-4.3A8 8 0 1 1 20 12z",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  trash: "M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13",
  image: "M6 4.5h12A2.5 2.5 0 0 1 20.5 7v10a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 17V7A2.5 2.5 0 0 1 6 4.5zM9 8.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zM4 17l5-4.5 4 3.5 3-2.5 4.5 4",
  back: "M19 12H5M11 6l-6 6 6 6",
  close: "M6 6l12 12M18 6 6 18",
  menu: "M4 7h16M4 12h16M4 17h16",
  logout: "M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M10 16l-4-4 4-4M6 12h10",
  lock: "M7 10.5h10A2 2 0 0 1 19 12.5v6A2 2 0 0 1 17 20.5H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 10.5V8a4 4 0 0 1 8 0v2.5",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z",
  pencil: "M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z",
  send: "M21 3 10 14M21 3l-7 18-4-7-7-4z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  coin: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM14.5 9.2c-.6-.8-1.6-1.2-2.6-1.2-1.5 0-2.6.8-2.6 2s1 1.7 2.7 2.1c1.6.4 2.6.9 2.6 2.1s-1.1 2-2.7 2c-1.2 0-2.2-.5-2.8-1.4M12 6.5V8M12 16v1.5",
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({
  name,
  size = 22,
  filled = false,
  style,
}: {
  name: IconName;
  size?: number;
  filled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
