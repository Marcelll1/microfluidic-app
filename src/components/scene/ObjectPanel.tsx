"use client";
import { useState } from "react";

type EdgeGroup = "Všetky" | "Zvislé rohy" | "Horné hrany" | "Dolné hrany";
const EDGE_GROUPS: { value: EdgeGroup; label: string }[] = [
  { value: "Všetky",      label: "Všetky hrany" },
  { value: "Zvislé rohy", label: "Zvislé rohy (4 rohy)" },
  { value: "Horné hrany", label: "Iba horné hrany" },
  { value: "Dolné hrany", label: "Iba dolné hrany" },
];

export default function ObjectPanel({ selected, transform, simSize, onUpdate, onClip, onBevel, onDelete }: any) {
  const maxX = simSize?.x ?? 10;
  const maxY = simSize?.y ?? 10;
  const maxZ = simSize?.z ?? 10;
  const [clipHeight, setClipHeight] = useState<number>(selected.userData.clipHeight ?? 0);
  const [clipAngle, setClipAngle] = useState<number>(selected.userData.clipAngle ?? 0);
  const [bevelGroup, setBevelGroup] = useState<EdgeGroup>((selected.userData.bevelGroup as EdgeGroup) ?? "Všetky");
  const [bevelRadius, setBevelRadius] = useState<number>(selected.userData.bevelRadius ?? 0);

  return (
    <aside className="absolute right-4 top-4 w-64 bg-slate-900/95 border border-slate-700 rounded-xl p-5 shadow-2xl z-40 text-white">
      <h2 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-4">Editor Objektu</h2>
      
      <div className="space-y-4">
        {/* Názov objektu */}
        <div>
          <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Názov</label>
          <input 
            type="text" 
            defaultValue={selected.userData.name} 
            onBlur={e => { selected.userData.name = e.target.value; }}
            className="w-full bg-black border border-slate-700 rounded p-2 text-xs outline-none focus:border-sky-500" 
          />
        </div>

        {/* X, Y, Z Posun */}
        <div className="space-y-2">
          <label className="text-[10px] text-slate-400 font-bold uppercase block">Pozícia</label>
          {([['x', maxX], ['y', maxY], ['z', maxZ]] as [string, number][]).map(([axis, max]) => (
            <div key={axis} className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase w-3">{axis}</span>
              <input
                type="range"
                min={0} max={max} step={0.1}
                value={transform[axis]}
                onChange={e => onUpdate(axis, parseFloat(e.target.value))}
                className="flex-1 accent-sky-500 h-1.5"
              />
              <input
                type="number" step="0.1" min={0} max={max}
                value={transform[axis]}
                onChange={e => onUpdate(axis, parseFloat(e.target.value))}
                className="w-14 bg-black border border-slate-700 rounded p-1 text-xs text-center"
              />
            </div>
          ))}
        </div>

        {/* Všetky rotácie */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
          {['rotX', 'rotY', 'rotZ'].map(axis => (
            <div key={axis}>
              <label className="text-[10px] text-pink-400 font-bold uppercase block mb-1">{axis}</label>
              <input 
                type="number" step="1"
                value={Math.round(transform[axis])} 
                onChange={e => onUpdate(axis, parseFloat(e.target.value))}
                className="w-full bg-black border border-slate-700 rounded p-1 text-xs text-center focus:border-pink-500" 
              />
            </div>
          ))}
        </div>

        {/* Šikmé Zrezanie */}
        <div className="pt-2 border-t border-slate-800">
          <label className="text-[10px] text-amber-500 font-bold uppercase block mb-2">Šikmé zrezanie (Výška / Uhol)</label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              placeholder="Výška"
              value={clipHeight || ""}
              onChange={e => {
                const v = parseFloat(e.target.value) || 0;
                setClipHeight(v);
                onClip(v, clipAngle);
              }}
              className="w-1/2 bg-black border border-slate-700 rounded p-2 text-xs text-center"
            />
            <input
              type="number"
              placeholder="Uhol °"
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

        {/* Zaoblenie hrán (len pre kocky) */}
        {selected.userData.type === "cube" && (
          <div className="pt-2 border-t border-slate-800">
            <label className="text-[10px] text-emerald-400 font-bold uppercase block mb-2">Zaoblenie hrán</label>
            <select
              value={bevelGroup}
              onChange={e => {
                const g = e.target.value as EdgeGroup;
                setBevelGroup(g);
                onBevel(g, bevelRadius);
              }}
              className="w-full bg-black border border-emerald-900/60 rounded p-1.5 text-xs text-emerald-300 outline-none focus:border-emerald-500 mb-2"
            >
              {EDGE_GROUPS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Polomer"
              value={bevelRadius || ""}
              onChange={e => {
                const v = Math.max(0, parseFloat(e.target.value) || 0);
                setBevelRadius(v);
                onBevel(bevelGroup, v);
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