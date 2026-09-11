import { createContext, useContext } from "react"
import type { ReactNode } from "react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import type { DragEndEvent } from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"

import { cn } from "@/lib/utils"

// A vertical list reordered by dragging a <DragHandle />. Only the handle
// starts a drag, so inputs and sliders inside a row keep working. Keyboard:
// focus the handle, Space to pick up, arrows to move, Space to drop.
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  className,
  children,
}: {
  items: T[]
  onReorder: (reordered: T[]) => void
  className?: string
  children: (item: T) => ReactNode
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = items.findIndex((item) => item.id === active.id)
    const to = items.findIndex((item) => item.id === over.id)
    onReorder(arrayMove(items, from, to))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item) => (
            <SortableItem key={item.id} id={item.id}>
              {children(item)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

type HandleProps = Pick<
  ReturnType<typeof useSortable>,
  "attributes" | "listeners" | "setActivatorNodeRef"
>

const HandleContext = createContext<HandleProps | null>(null)

function SortableItem({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, transform, transition, isDragging, ...handle } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && "bg-background relative z-10 rounded-md shadow-md")}
    >
      <HandleContext.Provider value={handle}>{children}</HandleContext.Provider>
    </div>
  )
}

// The grip that drags its enclosing SortableList row.
export function DragHandle() {
  const handle = useContext(HandleContext)
  if (!handle) throw new Error("DragHandle must be rendered inside a SortableList")
  const { attributes, listeners, setActivatorNodeRef } = handle
  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      // touch-none: without it, a drag on a phone scrolls the page instead.
      className="text-muted-foreground hover:text-foreground flex h-8 shrink-0 cursor-grab touch-none items-center active:cursor-grabbing"
    >
      <GripVertical size={16} />
    </button>
  )
}
