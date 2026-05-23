import type { CSSProperties } from 'react';

export type PixelGrid = string[];
export type PixelPalette = Record<string, string>;

interface Props {
  // Layers paint bottom→top in order. Each layer must have the same width and
  // height (string length × array length). Use '.' or ' ' for transparent
  // pixels — they're skipped at render time.
  layers: { grid: PixelGrid; palette: PixelPalette }[];
  pixelSize?: number;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

// SVG-based pixel renderer. One <rect> per opaque pixel. Tiny grids (≤32×32)
// keep the DOM cost negligible and `shapeRendering="crispEdges"` plus
// `image-rendering: pixelated` make the result sharp at any pixel-size.
export function PixelArt({
  layers,
  pixelSize = 6,
  className,
  style,
  ariaLabel,
}: Props) {
  if (layers.length === 0) return null;
  const first = layers[0].grid;
  const h = first.length;
  const w = first[0]?.length ?? 0;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w * pixelSize}
      height={h * pixelSize}
      className={className}
      style={{ imageRendering: 'pixelated', display: 'block', ...style }}
      shapeRendering="crispEdges"
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
    >
      {layers.flatMap((layer, layerIdx) =>
        layer.grid.flatMap((row, y) =>
          Array.from(row).map((ch, x) => {
            const fill = layer.palette[ch];
            if (!fill || fill === 'transparent' || ch === '.' || ch === ' ') {
              return null;
            }
            return (
              <rect
                key={`${layerIdx}-${x}-${y}`}
                x={x}
                y={y}
                width={1}
                height={1}
                fill={fill}
              />
            );
          })
        )
      )}
    </svg>
  );
}
