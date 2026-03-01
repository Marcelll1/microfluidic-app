"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import DragMenu from "./DragMenu";
import ObjectPanel from "./ObjectPanel";
import SceneGraph from "./SceneGraph";

type ObjectType = "cube" | "cylinder" | "rbc" | "group";

interface DbObjectRow {
  id: string;
  project_id: string;
  type: ObjectType;
  pos_x: number; pos_y: number; pos_z: number;
  rotation_y: number;
  params: any;
}

type CubeParams = { width: number; height: number; depth: number };
type CylinderParams = { radiusTop: number; radiusBottom: number; height: number };
type ObjectParams = CubeParams | CylinderParams | any;

type Transform = { x: number; y: number; z: number; rotX: number; rotY: number; rotZ: number };
type Selected = { mesh: THREE.Object3D; type: ObjectType; params: ObjectParams };

const DEMO_STORAGE_KEY = "demoScene_v1";

function snap(value: number, step = 0.1) {
  return Math.round(value / step) * step;
}

export default function Scene3D({ projectId }: { projectId: string | null }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Stavy pre editor a UI
  const [objects, setObjects] = useState<THREE.Object3D[]>([]);
  const [dragType, setDragType] = useState<ObjectType | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0 });

  // LB Sieť parametre
  const [simSize, setSimSize] = useState({ x: 10, y: 10, z: 10 });
  const [showLB, setShowLB] = useState(true);
  const [lbColor, setLbColor] = useState("#4466aa");

  // Refy pre pôvodnú logiku hýbania
  const selectedMeshRef = useRef<THREE.Object3D | null>(null);
  const isDraggingRef = useRef(false);
  const patchTimerRef = useRef<number | null>(null);

  // Funkcia na aktualizáciu zoznamu objektov
  const syncObjectsList = useCallback(() => {
    if (!sceneRef.current) return;
    const list = sceneRef.current.children.filter(c => c.userData?.interactable === true);
    setObjects([...list]);
  }, []);

  // --- API FUNKCIE (ZACHOVANÉ) ---
  const createObjectInDB = useCallback(async (payload: any) => {
    const res = await fetch("/api/objects/create", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error ?? "CREATE failed");
    return json as { id: string };
  }, []);

  const patchObjectInDB = useCallback(async (dbId: string, patch: any) => {
    if (!projectId) return;
    await fetch(`/api/objects/${dbId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
  }, [projectId]);

  const patchSelectedDebounced = useCallback((patch: any) => {
    const mesh = selectedMeshRef.current;
    const dbId = mesh?.userData?.dbId;
    if (!mesh || !dbId || !projectId) return;

    if (patchTimerRef.current) window.clearTimeout(patchTimerRef.current);
    patchTimerRef.current = window.setTimeout(() => {
      void patchObjectInDB(dbId, patch);
    }, 250);
  }, [patchObjectInDB, projectId]);

  // Pomocná funkcia na vytvorenie meshu z DB
  const createMeshFromRow = useCallback((row: DbObjectRow): THREE.Object3D => {
    let geometry: THREE.BufferGeometry;
    const p = row.params || {};

    if (row.type === "cube") {
      geometry = new THREE.BoxGeometry(p.width || 1, p.height || 1, p.depth || 1);
      geometry.translate((p.width || 1) / 2, (p.height || 1) / 2, (p.depth || 1) / 2);
    } else {
      geometry = new THREE.CylinderGeometry(p.radiusTop || 0.5, p.radiusBottom || 0.5, p.height || 1, 32);
    }

    const material = new THREE.MeshStandardMaterial({ 
      color: row.type === "cube" ? 0x00aaff : 0xffaa00,
      clippingPlanes: [] // Pripravené pre zrezanie
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(row.pos_x, row.pos_y, row.pos_z);
    mesh.rotation.set(p.rotX || 0, row.rotation_y, p.rotZ || 0);

    mesh.userData = { 
      interactable: true, 
      type: row.type, 
      params: row.params || {}, 
      dbId: row.id, 
      name: p.name || row.type 
    };
    return mesh;
  }, []);

  // Načítanie scény
  const loadScene = useCallback(async () => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    scene.children.filter(c => c.userData?.interactable).forEach(m => scene.remove(m));

    if (!projectId) {
      const raw = localStorage.getItem(DEMO_STORAGE_KEY);
      if (!raw) return;
      JSON.parse(raw).forEach((o: any) => {
        const mesh = createMeshFromRow({ ...o, id: crypto.randomUUID() });
        mesh.userData.dbId = undefined;
        scene.add(mesh);
      });
    } else {
      const res = await fetch(`/api/objects?project_id=${projectId}`);
      if (res.ok) {
        const data = await res.json() as DbObjectRow[];
        data.forEach(row => scene.add(createMeshFromRow(row)));
      }
    }
    syncObjectsList();
  }, [projectId, createMeshFromRow, syncObjectsList]);

  // Vykreslenie/Uprava LB Siete
  const drawLBGrid = useCallback(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    
    // Odstráň starú sieť
    const oldGrid = scene.getObjectByName("lbSystem");
    if (oldGrid) scene.remove(oldGrid);

    if (!showLB) return;

    const group = new THREE.Group();
    group.name = "lbSystem";

    // 1. Podlaha (GridHelper)
    const gridHelper = new THREE.GridHelper(Math.max(simSize.x, simSize.z), Math.max(simSize.x, simSize.z), lbColor, "#222233");
    gridHelper.position.set(simSize.x / 2, 0, simSize.z / 2);
    group.add(gridHelper);

    // 2. Ohaničenie oblasti (Bounding Box)
    const boxGeo = new THREE.BoxGeometry(simSize.x, simSize.y, simSize.z);
    const edges = new THREE.EdgesGeometry(boxGeo);
    const boxLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: lbColor, opacity: 0.5, transparent: true }));
    boxLines.position.set(simSize.x / 2, simSize.y / 2, simSize.z / 2);
    group.add(boxLines);

    // 3. Lattice Body (Skutočná LB sieť - voliteľné, ak je príliš hustá, stačia okraje)
    const pts = [];
    for(let x=0; x<=simSize.x; x++) {
      for(let y=0; y<=simSize.y; y++) {
        for(let z=0; z<=simSize.z; z++) {
          pts.push(x, y, z);
        }
      }
    }
    const ptsGeom = new THREE.BufferGeometry();
    ptsGeom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const ptsMat = new THREE.PointsMaterial({ color: lbColor, size: 0.05, opacity: 0.3, transparent: true });
    const latticePoints = new THREE.Points(ptsGeom, ptsMat);
    group.add(latticePoints);

    scene.add(group);
  }, [simSize, showLB, lbColor]);

  // --- THREE.JS INITIALIZATION ---
  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c10);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.set(simSize.x, simSize.y + 5, simSize.z + 10);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.localClippingEnabled = true; // Dôležité pre zrezanie!
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const light = new THREE.PointLight(0xffffff, 1);
    light.position.set(15, 20, 15);
    scene.add(light);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // EVENTY PRE POHYB (Pôvodná funkčnosť)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();

    function pickMesh(e: MouseEvent): THREE.Object3D | null {
      const rect = mount.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      
      const hits = raycaster.intersectObjects(scene.children, true);
      // Hľadáme objekty, ktoré sme my označili ako interactable (ignorujeme sieť)
      let interactableHit = null;
      for (const h of hits) {
        let obj: THREE.Object3D | null = h.object;
        while (obj) {
          if (obj.userData?.interactable) {
            interactableHit = obj;
            break;
          }
          obj = obj.parent;
        }
        if (interactableHit) break;
      }
      return interactableHit;
    }

    const clearHighlight = () => {
      scene.children.forEach(c => {
        if (c.userData?.interactable && c instanceof THREE.Mesh) {
          const mat = c.material as THREE.MeshStandardMaterial;
          if (mat.emissive) mat.emissive.setHex(0x000000);
        }
      });
    };

    const onClick = (e: MouseEvent) => {
      if (isDraggingRef.current) { isDraggingRef.current = false; return; }
      const obj = pickMesh(e);
      if (!obj) {
        clearHighlight();
        selectedMeshRef.current = null;
        setSelected(null);
        return;
      }
      
      clearHighlight();
      if (obj instanceof THREE.Mesh) {
        (obj.material as THREE.MeshStandardMaterial).emissive.setHex(0x333333);
      }

      selectedMeshRef.current = obj;
      setSelected({ mesh: obj, type: obj.userData.type || "group", params: obj.userData.params || {} });
      setTransform({
        x: obj.position.x, y: obj.position.y, z: obj.position.z,
        rotX: THREE.MathUtils.radToDeg(obj.rotation.x),
        rotY: THREE.MathUtils.radToDeg(obj.rotation.y),
        rotZ: THREE.MathUtils.radToDeg(obj.rotation.z),
      });
    };

    const onMouseDown = (e: MouseEvent) => {
      if (!selectedMeshRef.current) return;
      const hit = pickMesh(e);
      if (hit && hit === selectedMeshRef.current) {
        isDraggingRef.current = true;
        controls.enabled = false;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !selectedMeshRef.current) return;
      const rect = mount.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      raycaster.ray.intersectPlane(groundPlane, intersection);

      // Posun a snapping s OBMEDZENÍM na veľkosť simulačnej oblasti!
      let sX = snap(intersection.x, 0.1);
      let sZ = snap(intersection.z, 0.1);
      
      // Ohraničenie voči LB sieti
      sX = Math.max(0, Math.min(sX, simSize.x));
      sZ = Math.max(0, Math.min(sZ, simSize.z));

      const mesh = selectedMeshRef.current;
      mesh.position.set(sX, mesh.position.y, sZ);
      setTransform(prev => ({ ...prev, x: sX, z: sZ }));
    };

    const onMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        controls.enabled = true;
        const mesh = selectedMeshRef.current;
        if (mesh) {
          patchSelectedDebounced({ pos_x: mesh.position.x, pos_z: mesh.position.z });
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (!selectedMeshRef.current || !e.shiftKey) return;
      e.preventDefault();
      const mesh = selectedMeshRef.current;
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      
      const delta = -Math.sign(e.deltaY) * 0.1;
      mesh.position.addScaledVector(dir, delta);
      
      // Znovu ohraničenie
      mesh.position.x = Math.max(0, Math.min(snap(mesh.position.x, 0.1), simSize.x));
      mesh.position.y = Math.max(0, Math.min(snap(mesh.position.y, 0.1), simSize.y));
      mesh.position.z = Math.max(0, Math.min(snap(mesh.position.z, 0.1), simSize.z));

      setTransform(prev => ({ ...prev, x: mesh.position.x, y: mesh.position.y, z: mesh.position.z }));
      patchSelectedDebounced({ pos_x: mesh.position.x, pos_y: mesh.position.y, pos_z: mesh.position.z });
    };

    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    loadScene();

    return () => {
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      mount.removeChild(renderer.domElement);
    };
  }, [simSize, loadScene, patchSelectedDebounced]);

  // Kreslenie LB siete pri zmene parametrov
  useEffect(() => {
    drawLBGrid();
  }, [drawLBGrid]);

  // --- DRAG & DROP DO SCÉNY (Pôvodná logika opravená) ---
  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!sceneRef.current || !cameraRef.current || !mountRef.current || !dragType) return;

    const rect = mountRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    ray.ray.intersectPlane(plane, point);

    let geometry: THREE.BufferGeometry;
    let params: ObjectParams;

    if (dragType === "cube") {
      params = { width: 1, height: 1, depth: 1, name: "Kocka" };
      geometry = new THREE.BoxGeometry(1, 1, 1);
      geometry.translate(0.5, 0.5, 0.5);
    } else {
      params = { radiusTop: 0.5, radiusBottom: 0.5, height: 1, name: "Valec" };
      geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
    }

    const material = new THREE.MeshStandardMaterial({ 
      color: dragType === "cube" ? 0x00aaff : 0xffaa00,
      clippingPlanes: []
    });

    const mesh = new THREE.Mesh(geometry, material);
    
    // Obmedzenie dropu do LB
    point.x = Math.max(0, Math.min(snap(point.x, 0.1), simSize.x));
    point.z = Math.max(0, Math.min(snap(point.z, 0.1), simSize.z));
    mesh.position.copy(point);

    mesh.userData = { interactable: true, type: dragType, params, dbId: undefined, name: params.name };
    sceneRef.current.add(mesh);
    syncObjectsList();

    if (projectId) {
      try {
        const created = await createObjectInDB({
          project_id: projectId, type: dragType,
          pos_x: mesh.position.x, pos_y: mesh.position.y, pos_z: mesh.position.z,
          rotation_y: mesh.rotation.y, params
        });
        mesh.userData.dbId = created.id;
      } catch (err: any) { alert(err?.message); }
    }
  }, [dragType, projectId, simSize, createObjectInDB, syncObjectsList]);

  // --- IMPORT RBC BUNKY (Guľa + Membrána = Group) ---
  const handleImportRBC = (rbcGroup: THREE.Group) => {
    if (!sceneRef.current) return;
    sceneRef.current.add(rbcGroup);
    syncObjectsList();
  };

  // --- DELETE & UPDATE ---
  const deleteSelected = async () => {
    if (!selectedMeshRef.current || !sceneRef.current) return;
    const mesh = selectedMeshRef.current;
    const dbId = mesh.userData?.dbId;
    sceneRef.current.remove(mesh);
    selectedMeshRef.current = null;
    setSelected(null);
    syncObjectsList();
    if (dbId && projectId) {
      await fetch(`/api/objects/${dbId}`, { method: "DELETE" });
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Delete") void deleteSelected(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const updateTransformPanel = (field: string, value: number) => {
    if (!selectedMeshRef.current) return;
    const mesh = selectedMeshRef.current;
    
    let v = value;
    if (field === 'x') v = Math.max(0, Math.min(v, simSize.x));
    if (field === 'y') v = Math.max(0, Math.min(v, simSize.y));
    if (field === 'z') v = Math.max(0, Math.min(v, simSize.z));

    if (field === 'x' || field === 'y' || field === 'z') mesh.position[field] = v;
    if (field === 'rotX') mesh.rotation.x = THREE.MathUtils.degToRad(v);
    if (field === 'rotY') mesh.rotation.y = THREE.MathUtils.degToRad(v);
    if (field === 'rotZ') mesh.rotation.z = THREE.MathUtils.degToRad(v);

    setTransform(prev => ({ ...prev, [field]: v }));

    patchSelectedDebounced({
      pos_x: mesh.position.x, pos_y: mesh.position.y, pos_z: mesh.position.z,
      rotation_y: mesh.rotation.y,
      params: { ...mesh.userData.params, rotX: mesh.rotation.x, rotZ: mesh.rotation.z }
    });
  };

  const updateClipping = (height: number, angleDeg: number) => {
    if (!selectedMeshRef.current) return;
    const mesh = selectedMeshRef.current;
    
    // Zrezanie funguje pre základné tvary, pre Group to treba aplikovať na deti
    const applyToMaterial = (m: THREE.Mesh) => {
      if (!m.material) return;
      const rad = THREE.MathUtils.degToRad(angleDeg);
      const normal = new THREE.Vector3(Math.sin(rad), -Math.cos(rad), 0).normalize();
      (m.material as any).clippingPlanes = [new THREE.Plane(normal, height)];
    };

    if (mesh instanceof THREE.Group) {
      mesh.children.forEach(c => { if (c instanceof THREE.Mesh) applyToMaterial(c); });
    } else if (mesh instanceof THREE.Mesh) {
      applyToMaterial(mesh);
    }
  };

  return (
    <div className="relative flex h-full w-full bg-black">
      {/* Horný Panel LB Siete */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-6 bg-slate-900/90 px-6 py-3 rounded-2xl shadow-xl border border-slate-700">
        <div className="flex flex-col">
          <label className="text-[10px] text-sky-400 font-bold uppercase mb-1">Veľkosť simulácie (LB Sieť)</label>
          <div className="flex gap-2">
            <input type="number" value={simSize.x} onChange={e => setSimSize({...simSize, x: +e.target.value})} className="w-14 bg-black border border-slate-600 rounded p-1 text-white text-xs" />
            <input type="number" value={simSize.y} onChange={e => setSimSize({...simSize, y: +e.target.value})} className="w-14 bg-black border border-slate-600 rounded p-1 text-white text-xs" />
            <input type="number" value={simSize.z} onChange={e => setSimSize({...simSize, z: +e.target.value})} className="w-14 bg-black border border-slate-600 rounded p-1 text-white text-xs" />
          </div>
        </div>
        <div className="w-px h-8 bg-slate-700"></div>
        <div className="flex items-center gap-3">
          <input type="color" value={lbColor} onChange={e => setLbColor(e.target.value)} className="w-6 h-6 cursor-pointer bg-transparent" />
          <label className="text-xs text-white flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showLB} onChange={e => setShowLB(e.target.checked)} className="accent-sky-500" />
            Zobraziť sieť
          </label>
        </div>
      </div>

      <DragMenu onStartDrag={(t: ObjectType) => setDragType(t)} onImportRBC={handleImportRBC} />

      <SceneGraph 
        objects={objects} 
        selectedId={selectedMeshRef.current?.uuid}
        onSelect={(obj: THREE.Object3D) => {
          selectedMeshRef.current = obj;
          setSelected({ mesh: obj, type: obj.userData.type || "group", params: obj.userData.params || {} });
          setTransform({
            x: obj.position.x, y: obj.position.y, z: obj.position.z,
            rotX: THREE.MathUtils.radToDeg(obj.rotation.x), rotY: THREE.MathUtils.radToDeg(obj.rotation.y), rotZ: THREE.MathUtils.radToDeg(obj.rotation.z),
          });
        }}
      />

      {/* Renderovacia zóna s obnoveným dropom */}
      <div ref={mountRef} className="flex-1" onDragOver={e => e.preventDefault()} onDrop={handleDrop} />

      {selected && (
        <ObjectPanel 
          selected={selected.mesh} 
          transform={transform} 
          onUpdate={updateTransformPanel}
          onClip={updateClipping}
          onDelete={deleteSelected}
        />
      )}
    </div>
  );
}