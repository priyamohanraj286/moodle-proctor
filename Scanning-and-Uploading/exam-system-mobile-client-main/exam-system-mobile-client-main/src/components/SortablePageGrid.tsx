'use client';

import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type ScannedPage } from '@/store/scanStore';
import Image from 'next/image';

// ── Single sortable page card ──────────────────────────────────────────────────
function SortablePageCard({
  page,
  index,
  onDelete,
}: {
  page: ScannedPage;
  index: number;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group rounded-xl overflow-hidden bg-surface border border-border
        touch-manipulation"
    >
      {/* Drag handle + thumbnail */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <div className="aspect-[3/4] relative bg-text-muted/10">
          <img
            src={page.thumbnail}
            alt={`Page ${index + 1}`}
            className="absolute inset-0 w-full h-full object-contain"
          />
        </div>
      </div>

      {/* Page number badge */}
      <div className="absolute top-2 left-2 bg-bg/80 backdrop-blur-sm
        rounded-md px-1.5 py-0.5 font-mono text-xs text-text-primary border border-border/50">
        {index + 1}
      </div>

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="absolute top-2 right-2 w-6 h-6 rounded-full
          bg-danger/90 text-white flex items-center justify-center
          opacity-0 group-active:opacity-100 focus:opacity-100
          transition-opacity text-xs font-bold shadow-lg"
        aria-label={`Delete page ${index + 1}`}
      >
        ×
      </button>

      {/* Footer */}
      <div className="px-2 py-1.5 bg-surface">
        <p className="text-xs text-text-secondary font-mono truncate">
          pg {String(index + 1).padStart(2, '0')}
        </p>
      </div>
    </div>
  );
}

// ── Sortable grid ──────────────────────────────────────────────────────────────
interface SortablePageGridProps {
  pages: ScannedPage[];
  onChange: (pages: ScannedPage[]) => void;
  onDelete: (id: string) => void;
}

export default function SortablePageGrid({
  pages,
  onChange,
  onDelete,
}: SortablePageGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIdx = pages.findIndex((p) => p.id === active.id);
    const newIdx = pages.findIndex((p) => p.id === over.id);
    onChange(arrayMove(pages, oldIdx, newIdx));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-3 gap-2 p-4">
          {pages.map((page, i) => (
            <SortablePageCard
              key={page.id}
              page={page}
              index={i}
              onDelete={() => onDelete(page.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
