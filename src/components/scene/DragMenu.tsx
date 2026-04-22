"use client";
import * as THREE from "three";
import { useState } from "react";

type SceneParam = { name: string; value: number };

export default function DragMenu({ onStartDrag, onImportRBC, sceneParams, onParamsChange }: {
  onStartDrag: (type: string) => void;
  onImportRBC: (group: THREE.Group) => void;
  sceneParams: SceneParam[];
  onParamsChange: (params: SceneParam[]) => void;
}) {
  const [newParamName, setNewParamName] = useState("");
  const [newParamValue, setNewParamValue] = useState("");

  // Spracovanie 2 súborov pre model bunky (CTC/RBC)
  const handleRbcImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length < 2) {
      alert("Prosím, vyberte oba súbory naraz: *nodes*.dat a *triangles*.dat!");
      return;
    }

    let nodesTxt = "", triTxt = "";
    for (const f of files) {
      const text = await f.text();
      if (f.name.toLowerCase().includes("nodes")) nodesTxt = text;
      else if (f.name.toLowerCase().includes("triangles")) triTxt = text;
      else if (!nodesTxt) nodesTxt = text;
      else triTxt = text;
    }

    if (!nodesTxt || !triTxt) {
      alert("Nepodarilo sa rozlíšiť súbory. Názvy musia obsahovať 'nodes' a 'triangles'.");
      return;
    }

    try {
      const vertices: number[] = [];
      for (const line of nodesTxt.trim().split(/\r?\n/)) {
        const parts = line.trim().split(/\s+/).map(Number);
        if (parts.length >= 3) vertices.push(parts[0], parts[1], parts[2]);
      }

      const indices: number[] = [];
      for (const line of triTxt.trim().split(/\r?\n/)) {
        const parts = line.trim().split(/\s+/).map(Number);
        if (parts.length >= 3) indices.push(parts[0], parts[1], parts[2]);
      }

      // Membrána s wireframom a bodmi
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geom.setIndex(indices);
      geom.computeVertexNormals();

      const membraneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
      const membraneMesh = new THREE.Mesh(geom, membraneMat);

      const wireframeGeo = new THREE.WireframeGeometry(geom);
      const wireframe = new THREE.LineSegments(wireframeGeo, new THREE.LineBasicMaterial({ color: 0xffffff }));
      wireframe.name = "__rbc_wireframe__";

      const rbcPoints = new THREE.Points(geom, new THREE.PointsMaterial({ color: 0xffffff, size: 0.04 }));
      rbcPoints.name = "__rbc_points__";

      const sphereMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );

      const group = new THREE.Group();
      group.add(membraneMesh);
      group.add(wireframe);
      group.add(rbcPoints);
      group.add(sphereMesh);

      group.userData = {
        interactable: true,
        type: 'rbc',
        name: 'Červená Krvinka',
        params: { vertices, indices },
      };

      onImportRBC(group);
    } catch {
      alert("Chyba pri parsovaní súborov RBC.");
    }
  };

  function addParam() {
    const name = newParamName.trim();
    const val = parseFloat(newParamValue);
    if (!name || isNaN(val)) return;
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      alert("Názov parametra musí začínať písmenom (napr. v, w, d1).");
      return;
    }
    if (sceneParams.some(p => p.name === name)) {
      alert(`Parameter '${name}' už existuje.`);
      return;
    }
    onParamsChange([...sceneParams, { name, value: val }]);
    setNewParamName("");
    setNewParamValue("");
  }

  function updateParamValue(name: string, rawVal: string) {
    const val = parseFloat(rawVal);
    if (!isNaN(val)) {
      onParamsChange(sceneParams.map(p => p.name === name ? { ...p, value: val } : p));
    }
  }

  function removeParam(name: string) {
    onParamsChange(sceneParams.filter(p => p.name !== name));
  }

  return (
    <aside className="w-48 bg-[var(--card-bg)] border-r border-[var(--border)] p-4 flex flex-col gap-4 z-40 overflow-y-auto">
      <h3 className="text-xs font-bold text-[var(--foreground)] opacity-70 uppercase tracking-widest mb-2">Pridať objekt</h3>

      <div draggable onDragStart={() => onStartDrag("cube")}
        className="bg-sky-600 hover:bg-sky-500 p-3 rounded text-center text-xs text-[var(--foreground)] cursor-grab font-bold transition">
        Kocka
      </div>
      <div draggable onDragStart={() => onStartDrag("cylinder")}
        className="bg-amber-600 hover:bg-amber-500 p-3 rounded text-center text-xs text-[var(--foreground)] cursor-grab font-bold transition">
        Valec
      </div>

      {/* Import RBC */}
      <div className="pt-4 border-t border-[var(--border)]">
        <h3 className="text-xs font-bold text-[var(--foreground)] opacity-70 uppercase tracking-widest mb-3">Model Bunky</h3>
        <label className="block w-full bg-rose-900/30 hover:bg-rose-900/60 border border-rose-800 text-rose-400 p-3 rounded text-center text-[10px] font-bold cursor-pointer transition">
          IMPORT (2 SÚBORY)
          <input type="file" multiple accept=".dat" onChange={handleRbcImport} className="hidden" />
        </label>
        <p className="text-[9px] text-slate-600 mt-2 leading-tight">Vyberte naraz *nodes*.dat a *triangles*.dat.</p>
      </div>

      {/* Parametre */}
      <div className="pt-4 border-t border-[var(--border)] flex flex-col gap-2">
        <h3 className="text-xs font-bold text-[var(--foreground)] opacity-70 uppercase tracking-widest">Parametre</h3>

        {sceneParams.length === 0 && (
          <p className="text-[9px] text-slate-600 italic">Žiadne parametre.</p>
        )}

        {sceneParams.map(p => (
          <div key={p.name} className="flex items-center gap-1">
            <span className="text-[11px] text-emerald-400 font-mono font-bold w-8 shrink-0">{p.name}</span>
            <span className="text-[10px] text-[var(--foreground)] opacity-70">=</span>
            <input
              type="number"
              step="any"
              defaultValue={p.value}
              onBlur={e => updateParamValue(p.name, e.target.value)}
              className="flex-1 min-w-0 bg-[var(--item-bg-alpha)] border border-[var(--border)] rounded p-1 text-xs text-center text-[var(--foreground)]"
            />
            <button
              onClick={() => removeParam(p.name)}
              title="Odstrániť"
              className="text-slate-600 hover:text-red-400 text-sm px-1 transition leading-none"
            >
              ×
            </button>
          </div>
        ))}

        {/* Pridať nový parameter */}
        <div className="flex gap-1 mt-1">
          <input
            type="text"
            placeholder="názov"
            value={newParamName}
            onChange={e => setNewParamName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addParam()}
            className="w-14 bg-[var(--item-bg-alpha)] border border-[var(--border)] rounded p-1 text-[10px] text-[var(--foreground)] font-mono"
          />
          <input
            type="number"
            placeholder="0"
            step="any"
            value={newParamValue}
            onChange={e => setNewParamValue(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addParam()}
            className="flex-1 min-w-0 bg-[var(--item-bg-alpha)] border border-[var(--border)] rounded p-1 text-[10px] text-[var(--foreground)]"
          />
        </div>
        <button
          onClick={addParam}
          className="w-full bg-emerald-900/40 hover:bg-emerald-700 border border-emerald-800 text-emerald-400 hover:text-[var(--foreground)] rounded p-1.5 text-[10px] font-bold transition"
        >
          + Add parameter
        </button>
        <p className="text-[9px] text-slate-600 leading-tight">
          Použi v objektoch: <span className="text-emerald-500 font-mono">v</span>, <span className="text-emerald-500 font-mono">v+10</span>, <span className="text-emerald-500 font-mono">w*2</span>
        </p>
      </div>
    </aside>
  );
}