"use client";
import * as THREE from "three";

export default function DragMenu({ onStartDrag, onImportRBC }: any) {

  // Funkcia na spracovanie 2 súborov pre model bunky (CTC/RBC)
  // Formát: *nodes*.dat  – každý riadok "x y z"
  //         *triangles*.dat – každý riadok "i j k" (0-based indexy)
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
      // fallback: pri neznámom názve hádame podľa poradia
      else if (!nodesTxt) nodesTxt = text;
      else triTxt = text;
    }

    if (!nodesTxt || !triTxt) {
      alert("Nepodarilo sa rozlíšiť súbory. Súbory musia mať v názve 'nodes' a 'triangles'.");
      return;
    }

    try {
      // Parsovanie uzlov – každý riadok "x y z"
      const vertices: number[] = [];
      for (const line of nodesTxt.trim().split(/\r?\n/)) {
        const parts = line.trim().split(/\s+/).map(Number);
        if (parts.length >= 3) vertices.push(parts[0], parts[1], parts[2]);
      }

      // Parsovanie trojuholníkov – každý riadok "i j k"
      const indices: number[] = [];
      for (const line of triTxt.trim().split(/\r?\n/)) {
        const parts = line.trim().split(/\s+/).map(Number);
        if (parts.length >= 3) indices.push(parts[0], parts[1], parts[2]);
      }

      const pos = [0, 0, 0];

      // 1. Membrána z trojuholníkov
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geom.setIndex(indices);
      geom.computeVertexNormals();
      const membraneMat = new THREE.MeshStandardMaterial({ color: 0xaa2222, side: THREE.DoubleSide });
      const membraneMesh = new THREE.Mesh(geom, membraneMat);

      // 2. Stredová guľa
      const sphereGeom = new THREE.SphereGeometry(0.3, 16, 16);
      const sphereMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
      const sphereMesh = new THREE.Mesh(sphereGeom, sphereMat);

      // 3. Spojenie (Group)
      const group = new THREE.Group();
      group.add(membraneMesh);
      group.add(sphereMesh);
      group.position.set(pos[0] || 0, pos[1] || 0, pos[2] || 0);

      group.userData = { 
        interactable: true, 
        type: 'rbc', 
        name: 'Červená Krvinka', 
        params: {} 
      };

      onImportRBC(group);
    } catch (err) {
      alert("Chyba pri parsovaní súborov RBC.");
    }
  };

  return (
    <aside className="w-48 bg-slate-900 border-r border-slate-800 p-4 flex flex-col gap-4 z-40">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Pridať objekt</h3>
      
      <div draggable onDragStart={() => onStartDrag("cube")} className="bg-sky-600 hover:bg-sky-500 p-3 rounded text-center text-xs text-white cursor-grab font-bold transition">
        Kocka
      </div>
      <div draggable onDragStart={() => onStartDrag("cylinder")} className="bg-amber-600 hover:bg-amber-500 p-3 rounded text-center text-xs text-white cursor-grab font-bold transition">
        Valec
      </div>

      <div className="mt-6 pt-4 border-t border-slate-800">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Model Bunky</h3>
        <label className="block w-full bg-rose-900/30 hover:bg-rose-900/60 border border-rose-800 text-rose-400 p-3 rounded text-center text-[10px] font-bold cursor-pointer transition">
          IMPORT (2 SÚBORY)
          <input type="file" multiple accept=".dat" onChange={handleRbcImport} className="hidden" />
        </label>
        <p className="text-[9px] text-slate-600 mt-2 leading-tight">Vyberte naraz *nodes*.dat a *triangles*.dat.</p>
      </div>
    </aside>
  );
}