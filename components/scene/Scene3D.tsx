"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import DragMenu from "./DragMenu";
import ObjectPanel from "./ObjectPanel";

type ObjectType = "cube" | "cylinder";
type CubeParams = { width: number; height: number; depth: number };
type CylinderParams = { radiusTop: number; radiusBottom: number; height: number };
type ObjectParams = CubeParams | CylinderParams;
type Transform = { x: number; y: number; z: number; rotationY: number };
type Selected = { mesh: THREE.Mesh; type: ObjectType; params: ObjectParams };

export default function Scene3D({ projectId }: { projectId: string | null }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const [dragType, setDragType] = useState<ObjectType | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [transform, setTransform] = useState<Transform>({
    x: 0, y: 0, z: 0, rotationY: 0,
  });

  // Setup Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1d25);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(5, 5, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);

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

    function onClick(e: MouseEvent) {
      if (!sceneRef.current || !cameraRef.current || !mountRef.current) return;
      const rect = mountRef.current.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, cameraRef.current);
      const hits = raycaster.intersectObjects(sceneRef.current.children);
      const hit = hits.find((h) => h.object instanceof THREE.Mesh);
      if (!hit) return setSelected(null);

      const mesh = hit.object as THREE.Mesh;
      const type = (mesh.userData.type as ObjectType) ?? "cube";
      const params = (mesh.userData.params as ObjectParams) ?? { width: 1, height: 1, depth: 1 };
      (mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x333333);
      setSelected({ mesh, type, params });
      setTransform({
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z,
        rotationY: mesh.rotation.y,
      });
    }

    renderer.domElement.addEventListener("click", onClick);

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      renderer.domElement.removeEventListener("click", onClick);
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

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
      geometry = new THREE.BoxGeometry(1, 1, 1);
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

  function updateTransform(field: keyof Transform, value: number) {
    if (!selected) return;
    const next = { ...transform, [field]: value };
    setTransform(next);
    selected.mesh.position.set(next.x, next.y, next.z);
    selected.mesh.rotation.y = next.rotationY;
  }

  function updateGeometry(newParams: ObjectParams) {
    if (!selected) return;
    let geom: THREE.BufferGeometry;
    if (selected.type === "cube") {
      const p = newParams as CubeParams;
      geom = new THREE.BoxGeometry(p.width, p.height, p.depth);
    } else {
      const p = newParams as CylinderParams;
      geom = new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, 32);
    }
    selected.mesh.geometry.dispose();
    selected.mesh.geometry = geom;
    selected.mesh.userData.params = newParams;
    setSelected({ ...selected, params: newParams });
  }

  return (
    <div className="relative flex h-full w-full">
      <DragMenu onStartDrag={(t) => setDragType(t)} />
      <div
        ref={mountRef}
        className="flex-1 bg-slate-950"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      />
      {selected && (
        <ObjectPanel
          type={selected.type}
          params={selected.params}
          transform={transform}
          onUpdateTransform={updateTransform}
          onUpdateGeometry={updateGeometry}
        />
      )}
    </div>
  );
}
