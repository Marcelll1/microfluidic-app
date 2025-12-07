"use client";

import { useState } from "react";

type ObjectType = "cube" | "cylinder";
type CubeParams = { width: number; height: number; depth: number };
type CylinderParams = {
  radiusTop: number;
  radiusBottom: number;
  height: number;
};
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

  // client-side validačné chyby
  const [transformError, setTransformError] = useState<string | null>(null);
  const [dimensionError, setDimensionError] = useState<string | null>(null);

  function handleTransformChange(field: keyof Transform, raw: string) {
    const value = parseFloat(raw);

    if (Number.isNaN(value)) {
      setTransformError("Value must be a number.");
      return;
    }

    // jednoduchý rozsah, aby si tam nedával nezmyselné hodnoty
    if (field !== "rotationY" && (value < -1000 || value > 1000)) {
      setTransformError("Position must be between -1000 and 1000.");
      return;
    }

    if (field === "rotationY" && (value < -360 || value > 360)) {
      setTransformError("Rotation must be between -360 and 360 degrees.");
      return;
    }

    setTransformError(null);
    onUpdateTransform(field, value);
  }

  function handleCubeDimensionChange(key: keyof CubeParams, raw: string) {
    const value = parseFloat(raw);

    if (Number.isNaN(value)) {
      setDimensionError("Dimension must be a number.");
      return;
    }

    if (value <= 0) {
      setDimensionError("Dimension must be greater than 0.");
      return;
    }

    if (value > 1000) {
      setDimensionError("Dimension is too large (max 1000).");
      return;
    }

    setDimensionError(null);
    onUpdateGeometry({
      ...(params as CubeParams),
      [key]: value,
    });
  }

  function handleCylinderDimensionChange(
    key: keyof CylinderParams,
    raw: string,
  ) {
    const value = parseFloat(raw);

    if (Number.isNaN(value)) {
      setDimensionError("Dimension must be a number.");
      return;
    }

    if (value <= 0) {
      setDimensionError("Dimension must be greater than 0.");
      return;
    }

    if (value > 1000) {
      setDimensionError("Dimension is too large (max 1000).");
      return;
    }

    setDimensionError(null);
    onUpdateGeometry({
      ...(params as CylinderParams),
      [key]: value,
    });
  }

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
        <div className="flex flex-col gap-2 mb-2">
          {(["x", "y", "z", "rotationY"] as (keyof Transform)[]).map(
            (field) => (
              <label
                key={field}
                className="text-sm flex items-center justify-between gap-2"
              >
                <span>{field}</span>
                <input
                  type="number"
                  step={field === "rotationY" ? 1 : 0.1}
                  value={transform[field]}
                  onChange={(e) =>
                    handleTransformChange(field, e.target.value)
                  }
                  className="w-28 bg-slate-950 border border-slate-800 rounded-md px-2 py-1"
                />
              </label>
            ),
          )}
          {transformError && (
            <p className="text-xs text-red-400 mt-1">{transformError}</p>
          )}
        </div>
      )}

      {/* Dimensions section */}
      <button
        className="w-full text-left text-sky-300 mb-2 mt-1"
        onClick={() => setOpenD((v) => !v)}
      >
        {openD ? "▼" : "▶"} Dimensions
      </button>
      {openD && (
        <div className="flex flex-col gap-2 mb-2">
          {type === "cube" ? (
            <>
              {(["width", "height", "depth"] as (keyof CubeParams)[]).map(
                (key) => (
                  <label
                    key={key}
                    className="text-sm flex items-center justify-between gap-2"
                  >
                    <span>{key}</span>
                    <input
                      type="number"
                      step={0.1}
                      min={0.1}
                      max={1000}
                      value={(params as CubeParams)[key]}
                      onChange={(e) =>
                        handleCubeDimensionChange(key, e.target.value)
                      }
                      className="w-28 bg-slate-950 border border-slate-800 rounded-md px-2 py-1"
                    />
                  </label>
                ),
              )}
            </>
          ) : (
            <>
              {(
                ["radiusTop", "radiusBottom", "height"] as (keyof CylinderParams)[]
              ).map((key) => (
                <label
                  key={key}
                  className="text-sm flex items-center justify-between gap-2"
                >
                  <span>{key}</span>
                  <input
                    type="number"
                    step={0.1}
                    min={0.1}
                    max={1000}
                    value={(params as CylinderParams)[key]}
                    onChange={(e) =>
                      handleCylinderDimensionChange(key, e.target.value)
                    }
                    className="w-28 bg-slate-950 border border-slate-800 rounded-md px-2 py-1"
                  />
                </label>
              ))}
            </>
          )}
          {dimensionError && (
            <p className="text-xs text-red-400 mt-1">{dimensionError}</p>
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
