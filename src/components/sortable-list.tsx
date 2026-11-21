"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useId, type ReactNode } from "react";

/** Renders the six-dot handle that starts a drag, with its accessible label. */
export type Handle = (label: string) => ReactNode;

function SortableRow({ id, children }: { id: string; children: (handle: Handle, dragging: boolean) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle: Handle = (label) => (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={label}
      title={label}
      className="flex size-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl bg-white text-icon active:cursor-grabbing"
    >
      <GripIcon />
    </button>
  );
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative ${isDragging ? "z-10 opacity-90 shadow-[0_12px_32px_rgba(24,35,47,0.18)]" : ""} rounded-[20px]`}
    >
      {children(handle, isDragging)}
    </div>
  );
}

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  children,
}: {
  items: T[];
  onReorder: (ids: string[]) => void;
  children: (item: T, index: number, handle: Handle, dragging: boolean) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const id = useId();

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = items.map((item) => item.id);
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  }

  return (
    <DndContext id={id} sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2.5">
          {items.map((item, index) => (
            <SortableRow key={item.id} id={item.id}>
              {(handle, dragging) => children(item, index, handle, dragging)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

/** Six dots: the handle that starts a drag. Works with mouse, finger (press and hold briefly) and keyboard. */
function GripIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.7" />
      <circle cx="15" cy="6" r="1.7" />
      <circle cx="9" cy="12" r="1.7" />
      <circle cx="15" cy="12" r="1.7" />
      <circle cx="9" cy="18" r="1.7" />
      <circle cx="15" cy="18" r="1.7" />
    </svg>
  );
}
