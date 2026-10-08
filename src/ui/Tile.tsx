import type { Color, FloorItem } from '../game';
import { COLOR_NAMES } from '../game';
import s from './ui.module.css';

/** 색약 사용자를 위해 색마다 다른 무늬를 함께 그린다. */
function Glyph({ color }: { color: Color }) {
  const stroke = color === 'yellow' || color === 'white' ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.85)';
  const common = { fill: 'none', stroke, strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (color) {
    case 'blue':
      return <circle cx="12" cy="12" r="5.5" {...common} />;
    case 'red':
      return <path d="M12 5.5 18.5 12 12 18.5 5.5 12Z" {...common} />;
    case 'yellow':
      return <path d="M12 6 18.5 17.5H5.5Z" {...common} />;
    case 'black':
      return <path d="M7.5 7.5 16.5 16.5M16.5 7.5 7.5 16.5" {...common} />;
    case 'white':
      return (
        <g {...common}>
          <path d="M5.5 10q3.25-3 6.5 0t6.5 0" />
          <path d="M5.5 15q3.25-3 6.5 0t6.5 0" />
        </g>
      );
  }
}

interface TileProps {
  item: FloorItem;
  ghost?: boolean;
  selected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export function Tile({ item, ghost, selected, onClick, className }: TileProps) {
  const cls = [s.tile, ghost && s.ghost, selected && s.selected, onClick && s.clickable, className]
    .filter(Boolean)
    .join(' ');
  if (item === 'FIRST') {
    return (
      <span className={`${cls} ${s.first}`} aria-label="선 마커" title="선 마커">
        1
      </span>
    );
  }
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      className={cls}
      style={{ background: `var(--c-${item})` }}
      aria-label={COLOR_NAMES[item]}
      title={COLOR_NAMES[item]}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <Glyph color={item} />
      </svg>
    </Tag>
  );
}
