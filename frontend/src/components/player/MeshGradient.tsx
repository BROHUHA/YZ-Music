import React, { useMemo } from 'react';

interface MeshGradientProps {
  primaryColor?: string;
  secondaryColor?: string;
  bottomColor?: string;
  darkBase?: string;
  className?: string;
}

/**
 * Authentic YZ Music / Apple Music Now Playing Mesh Backdrop
 * Direct replication of MeshGradient.kt specs:
 * 4 luminous anchor blobs sampled from the album art:
 * Anchors: (20%, 25%), (80%, 20%), (75%, 80%), (25%, 75%)
 * Smeared into a smooth, glowing ambient color mesh that flows continuously to the bottom.
 */
export const MeshGradient: React.FC<MeshGradientProps> = ({
  primaryColor = '#FA2D48',
  secondaryColor = '#4A154B',
  bottomColor,
  darkBase = '#08070d',
  className = '',
}) => {
  const c3 = bottomColor || secondaryColor;
  const c4 = primaryColor;

  const gradientStyle = useMemo(() => {
    return {
      background: `
        radial-gradient(circle at 20% 25%, ${primaryColor}a8 0%, transparent 58%),
        radial-gradient(circle at 80% 20%, ${secondaryColor}90 0%, transparent 60%),
        radial-gradient(circle at 75% 80%, ${c3}a0 0%, transparent 62%),
        radial-gradient(circle at 25% 75%, ${c4}99 0%, transparent 60%),
        ${darkBase}
      `,
    };
  }, [primaryColor, secondaryColor, c3, c4, darkBase]);

  return (
    <div
      className={`absolute inset-0 pointer-events-none transition-all duration-1000 overflow-hidden ${className}`}
      style={gradientStyle}
    >
      {/* Soft blur diffusion layer */}
      <div className="absolute inset-0 backdrop-blur-3xl" />
      {/* Gentle vertical contrast scrim (matching MeshGradient.kt:199-205) */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/35 pointer-events-none" />
    </div>
  );
};
