import React from 'react';

export function GridPattern() {
  return (
    <defs>
      <pattern id="rpg-grid" width="60" height="60" patternUnits="userSpaceOnUse">
        <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.2" />
      </pattern>
    </defs>
  );
}
