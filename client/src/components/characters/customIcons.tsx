import React from 'react';

interface CustomIconProps {
  size?: number | string;
  color?: string;
  strokeWidth?: number | string;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: any;
}

/** Fabrica um ícone customizado no mesmo estilo visual do lucide-react (viewBox 24x24, stroke 2px). */
function createIcon(displayName: string, children: React.ReactNode) {
  const Icon = ({ size = 24, color = 'currentColor', strokeWidth = 2, className, style, ...rest }: CustomIconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      {...rest}
    >
      {children}
    </svg>
  );
  Icon.displayName = displayName;
  return Icon;
}

export const Revolver = createIcon('Revolver', (
  <>
    <circle cx="9" cy="11" r="2.5" />
    <rect x="11.5" y="9.5" width="9.5" height="3" rx="1" />
    <rect x="7" y="13.5" width="4" height="7" rx="1" />
    <rect x="10" y="14" width="4" height="4" rx="2" />
    <line x1="12" y1="14.5" x2="12" y2="17" />
  </>
));

export const Bullet = createIcon('Bullet', (
  <>
    <path d="M9 12Q9 5 12 5Q15 5 15 12v6h-6Z" />
    <path d="M9 12h6" />
  </>
));

export const Helmet = createIcon('Helmet', (
  <>
    <path d="M5 4h14v8h-4v-4h-6v4h-4V4Z" />
  </>
));

export const Chestplate = createIcon('Chestplate', (
  <>
    <path d="M4 4h6v2h4v-2h6v4h-3v13h-10v-13h-3Z" />
    <path d="M12 8v13" />
  </>
));

export const Necklace = createIcon('Necklace', (
  <>
    <path d="M4 4c0 6 3.5 10 8 10s8-4 8-10" />
    <path d="M12 14l-2 4 2 2 2-2-2-4Z" />
  </>
));

export const Bow = createIcon('Bow', (
  <>
    <path d="M9 3c4 1 7 4.5 7 9s-3 8-7 9" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </>
));

export const Boot = createIcon('Boot', (
  <>
    <path d="M5 4h6v8h8v6h-14V4Z" />
    <path d="M5 8h6" />
  </>
));

export const CUSTOM_ICON_MAP: Record<string, React.ComponentType<any>> = {
  Revolver, Bullet, Helmet, Chestplate, Necklace, Bow, Boot,
};
