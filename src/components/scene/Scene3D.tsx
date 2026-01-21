"use client";
//pri tomto subore bolo vyuzivane generovanie kodu AI, pretoze obsahuje zlozity Three.js editor
//AI pomohla s implementaciou funkcionalit ako drag&drop, vyber objektov, manipulacia s objektmi, komunikacia s API
//jednotlive casti kodu ktore boli generovane niesu oznacene komenatrom pretoze boli upravovane a doplnane postupne v priebehu vyvoja ale AI kod tvorila zakladnu strukturu a funkcionalitu skoro celeho suboru
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import DragMenu from "./DragMenu";
import ObjectPanel from "./ObjectPanel";

type ObjectType = "cube" | "cylinder"; //definicia typov objektov

//tvar riadku v DB pre 3D objekt z /api/objects?project_id=...
interface DbObjectRow {
  id: string;
  project_id: string;
  type: ObjectType;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  rotation_y: number;
  params: any;
}

//parametre geometrie podla typu objektu
type CubeParams = { width: number; height: number; depth: number };
type CylinderParams = { radiusTop: number; radiusBottom: number; height: number };
type ObjectParams = CubeParams | CylinderParams;

type Transform = { x: number; y: number; z: number; rotationY: number };//to co zobrazuje/edituje ObjectPanel
type Selected = { mesh: THREE.Mesh; type: ObjectType; params: ObjectParams };//aktualne vybraty objekt

//kluc pre demo scenu (ak nieje projectId, tak sa scéna ukladá do localStorage)
const DEMO_STORAGE_KEY = "demoScene_v1";

// helper pre zaokrúhľovanie posunu objektu na krok (0.1)
function snap(value: number, step = 0.1) {
  return Math.round(value / step) * step;
}

export default function Scene3D({ projectId }: { projectId: string | null }) {
  const mountRef = useRef<HTMLDivElement>(null);//ref na div kde sa rendruje Three.js scéna
  const sceneRef = useRef<THREE.Scene | null>(null);//ref na Three.js scénu (objekty), drzia mimo react state aby sa zbytocne nerenderovalo pri kazdej zmene
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);//ref na kameru

  const [dragType, setDragType] = useState<ObjectType | null>(null);//typ objektu ktory sa prave drag&dropuje
  const [selected, setSelected] = useState<Selected | null>(null);//aktualne vybraty objekt(pre zobrazenie v ObjectPanel)
  const [transform, setTransform] = useState<Transform>({//cisla do ObjectPanel
    x: 0,
    y: 0,
    z: 0,
    rotationY: 0,
  });

  const selectedMeshRef = useRef<THREE.Mesh | null>(null);//mesh ktorym hybem mysou
  const isDraggingRef = useRef(false);//ci sa prave draguje objekt

  const patchTimerRef = useRef<number | null>(null);//timer pre debounce update do DB

  // CREATE - vytvorí 1 objekt v DB a vráti jeho id
  const createObjectInDB = useCallback(
    async (payload: {
      project_id: string;
      type: ObjectType;
      pos_x: number;
      pos_y: number;
      pos_z: number;
      rotation_y: number;
      params: any;
    }) => {
      const res = await fetch("/api/objects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "CREATE failed");
      return json as { id: string }; //vrati id vytvoreneho objektu
    },
    []
  );

  // UPDATE - upraví 1 objekt v DB (debounce, aby sa to nespamovalo pri drag)
  const patchObjectInDB = useCallback(async (dbId: string, patch: any) => {
    const res = await fetch(`/api/objects/${dbId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      console.error("UPDATE failed:", res.status, json);
    }
  }, []);

  // UPDATE - debounce wrapper
  const patchSelectedDebounced = useCallback(
    (patch: any) => {
      const mesh = selectedMeshRef.current;
      const dbId = (mesh?.userData?.dbId as string | undefined) ?? undefined;
      if (!mesh || !dbId || !projectId) return;//nic neupdatuj ak nie je vybraty objekt alebo nema dbId a existuje projectId

      if (patchTimerRef.current) window.clearTimeout(patchTimerRef.current);
      patchTimerRef.current = window.setTimeout(() => {
        void patchObjectInDB(dbId, patch);
      }, 250);//250ms debounce(realne posle patch do DB az po 250ms od poslednej zmeny)
    },
    [patchObjectInDB, projectId]
  );

  // helper - vytvor mesh z DB row
  const createMeshFromRow = useCallback((row: DbObjectRow): THREE.Mesh => {
    let geometry: THREE.BufferGeometry;

    if (row.type === "cube") {
      const p = (row.params || { width: 1, height: 1, depth: 1 }) as CubeParams;
      geometry = new THREE.BoxGeometry(p.width, p.height, p.depth);
      geometry.translate(p.width / 2, p.height / 2, p.depth / 2); // posun aby objekt sedel na rohu a neratal sa od stredu
    } else {
      const p = (row.params || { radiusTop: 0.5, radiusBottom: 0.5, height: 1 }) as CylinderParams;
      geometry = new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, 32);
    }

    const material = new THREE.MeshStandardMaterial({
      color: row.type === "cube" ? 0x00aaff : 0xffaa00,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(row.pos_x, row.pos_y, row.pos_z);
    mesh.rotation.y = row.rotation_y;

    //drzi sa typ a parameter pre panely a dbId pre update/delete
    mesh.userData = {
      type: row.type,
      params: row.params,
      dbId: row.id,
    };

    return mesh;
  }, []);

  // READ - load scene (demo localStorage alebo DB)
  const loadScene = useCallback(async () => {
    //vycisti sceny
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    const meshes = scene.children.filter((c) => c instanceof THREE.Mesh);
    meshes.forEach((m) => scene.remove(m));

    // DEMO
    if (!projectId) {
      const raw = localStorage.getItem(DEMO_STORAGE_KEY);
      if (!raw) return;

      let items: any[] = [];
      try {
        items = JSON.parse(raw);
        if (!Array.isArray(items)) items = [];
      } catch {
        items = [];
      }

      for (const o of items) {
        const fakeRow: DbObjectRow = {
          id: crypto.randomUUID(),
          project_id: "demo",
          type: (o.type as ObjectType) ?? "cube",
          pos_x: Number(o.pos_x) || 0,
          pos_y: Number(o.pos_y) || 0,
          pos_z: Number(o.pos_z) || 0,
          rotation_y: Number(o.rotation_y) || 0,
          params: o.params ?? {},
        };

        const mesh = createMeshFromRow(fakeRow);//vytvori mesh z fake DB riadku
        mesh.userData.dbId = undefined;//no dbId v demo režime
        scene.add(mesh);
      }
      return;
    }

    // DB - READ
    const res = await fetch(`/api/objects?project_id=${projectId}`);//ziska objekty pre dany projekt
    if (!res.ok) {
      const text = await res.text();
      console.error("READ failed:", res.status, res.statusText, text);
      return;
    }

    //parsovanie odpovede
    let data: DbObjectRow[] = [];
    try {
      data = (await res.json()) as DbObjectRow[];
    } catch {
      data = [];
    }

    //vytvorenie meshov z nacitanych dat (kazdy riadok z DB je mesh)
    for (const row of data) {
      const mesh = createMeshFromRow(row);//vytvori mesh z DB riadku
      scene.add(mesh);//prida mesh do scény
    }
  }, [projectId, createMeshFromRow]);

  // UPDATE (bulk save scene) - uloží celú scénu do DB (alebo localStorage ak demo)
  const saveSceneToDB = useCallback(async () => {
    if (!sceneRef.current) return;

    const objects = sceneRef.current.children
      .filter((c) => c instanceof THREE.Mesh)
      .map((child) => {
        const mesh = child as THREE.Mesh;
        const { x, y, z } = mesh.position;
        return {
          type: (mesh.userData.type as ObjectType) ?? "cube",
          pos_x: x,
          pos_y: y,
          pos_z: z,
          rotation_y: mesh.rotation.y,
          params: mesh.userData.params ?? {},
        };
      });

    if (!projectId) {
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(objects));
      alert("Demo saved locally (not to database).");
      return;
    }

    const res = await fetch("/api/objects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        objects: objects.map((o) => ({ ...o, project_id: projectId })),
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("SAVE scene failed:", res.status, json);
      alert(json?.error ?? "Save failed.");
      return;
    }

    await loadScene();//reload scene po uložení
  }, [projectId, loadScene]);

  // global save event
  useEffect(() => {
    function handleSave() {
      void saveSceneToDB();
    }
    document.addEventListener("saveScene", handleSave);
    return () => document.removeEventListener("saveScene", handleSave);
  }, [saveSceneToDB]);

  // helper pre highlight vybraneho objektu
  //prejde vsetky meshe v scene a odstrani highlight (emissive farbu), selected mesh dostane emissive farbu
  const clearHighlight = useCallback(() => {
    if (!sceneRef.current) return;
    sceneRef.current.children.forEach((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat.emissive) mat.emissive.setHex(0x000000);
      }
    });
  }, []);

  // DELETE - delete selected (lokálne + DB ak dbId existuje)
  const deleteSelected = useCallback(async () => {
    if (!selectedMeshRef.current || !sceneRef.current) return;

    const mesh = selectedMeshRef.current;
    const dbId = mesh.userData?.dbId as string | undefined;

    sceneRef.current.remove(mesh);//zmaze mesh zo scény lokalne
    selectedMeshRef.current = null;
    setSelected(null);

    // DELETE
    if (dbId && projectId) {//ak ma dbId a existuje projectId, zmaze aj z DB
      const res = await fetch(`/api/objects/${dbId}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        console.error("DELETE failed:", res.status, json);
        alert(json?.error ?? "Failed to delete object from DB.");
      }
    }
  }, [projectId]);

  // keyboard Delete
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Delete") void deleteSelected();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelected]);

  // Three.js setup
  useEffect(() => {
    //kontrola mount ref bez neho nemam kde rendrovat
    if (!mountRef.current) return;
    const mount = mountRef.current;

    //inicializacia sceny, kamery, rendereru
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1d25);
    sceneRef.current = scene;

    //nastavenie kamery
    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);//75 fov aspect podla velkosti mountu
    camera.position.set(5, 5, 5);//nastavenie pociatocnej pozicie kamery
    cameraRef.current = camera;

    //nastavenie rendereru vlozeneho do DOM
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    //pridanie svetiel do scény
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    //pridanie pomocnych osi a grid helperov
    scene.add(new THREE.GridHelper(20, 20));
    scene.add(new THREE.AxesHelper(5));

    //inicializacia ovladania kamery
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;//vyhladenie pohybu

    const raycaster = new THREE.Raycaster();//pre vyber objektov myskou
    const mouse = new THREE.Vector2();//normalizovane suradnice mysky (-1 to +1)
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);//rovina y=0 pre projekciu pri dragovaní
    const intersection = new THREE.Vector3();//bod prieniku rayu s rovinou

    //funkcia pre vyber meshu pod myskou
    function pickMesh(e: MouseEvent): THREE.Mesh | null {
      if (!sceneRef.current || !cameraRef.current || !mountRef.current) return null;
      const rect = mountRef.current.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, cameraRef.current);
      const hits = raycaster.intersectObjects(sceneRef.current.children);//ziska vsetky objekty pod myskou
      const hit = hits.find((h) => h.object instanceof THREE.Mesh);//najde prvy Mesh ktory ray hitol
      return hit ? (hit.object as THREE.Mesh) : null;
    }

    // udalosti pre vyber a manipulaciu s objektami
    function onClick(e: MouseEvent) {
      if (isDraggingRef.current) {//ak sa prave dragovalo, tak click ignoruj
        isDraggingRef.current = false;
        return;
      }

      const mesh = pickMesh(e);//ziska mesh pod myskou
      if (!mesh) {
        clearHighlight();//ak nic nie je pod myskou, odstrani highlight
        selectedMeshRef.current = null;
        setSelected(null);
        return;
      }

      const type = (mesh.userData.type as ObjectType) ?? "cube";//ziska typ objektu z userData
      const params =
        (mesh.userData.params as ObjectParams) ??
        ({ width: 1, height: 1, depth: 1 } as CubeParams);

      clearHighlight();
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat.emissive) mat.emissive.setHex(0x333333);

      selectedMeshRef.current = mesh;//nastavi vybraty mesh
      setSelected({ mesh, type, params });//nastavi selected pre ObjectPanel
      setTransform({//nastavi transform pre ObjectPanel
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z,
        rotationY: mesh.rotation.y,
      });
    }

    // udalosti pre dragovanie objektov
    function onMouseDown(e: MouseEvent) {
      if (!selectedMeshRef.current) return;
      const hit = pickMesh(e);
      if (hit && hit === selectedMeshRef.current) {
        isDraggingRef.current = true;
        controls.enabled = false;
      }
    }

    function onMouseMove(e: MouseEvent) {
      if (!isDraggingRef.current || !selectedMeshRef.current || !cameraRef.current) return;

      const rect = mount.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, cameraRef.current);
      raycaster.ray.intersectPlane(groundPlane, intersection);

      const snappedX = snap(intersection.x, 0.1);
      const snappedZ = snap(intersection.z, 0.1);

      const mesh = selectedMeshRef.current;
      mesh.position.set(snappedX, mesh.position.y, snappedZ);

      setTransform((prev) => ({ ...prev, x: snappedX, z: snappedZ }));
    }

    function onMouseUp() {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        controls.enabled = true;

        // UPDATE - po skončení drag pošli pozíciu do DB (debounce wrapper)
        const mesh = selectedMeshRef.current;
        const dbId = mesh?.userData?.dbId as string | undefined;
        if (mesh && dbId && projectId) {
          patchSelectedDebounced({
            pos_x: mesh.position.x,
            pos_y: mesh.position.y,
            pos_z: mesh.position.z,
            rotation_y: mesh.rotation.y,
          });
        }
      }
    }

    // udalost pre posun objektu dopredu/dozadu po osi kamery (s shift+wheel)
    function onWheel(e: WheelEvent) {
      if (!selectedMeshRef.current || !cameraRef.current) return;
      if (!e.shiftKey) return;

      e.preventDefault();

      const mesh = selectedMeshRef.current;
      const dir = new THREE.Vector3();
      cameraRef.current.getWorldDirection(dir);

      const delta = -Math.sign(e.deltaY) * 0.1;
      mesh.position.addScaledVector(dir, delta);

      mesh.position.set(
        snap(mesh.position.x, 0.1),
        snap(mesh.position.y, 0.1),
        snap(mesh.position.z, 0.1)
      );

      setTransform({
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z,
        rotationY: mesh.rotation.y,
      });

      // UPDATE - wheel transform do DB
      const dbId = mesh.userData?.dbId as string | undefined;
      if (dbId && projectId) {
        patchSelectedDebounced({
          pos_x: mesh.position.x,
          pos_y: mesh.position.y,
          pos_z: mesh.position.z,
          rotation_y: mesh.rotation.y,
        });
      }
    }
    //pridanie event listenerov
    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("mousedown", onMouseDown);
    renderer.domElement.addEventListener("mousemove", onMouseMove);
    renderer.domElement.addEventListener("mouseup", onMouseUp);
    renderer.domElement.addEventListener("mouseleave", onMouseUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    //nekonecny loop pre renderovanie scény
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
    //initial load scény
    void loadScene();

    return () => {
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("mouseup", onMouseUp);
      renderer.domElement.removeEventListener("mouseleave", onMouseUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      mount.removeChild(renderer.domElement);
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, [clearHighlight, loadScene, patchSelectedDebounced, projectId]);

  // CREATE - drop objektu do scény (a do DB ak je projectId)
  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
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
        params = { width: 1, height: 1, depth: 1 };
        geometry = new THREE.BoxGeometry(params.width, params.height, params.depth);
        geometry.translate(params.width / 2, params.height / 2, params.depth / 2);
      } else {
        params = { radiusTop: 0.5, radiusBottom: 0.5, height: 1 };
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
      }

      const material = new THREE.MeshStandardMaterial({
        color: dragType === "cube" ? 0x00aaff : 0xffaa00,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(point);

      mesh.userData = { type: dragType, params, dbId: undefined };

      // CREATE do DB, ak sme v projekte
      if (projectId) {
        try {
          const created = await createObjectInDB({
            project_id: projectId,
            type: dragType,
            pos_x: mesh.position.x,
            pos_y: mesh.position.y,
            pos_z: mesh.position.z,
            rotation_y: mesh.rotation.y,
            params,
          });
          mesh.userData.dbId = created.id;
        } catch (err: any) {
          console.error(err);
          alert(err?.message ?? "Failed to create object in DB.");
        }
      }

      sceneRef.current.add(mesh);

      // auto-select dropnutý objekt
      selectedMeshRef.current = mesh;
      setSelected({ mesh, type: dragType, params });
      setTransform({
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z,
        rotationY: mesh.rotation.y,
      });
    },
    [dragType, projectId, createObjectInDB]
  );

  // UPDATE - zmena transformu z panelu (a do DB ak dbId existuje)
  function updateTransform(field: keyof Transform, value: number) {
    if (!selectedMeshRef.current) return;

    const next = { ...transform, [field]: value };
    setTransform(next);

    const mesh = selectedMeshRef.current;
    mesh.position.set(next.x, next.y, next.z);
    mesh.rotation.y = next.rotationY;

    patchSelectedDebounced({
      pos_x: mesh.position.x,
      pos_y: mesh.position.y,
      pos_z: mesh.position.z,
      rotation_y: mesh.rotation.y,
    });
  }

  // UPDATE - zmena geometrie (params) a patch do DB
  function updateGeometry(newParams: ObjectParams) {
    if (!selected) return;

    if (selected.type === "cube") {
      const p = newParams as CubeParams;
      const geom = new THREE.BoxGeometry(p.width, p.height, p.depth);
      geom.translate(p.width / 2, p.height / 2, p.depth / 2);
      selected.mesh.geometry.dispose();
      selected.mesh.geometry = geom;
    } else {
      const p = newParams as CylinderParams;
      const geom = new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, 32);
      selected.mesh.geometry.dispose();
      selected.mesh.geometry = geom;
    }

    selected.mesh.userData.params = newParams;
    setSelected({ ...selected, params: newParams });

    patchSelectedDebounced({ params: newParams });
  }

  return (
    <div className="relative flex h-full w-full">
      {!projectId && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded bg-amber-500 text-slate-900 text-sm">
          Demo mode – not saved to database
        </div>
      )}

      <DragMenu onStartDrag={(t: ObjectType) => setDragType(t)} />

      <div
        ref={mountRef}
        className="flex-1 bg-slate-950"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      />

      {selected && (//ak je nieco vybrane, zobraz ObjectPanel
        <ObjectPanel
          type={selected.type}
          params={selected.params}
          transform={transform}
          onUpdateTransform={updateTransform}
          onUpdateGeometry={updateGeometry}
          onDelete={() => void deleteSelected()}
        />
      )}
    </div>
  );
}
