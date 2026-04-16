"use client";
import * as THREE from "three";

export default function SceneGraph({ objects, selectedId, onSelect }: any) {
  return (
    <div className="absolute left-52 top-4 w-44 bg-slate-900/90 border border-slate-700 rounded-lg p-3 z-40 max-h-[calc(100vh-32px)] overflow-y-auto shadow-xl">
      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Objekty v scéne</h3>
      
      <div className="flex flex-col gap-1">
        {objects.length === 0 && <p className="text-[10px] text-slate-600 italic">Prázdna scéna</p>}
        
        {objects.map((obj: THREE.Object3D) => (
          <div
            key={obj.uuid}
            onClick={() => onSelect(obj)}
            className={`group flex justify-between items-center cursor-pointer px-2 py-1.5 rounded text-xs transition ${
              selectedId === obj.uuid 
                ? "bg-sky-600 text-white font-bold" 
                : "hover:bg-slate-800 text-slate-400"
            }`}
          >
            <span className="truncate pr-2">{obj.userData.name || obj.userData.type || "Objekt"}</span>
            <span className="text-[9px] opacity-40">{obj instanceof THREE.Group ? 'GRP' : 'MSH'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}