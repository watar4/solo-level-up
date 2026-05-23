import type { CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { QuestCard } from './QuestCard';
import type { DragListeners } from './QuestCard';
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

// Drag is now initiated from a dedicated grip handle inside QuestCard rather
// than from the whole card body. This way the card body keeps the browser's
// default touch-action and scroll gestures pass through normally, so the
// quest list scrolls like any other vertical list.
export function SortableQuestCard({ forceLifted, ...props }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.quest.id,
  });
  const lifted = isDragging || forceLifted;

  const dndTransform = CSS.Transform.toString(transform) ?? '';
  const liftTransform = lifted
    ? 'scale(1.04) translateY(-4px)'
    : 'scale(1) translateY(0)';
  const combined = `${dndTransform} ${liftTransform}`.trim();

  const style: CSSProperties = {
    transform: combined,
    transformOrigin: 'center',
    transition: lifted
      ? 'transform 160ms cubic-bezier(0.2, 1.5, 0.3, 1), box-shadow 90ms ease-out, outline 90ms ease-out, filter 90ms ease-out'
      : transition ?? 'transform 140ms ease-out, box-shadow 140ms ease-out, filter 140ms ease-out',
    zIndex: lifted ? 30 : undefined,
    position: 'relative',
    willChange: 'transform',
    ...(lifted && {
      boxShadow:
        '0 22px 42px rgba(0, 0, 0, 0.6), 0 0 32px rgba(0, 212, 255, 0.8), inset 0 0 0 1px rgba(95, 201, 255, 0.95)',
      outline: '2px solid rgba(95, 201, 255, 0.95)',
      outlineOffset: '3px',
      filter: 'brightness(1.2) saturate(1.15)',
    }),
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <QuestCard {...props} dragListeners={listeners as DragListeners | undefined} />
    </div>
  );
}
