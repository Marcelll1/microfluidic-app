"use client";

import { useState } from "react";

type ObjectType = "cube" | "cylinder";
type CubeParams = { width: number; height: number; depth: number };
type CylinderParams = { radiusTop: number; radiusBottom: number; height: number };
type ObjectParams = CubeParams | CylinderParams;
type Transform = { x: number; y: number; z: number; rotationY: number };

export default function ObjectPanel({
  type,
  params,
  transform,
  onUpdateTransform,
  onUpdateGeometry,
  onDelete,
}: {
  type: ObjectType;
  params: ObjectParams;
  transform: Transform;
  onUpdateTransform: (field: keyof Transform, value: number) => void;
  onUpdateGeometry: (p: ObjectParams) => void;
  onDelete: () => void;
}) {
  const [openT, setOpenT] = useState(true);
  const [openD, setOpenD] = useState(true);

  return (
    <aside className="absolute right-3 top-3 w-64 bg-slate-900/80 border border-slate-800 rounded-xl shadow-xl text-slate-100 p-4 backdrop-blur">
      <h4 className="text-lg font-semibold mb-2">Object editor</h4>

      {/* Transform section */}
      <button
        className="w-full text-left text-sky-300 mb-2"
        onClick={() => setOpenT((v) => !v)}
      >
        {openT ? "▼" : "▶"} Transform
      </button>
      {openT && (
        <div className="flex flex-col gap-2 mb-4">
          {["x", "y", "z", "rotationY"].map((field) => (
            <label key={field} className="text-sm flex items-center justify-between gap-2">
              <span>{field}</span>
              <input
                type="number"
                step="0.1"
                value={transform[field as keyof Transform]}
                onChange={(e) =>
                  onUpdateTransform(field as keyof Transform, parseFloat(e.target.value))
                }
                className="w-28 bg-slate-950 border border-slate-800 rounded-md px-2 py-1"
              />
            </label>
          ))}
        </div>
      )}

      {/* Dimensions section */}
      <button
        className="w-full text-left text-sky-300 mb-2"
        onClick={() => setOpenD((v) => !v)}
      >
        {openD ? "▼" : "▶"} Dimensions
      </button>
      {openD && (
        <div className="flex flex-col gap-2 mb-4">
          {type === "cube" ? (
            <>
              {["width", "height", "depth"].map((key) => (
                <label key={key} className="text-sm flex items-center justify-between gap-2">
                  <span>{key}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={(params as CubeParams)[key as keyof CubeParams]}
                    onChange={(e) =>
                      onUpdateGeometry({
                        ...(params as CubeParams),
                        [key]: parseFloat(e.target.value),
                      })
                    }
                    className="w-28 bg-slate-950 border border-slate-800 rounded-md px-2 py-1"
                  />
                </label>
              ))}
            </>
          ) : (
            <>
              {["radiusTop", "radiusBottom", "height"].map((key) => (
                <label key={key} className="text-sm flex items-center justify-between gap-2">
                  <span>{key}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={(params as CylinderParams)[key as keyof CylinderParams]}
                    onChange={(e) =>
                      onUpdateGeometry({
                        ...(params as CylinderParams),
                        [key]: parseFloat(e.target.value),
                      })
                    }
                    className="w-28 bg-slate-950 border border-slate-800 rounded-md px-2 py-1"
                  />
                </label>
              ))}
            </>
          )}
        </div>
      )}

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="mt-2 w-full bg-red-700 hover:bg-red-800 text-white text-sm px-3 py-2 rounded-md"
      >
        Delete object
      </button>
    </aside>
  );
}
