import type { CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { QuestCard } from './QuestCard';
import type { Quest } from '../types';

interface Props {
  quest: Quest;
  doneToday: boolean;
  busy?: boolean;
  onToggle: () => void;
  onOpenMenu?: () => void;
}

// Long-press to start a drag. While the drag is active, this in-list element
// becomes a semi-transparent placeholder and the lifted preview is rendered
// by the DragOverlay in Dashboard.tsx — that way the pickup pop is fully
// visible (not stuck under the user's finger) and unambiguous.
export function SortableQuestCard(props: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.quest.id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.25 : undefined,
    position: 'relative',
    touchAction: 'manipulation',
    WebkitUserSelect: 'none',
    userSelect: 'none',
    WebkitTouchCallout: 'none',
    WebkitTapHighlightColor: 'transparent',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <QuestCard {...props} />
    </div>
  );
}
