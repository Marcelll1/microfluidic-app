"use client";
import * as THREE from "three";

export default function ObjectPanel({ selected, transform, onUpdate, onClip, onDelete }: any) {
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
        <div className="grid grid-cols-3 gap-2">
          {['x', 'y', 'z'].map(axis => (
            <div key={axis}>
              <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Poz {axis}</label>
              <input 
                type="number" step="0.1"
                value={transform[axis]} 
                onChange={e => onUpdate(axis, parseFloat(e.target.value))}
                className="w-full bg-black border border-slate-700 rounded p-1 text-xs text-center" 
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
            <input type="number" placeholder="Výška" onChange={e => onClip(parseFloat(e.target.value) || 0, 0)} className="w-1/2 bg-black border border-slate-700 rounded p-2 text-xs text-center" />
            <input type="number" placeholder="Uhol °" onChange={e => onClip(0, parseFloat(e.target.value) || 0)} className="w-1/2 bg-black border border-slate-700 rounded p-2 text-xs text-center" />
          </div>
        </div>

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