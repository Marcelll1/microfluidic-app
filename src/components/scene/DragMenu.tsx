"use client";

type ObjectType = "cube" | "cylinder";

export default function DragMenu({ onStartDrag }: { onStartDrag: (t: ObjectType) => void }) {
  return (
    <aside className="w-44 bg-slate-900/80 border-r border-slate-800 p-3 flex flex-col gap-3">
      <div
        draggable
        onDragStart={() => onStartDrag("cube")}
        className="rounded-lg bg-cyan-500 text-slate-950 text-center py-2 cursor-grab active:cursor-grabbing"
      >
        Cube
      </div>
      <div
        draggable
        onDragStart={() => onStartDrag("cylinder")}
        className="rounded-lg bg-amber-500 text-slate-900 text-center py-2 cursor-grab active:cursor-grabbing"
      >
        Cylinder
      </div>
    </aside>
  );
}
