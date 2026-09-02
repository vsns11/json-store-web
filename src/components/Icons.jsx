/** Small inline icon set — no icon dependency, all sized to the current font. */
const base = {
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export const Icon = {
  Search: (props) => (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  ),
  Plus: (props) => (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Wand: (props) => (
    <svg {...base} {...props}>
      <path d="m4 20 10-10M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 12l.7 1.3L21 14l-1.3.7L19 16l-.7-1.3L17 14l1.3-.7z" />
    </svg>
  ),
  Compress: (props) => (
    <svg {...base} {...props}>
      <path d="M4 9h16M4 15h16M9 4v3M15 4v3M9 17v3M15 17v3" />
    </svg>
  ),
  Sort: (props) => (
    <svg {...base} {...props}>
      <path d="M4 7h10M4 12h7M4 17h4M17 5v14M17 19l3-3M17 19l-3-3" />
    </svg>
  ),
  Copy: (props) => (
    <svg {...base} {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h8" />
    </svg>
  ),
  Download: (props) => (
    <svg {...base} {...props}>
      <path d="M12 4v11M8 11l4 4 4-4M5 20h14" />
    </svg>
  ),
  Upload: (props) => (
    <svg {...base} {...props}>
      <path d="M12 16V5M8 9l4-4 4 4M5 20h14" />
    </svg>
  ),
  Trash: (props) => (
    <svg {...base} {...props}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  ),
  Save: (props) => (
    <svg {...base} {...props}>
      <path d="M5 4h11l4 4v12H5z" />
      <path d="M9 4v5h6V4M8 20v-6h8v6" />
    </svg>
  ),
  Sun: (props) => (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
    </svg>
  ),
  Moon: (props) => (
    <svg {...base} {...props}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  ),
  Revert: (props) => (
    <svg {...base} {...props}>
      <path d="M4 10h7a5 5 0 1 1-5 5" />
      <path d="M4 10 8 6M4 10l4 4" />
    </svg>
  ),
  Lock: (props) => (
    <svg {...base} {...props}>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  SignOut: (props) => (
    <svg {...base} {...props}>
      <path d="M15 12H5m10 0-3-3m3 3-3 3" />
      <path d="M10 4h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7" />
    </svg>
  ),
  Layers: (props) => (
    <svg {...base} {...props}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  ),
  Table: (props) => (
    <svg {...base} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M3 14h18M9 9v11" />
    </svg>
  ),
  Back: (props) => (
    <svg {...base} {...props}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  ),
  Menu: (props) => (
    <svg {...base} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
  Form: (props) => (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 13h8M8 17h4" />
    </svg>
  ),
  Keyboard: (props) => (
    <svg {...base} {...props}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
    </svg>
  ),
  Refresh: (props) => (
    <svg {...base} {...props}>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 4v5h-5" />
    </svg>
  ),
  Info: (props) => (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  ),
  File: (props) => (
    <svg {...base} {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  ),
}
