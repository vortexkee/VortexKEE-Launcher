import React, { useEffect, useMemo, useState } from 'react';

interface PlayerAvatarProps {
  username: string;
  size?: number;
  mode?: '3d' | '2d';
  className?: string;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const FALLBACK_PALETTES = [
  { skin: '#D7A984', hair: '#4A3123', eyes: '#2B5B84', accent: '#D4A359' },
  { skin: '#C6906B', hair: '#232026', eyes: '#3E8E5A', accent: '#B83B3B' },
  { skin: '#E5BCA0', hair: '#8B5A2B', eyes: '#4F46E5', accent: '#00B4D8' },
  { skin: '#9E6E4E', hair: '#1B181C', eyes: '#D97706', accent: '#A855F7' },
  { skin: '#DEB593', hair: '#5C3A21', eyes: '#0F766E', accent: '#2ECC71' },
];

/**
 * Renders a 3D isometric or 2D Minecraft player head preview via mc-heads.net
 * with a crisp deterministic pixel-art Minecraft head SVG fallback for offline use.
 */
export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  username,
  size = 40,
  mode = '3d',
  className = '',
}) => {
  const cleanName = username.trim();
  const isValidMcName = /^[a-zA-Z0-9_]{3,16}$/.test(cleanName);

  const [debouncedName, setDebouncedName] = useState(cleanName);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedName(cleanName);
      setImgFailed(false);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [cleanName]);

  const palette = useMemo(() => {
    const h = hashString((cleanName || 'Steve').toLowerCase());
    return FALLBACK_PALETTES[h % FALLBACK_PALETTES.length];
  }, [cleanName]);

  const remoteUrl = useMemo(() => {
    if (!isValidMcName || !/^[a-zA-Z0-9_]{3,16}$/.test(debouncedName)) {
      return null;
    }
    const px = Math.max(48, size * 2);
    return mode === '3d'
      ? `https://mc-heads.net/head/${encodeURIComponent(debouncedName)}/${px}`
      : `https://mc-heads.net/avatar/${encodeURIComponent(debouncedName)}/${px}`;
  }, [debouncedName, isValidMcName, mode, size]);

  if (!remoteUrl || imgFailed) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`relative shrink-0 overflow-hidden rounded-lg bg-surface-elevated border border-edge flex items-center justify-center ${className}`}
        title={cleanName || 'Misafir Oyuncu'}
      >
        <svg
          viewBox="0 0 8 8"
          width={size - 4}
          height={size - 4}
          shapeRendering="crispEdges"
          aria-hidden="true"
        >
          <rect width="8" height="8" fill={palette.skin} />
          {/* Hair top & sides */}
          <rect x="0" y="0" width="8" height="2" fill={palette.hair} />
          <rect x="0" y="2" width="1" height="1" fill={palette.hair} />
          <rect x="7" y="2" width="1" height="1" fill={palette.hair} />
          {/* Eyes */}
          <rect x="1" y="4" width="1" height="1" fill="#FFFFFF" />
          <rect x="2" y="4" width="1" height="1" fill={palette.eyes} />
          <rect x="5" y="4" width="1" height="1" fill={palette.eyes} />
          <rect x="6" y="4" width="1" height="1" fill="#FFFFFF" />
          {/* Nose & mouth */}
          <rect x="3" y="5" width="2" height="1" fill="#A97456" />
          <rect x="2" y="6" width="4" height="1" fill={palette.hair} opacity="0.7" />
        </svg>
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative shrink-0 overflow-hidden rounded-lg bg-surface-elevated border border-edge flex items-center justify-center ${className}`}
      title={cleanName}
    >
      <img
        src={remoteUrl}
        alt={cleanName}
        width={size}
        height={size}
        draggable={false}
        onError={() => setImgFailed(true)}
        className="w-full h-full object-contain p-0.5 select-none"
      />
    </div>
  );
};
