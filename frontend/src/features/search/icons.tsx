/** Small red outline icons used in the result details (inline SVG: no icon library or remote files). */
const common = {
  width: 30,
  height: 30,
  viewBox: '0 0 32 32',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

export const PizzaSliceIcon = () => (
  <svg {...common}>
    <path d="M5 8c7-4 15-4 22 0L16 29 5 8z" />
    <path d="M7.5 12.5c5.5-2.6 11.5-2.6 17 0" />
    <circle cx="13" cy="16" r="1.6" />
    <circle cx="19" cy="17" r="1.6" />
    <circle cx="16" cy="22" r="1.4" />
  </svg>
);

export const ClockIcon = () => (
  <svg {...common}>
    <circle cx="16" cy="16" r="12" />
    <path d="M16 9v7l5 3" />
  </svg>
);

export const CalendarIcon = () => (
  <svg {...common}>
    <rect x="5" y="7" width="22" height="20" rx="3" />
    <path d="M5 13h22M11 4v6M21 4v6" />
  </svg>
);
