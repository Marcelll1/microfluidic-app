"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { CSG } from "three-csg-ts";
import { VTKLoader } from "three/examples/jsm/loaders/VTKLoader.js";
import DragMenu from "./DragMenu";
import ObjectPanel from "./ObjectPanel";
import SceneGraph from "./SceneGraph";
import SimSettingsPanel from "./SimSettingsPanel";
import { useTheme } from "@/lib/ThemeContext";

type ObjectType = "cube" | "cylinder" | "rbc" | "group" | "merged" | "__lb_settings__";

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



// ── Per-edge bevel geometria ────────────────────────────────────────────────
// 12 hrán kocky: vert-fl, vert-fr, vert-bl, vert-br (zvislé)
//                top-front, top-back, top-left, top-right  (horné)
//                bot-front, bot-back, bot-left, bot-right  (dolné)
type EdgeGroup = "Všetky" | "Zvislé rohy" | "Horné hrany" | "Dolné hrany" | "Bočné hrany"; // legacy

/** Vytvorí 2D tvar obdĺžnika (a×b) so selektívne zaobleným rohom (cr>0 = zaoblenie).
 *  Poradie rohov:  BL(0,0)  BR(a,0)  TR(a,b)  TL(0,b) */
function roundedRectShape(a: number, b: number, rBL: number, rBR: number, rTR: number, rTL: number, isChamfer: boolean = false): THREE.Shape {
  const s = new THREE.Shape();
  const clamp = (v: number, max1: number, max2: number) => Math.min(v, max1 / 2 - 0.001, max2 / 2 - 0.001);
  const cBL = clamp(rBL, a, b), cBR = clamp(rBR, a, b), cTR = clamp(rTR, a, b), cTL = clamp(rTL, a, b);
  
  s.moveTo(cBL, 0);
  s.lineTo(a - cBR, 0);
  if (cBR > 0) {
     if (isChamfer) s.lineTo(a, cBR);
     else s.quadraticCurveTo(a, 0, a, cBR); 
  } else s.lineTo(a, 0);
  
  s.lineTo(a, b - cTR);
  if (cTR > 0) {
     if (isChamfer) s.lineTo(a - cTR, b);
     else s.quadraticCurveTo(a, b, a - cTR, b); 
  } else s.lineTo(a, b);
  
  s.lineTo(cTL, b);
  if (cTL > 0) {
     if (isChamfer) s.lineTo(0, b - cTL);
     else s.quadraticCurveTo(0, b, 0, b - cTL); 
  } else s.lineTo(0, b);
  
  s.lineTo(0, cBL);
  if (cBL > 0) {
     if (isChamfer) s.lineTo(cBL, 0);
     else s.quadraticCurveTo(0, 0, cBL, 0); 
  } else s.lineTo(cBL, 0);
  
  return s;
}

/** Vybuduje geometriu kocky so zaoblením ľubovoľnej podmnožiny 12 hrán. */
function buildBevelGeometryEdges(
  w: number, h: number, d: number,
  r: number, edges: Set<string>,
  isChamfer: boolean = false
): THREE.BufferGeometry {
  if (r <= 0 || edges.size === 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(w / 2, h / 2, d / 2);
    return g;
  }
  const R = (id: string) => edges.has(id) ? r : 0;

  const s1 = roundedRectShape(w, d, R("vert-bl"), R("vert-br"), R("vert-fr"), R("vert-fl"), isChamfer);
  const g1 = new THREE.ExtrudeGeometry(s1, { depth: h, bevelEnabled: false, curveSegments: isChamfer ? 1 : 8 });
  g1.rotateX(-Math.PI / 2);
  g1.translate(0, 0, d);

  const s2 = roundedRectShape(w, h, R("bot-left"), R("bot-right"), R("top-right"), R("top-left"), isChamfer);
  const g2 = new THREE.ExtrudeGeometry(s2, { depth: d, bevelEnabled: false, curveSegments: isChamfer ? 1 : 8 });

  const s3 = roundedRectShape(d, h, R("bot-back"), R("bot-front"), R("top-front"), R("top-back"), isChamfer);
  const g3 = new THREE.ExtrudeGeometry(s3, { depth: w, bevelEnabled: false, curveSegments: isChamfer ? 1 : 8 });
  g3.rotateY(Math.PI / 2);
  g3.translate(0, 0, d);   // world: X∈[0,w], Y∈[0,h], Z∈[0,d] ✓

  // ─── CSG intersect všetkých 3 profilov ─────────────────────────────────
  try {
    const mat = new THREE.MeshStandardMaterial();
    const m1 = new THREE.Mesh(g1, mat); m1.updateMatrixWorld(true);
    const m2 = new THREE.Mesh(g2, mat); m2.updateMatrixWorld(true);
    const m3 = new THREE.Mesh(g3, mat); m3.updateMatrixWorld(true);
    let result = CSG.intersect(m1, m2);
    result.updateMatrixWorld(true);
    result = CSG.intersect(result, m3);
    return result.geometry;
  } catch {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(w / 2, h / 2, d / 2);
    return g;
  }
}

/** Legacy helper – konvertuje starý EdgeGroup string na Set hrán */
function edgeGroupToSet(group: EdgeGroup | string | undefined): Set<string> {
  switch (group) {
    case "Všetky":      return new Set(["vert-fl","vert-fr","vert-bl","vert-br","top-front","top-back","top-left","top-right","bot-front","bot-back","bot-left","bot-right"]);
    case "Zvislé rohy": return new Set(["vert-fl","vert-fr","vert-bl","vert-br"]);
    case "Horné hrany": return new Set(["top-front","top-back","top-left","top-right"]);
    case "Dolné hrany": return new Set(["bot-front","bot-back","bot-left","bot-right"]);
    case "Bočné hrany": return new Set(["top-left","top-right","bot-left","bot-right"]);
    default: return new Set();
  }
}

/** Backward-compat wrapper pre starý kód ktorý stále posiela EdgeGroup */
function buildBevelGeometry(
  w: number, h: number, d: number,
  r: number, group: EdgeGroup
): THREE.BufferGeometry {
  return buildBevelGeometryEdges(w, h, d, r, edgeGroupToSet(group), false);
}
// ─────────────────────────────────────────────────────────────────────────────

export default function Scene3D({ projectId }: { projectId: string | null }) {
  const { theme } = useTheme();
  
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
  const [showEdges, setShowEdges] = useState(true); 
  const showEdgesRef = useRef(true);
  useEffect(() => {
    showEdgesRef.current = showEdges;
  }, [showEdges]);


  const [lbColor, setLbColor] = useState("#4466aa");
  const [lbDensity, setLbDensity] = useState(1); // body na jednotku dĺžky (1/spacing)

  // Globálne parametre scény (napr. v = 5, použiteľné v objektoch)
  const [sceneParams, setSceneParams] = useState<{ name: string; value: number }[]>([]);

  // Refy pre pôvodnú logiku hýbania
  const simSizeRef = useRef(simSize);
  simSizeRef.current = simSize; // vždy aktuálna hodnota bez re-init efektu
  const selectedMeshRef = useRef<THREE.Object3D | null>(null);
  const isDraggingRef = useRef(false);
  const patchTimerRef = useRef<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Multi-výber pre zlúčenie objektov
  const [multiSelect, setMultiSelect] = useState<string[]>([]);
  const multiSelectRef = useRef<string[]>([]);
  const [showVTK, setShowVTK] = useState(false);
  const [vtkLoading, setVtkLoading] = useState(false);

  // Funkcia na aktualizáciu zoznamu objektov
  const syncObjectsList = useCallback(() => {
    if (!sceneRef.current) return;
    const list = sceneRef.current.children.filter(c => c.userData?.interactable === true);
    setObjects([...list]);
  }, []);

  const validateScene = useCallback(() => {
    if (!sceneRef.current) return;
    
    const interactables = sceneRef.current.children.filter(c => c.userData?.interactable === true);
    
    // Apply Highlight pre výber (selected/multiSelect)
    interactables.forEach(c => {
      if (c instanceof THREE.Mesh || c instanceof THREE.Group) {
        const targetMeshes: THREE.Mesh[] = [];
        if (c instanceof THREE.Mesh) targetMeshes.push(c);
        if (c instanceof THREE.Group) c.traverse(ch => { if (ch instanceof THREE.Mesh) targetMeshes.push(ch); });

        const isSelected = selectedMeshRef.current === c;
        const inMulti = multiSelectRef.current.includes(c.uuid);
        
        targetMeshes.forEach(m => {
          if (!m.material) return;
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          
          if (m.userData.originalColor === undefined && 'color' in mats[0]) {
            m.userData.originalColor = (mats[0] as THREE.MeshStandardMaterial).color.getHex();
          }

          mats.forEach(mat => {
            if ('emissive' in mat && 'color' in mat) {
              const material = mat as THREE.MeshStandardMaterial;
              
              if (inMulti) {
                material.color.setHex(0x22aa33);
                material.emissive.setHex(0x113322);
              } else if (isSelected) {
                material.color.setHex(m.userData.originalColor ?? 0x333333);
                material.emissive.setHex(0x333333);
              } else {
                material.color.setHex(m.userData.originalColor ?? 0x333333);
                material.emissive.setHex(0x000000);
              }
              material.needsUpdate = true;
            }
          });
        });
      }
    });
  }, []);

  // Validation effect
  useEffect(() => {
    validateScene();
  }, [objects, transform, validateScene, multiSelect, simSize]);

  // Theme update effect for background and grid
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(theme === "light" ? 0xf8fafc : 0x0a0c10);
      
      // Update grid helper colors if needed
      sceneRef.current.children.forEach((child) => {
        if (child instanceof THREE.GridHelper) {
          const gridColor = theme === "light" ? 0xcccccc : 0x444444;
          // GridHelper uses properties colors but we might need to recreate it if colors can't be updated simply.
          // However for immediate effect we just recreate GridHelper inside init
        }
      });
    }
  }, [theme]);


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
    // Vypnuté okamžité ukladanie, teraz ukladá iba tlačidlo SAVE
  }, []);

  const patchSelectedDebounced = useCallback((patch: any) => {
    // Vypnuté auto-ukladanie po každom kroku
  }, []);

  // Pomocná funkcia na vytvorenie meshu z DB
  const createMeshFromRow = useCallback((row: DbObjectRow): THREE.Object3D => {
    const p = row.params || {};

    // --- Rekonštrukcia RBC bunky z uložených vertices/indices ---
    if (row.type === "rbc") {
      const vertices = p.vertices as number[] | undefined;
      const indices = p.indices as number[] | undefined;

      const geom = new THREE.BufferGeometry();
      if (vertices && indices) {
        geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geom.setIndex(indices);
        geom.computeVertexNormals();
      }
      const membraneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
      const membraneMesh = new THREE.Mesh(geom, membraneMat);

      const group = new THREE.Group();
      group.add(membraneMesh);

      // Hrany + body membrámy – len keď geom obsahuje dáta
      if (vertices && indices) {
        const wireframeGeo = new THREE.WireframeGeometry(geom);
        const wireframeMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 });
        const wireframe = new THREE.LineSegments(wireframeGeo, wireframeMat);
        wireframe.name = "__rbc_wireframe__";
        group.add(wireframe);

        const pointsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.04 });
        const rbcPoints = new THREE.Points(geom, pointsMat);
        rbcPoints.name = "__rbc_points__";
        group.add(rbcPoints);
      }

      const sphereGeom = new THREE.SphereGeometry(0.3, 16, 16);
      const sphereMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const sphereMesh = new THREE.Mesh(sphereGeom, sphereMat);
      group.add(sphereMesh);
      group.position.set(row.pos_x, row.pos_y, row.pos_z);
      group.rotation.set(p.rotX || 0, row.rotation_y, p.rotZ || 0);
      group.updateMatrixWorld(true);
      group.userData = {
        interactable: true,
        type: "rbc",
        params: row.params || {},
        dbId: row.id,
        name: p.name || "Bunka",
        clipHeight: 0,
        clipAngle: 0,
      };
      return group;
    }

    // --- Rekonštrukcia zlúčeného objektu zo uložených částí (CSG union) ---
    if (row.type === "merged") {
      const parts = (p.parts || []) as any[];
      const buildPartMesh = (part: any): THREE.Mesh => {
        const pp = part.params || {};
        let geom: THREE.BufferGeometry;
        if (String(part.type || "").toLowerCase() === "cube") {
          const edges2 = pp.bevelEdges ? new Set<string>(pp.bevelEdges as string[]) : edgeGroupToSet((pp.bevelGroup as EdgeGroup) || "Všetky");
          geom = buildBevelGeometryEdges(pp.width||1, pp.height||1, pp.depth||1, pp.bevelRadius||0, edges2, !!pp.isChamfer);
        } else {
          geom = new THREE.CylinderGeometry(pp.radiusTop||0.5, pp.radiusBottom||0.5, pp.height||1, 32);
        }
        const m = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: 0x886622 }));
        m.position.set(part.pos_x, part.pos_y, part.pos_z);
        m.rotation.set(pp.rotX||0, part.rotation_y||0, pp.rotZ||0);
        m.updateMatrix();
        return m;
      };
      let result = parts.length > 0 ? buildPartMesh(parts[0]) : new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0x886622 }));
      for (let i = 1; i < parts.length; i++) result = CSG.union(result, buildPartMesh(parts[i]));
      result.position.set(row.pos_x, row.pos_y, row.pos_z);
      result.userData = { interactable: true, type: "merged", params: row.params || {}, dbId: row.id, name: p.name || "Zlúčený objekt", clipHeight: 0, clipAngle: 0 };
      result.material = new THREE.MeshStandardMaterial({
        color: p.color ? new THREE.Color(p.color) : 0x886622,
        clippingPlanes: []
      });
      const edgeGeo = new THREE.EdgesGeometry(result.geometry, 15);
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 });
      const edgeMesh = new THREE.LineSegments(edgeGeo, edgeMat);
      edgeMesh.name = "__edge_highlight__";
      edgeMesh.visible = showEdgesRef.current;
      result.add(edgeMesh);

      return result;
    }

    let geometry: THREE.BufferGeometry;
    const bevel = p.bevelRadius || 0;
    const w = p.width || 1, h = p.height || 1, d = p.depth || 1;

    if (row.type === "cube") {
      const edges = p.bevelEdges ? new Set<string>(p.bevelEdges as string[]) : edgeGroupToSet((p.bevelGroup as EdgeGroup) || "Všetky");
      geometry = buildBevelGeometryEdges(w, h, d, bevel, edges, !!p.isChamfer);
    } else {
      geometry = new THREE.CylinderGeometry(p.radiusTop || 0.5, p.radiusBottom || 0.5, p.height || 1, 32);
    }

    const material = new THREE.MeshStandardMaterial({ 
      color: p.color ? new THREE.Color(p.color) : (row.type === "cube" ? 0x00aaff : 0xffaa00),
      clippingPlanes: []
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(row.pos_x, row.pos_y, row.pos_z);
    mesh.rotation.set(p.rotX || 0, row.rotation_y, p.rotZ || 0);
    mesh.updateMatrixWorld(true);

    mesh.userData = { 
      interactable: true, 
      type: row.type, 
      params: row.params || {}, 
      dbId: row.id, 
      name: p.name || row.type,
      clipHeight: p.clipHeight || 0,
      clipAngle: p.clipAngle || 0,
      bevelRadius: bevel,
    };

    // Obnov zrezanie zo uložených parametrov
    if (p.clipHeight || p.clipAngle) {
    }

    const edgeGeo = new THREE.EdgesGeometry(mesh.geometry, 15);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 });
    const edgeMesh = new THREE.LineSegments(edgeGeo, edgeMat);
    edgeMesh.name = "__edge_highlight__";
      edgeMesh.visible = showEdgesRef.current;
    mesh.add(edgeMesh);

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
        // Obnov LB nastavenia zo špeciálneho záznamu
        const lbRow = data.find(r => r.type === "__lb_settings__");
        if (lbRow?.params) {
          const p = lbRow.params as any;
          if (p.simSize)   setSimSize(p.simSize);
          if (p.lbDensity !== undefined) setLbDensity(p.lbDensity);
          if (p.lbColor)   setLbColor(p.lbColor);
          if (p.showLB    !== undefined) setShowLB(p.showLB);
        }
        // Render iba reálnych objektov
        data
          .filter(r => r.type !== "__lb_settings__")
          .forEach(row => scene.add(createMeshFromRow(row)));
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
    const lbSpacing = lbDensity > 0 ? 1 / lbDensity : 1; 
    const gridDivs = Math.max(1, Math.round(Math.max(simSize.x, simSize.z) * lbDensity));
    const gridGridColor = theme === "light" ? "#cbd5e1" : "#222233";
    const gridHelper = new THREE.GridHelper(Math.max(simSize.x, simSize.z), gridDivs, lbColor, gridGridColor);
    gridHelper.position.set(simSize.x / 2, 0, simSize.z / 2);
    group.add(gridHelper);

    // 2. Ohraničenie oblasti (Bounding Box)
    const boxGeo = new THREE.BoxGeometry(simSize.x, simSize.y, simSize.z);
    const edges = new THREE.EdgesGeometry(boxGeo, 15);
    const boxLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: lbColor, opacity: 0.5, transparent: true }));
    boxLines.position.set(simSize.x / 2, simSize.y / 2, simSize.z / 2);
    group.add(boxLines);

    // 3. Lattice Body – hustota bodov podľa lbDensity (body/jednotku)
    const pts: number[] = [];
    const sp = Math.max(0.01, lbSpacing);
    for (let x = 0; x <= simSize.x + 1e-9; x += sp) {
      for (let y = 0; y <= simSize.y + 1e-9; y += sp) {
        for (let z = 0; z <= simSize.z + 1e-9; z += sp) {
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
  }, [simSize, showLB, lbColor, lbDensity, theme]);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.children.forEach(child => {
        if (child.userData?.interactable) {
          child.traverse(c => {
            if (c.name === "__edge_highlight__") c.visible = showEdges;
          });
        }
      });
    }
  }, [showEdges]);

  // --- THREE.JS INITIALIZATION ---
  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme === "light" ? 0xf8fafc : 0x0a0c10);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.set(simSizeRef.current.x, simSizeRef.current.y + 5, simSizeRef.current.z + 10);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true, preserveDrawingBuffer: true });
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
        // Preskočiť stencil cap plochy – nesmú blokovať kliknutie/drag
        let isCapChild = false;
        let tmp: THREE.Object3D | null = h.object;
        while (tmp) { if (tmp.name === '__clipCap__') { isCapChild = true; break; } tmp = tmp.parent; }
        if (isCapChild) continue;

        let obj: THREE.Object3D | null = h.object;
        while (obj) {
          if (obj.userData?.interactable) { interactableHit = obj; break; }
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

      // Shift+click = pridaj/odoober z multi-výberu
      if (e.shiftKey && obj) {
        const uuid = obj.uuid;
        const alreadyIn = multiSelectRef.current.includes(uuid);
        const next = alreadyIn
          ? multiSelectRef.current.filter(id => id !== uuid)
          : [...multiSelectRef.current, uuid];
        multiSelectRef.current = next;
        setMultiSelect([...next]);
        if (obj instanceof THREE.Mesh) {
          (obj.material as THREE.MeshStandardMaterial).emissive.setHex(alreadyIn ? 0x000000 : 0x113322);
        }
        return;
      }

      // Normálny klik – zruš multi-výber
      multiSelectRef.current = [];
      setMultiSelect([]);

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
      
      // Neohraničujeme voči LB sieti - ESPResSo zvláda pozíciu mimo simulácie
      const mesh = selectedMeshRef.current;
      mesh.position.set(sX, mesh.position.y, sZ);
      setTransform(prev => ({ ...prev, x: sX, z: sZ }));
      // Re-aplikuj rez keď sa objekt hýbe
      if (false) {
      }
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
      
      // Neobmedzujeme
      mesh.position.x = snap(mesh.position.x, 0.1);
      mesh.position.y = Math.max(0, snap(mesh.position.y, 0.1));
      mesh.position.z = snap(mesh.position.z, 0.1);

      setTransform(prev => ({ ...prev, x: mesh.position.x, y: mesh.position.y, z: mesh.position.z }));
      patchSelectedDebounced({ pos_x: mesh.position.x, pos_y: mesh.position.y, pos_z: mesh.position.z });
      // Re-aplikuj rez keď sa objekt hýbe
      if (false) {
      }
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
  }, [loadScene, patchSelectedDebounced]);

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

    // Unikátne meno podľa počtu existujúcich objektov tohto typu
    const existingCount = sceneRef.current.children.filter(
      c => c.userData?.type === dragType && c.userData?.interactable
    ).length;
    const uniqueName = dragType === "cube" ? `Kocka${existingCount + 1}` : `Valec${existingCount + 1}`;

    if (dragType === "cube") {
      params = { width: 1, height: 1, depth: 1, name: uniqueName };
      geometry = new THREE.BoxGeometry(1, 1, 1);
      geometry.translate(0.5, 0.5, 0.5);
    } else {
      params = { radiusTop: 0.5, radiusBottom: 0.5, height: 1, name: uniqueName };
      geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
    }

    const material = new THREE.MeshStandardMaterial({ 
      color: dragType === "cube" ? 0x00aaff : 0xffaa00,
      clippingPlanes: []
    });

    const mesh = new THREE.Mesh(geometry, material);
    
    // Neobmedzujeme na simbox
    point.x = snap(point.x, 0.1);
    point.y = Math.max(0, snap(point.y, 0.1));
    point.z = snap(point.z, 0.1);
    mesh.position.copy(point);

    mesh.userData = { interactable: true, type: dragType, params, dbId: undefined, name: params.name, clipHeight: 0, clipAngle: 0, bevelRadius: 0 };
    const edgeGeo = new THREE.EdgesGeometry(mesh.geometry, 15);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 });
    const edgeMesh = new THREE.LineSegments(edgeGeo, edgeMat);
    edgeMesh.name = "__edge_highlight__";
      edgeMesh.visible = showEdgesRef.current;
    edgeMesh.visible = showEdgesRef.current;
    mesh.add(edgeMesh);

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
    } else {
      // Demo mode – okamžite ulož do localStorage
      const allMeshes = sceneRef.current!.children.filter(c => c.userData?.interactable);
      const data = allMeshes.map(m => ({
        type: m.userData.type,
        pos_x: m.position.x, pos_y: m.position.y, pos_z: m.position.z,
        rotation_y: m.rotation.y,
        params: m.userData.params ?? {},
      }));
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
    }
  }, [dragType, projectId, simSize, createObjectInDB, syncObjectsList]);

  // --- ZLÚČENIE OBJEKTOV (CSG union) ---
  const mergeSelected = useCallback(async () => {
    if (!sceneRef.current || multiSelectRef.current.length < 2) return;
    const scene = sceneRef.current;

    const objs = multiSelectRef.current
      .map(uuid => scene.children.find(c => c.uuid === uuid))
      .filter(Boolean) as THREE.Object3D[];

    const meshes = objs.filter(m => m instanceof THREE.Mesh) as THREE.Mesh[];
    if (meshes.length < 2) {
      alert("Zlúčenie funguje len pre kocky a valce (nie RBC bunky).");
      return;
    }

    // Ulož pôvodné časti pre export
    const parts = meshes.map(m => ({
      type: m.userData.type as string,
      pos_x: m.position.x, pos_y: m.position.y, pos_z: m.position.z,
      rotation_y: m.rotation.y,
      params: { ...(m.userData.params || {}), rotX: m.rotation.x, rotZ: m.rotation.z },
    }));

    // CSG union – spoj všetky vybrané meshe
    let result = meshes[0].clone() as THREE.Mesh;
    result.updateMatrix();
    for (let i = 1; i < meshes.length; i++) {
      const next = meshes[i].clone() as THREE.Mesh;
      next.updateMatrix();
      result = CSG.union(result, next);
    }
    // Nastav materiál výsledku
    (result.material as THREE.MeshStandardMaterial).color.setHex(0x886622);

    const mergedCount = scene.children.filter(c => c.userData?.type === "merged").length;
    const mergedName = `Zlúčený${mergedCount + 1}`;
    const mergedParams = { parts, name: mergedName };
    result.userData = { interactable: true, type: "merged" as ObjectType, params: mergedParams, dbId: undefined, name: mergedName, clipHeight: 0, clipAngle: 0 };

    // Zmaž pôvodné objekty
    for (const m of meshes) {
      scene.remove(m);
      if (m.userData.dbId && projectId) {
        await fetch(`/api/objects/${m.userData.dbId}`, { method: "DELETE" }).catch(() => {});
      }
    }

    scene.add(result);
    multiSelectRef.current = [];
    setMultiSelect([]);
    selectedMeshRef.current = result;
    setSelected({ mesh: result, type: "merged" as ObjectType, params: mergedParams });
    setTransform({ x: result.position.x, y: result.position.y, z: result.position.z, rotX: 0, rotY: 0, rotZ: 0 });
    syncObjectsList();

    if (projectId) {
      try {
        const created = await createObjectInDB({
          project_id: projectId, type: "merged",
          pos_x: result.position.x, pos_y: result.position.y, pos_z: result.position.z,
          rotation_y: 0, params: mergedParams,
        });
        result.userData.dbId = created.id;
      } catch (err: any) { alert(err?.message); }
    } else {
      const allObjs = scene.children.filter(c => c.userData?.interactable);
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(allObjs.map(m => ({
        type: m.userData.type, pos_x: m.position.x, pos_y: m.position.y, pos_z: m.position.z,
        rotation_y: m.rotation.y, params: m.userData.params ?? {},
      }))));
    }
  }, [projectId, createObjectInDB, syncObjectsList]);

  // --- IMPORT RBC BUNKY (Guľa + Membrána = Group) ---
  const handleImportRBC = useCallback(async (rbcGroup: THREE.Group) => {
    if (!sceneRef.current) return;

    // Extrakuj vertices a indices z membrány (meshChild s indexovanou geometriou)
    const membraneMeshChild = rbcGroup.children.find(
      (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.geometry.getIndex() !== null
    );
    let vertices: number[] = [];
    let indices: number[] = [];
    if (membraneMeshChild) {
      const posAttr = membraneMeshChild.geometry.getAttribute('position') as THREE.BufferAttribute;
      vertices = Array.from(posAttr.array as Float32Array);
      const indexAttr = membraneMeshChild.geometry.getIndex()!;
      indices = Array.from(indexAttr.array as Uint16Array | Uint32Array);
    }

    const existingCount = sceneRef.current.children.filter(c => c.userData?.type === "rbc").length;
    const uniqueName = `Bunka${existingCount + 1}`;
    const params = { vertices, indices, name: uniqueName };

    rbcGroup.userData = {
      interactable: true, type: "rbc", params,
      dbId: undefined, name: uniqueName, clipHeight: 0, clipAngle: 0,
    };

    sceneRef.current.add(rbcGroup);
    syncObjectsList();

    if (projectId) {
      try {
        const created = await createObjectInDB({
          project_id: projectId, type: "rbc",
          pos_x: rbcGroup.position.x, pos_y: rbcGroup.position.y, pos_z: rbcGroup.position.z,
          rotation_y: rbcGroup.rotation.y, params,
        });
        rbcGroup.userData.dbId = created.id;
      } catch (err: any) { alert(err?.message); }
    } else {
      // Demo mode – ulož do localStorage
      const allObjs = sceneRef.current!.children.filter(c => c.userData?.interactable);
      const data = allObjs.map(m => ({
        type: m.userData.type,
        pos_x: m.position.x, pos_y: m.position.y, pos_z: m.position.z,
        rotation_y: m.rotation.y,
        params: m.userData.params ?? {},
      }));
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
    }
  }, [projectId, createObjectInDB, syncObjectsList]);

  // --- SAVE SCENE ---
  const saveScene = useCallback(async () => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const meshes = scene.children.filter(c => c.userData?.interactable === true);

    if (!projectId) {
      // Demo mode – ulož do localStorage
      const data = meshes.map(m => ({
        type: m.userData.type,
        pos_x: m.position.x, pos_y: m.position.y, pos_z: m.position.z,
        rotation_y: m.rotation.y,
        params: m.userData.params ?? {},
      }));
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
      return;
    }

    setSaveStatus("saving");
    try {
      const objects = [
        // Špeciálny záznam pre LB nastavenia
        {
          type: "__lb_settings__",
          pos_x: 0, pos_y: 0, pos_z: 0, rotation_y: 0,
          params: { simSize, lbDensity, lbColor, showLB },
        },
        ...meshes.map(m => ({
        type: m.userData.type ?? "cube",
        pos_x: m.position.x, pos_y: m.position.y, pos_z: m.position.z,
        rotation_y: m.rotation.y,
        params: {
          ...(m.userData.params ?? {}),
          rotX: m.rotation.x,
          rotY: m.rotation.y,
          rotZ: m.rotation.z,
          name: m.userData.name,
          clipHeight: m.userData.clipHeight ?? 0,
          clipAngle: m.userData.clipAngle ?? 0,
          bevelRadius: m.userData.bevelRadius ?? 0,
          bevelGroup: m.userData.bevelGroup ?? "Všetky",
        },
      }))];

      const res = await fetch("/api/objects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, objects }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "Save failed");
      }

      // Synchronizácia dbId pre každý mesh (po bulk replace sú nové IDs)
      const updated = await fetch(`/api/objects?project_id=${projectId}`);
      if (updated.ok) {
        const rows = await updated.json() as DbObjectRow[];
        meshes.forEach((m, i) => { if (rows[i]) m.userData.dbId = rows[i].id; });
      }

      // --- SAVE THUMBNAIL ---
      const canvas = mountRef.current?.querySelector("canvas");
      if (canvas) {
        const thumbnail = canvas.toDataURL("image/jpeg", 0.5);
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ thumbnail }),
        }).catch(err => console.error("Failed to save thumbnail:", err));
      }

      setSaveStatus("saved");
    } catch (err: any) {
      console.error(err);
      setSaveStatus("error");
    } finally {
      setTimeout(() => setSaveStatus("idle"), 2500);
    }
  }, [projectId, simSize, lbDensity, lbColor, showLB]);

  // --- STL EXPORT PRE PARAVIEW ---
  const exportSTL = useCallback(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Exportuj len interaktívne objekty (nie mriežku, svetlá a pod.)
    const exportScene = new THREE.Scene();
    scene.children
      .filter(c => c.userData?.interactable === true)
      .forEach(obj => {
        // Klon s aplikovanými world-space transformáciami
        const clone = obj.clone(true);
        exportScene.add(clone);
      });

    const exporter = new STLExporter();
    const stlBinary = exporter.parse(exportScene, { binary: true }) as unknown as ArrayBuffer;
    const blob = new Blob([stlBinary], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "model.stl";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // --- KONTROLA TVAROV (GAPS) ---
  const checkGeometryGaps = useCallback(() => {
    if (!sceneRef.current) return;
    const interactables = sceneRef.current.children.filter((c): c is THREE.Mesh | THREE.Group => 
      c.userData?.interactable === true && (c instanceof THREE.Mesh || c instanceof THREE.Group)
    );
    
    let gapFound = false;
    let gapDetails: string[] = [];

    const processObject = (p: any, type: string, name: string) => {
      const w = Number(p.width ?? p.w ?? 1);
      const h = Number(p.height ?? p.h ?? 1);
      const d = Number(p.depth ?? p.d ?? 1);
      const r = Number(p.bevelRadius ?? 0);
      
      // 1. Skontroluj zaoblené hrany
      if (r > 0) {
        const maxR = Math.min(w / 2, h / 2, d / 2);
        if (r >= maxR) {
          gapFound = true;
          gapDetails.push(`- [${name}]: Polomer zaoblenia (${r}) je príliš veľký. V ESPResSo to vygeneruje prerazenú geometriu. Maximálne povolené zaoblenie pre tento rozmer je < ${maxR}.`);
        }
      }
      
      // 2. Skontroluj zrezania
      const ch = Number(p.clipHeight ?? 0);
      const ca = Number(p.clipAngle ?? 0);
      if (ch !== 0 || ca !== 0) {
         if (ch >= h || ch < 0) {
           gapFound = true;
           gapDetails.push(`- [${name}]: Zrezanie (výška ${ch}) je nastavené na príliš hrubú úroveň. Rovina odsekne celý objekt alebo jeho spodnú podstavu, čo môže v ESPResSo tvoriť nedefinovanú hranicu.`);
         } else if (ca !== 0) {
           // Jednoduchý test – či sklon zrezania prečnieva spodnú stranu pri danom šírke:
           // tan(u Uhol) * w -> koľko výšky zoberie rez pozdĺž šírky.
           // Ak ch - zoberie viac ako h, zreže ho úplne atď.
           const cutDrop = w * Math.tan(Math.abs(ca) * Math.PI / 180);
           if (ch - cutDrop < 0) {
             gapFound = true;
             gapDetails.push(`- [${name}]: Uhol zrezania (${ca}°) pri danej výške rezu pretne samotnú podstavu geometrie. ESPResSo nedokáže spojiť rez do jedného plného telesa.`);
           }
         }
      }
    };

    interactables.forEach(c => {
      const t = String(c.userData.type || "");
      const p = c.userData.params || {};
      const name = c.userData.name || t;

      if (t === "merged" && Array.isArray(p.parts)) {
         p.parts.forEach((part: any, i: number) => {
            processObject(part.params || {}, part.type || "", `${name} (časť ${i+1})`);
         });
      } else {
         processObject(p, t, name);
      }
    });

    if (gapFound) {
      alert("⚠️ BOLI NÁJDENÉ POTENCIÁLNE MEDZERY/CHYBY TVAROV PRE ESPRESSO:\n\n" + gapDetails.join("\n\n"));
    } else {
      alert("✅ Kontrola zrezaní a zaoblení prebehla úspešne. Parametre sú v bezpečných limitoch a nevygenerujú sa žiadne interné medzery.");
    }
  }, []);

  // --- DELETE & UPDATE ---
  const deleteSelected = useCallback(async () => {
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
  }, [projectId, syncObjectsList]);

  // --- COPY / PASTE ---
  const copiedObjectRef = useRef<any>(null);

  const copySelected = useCallback(() => {
    const mesh = selectedMeshRef.current;
    if (!mesh) return;
    copiedObjectRef.current = {
      type: mesh.userData.type,
      pos_x: mesh.position.x,
      pos_y: mesh.position.y,
      pos_z: mesh.position.z,
      rotation_y: mesh.rotation.y,
      params: JSON.parse(JSON.stringify(mesh.userData.params || {})),
      paramExprs: JSON.parse(JSON.stringify(mesh.userData.paramExprs || {})),
      scale: { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z },
    };
  }, []);

  const pasteObject = useCallback(async () => {
    const src = copiedObjectRef.current;
    if (!src || !sceneRef.current) return;
    const offset = 1;
    const fakeRow: any = {
      id: "__paste__",
      project_id: projectId ?? "",
      type: src.type,
      pos_x: src.pos_x + offset,
      pos_y: src.pos_y,
      pos_z: src.pos_z + offset,
      rotation_y: src.rotation_y,
      params: { ...src.params },
    };
    const newMesh = createMeshFromRow(fakeRow);
    newMesh.userData.dbId = undefined;
    newMesh.userData.paramExprs = src.paramExprs;
    newMesh.scale.set(src.scale.x, src.scale.y, src.scale.z);
    sceneRef.current.add(newMesh);
    syncObjectsList();
    // Select new mesh
    selectedMeshRef.current = newMesh;
    setSelected({ mesh: newMesh as any, type: src.type, params: fakeRow.params });
    setTransform({ x: fakeRow.pos_x, y: fakeRow.pos_y, z: fakeRow.pos_z, rotX: 0, rotY: 0, rotZ: 0 });
    if (projectId) {
      try {
        const created = await createObjectInDB({
          project_id: projectId, type: src.type,
          pos_x: fakeRow.pos_x, pos_y: fakeRow.pos_y, pos_z: fakeRow.pos_z,
          rotation_y: fakeRow.rotation_y,
          params: fakeRow.params,
        });
        newMesh.userData.dbId = created.id;
      } catch (err: any) { alert(err?.message); }
    }
  }, [projectId, createObjectInDB, createMeshFromRow, syncObjectsList]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete") void deleteSelected();
      if (e.ctrlKey && e.key === "c") copySelected();
      if (e.ctrlKey && e.key === "v") void pasteObject();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelected, copySelected, pasteObject]);

  const updateColorPanel = (colorValue: string) => {
    if (!selectedMeshRef.current) return;
    const mesh = selectedMeshRef.current;
    mesh.traverse((m) => {
      if (m instanceof THREE.Mesh && m.material && m.name !== "__edge_highlight__" && "color" in m.material) {
        (m.material as THREE.MeshStandardMaterial).color.set(colorValue);
        m.userData.originalColor = (m.material as THREE.MeshStandardMaterial).color.getHex();
      }
    });
    mesh.userData.params = { ...mesh.userData.params, color: colorValue };
    patchSelectedDebounced({ params: mesh.userData.params });
  };

  const updateTransformPanel = (field: string, value: number) => {
    if (!selectedMeshRef.current) return;
    const mesh = selectedMeshRef.current;
    
    let v = value;
    // Neoverujeme limity X/Y/Z podľa simSize
    if (field === 'y') v = Math.max(0, v);

    if (field === 'x' || field === 'y' || field === 'z') mesh.position[field] = v;
    if (field === 'rotX') mesh.rotation.x = THREE.MathUtils.degToRad(v);
    if (field === 'rotY') mesh.rotation.y = THREE.MathUtils.degToRad(v);
    if (field === 'rotZ') mesh.rotation.z = THREE.MathUtils.degToRad(v);
    if (field === 'scaleX') mesh.scale.x = Math.max(0.01, v);
    if (field === 'scaleY') mesh.scale.y = Math.max(0.01, v);
    if (field === 'scaleZ') mesh.scale.z = Math.max(0.01, v);

    setTransform(prev => ({ ...prev, [field]: v }));

    mesh.userData.params = { ...mesh.userData.params, rotX: mesh.rotation.x, rotZ: mesh.rotation.z,
      scaleX: mesh.scale.x, scaleY: mesh.scale.y, scaleZ: mesh.scale.z };
    patchSelectedDebounced({
      pos_x: mesh.position.x, pos_y: mesh.position.y, pos_z: mesh.position.z,
      rotation_y: mesh.rotation.y,
      params: mesh.userData.params,
    });

    // Re-aplikuj zrezanie v novom world-space (rotácia/pohyb mohli zmeniť orientáciu)
    if (false) {
    }
  };

  // Aktualizácia rozmerov (width/height/depth/radius) vybraného objektu
  const refreshEdgeHighlight = (mesh: THREE.Mesh) => {
    const oldEdge = mesh.getObjectByName("__edge_highlight__") as THREE.LineSegments | undefined;
    if (oldEdge && oldEdge.geometry) oldEdge.geometry.dispose();
    if (oldEdge) mesh.remove(oldEdge);
    const edgeGeo = new THREE.EdgesGeometry(mesh.geometry, 15);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 });
    const edgeMesh = new THREE.LineSegments(edgeGeo, edgeMat);
    edgeMesh.name = "__edge_highlight__";
      edgeMesh.visible = showEdgesRef.current;
    edgeMesh.visible = showEdgesRef.current;
    mesh.add(edgeMesh);
  };

  const updateDimensions = useCallback((updatedParams: Record<string, number>) => {
    const mesh = selectedMeshRef.current;
    if (!mesh) return;
    const type = mesh.userData.type as ObjectType;
    const oldParams = mesh.userData.params || {};
    const newParams = { ...oldParams, ...updatedParams };

    if (type === "cube" && mesh instanceof THREE.Mesh) {
      const { width = 1, height = 1, depth = 1, bevelRadius = 0, bevelEdges, bevelGroup } = newParams;
      const edges = bevelEdges ? new Set<string>(bevelEdges as string[]) : edgeGroupToSet(bevelGroup as EdgeGroup);
      mesh.geometry.dispose();
      mesh.geometry = buildBevelGeometryEdges(width, height, depth, bevelRadius, edges, !!newParams.isChamfer);
      refreshEdgeHighlight(mesh as THREE.Mesh);

      if (newParams.clipHeight || newParams.clipAngle) {
      }
    } else if (type === "cylinder" && mesh instanceof THREE.Mesh) {
      const { radiusTop = 0.5, radiusBottom = 0.5, height = 1 } = newParams;
      mesh.geometry.dispose();
      mesh.geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 32);
      refreshEdgeHighlight(mesh as THREE.Mesh);

      if (newParams.clipHeight || newParams.clipAngle) {
      }
    }

    mesh.userData.params = newParams;
    setSelected(prev => prev ? { ...prev, params: newParams } : prev);
    patchSelectedDebounced({ params: newParams });
  }, [patchSelectedDebounced]);

  const updateClipping = (height: number, angleDeg: number) => {
    const mesh = selectedMeshRef.current;
    if (!mesh) return;

    // Ulož do userData aj do params (pre DB)
    mesh.userData.clipHeight = height;
    mesh.userData.clipAngle = angleDeg;
    mesh.userData.params = { ...mesh.userData.params, clipHeight: height, clipAngle: angleDeg };

    // Aplikuj rez v world-space (funguje aj pre rotované objekty)

    // Ulož do DB
    patchSelectedDebounced({ params: mesh.userData.params });
  };

  const updateBevel = (edges: Set<string>, radius: number, isChamfer: boolean = false) => {
    const mesh = selectedMeshRef.current;
    if (!mesh || !(mesh instanceof THREE.Mesh) || mesh.userData.type !== "cube") return;
    const p = mesh.userData.params || {};
    const w = p.width || 1, h = p.height || 1, d = p.depth || 1;

    if (mesh.geometry) mesh.geometry.dispose();
    mesh.geometry = buildBevelGeometryEdges(w, h, d, radius, edges, isChamfer);

    refreshEdgeHighlight(mesh as THREE.Mesh);

    mesh.userData.bevelRadius = radius;
    mesh.userData.bevelEdges = Array.from(edges);
    mesh.userData.params = { ...mesh.userData.params, bevelRadius: radius, bevelEdges: Array.from(edges), isChamfer: isChamfer };

    if (false) {
    }

    patchSelectedDebounced({ params: mesh.userData.params });
  };

  return (
    <div className="relative flex h-full w-full bg-[var(--background)]">
      <SimSettingsPanel projectId={projectId} />
      {/* Horný Panel LB Siete */}
      <div className="absolute top-4 left-[396px] right-[280px] z-30 flex justify-center pointer-events-none">
        <div className="flex items-center flex-wrap justify-center gap-4 xl:gap-6 bg-[var(--card-bg)]/90 px-4 py-3 xl:px-6 rounded-2xl shadow-xl border border-[var(--border)] pointer-events-auto max-w-full">
          <div className="flex flex-col">
          <label className="text-[10px] text-[var(--accent)] font-bold uppercase mb-1">Veľkosť simulácie (LB Sieť)</label>
          <div className="flex gap-2">
            <input type="number" value={simSize.x} onChange={e => setSimSize({...simSize, x: +e.target.value})} className="w-14 bg-[var(--background)] border border-[var(--border)] rounded p-1 text-[var(--foreground)] text-xs" />
            <input type="number" value={simSize.y} onChange={e => setSimSize({...simSize, y: +e.target.value})} className="w-14 bg-[var(--background)] border border-[var(--border)] rounded p-1 text-[var(--foreground)] text-xs" />
            <input type="number" value={simSize.z} onChange={e => setSimSize({...simSize, z: +e.target.value})} className="w-14 bg-[var(--background)] border border-[var(--border)] rounded p-1 text-[var(--foreground)] text-xs" />
          </div>
        </div>
        <div className="w-px h-8 bg-[var(--border)]"></div>
        <div className="flex items-center gap-3">
          <input type="color" value={lbColor} onChange={e => setLbColor(e.target.value)} className="w-6 h-6 cursor-pointer bg-transparent" />
          <label className="text-xs text-[var(--foreground)] flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showLB} onChange={e => setShowLB(e.target.checked)} className="accent-sky-500" />
            Zobraziť sieť
          </label>
          <label className="text-xs text-[var(--foreground)] flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showEdges} onChange={e => setShowEdges(e.target.checked)} className="accent-[var(--accent)]" />
            Zobraziť hrany

          </label>
        </div>
        <div className="w-px h-8 bg-[var(--border)]"></div>
        <div className="flex flex-col">
          <label className="text-[10px] text-[var(--accent)] font-bold uppercase mb-1">Hustota LB (b/j)</label>
          <input
            type="number" min="0.1" step="0.1"
            value={lbDensity}
            onChange={e => setLbDensity(Math.max(0.1, +e.target.value))}
            className="w-16 bg-[var(--background)] border border-[var(--border)] rounded p-1 text-[var(--foreground)] text-xs text-center"
          />
        </div>
        <div className="w-px h-8 bg-[var(--border)]"></div>
        {/* Export STL pre ParaView */}
        <button
          onClick={() => exportSTL()}
          className="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition border bg-violet-800 hover:bg-violet-600 border-violet-600 text-white"
          title="Exportuj scénu ako STL súbor pre ParaView"
        >
          Export STL
        </button>
        {/* Check Gaps in Geometry */}
        <button
          onClick={checkGeometryGaps}
          className="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition border bg-fuchsia-800 hover:bg-fuchsia-600 border-fuchsia-600 text-white"
          title="Skontroluje medzery zrezaných a zaoblených objektov, aby sa správne vygenerovali v ESPResSo"
        >
          Kontrola tvarov a medzier
        </button>

        <div className="w-px h-8 bg-[var(--border)]"></div>
        {/* Save Scene */}
        <button
          onClick={() => void saveScene()}
          disabled={saveStatus === "saving"}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition border
            ${saveStatus === "saved" ? "bg-emerald-700 border-emerald-500 text-white" :
              saveStatus === "error" ? "bg-red-800 border-red-500 text-white" :
              saveStatus === "saving" ? "bg-[var(--border)] border-slate-500 text-slate-400 cursor-not-allowed" :
              "bg-sky-800 hover:bg-sky-600 border-sky-600 text-white"}`}
        >
          {saveStatus === "saving" ? "Ukladám..." :
           saveStatus === "saved" ? "Uložené ✓" :
           saveStatus === "error" ? "Chyba ✗" :
           "Uložiť scénu"}
        </button>
        </div>
      </div>

      <DragMenu
        onStartDrag={(t: string) => setDragType(t as ObjectType)}
        onImportRBC={handleImportRBC}
        sceneParams={sceneParams}
        onParamsChange={setSceneParams}
      />

      <SceneGraph 
        objects={objects} 
        selectedId={selected?.mesh.uuid}
        onSelect={(obj: THREE.Object3D) => {
          // Zmaž highlight zo všetkých objektov
          sceneRef.current?.children.forEach(c => {
            if (c.userData?.interactable && c instanceof THREE.Mesh) {
              (c.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
            }
          });
          // Vysvieti vybraný
          if (obj instanceof THREE.Mesh) {
            (obj.material as THREE.MeshStandardMaterial).emissive.setHex(0x333333);
          }
          selectedMeshRef.current = obj;
          setSelected({ mesh: obj, type: obj.userData.type || "group", params: obj.userData.params || {} });
          setTransform({
            x: obj.position.x, y: obj.position.y, z: obj.position.z,
            rotX: THREE.MathUtils.radToDeg(obj.rotation.x), rotY: THREE.MathUtils.radToDeg(obj.rotation.y), rotZ: THREE.MathUtils.radToDeg(obj.rotation.z),
          });
        }}
      />

      {/* Multi-výber – lišta Zlúčiť */}
      {multiSelect.length >= 2 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[var(--card-bg)]/95 border border-emerald-600 rounded-xl px-5 py-2.5 shadow-2xl">
          <span className="text-xs text-emerald-300 font-bold">{multiSelect.length} objekty vybrané</span>
          <button
            onClick={() => void mergeSelected()}
            className="bg-emerald-700 hover:bg-emerald-500 text-[var(--foreground)] text-xs font-bold px-3 py-1.5 rounded transition"
          >
            ⊕ Zlúčiť do 1 tvaru
          </button>
          <button
            onClick={() => { multiSelectRef.current = []; setMultiSelect([]); }}
            className="bg-[var(--border)] hover:bg-[var(--card-bg)] text-[var(--foreground)] text-xs px-2.5 py-1.5 rounded transition"
          >
            Zrušiť
          </button>
        </div>
      )}

      {/* Renderovacia zóna s obnoveným dropom */}
      <div ref={mountRef} className="flex-1" onDragOver={e => e.preventDefault()} onDrop={handleDrop} />

      {selected && (
        <ObjectPanel 
          key={selected.mesh.uuid}
          selected={selected.mesh} 
          transform={transform}
          simSize={simSize}
          sceneParams={sceneParams}
          onUpdate={updateTransformPanel}
          onColorUpdate={updateColorPanel}
          onDimUpdate={updateDimensions}
          onClip={updateClipping}
          onBevel={updateBevel}
          onDelete={deleteSelected}
        />
      )}
    </div>
  );
}