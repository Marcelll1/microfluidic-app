"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

type ObjectType = "cube" | "cylinder";

interface ObjectData {
  mesh: THREE.Mesh;
  type: ObjectType;
  params: any;
}

export default function Scene3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [dragType, setDragType] = useState<ObjectType | null>(null);
  const [selectedObject, setSelectedObject] = useState<ObjectData | null>(null);
  const [transformOpen, setTransformOpen] = useState(true);
  const [dimensionOpen, setDimensionOpen] = useState(true);
  const [objectTransform, setObjectTransform] = useState({ x: 0, y: 0, z: 0, rotationY: 0 });

  useEffect(() => {
    const mount = mountRef.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.set(5, 5, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.GridHelper(20, 20));
    scene.add(new THREE.AxesHelper(5));

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (event: MouseEvent) => {
      if (!sceneRef.current || !cameraRef.current) return;

      const rect = mount.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);
      const intersects = raycaster.intersectObjects(sceneRef.current.children);

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        const type = (mesh.userData.type as ObjectType) || "cube";
        const params = mesh.userData.params || {};

        // zvýraznenie
        sceneRef.current.children.forEach((child) => {
          if (child instanceof THREE.Mesh) {
            (child.material as THREE.MeshStandardMaterial).emissive.set(0x000000);
          }
        });
        (mesh.material as THREE.MeshStandardMaterial).emissive.set(0x333333);

        setSelectedObject({ mesh, type, params });
        setObjectTransform({
          x: mesh.position.x,
          y: mesh.position.y,
          z: mesh.position.z,
          rotationY: mesh.rotation.y
        });
      } else {
        setSelectedObject(null);
      }
    };

    renderer.domElement.addEventListener("click", onClick);

    return () => {
      mount.removeChild(renderer.domElement);
      renderer.domElement.removeEventListener("click", onClick);
    };
  }, []);

  // 🟦 Funkcia na pridanie objektu
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!sceneRef.current || !cameraRef.current || !mountRef.current || !dragType) return;

    const rect = mountRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const mouse = new THREE.Vector2(x, y);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, point);

    let geometry: THREE.BufferGeometry;
    let material = new THREE.MeshStandardMaterial({ color: dragType === "cube" ? 0x00aaff : 0xffaa00 });
    let params: any;

    if (dragType === "cube") {
      params = { width: 1, height: 1, depth: 1 };
      geometry = new THREE.BoxGeometry(params.width, params.height, params.depth);
    } else {
      params = { radiusTop: 0.5, radiusBottom: 0.5, height: 1 };
      geometry = new THREE.CylinderGeometry(params.radiusTop, params.radiusBottom, params.height, 32);
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(point);
    mesh.userData = { type: dragType, params };
    sceneRef.current.add(mesh);
  };

  // 🧩 Aktualizácia geometrie
  const updateGeometry = (newParams: any) => {
    if (!selectedObject || !sceneRef.current) return;
    const { mesh, type } = selectedObject;
    let newGeometry: THREE.BufferGeometry;

    if (type === "cube") {
      newGeometry = new THREE.BoxGeometry(newParams.width, newParams.height, newParams.depth);
    } else {
      newGeometry = new THREE.CylinderGeometry(newParams.radiusTop, newParams.radiusBottom, newParams.height, 32);
    }

    mesh.geometry.dispose();
    mesh.geometry = newGeometry;
    mesh.userData.params = newParams;
    setSelectedObject({ ...selectedObject, params: newParams });
  };

  // 🧭 Aktualizácia pozície/rotácie
  const updateTransform = (field: keyof typeof objectTransform, value: number) => {
    if (!selectedObject) return;
    const mesh = selectedObject.mesh;
    const updated = { ...objectTransform, [field]: value };
    setObjectTransform(updated);
    mesh.position.set(updated.x, updated.y, updated.z);
    mesh.rotation.y = updated.rotationY;
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Bočný panel */}
      <div style={{ width: 150, background: "#333", color: "#fff", padding: 10 }}>
        <div draggable onDragStart={() => setDragType("cube")} style={{ padding: 8, marginBottom: 8, background: "#00aaff", cursor: "grab", textAlign: "center" }}>Kocka</div>
        <div draggable onDragStart={() => setDragType("cylinder")} style={{ padding: 8, background: "#ffaa00", cursor: "grab", textAlign: "center" }}>Valec</div>
      </div>

      {/* Scéna */}
      <div ref={mountRef} style={{ flex: 1 }} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} />

      {/* Panel úprav */}
      {selectedObject && (
        <div
          style={{
            position: "absolute",
            top: 45,
            right: 0,
            background: "#222",
            color: "#fff",
            padding: 10,
            borderRadius: 8,
            width: 220,
            boxShadow: "0 0 10px rgba(0,0,0,0.5)",
          }}
        >
          <h4>Úprava objektu</h4>

          {/* Transformácia */}
          <div>
            <h5
              onClick={() => setTransformOpen(!transformOpen)}
              style={{ cursor: "pointer", color: "#0af", marginBottom: 4 }}
            >
              {transformOpen ? "▼" : "▶"} Transformácia
            </h5>
            {transformOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                <label>X: <input type="number" step="0.1" value={objectTransform.x} onChange={(e) => updateTransform("x", parseFloat(e.target.value))} /></label>
                <label>Y: <input type="number" step="0.1" value={objectTransform.y} onChange={(e) => updateTransform("y", parseFloat(e.target.value))} /></label>
                <label>Z: <input type="number" step="0.1" value={objectTransform.z} onChange={(e) => updateTransform("z", parseFloat(e.target.value))} /></label>
                <label>Rotácia Y: <input type="number" step="0.1" value={objectTransform.rotationY} onChange={(e) => updateTransform("rotationY", parseFloat(e.target.value))} /></label>
              </div>
            )}
          </div>

          {/* Rozmery */}
          <div>
            <h5
              onClick={() => setDimensionOpen(!dimensionOpen)}
              style={{ cursor: "pointer", color: "#0af", marginBottom: 4 }}
            >
              {dimensionOpen ? "▼" : "▶"} Rozmery
            </h5>
            {dimensionOpen && (
              <>
                {selectedObject.type === "cube" ? (
                  <>
                    <label>Šírka: <input type="number" step="0.1" value={selectedObject.params.width} onChange={(e) => updateGeometry({ ...selectedObject.params, width: parseFloat(e.target.value) })} /></label>
                    <label>Výška: <input type="number" step="0.1" value={selectedObject.params.height} onChange={(e) => updateGeometry({ ...selectedObject.params, height: parseFloat(e.target.value) })} /></label>
                    <label>Hĺbka: <input type="number" step="0.1" value={selectedObject.params.depth} onChange={(e) => updateGeometry({ ...selectedObject.params, depth: parseFloat(e.target.value) })} /></label>
                  </>
                ) : (
                  <>
                    <label>Vrchný priemer: <input type="number" step="0.1" value={selectedObject.params.radiusTop} onChange={(e) => updateGeometry({ ...selectedObject.params, radiusTop: parseFloat(e.target.value) })} /></label>
                    <label>Spodný priemer: <input type="number" step="0.1" value={selectedObject.params.radiusBottom} onChange={(e) => updateGeometry({ ...selectedObject.params, radiusBottom: parseFloat(e.target.value) })} /></label>
                    <label>Výška: <input type="number" step="0.1" value={selectedObject.params.height} onChange={(e) => updateGeometry({ ...selectedObject.params, height: parseFloat(e.target.value) })} /></label>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
