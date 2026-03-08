"use client";
import { useState, useEffect, useCallback, useRef } from "react";

// ── 12-edge individual picker ─────────────────────────────────────────────
// SVG isometric cube corners
const C = {
  FTL: [14, 34] as [number,number], FTR: [70, 34] as [number,number],
  FBL: [14, 78] as [number,number], FBR: [70, 78] as [number,number],
  BTL: [36, 18] as [number,number], BTR: [92, 18] as [number,number],
  BBL: [36, 62] as [number,number], BBR: [92, 62] as [number,number],
};

// 12 named edges: id, start, end, label
const EDGES: { id: string; a: [number,number]; b: [number,number]; label: string }[] = [
  // top face
  { id: "top-front", a: C.FTL, b: C.FTR, label: "Horná predná" },
  { id: "top-back",  a: C.BTL, b: C.BTR, label: "Horná zadná"  },
  { id: "top-left",  a: C.FTL, b: C.BTL, label: "Horná ľavá"   },
  { id: "top-right", a: C.FTR, b: C.BTR, label: "Horná pravá"  },
  // bottom face
  { id: "bot-front", a: C.FBL, b: C.FBR, label: "Dolná predná" },
  { id: "bot-back",  a: C.BBL, b: C.BBR, label: "Dolná zadná"  },
  { id: "bot-left",  a: C.FBL, b: C.BBL, label: "Dolná ľavá"   },
  { id: "bot-right", a: C.FBR, b: C.BBR, label: "Dolná pravá"  },
  // vertical edges
  { id: "vert-fl",   a: C.FTL, b: C.FBL, label: "Zvislá predná-ľavá"  },
  { id: "vert-fr",   a: C.FTR, b: C.FBR, label: "Zvislá predná-pravá" },
  { id: "vert-bl",   a: C.BTL, b: C.BBL, label: "Zvislá zadná-ľavá"   },
  { id: "vert-br",   a: C.BTR, b: C.BBR, label: "Zvislá zadná-pravá"  },
];

function EdgeCubePicker({
  activeEdges, onChange,
}: {
  activeEdges: Set<string>;
  onChange: (edges: Set<string>) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  function toggle(id: string) {
    const next = new Set(activeEdges);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  }

  const hoveredLabel = hovered ? EDGES.find(e => e.id === hovered)?.label : null;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 106 90" width="120" height="102" className="select-none">
        {/* Cube face fills for context */}
        <polygon points={[C.FTL,C.FTR,C.FBR,C.FBL].map(p=>p.join(",")).join(" ")} fill="#0f172a" />
        <polygon points={[C.FTL,C.BTL,C.BBL,C.FBL].map(p=>p.join(",")).join(" ")} fill="#0c1220" />
        <polygon points={[C.FTL,C.FTR,C.BTR,C.BTL].map(p=>p.join(",")).join(" ")} fill="#111827" />
        {/* 12 edges */}
        {EDGES.map(edge => {
          const active = activeEdges.has(edge.id);
          const isHov = hovered === edge.id;
          return (
            <line
              key={edge.id}
              x1={edge.a[0]} y1={edge.a[1]}
              x2={edge.b[0]} y2={edge.b[1]}
              stroke={active ? "#34d399" : isHov ? "#6ee7b7" : "#334155"}
              strokeWidth={active || isHov ? 3.5 : 2}
              strokeLinecap="round"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHovered(edge.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => toggle(edge.id)}
            />
          );
        })}
        {/* Invisible wider hit area lines for easier clicking */}
        {EDGES.map(edge => (
          <line
            key={edge.id + "-hit"}
            x1={edge.a[0]} y1={edge.a[1]}
            x2={edge.b[0]} y2={edge.b[1]}
            stroke="transparent"
            strokeWidth={10}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHovered(edge.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => toggle(edge.id)}
          />
        ))}
      </svg>
      <div className="flex gap-1.5 flex-wrap justify-center mt-0.5">
        <button
          onClick={() => onChange(new Set(EDGES.map(e => e.id)))}
          className="text-[8px] text-emerald-500 hover:text-emerald-300 border border-emerald-900/50 hover:border-emerald-500 rounded px-1.5 py-0.5 transition"
        >všetky</button>
        <button
          onClick={() => onChange(new Set())}
          className="text-[8px] text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-500 rounded px-1.5 py-0.5 transition"
        >žiadne</button>
      </div>
      <span className="text-[9px] text-emerald-400 text-center leading-tight h-3">
        {hoveredLabel ?? (activeEdges.size > 0 ? `${activeEdges.size} hrán` : "klikni na hranu")}
      </span>
    </div>
  );
}


type SceneParam = { name: string; value: number };
type AllExprs = Record<string, string>;

// Vyhodnotí matematický výraz s dosadením parametrov (napr. "v+10", "w*2")
export function evalExpr(expr: string, params: SceneParam[]): number | null {
  let s = String(expr).trim();
  if (s === "" || s === "-") return null;
  const sorted = [...params].sort((a, b) => b.name.length - a.name.length);
  for (const p of sorted) {
    s = s.replace(new RegExp(`\\b${p.name}\\b`, "g"), String(p.value));
  }
  if (!/^[\d\s+\-*/().e]+$/i.test(s)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function('"use strict"; return (' + s + ')')();
    return typeof result === "number" && isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

// Čistý (stateless) input – text je riadený zvonka, žiadny interný state, žiadny useEffect
function ExprInput({
  text, params, onTextChange, onValueChange, step = "0.1", className = "",
}: {
  text: string;
  params: SceneParam[];
  onTextChange: (raw: string) => void;
  onValueChange: (val: number) => void;
  step?: string;
  className?: string;
}) {
  const val = evalExpr(text, params);
  const invalid = val === null && text.trim() !== "";
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={e => {
        const raw = e.target.value;
        onTextChange(raw);
        const evaluated = evalExpr(raw, params);
        if (evaluated !== null) onValueChange(evaluated);
      }}
      step={step}
      className={`bg-black border rounded p-1 text-xs text-center outline-none focus:border-sky-500 transition
        ${invalid ? "border-red-500 text-red-400" : "border-slate-700 text-white"} ${className}`}
      title={invalid ? "Neplatný výraz" : undefined}
    />
  );
}

function initExprs(obj: any, transform: any): AllExprs {
  const saved: AllExprs = obj.userData.paramExprs ?? {};
  return {
    x:    saved.x    ?? String(transform.x   ?? 0),
    y:    saved.y    ?? String(transform.y   ?? 0),
    z:    saved.z    ?? String(transform.z   ?? 0),
    rotX: saved.rotX ?? String(Math.round(transform.rotX ?? 0)),
    rotY: saved.rotY ?? String(Math.round(transform.rotY ?? 0)),
    rotZ: saved.rotZ ?? String(Math.round(transform.rotZ ?? 0)),
    scaleX: saved.scaleX ?? String(obj.userData.params?.scaleX ?? 1),
    scaleY: saved.scaleY ?? String(obj.userData.params?.scaleY ?? 1),
    scaleZ: saved.scaleZ ?? String(obj.userData.params?.scaleZ ?? 1),
    width:        saved.width        ?? String(obj.userData.params?.width        ?? 1),
    height:       saved.height       ?? String(obj.userData.params?.height       ?? 1),
    depth:        saved.depth        ?? String(obj.userData.params?.depth        ?? 1),
    radiusTop:    saved.radiusTop    ?? String(obj.userData.params?.radiusTop    ?? 0.5),
    radiusBottom: saved.radiusBottom ?? String(obj.userData.params?.radiusBottom ?? 0.5),
  };
}

export default function ObjectPanel({
  selected, transform, simSize, sceneParams = [],
  onUpdate, onDimUpdate, onClip, onBevel, onDelete,
}: any) {
  const maxX = simSize?.x ?? 10;
  const maxY = simSize?.y ?? 10;
  const maxZ = simSize?.z ?? 10;
  const params: SceneParam[] = sceneParams;

  const [clipHeight, setClipHeight] = useState<number>(selected.userData.clipHeight ?? 0);
  const [clipAngle,  setClipAngle]  = useState<number>(selected.userData.clipAngle  ?? 0);
  const [bevelEdges, setBevelEdges] = useState<Set<string>>(() => {
    const saved = selected.userData.params?.bevelEdges;
    if (Array.isArray(saved) && saved.length > 0) return new Set<string>(saved as string[]);
    // legacy bevelGroup
    const grp = selected.userData.bevelGroup ?? selected.userData.params?.bevelGroup;
    if (grp === "Zvislé rohy") return new Set(["vert-fl","vert-fr","vert-bl","vert-br"]);
    if (grp === "Horné hrany") return new Set(["top-front","top-back","top-left","top-right"]);
    if (grp === "Dolné hrany") return new Set(["bot-front","bot-back","bot-left","bot-right"]);
    if (grp === "Bočné hrany") return new Set(["top-left","top-right","bot-left","bot-right"]);
    if (grp === "Všetky") return new Set(["vert-fl","vert-fr","vert-bl","vert-br","top-front","top-back","top-left","top-right","bot-front","bot-back","bot-left","bot-right"]);
    return new Set<string>();
  });
  const [bevelRadius, setBevelRadius] = useState<number>(selected.userData.bevelRadius ?? 0);

  const type: string = selected.userData.type ?? "";

  // Všetky výrazy ako reťazce – NIKDY sa neprepíšu externe (zachová sa "v", "v+10" atd.)
  const [exprs, setExprs] = useState<AllExprs>(() => initExprs(selected, transform));

  // Ulož výrazy do userData aby prežili re-render v tej istej session
  const saveExprs = useCallback((next: AllExprs) => {
    selected.userData.paramExprs = next;
  }, [selected]);

  // Keď sa zmenia sceneParams → znovu vyhodnoť VŠETKY výrazy a aplikuj na mesh
  const prevParamsRef = useRef<SceneParam[]>(sceneParams);
  useEffect(() => {
    if (prevParamsRef.current === sceneParams) return;
    prevParamsRef.current = sceneParams;

    setExprs(prev => {
      const posFields = ["x", "y", "z", "rotX", "rotY", "rotZ", "scaleX", "scaleY", "scaleZ"];
      const dimFields = ["width", "height", "depth", "radiusTop", "radiusBottom"];

      for (const key of posFields) {
        const val = evalExpr(prev[key] ?? "", sceneParams);
        if (val !== null) {
          const max = key === "x" ? maxX : key === "y" ? maxY : key === "z" ? maxZ : undefined;
          const clamped = max !== undefined ? Math.max(0, Math.min(val, max)) : val;
          onUpdate?.(key, clamped);
        }
      }
      const dimUpdates: Record<string, number> = {};
      for (const key of dimFields) {
        const val = evalExpr(prev[key] ?? "", sceneParams);
        if (val !== null && val > 0) dimUpdates[key] = val;
      }
      if (Object.keys(dimUpdates).length > 0) onDimUpdate?.(dimUpdates);

      return prev; // texty sa nemenia
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneParams]);

  function setExpr(key: string, raw: string) {
    const next = { ...exprs, [key]: raw };
    setExprs(next);
    saveExprs(next);
  }

  function handlePosExpr(axis: string, raw: string, max: number) {
    setExpr(axis, raw);
    const val = evalExpr(raw, params);
    if (val !== null) onUpdate(axis, Math.max(0, Math.min(val, max)));
  }

  function handleSlider(axis: string, value: number) {
    const rounded = String(Math.round(value * 10) / 10);
    setExpr(axis, rounded);
    onUpdate(axis, value);
  }

  function handleDim(key: string, raw: string) {
    setExpr(key, raw);
    const val = evalExpr(raw, params);
    if (val !== null && val > 0) onDimUpdate?.({ [key]: val });
  }

  function handleRot(axis: string, raw: string) {
    setExpr(axis, raw);
    const val = evalExpr(raw, params);
    if (val !== null) onUpdate(axis, val);
  }

  function handleScale(axis: string, raw: string) {
    setExpr(axis, raw);
    const val = evalExpr(raw, params);
    if (val !== null && val > 0) onUpdate(axis, val);
  }

  const dimLabel: Record<string, string> = {
    width: "Šírka", height: "Výška", depth: "Hĺbka",
    radiusTop: "Polomer ↑", radiusBottom: "Polomer ↓",
  };

  return (
    <aside className="absolute right-4 top-4 w-64 bg-slate-900/95 border border-slate-700 rounded-xl p-5 shadow-2xl z-40 text-white overflow-y-auto max-h-[calc(100vh-2rem)]">
      <h2 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-4">Editor Objektu</h2>

      <div className="space-y-4">

        {/* Názov */}
        <div>
          <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Názov</label>
          <input
            type="text"
            defaultValue={selected.userData.name}
            onBlur={e => { selected.userData.name = e.target.value; }}
            className="w-full bg-black border border-slate-700 rounded p-2 text-xs outline-none focus:border-sky-500"
          />
        </div>

        {/* Pozícia X, Y, Z */}
        <div className="space-y-2">
          <label className="text-[10px] text-slate-400 font-bold uppercase block">Pozícia</label>
          {([ ["x", maxX], ["y", maxY], ["z", maxZ] ] as [string, number][]).map(([axis, max]) => {
            const numVal = evalExpr(exprs[axis] ?? "", params) ?? (transform[axis] ?? 0);
            return (
              <div key={axis} className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase w-3">{axis}</span>
                <input
                  type="range" min={0} max={max} step={0.1}
                  value={Math.min(Math.max(numVal, 0), max)}
                  onChange={e => handleSlider(axis, parseFloat(e.target.value))}
                  className="flex-1 accent-sky-500 h-1.5"
                />
                <ExprInput
                  text={exprs[axis] ?? ""}
                  params={params}
                  onTextChange={raw => handlePosExpr(axis, raw, max)}
                  onValueChange={val => onUpdate(axis, Math.max(0, Math.min(val, max)))}
                  className="w-16"
                />
              </div>
            );
          })}
        </div>

        {/* Rozmery kocky */}
        {type === "cube" && (
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <label className="text-[10px] text-sky-300 font-bold uppercase block">Rozmery</label>
            {(["width", "height", "depth"] as const).map(key => {
              const txt = exprs[key] ?? "";
              const val = evalExpr(txt, params);
              const bad = val === null && txt.trim() !== "";
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-bold w-10 shrink-0">{dimLabel[key]}</span>
                  <input
                    type="text"
                    value={txt}
                    onChange={e => handleDim(key, e.target.value)}
                    placeholder="1"
                    className={`flex-1 min-w-0 bg-black border rounded p-1 text-xs text-center text-white outline-none focus:border-sky-500 transition
                      ${bad ? "border-red-500 text-red-400" : "border-slate-700"}`}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Rozmery valca */}
        {type === "cylinder" && (
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <label className="text-[10px] text-sky-300 font-bold uppercase block">Rozmery</label>
            {(["radiusTop", "radiusBottom", "height"] as const).map(key => {
              const txt = exprs[key] ?? "";
              const val = evalExpr(txt, params);
              const bad = val === null && txt.trim() !== "";
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-bold w-14 shrink-0 leading-tight">{dimLabel[key]}</span>
                  <input
                    type="text"
                    value={txt}
                    onChange={e => handleDim(key, e.target.value)}
                    placeholder="1"
                    className={`flex-1 min-w-0 bg-black border rounded p-1 text-xs text-center text-white outline-none focus:border-sky-500 transition
                      ${bad ? "border-red-500 text-red-400" : "border-slate-700"}`}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Rotácie */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
          <label className="text-[10px] text-pink-400 font-bold uppercase block col-span-3">Rotácie</label>
          {(["rotX", "rotY", "rotZ"] as const).map(axis => (
            <div key={axis}>
              <label className="text-[10px] text-pink-400 font-bold uppercase block mb-1">{axis}</label>
              <ExprInput
                text={exprs[axis] ?? ""}
                params={params}
                onTextChange={raw => handleRot(axis, raw)}
                onValueChange={val => onUpdate(axis, val)}
                step="1"
                className="w-full"
              />
            </div>
          ))}
        </div>

        {/* Skalovanie */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
          <label className="text-[10px] text-violet-400 font-bold uppercase block col-span-3">Skalovanie</label>
          {(["scaleX", "scaleY", "scaleZ"] as const).map(axis => (
            <div key={axis}>
              <label className="text-[10px] text-violet-400 font-bold uppercase block mb-1">{axis.replace("scale", "")}</label>
              <ExprInput
                text={exprs[axis] ?? "1"}
                params={params}
                onTextChange={raw => handleScale(axis, raw)}
                onValueChange={val => { if (val > 0) onUpdate(axis, val); }}
                step="0.1"
                className="w-full"
              />
            </div>
          ))}
        </div>

        {/* Šikmé Zrezanie */}
        <div className="pt-2 border-t border-slate-800">
          <label className="text-[10px] text-amber-500 font-bold uppercase block mb-2">Šikmé zrezanie (Výška / Uhol)</label>
          <div className="flex gap-2">
            <input
              type="number" step="0.01" placeholder="Výška"
              value={clipHeight || ""}
              onChange={e => {
                const v = parseFloat(e.target.value) || 0;
                setClipHeight(v);
                onClip(v, clipAngle);
              }}
              className="w-1/2 bg-black border border-slate-700 rounded p-2 text-xs text-center"
            />
            <input
              type="number" placeholder="Uhol °"
              value={clipAngle || ""}
              onChange={e => {
                const v = parseFloat(e.target.value) || 0;
                setClipAngle(v);
                onClip(clipHeight, v);
              }}
              className="w-1/2 bg-black border border-slate-700 rounded p-2 text-xs text-center"
            />
          </div>
        </div>

        {/* Zaoblenie hrán */}
        {type === "cube" && (
          <div className="pt-2 border-t border-slate-800">
            <label className="text-[10px] text-emerald-400 font-bold uppercase block mb-2">Zaoblenie hrán</label>
            <div className="flex justify-center mb-2">
              <EdgeCubePicker
                activeEdges={bevelEdges}
                onChange={edges => {
                  setBevelEdges(edges);
                  onBevel(edges, bevelRadius);
                }}
              />
            </div>
            <input
              type="number" step="0.01" min="0" placeholder="Polomer"
              value={bevelRadius || ""}
              onChange={e => {
                const v = Math.max(0, parseFloat(e.target.value) || 0);
                setBevelRadius(v);
                onBevel(bevelEdges, v);
              }}
              className="w-full bg-black border border-emerald-900/60 rounded p-2 text-xs text-center focus:border-emerald-500 outline-none"
            />
          </div>
        )}

        <button
          onClick={onDelete}
          className="w-full bg-red-900/40 hover:bg-red-600 text-red-400 hover:text-white border border-red-900/50 py-2 rounded text-[10px] font-bold mt-2 transition"
        >
          ZMAZAŤ OBJEKT
        </button>

      </div>
    </aside>
  );
}
