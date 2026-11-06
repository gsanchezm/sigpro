import type { SVGProps } from 'react';

// Iconos SVG inline de trazo 1.5px (handoff: "Assets"). Decorativos: siempre aria-hidden.

type IconProps = SVGProps<SVGSVGElement> & { readonly size?: number };

const base = (size: number, props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> => ({
  'aria-hidden': true,
  width: size,
  height: size,
  viewBox: '0 0 14 14',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ...props,
});

export const SunIcon = ({ size = 14, ...props }: IconProps) => (
  <svg {...base(size, props)}>
    <circle cx="7" cy="7" r="3" />
    <line x1="7" y1="0.8" x2="7" y2="2.2" />
    <line x1="7" y1="11.8" x2="7" y2="13.2" />
    <line x1="0.8" y1="7" x2="2.2" y2="7" />
    <line x1="11.8" y1="7" x2="13.2" y2="7" />
  </svg>
);

export const MoonIcon = ({ size = 14, ...props }: IconProps) => (
  <svg {...base(size, { ...props, fill: 'currentColor', stroke: 'none' })}>
    <path d="M9 1.5a5.5 5.5 0 1 0 3.5 9.7A6 6 0 0 1 9 1.5z" />
  </svg>
);

export const MenuIcon = ({ size = 14, ...props }: IconProps) => (
  <svg {...base(size, props)}>
    <line x1="2" y1="3.5" x2="12" y2="3.5" />
    <line x1="2" y1="7" x2="12" y2="7" />
    <line x1="2" y1="10.5" x2="12" y2="10.5" />
  </svg>
);

export const SearchIcon = ({ size = 14, ...props }: IconProps) => (
  <svg {...base(size, props)}>
    <circle cx="6" cy="6" r="4" />
    <line x1="9" y1="9" x2="12.5" y2="12.5" />
  </svg>
);

export const BellIcon = ({ size = 14, ...props }: IconProps) => (
  <svg {...base(size, props)}>
    <path d="M3 10.5V7a4 4 0 0 1 8 0v3.5l1 1H2l1-1z" />
    <path d="M5.8 12.8a1.3 1.3 0 0 0 2.4 0" />
  </svg>
);

export const DownloadIcon = ({ size = 14, ...props }: IconProps) => (
  <svg {...base(size, props)}>
    <line x1="7" y1="1.5" x2="7" y2="9" />
    <polyline points="3.8,6 7,9.2 10.2,6" />
    <line x1="2" y1="12" x2="12" y2="12" />
  </svg>
);

export const DotsIcon = ({ size = 14, ...props }: IconProps) => (
  <svg {...base(size, { ...props, fill: 'currentColor', stroke: 'none' })}>
    <circle cx="3" cy="7" r="1.2" />
    <circle cx="7" cy="7" r="1.2" />
    <circle cx="11" cy="7" r="1.2" />
  </svg>
);

export const CloseIcon = ({ size = 14, ...props }: IconProps) => (
  <svg {...base(size, props)}>
    <line x1="3" y1="3" x2="11" y2="11" />
    <line x1="11" y1="3" x2="3" y2="11" />
  </svg>
);

export const ChevronIcon = ({ size = 14, ...props }: IconProps) => (
  <svg {...base(size, props)}>
    <polyline points="3.5,5.5 7,9 10.5,5.5" />
  </svg>
);

export const SortIcon = ({ size = 10, ...props }: IconProps) => (
  <svg {...base(size, { ...props, fill: 'currentColor', stroke: 'none' })}>
    <path d="M7 2 10 6H4zM7 12 4 8h6z" />
  </svg>
);

export const InfoIcon = ({ size = 12, ...props }: IconProps) => (
  <svg {...base(size, props)}>
    <circle cx="7" cy="7" r="5.5" />
    <line x1="7" y1="6.2" x2="7" y2="10" />
    <circle cx="7" cy="4.2" r="0.4" fill="currentColor" />
  </svg>
);
