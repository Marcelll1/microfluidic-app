"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import DragMenu from "./DragMenu";
import ObjectPanel from "./ObjectPanel";

type ObjectType = "cube" | "cylinder";

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

type CubeParams = { width: number; height: number; depth: number };
type CylinderParams = { radiusTop: number; radiusBottom: number; height: number };
type ObjectParams = CubeParams | CylinderParams;
type Transform = { x: number; y: number; z: number; rotationY: number };
type Selected = { mesh: THREE.Mesh; type: ObjectType; params: ObjectParams };

/** Snap value to given step (0.1) */
function snap(value: number, step = 0.1) {
  return Math.round(value / step) * step;
}

export default function Scene3D({ projectId }: { projectId: string | null }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const [dragType, setDragType] = useState<ObjectType | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [transform, setTransform] = useState<Transform>({
    x: 0,
    y: 0,
    z: 0,
    rotationY: 0,
  });

  // This ref tracks currently selected mesh even inside event handlers
  const selectedMeshRef = useRef<THREE.Mesh | null>(null);

  // Flags for dragging
  const isDraggingRef = useRef(false);

  /** Create mesh from DB row (used when loading scene) */
const createMeshFromRow = useCallback((row: DbObjectRow): THREE.Mesh => {
  let geometry: THREE.BufferGeometry;

  if (row.type === "cube") {
    const p = (row.params || {
      width: 1,
      height: 1,
      depth: 1,
    }) as CubeParams;

    geometry = new THREE.BoxGeometry(p.width, p.height, p.depth);
    // Move origin to back-left-bottom corner
    geometry.translate(p.width / 2, p.height / 2, p.depth / 2);

  } else {
    const p = (row.params || {
      radiusTop: 0.5,
      radiusBottom: 0.5,
      height: 1,
    }) as CylinderParams;

    geometry = new THREE.CylinderGeometry(
      p.radiusTop,
      p.radiusBottom,
      p.height,
      32
    );
  }

  const material = new THREE.MeshStandardMaterial({
    color: row.type === "cube" ? 0x00aaff : 0xffaa00,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(row.pos_x, row.pos_y, row.pos_z);
  mesh.rotation.y = row.rotation_y;

  mesh.userData = {
    type: row.type,
    params: row.params,
  };

  return mesh;
}, []);

  /** Load scene objects from DB once scene is ready */
  const loadScene = useCallback(async () => {
    if (!projectId || !sceneRef.current) return;

    try {
      const res = await fetch(`/api/objects?project_id=${projectId}`);
      if (!res.ok) {
        const text = await res.text();
        console.error("Failed to load scene:", res.status, res.statusText, text);
        return;
      }

      const data = (await res.json()) as DbObjectRow[];

      const scene = sceneRef.current;
      const meshes = scene.children.filter((c) => c instanceof THREE.Mesh);
      meshes.forEach((m) => scene.remove(m));

      for (const row of data) {
        const mesh = createMeshFromRow(row);
        scene.add(mesh);
      }
    } catch (err) {
      console.error("Error while loading scene:", err);
    }
  }, [projectId, createMeshFromRow]);

  /** Save current scene to DB */
  const saveSceneToDB = useCallback(async () => {
    if (!projectId || !sceneRef.current) {
      console.warn("No projectId or scene, nothing to save");
      return;
    }

    const objects = sceneRef.current.children
      .filter((c) => c instanceof THREE.Mesh)
      .map((child) => {
        const mesh = child as THREE.Mesh;
        const { x, y, z } = mesh.position;
        return {
          project_id: projectId,
          type: (mesh.userData.type as ObjectType) ?? "cube",
          pos_x: x,
          pos_y: y,
          pos_z: z,
          rotation_y: mesh.rotation.y,
          params: mesh.userData.params ?? {},
        };
      });

    try {
      const res = await fetch("/api/objects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, objects }),
      });

      const json = await res.json();
      if (!res.ok) {
        console.error("Save to DB failed:", res.status, res.statusText, json);
      } else {
        console.log("Scene saved to DB:", json);
      }
    } catch (err) {
      console.error("Error while saving to DB:", err);
    }
  }, [projectId]);

  /** Listen to global saveScene event from layout */
  useEffect(() => {
    function handleSave() {
      void saveSceneToDB();
    }
    document.addEventListener("saveScene", handleSave);
    return () => document.removeEventListener("saveScene", handleSave);
  }, [saveSceneToDB]);

  /** Clear emissive highlight from all meshes */
  const clearHighlight = useCallback(() => {
    if (!sceneRef.current) return;
    sceneRef.current.children.forEach((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat.emissive) mat.emissive.setHex(0x000000);
      }
    });
  }, []);

  /** Delete currently selected object */
  const deleteSelected = useCallback(() => {
    if (!selectedMeshRef.current || !sceneRef.current) return;
    sceneRef.current.remove(selectedMeshRef.current);
    selectedMeshRef.current = null;
    setSelected(null);
  }, []);

  /** Keyboard Delete / Backspace removes object */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Delete") {
        deleteSelected();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelected]);

  /** Main Three.js setup and mouse interactions */
  useEffect(() => {
    if (!mountRef.current) return;

    const mount = mountRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1d25);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );
    camera.position.set(5, 5, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    scene.add(new THREE.GridHelper(20, 20));
    scene.add(new THREE.AxesHelper(5));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();

    /** Helper: pick first mesh under cursor */
    function pickMesh(e: MouseEvent): THREE.Mesh | null {
      if (!sceneRef.current || !cameraRef.current || !mountRef.current) return null;
      const rect = mountRef.current.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, cameraRef.current);
      const hits = raycaster.intersectObjects(sceneRef.current.children);
      const hit = hits.find((h) => h.object instanceof THREE.Mesh);
      return hit ? (hit.object as THREE.Mesh) : null;
    }

    /** Single-click: select + highlight + show panel */
    function onClick(e: MouseEvent) {
      // If we just finished dragging, ignore click
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        return;
      }

      const mesh = pickMesh(e);
      if (!mesh) {
        clearHighlight();
        selectedMeshRef.current = null;
        setSelected(null);
        return;
      }

      const type = (mesh.userData.type as ObjectType) ?? "cube";
      const params =
        (mesh.userData.params as ObjectParams) ??
        ({ width: 1, height: 1, depth: 1 } as CubeParams);

      clearHighlight();
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat.emissive) mat.emissive.setHex(0x333333);

      selectedMeshRef.current = mesh;
      setSelected({ mesh, type, params });
      setTransform({
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z,
        rotationY: mesh.rotation.y,
      });
    }

    /** Mouse down: start dragging selected mesh */
    function onMouseDown(e: MouseEvent) {
      if (!selectedMeshRef.current) return;
      const hit = pickMesh(e);
      if (hit && hit === selectedMeshRef.current) {
        isDraggingRef.current = true;
        // disable orbit while dragging
        controls.enabled = false;
      }
    }

    /** Mouse move: drag on ground plane with snap 0.1 */
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

      setTransform((prev) => ({
        ...prev,
        x: snappedX,
        z: snappedZ,
      }));
    }

    /** Mouse up: finish dragging */
    function onMouseUp() {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        controls.enabled = true;
      }
    }

    /** Wheel + Shift: move object along camera direction with snap 0.1 */
    function onWheel(e: WheelEvent) {
      if (!selectedMeshRef.current || !cameraRef.current) return;
      if (!e.shiftKey) return; // without Shift, let OrbitControls zoom normally

      e.preventDefault();

      const mesh = selectedMeshRef.current;
      const dir = new THREE.Vector3();
      cameraRef.current.getWorldDirection(dir);

      const delta = -Math.sign(e.deltaY) * 0.1; // step 0.1
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
    }

    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("mousedown", onMouseDown);
    renderer.domElement.addEventListener("mousemove", onMouseMove);
    renderer.domElement.addEventListener("mouseup", onMouseUp);
    renderer.domElement.addEventListener("mouseleave", onMouseUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // After scene is ready, load from DB
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
  }, [clearHighlight, loadScene]);

  /** Drag & drop creation of new objects (as before) */
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
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

    // geometry centered around origin
    geometry = new THREE.BoxGeometry(params.width, params.height, params.depth);

    // shift geometry so (0,0,0) becomes back-left-bottom corner
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
    mesh.userData = { type: dragType, params };

    sceneRef.current.add(mesh);
  }

  /** Update transform from panel */
  function updateTransform(field: keyof Transform, value: number) {
    if (!selectedMeshRef.current) return;

    const next = { ...transform, [field]: value };
    setTransform(next);

    const mesh = selectedMeshRef.current;
    mesh.position.set(next.x, next.y, next.z);
    mesh.rotation.y = next.rotationY;
  }

  /** Update geometry from panel */
  function updateGeometry(newParams: ObjectParams) {
    if (!selected) return;

    let geom: THREE.BufferGeometry;

    if (selected.type === "cube") {
  const p = newParams as CubeParams;

  let geom = new THREE.BoxGeometry(p.width, p.height, p.depth);
  // again move origin to back-left-bottom corner
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
  }

  return (
    <div className="relative flex h-full w-full">
      {/* Left menu with draggable primitives */}
      <DragMenu onStartDrag={(t: ObjectType) => setDragType(t)} />

      {/* Three.js canvas */}
      <div
        ref={mountRef}
        className="flex-1 bg-slate-950"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      />

      {/* Right panel for selected object */}
      {selected && (
        <ObjectPanel
          type={selected.type}
          params={selected.params}
          transform={transform}
          onUpdateTransform={updateTransform}
          onUpdateGeometry={updateGeometry}
          onDelete={deleteSelected}
        />
      )}
    </div>
  );
}
