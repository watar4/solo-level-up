import type { CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { QuestCard } from './QuestCard';
import type { Quest } from '../types';

interface Props {
  quest: Quest;
  doneToday: boolean;
  busy?: boolean;
  // Redundant lift signal driven by Dashboard's DndContext.onDragStart.
  // Combined with useSortable.isDragging so the pickup visual fires at the
  // earliest observable activation moment in either source.
  forceLifted?: boolean;
  onToggle: () => void;
  onOpenMenu?: () => void;
}

// Lift visual is merged into the same transform string as dnd-kit's translate
// so everything paints from one CSS transform property — earlier attempts to
// stack scale on an inner wrapper failed to animate visibly on iOS Safari.
// Identity transform is set even at rest so the transition between rest and
// lifted always has a defined start value (browsers can skip the animation
// when transitioning from `none`).
export function SortableQuestCard({ forceLifted, ...props }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.quest.id,
  });
  const lifted = isDragging || forceLifted;

  const dndTransform = CSS.Transform.toString(transform) ?? '';
  const liftTransform = lifted
    ? 'scale(1.08) translateY(-10px)'
    : 'scale(1) translateY(0)';
  const combined = `${dndTransform} ${liftTransform}`.trim();

  const style: CSSProperties = {
    transform: combined,
    transformOrigin: 'center',
    transition: lifted
      ? 'transform 170ms cubic-bezier(0.2, 1.7, 0.3, 1), box-shadow 90ms ease-out, outline 90ms ease-out, filter 90ms ease-out'
      : transition ?? 'transform 140ms ease-out, box-shadow 140ms ease-out, filter 140ms ease-out',
    zIndex: lifted ? 30 : undefined,
    position: 'relative',
    touchAction: 'none',
    WebkitUserSelect: 'none',
    userSelect: 'none',
    WebkitTouchCallout: 'none',
    WebkitTapHighlightColor: 'transparent',
    willChange: 'transform',
    ...(lifted && {
      boxShadow:
        '0 24px 50px rgba(0, 0, 0, 0.65), 0 0 36px rgba(0, 212, 255, 0.85), inset 0 0 0 1px rgba(95, 201, 255, 1)',
      outline: '2px solid rgba(95, 201, 255, 1)',
      outlineOffset: '3px',
      filter: 'brightness(1.25) saturate(1.2)',
    }),
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <QuestCard {...props} />
    </div>
  );
}
