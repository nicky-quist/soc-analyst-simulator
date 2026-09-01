// A small hand-rolled icon set so the console reads like a real security
// product's chrome rather than emoji standing in for icons. Every icon is a
// plain stroked SVG on a 24x24 grid — no icon library dependency, offline-safe.

function Svg({ size = 16, strokeWidth = 1.8, children, style, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, display: 'block', ...style }}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconShield = (p) => (
  <Svg {...p}><path d="M12 3l7 3.2v5.3c0 4.7-3 8.7-7 9.5-4-.8-7-4.8-7-9.5V6.2L12 3z" /></Svg>
);

export const IconDashboard = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.2" />
    <rect x="13" y="3.5" width="7.5" height="4.5" rx="1.2" />
    <rect x="13" y="10" width="7.5" height="10.5" rx="1.2" />
    <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.2" />
  </Svg>
);

export const IconInbox = (p) => (
  <Svg {...p}>
    <path d="M3.5 13.5h4.8l1.3 2.3h4.8l1.3-2.3h4.8" />
    <path d="M5 6.5l-1.5 7v6a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5v-6l-1.5-7a1.5 1.5 0 0 0-1.5-1.2H6.5A1.5 1.5 0 0 0 5 6.5z" />
  </Svg>
);

export const IconSun = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7" />
  </Svg>
);

export const IconMoon = (p) => (
  <Svg {...p}><path d="M20.2 13.6A8.4 8.4 0 1 1 10.4 3.8a6.8 6.8 0 0 0 9.8 9.8z" /></Svg>
);

export const IconUser = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8.2" r="3.5" />
    <path d="M4.8 20c1-3.6 4-5.6 7.2-5.6s6.2 2 7.2 5.6" />
  </Svg>
);

export const IconChevronDown = (p) => (
  <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>
);

export const IconRotate = (p) => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 1 1 2.6 5.9" />
    <path d="M4 17.5V12h5.5" />
  </Svg>
);

export const IconGraduationCap = (p) => (
  <Svg {...p}>
    <path d="M2.5 9.5L12 5l9.5 4.5L12 14 2.5 9.5z" />
    <path d="M6.5 11.4v4.2c0 1.4 2.5 2.9 5.5 2.9s5.5-1.5 5.5-2.9v-4.2" />
    <path d="M21.5 9.5v5.6" />
  </Svg>
);

export const IconSearch = (p) => (
  <Svg {...p}><circle cx="10.8" cy="10.8" r="6.3" /><path d="M20 20l-4.4-4.4" /></Svg>
);

export const IconCircleSlash = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M6.5 6.5l11 11" /></Svg>
);

export const IconTarget = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.6" fill="currentColor" /></Svg>
);

export const IconZap = (p) => (
  <Svg {...p}><path d="M12.5 2.5L4.5 14h5.5l-1 7.5 8-11.5H11l1.5-7.5z" strokeLinejoin="round" /></Svg>
);

export const IconAlertOctagon = (p) => (
  <Svg {...p}>
    <path d="M7.7 3.5h8.6l5.2 5.2v8.6l-5.2 5.2H7.7l-5.2-5.2V8.7l5.2-5.2z" />
    <path d="M12 8v5.2" />
    <path d="M12 16.3v.1" />
  </Svg>
);

export const IconSwap = (p) => (
  <Svg {...p}>
    <path d="M4 8h13.5" /><path d="M14 4.5L17.5 8 14 11.5" />
    <path d="M20 16H6.5" /><path d="M10 12.5L6.5 16 10 19.5" />
  </Svg>
);

export const IconFileCheck = (p) => (
  <Svg {...p}>
    <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7 3.5z" />
    <path d="M14 3.5V8h4" />
    <path d="M9 13.2l2 2 4-4.2" />
  </Svg>
);

export const IconDot = (p) => (
  <Svg {...p} strokeWidth={0}><circle cx="12" cy="12" r="3.4" fill="currentColor" /></Svg>
);

export const IconActivity = (p) => (
  <Svg {...p}><path d="M2.5 12h4l2.2-7 4 14 2.2-7h6.6" /></Svg>
);

export const IconListChecks = (p) => (
  <Svg {...p}>
    <path d="M3.5 6.5l1.6 1.6 3-3" />
    <path d="M3.5 13.5l1.6 1.6 3-3" />
    <path d="M3.5 20.5l1.6 1.6 3-3" />
    <path d="M11 6.5h9.5M11 13.5h9.5M11 20.5h9.5" />
  </Svg>
);

export const IconPieChart = (p) => (
  <Svg {...p}>
    <path d="M12 3v9l7.8 4.2A9 9 0 1 1 12 3z" />
    <path d="M21 10.5A9 9 0 0 0 13.5 3v7.5H21z" />
  </Svg>
);

export const IconFilter = (p) => (
  <Svg {...p}><path d="M3.5 4.5h17L14 13v6l-4 2v-8L3.5 4.5z" strokeLinejoin="round" /></Svg>
);

export const IconServer = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="4" width="17" height="6.5" rx="1.3" />
    <rect x="3.5" y="13.5" width="17" height="6.5" rx="1.3" />
    <path d="M7 7.25h.01M7 16.75h.01" strokeWidth="2.4" />
  </Svg>
);

export const IconTrendingUp = (p) => (
  <Svg {...p}><path d="M3 16.5l6.2-6.2 4 4L21 6.5" /><path d="M15 6.5h6v6" /></Svg>
);

export const IconUsers = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="8.2" r="3.2" />
    <path d="M3 19.5c.8-3.2 3.2-5 6-5s5.2 1.8 6 5" />
    <path d="M16 4.8a3.2 3.2 0 0 1 0 6.3" />
    <path d="M17.5 14.9c2.3.6 4 2.3 4.6 4.6" />
  </Svg>
);

export const IconRadio = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="2.3" />
    <path d="M7.5 8.5a6.3 6.3 0 0 0 0 7M16.5 8.5a6.3 6.3 0 0 1 0 7" />
    <path d="M4.2 5.2a11 11 0 0 0 0 13.6M19.8 5.2a11 11 0 0 1 0 13.6" />
  </Svg>
);

export const IconClock = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3.2 2" /></Svg>
);

export const IconChevronRight = (p) => (
  <Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>
);

export const IconCheck = (p) => (
  <Svg {...p} strokeWidth={p?.strokeWidth ?? 2.2}><path d="M4.5 12.5l5 5L19.5 7" /></Svg>
);

export const IconX = (p) => (
  <Svg {...p} strokeWidth={p?.strokeWidth ?? 2.2}><path d="M6 6l12 12M18 6L6 18" /></Svg>
);

export const IconSettings = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2.1 2.1 0 1 1-3 3l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2.1 2.1 0 1 1-4.2 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2.1 2.1 0 1 1-3-3l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1h-.2a2.1 2.1 0 1 1 0-4.2h.1A1.7 1.7 0 0 0 4.6 8a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2.1 2.1 0 1 1 3-3l.1.1a1.7 1.7 0 0 0 1.9.3H9.4a1.7 1.7 0 0 0 1-1.6v-.2a2.1 2.1 0 1 1 4.2 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2.1 2.1 0 1 1 3 3l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.2a2.1 2.1 0 1 1 0 4.2h-.1a1.7 1.7 0 0 0-1.6 1z" />
  </Svg>
);
