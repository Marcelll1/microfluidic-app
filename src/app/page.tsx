"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

export default function Home() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const [dragType, setDragType] = useState<"cube" | "cylinder" | null>(null);

  useEffect(() => {
    const mount = mountRef.current!;
    
    // --- Scéna ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    sceneRef.current = scene;

    // --- Kamera ---
    const camera = new THREE.PerspectiveCamera(
      75,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );
    camera.position.set(5, 5, 5);
    cameraRef.current = camera;

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // --- Svetlá ---
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    // --- OrbitControls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.enablePan = true;
    controlsRef.current = controls;

    // --- Grid a osi ---
    scene.add(new THREE.GridHelper(20, 20));
    scene.add(new THREE.AxesHelper(5));

    // --- Animácia ---
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // --- Reagovanie na zmenu veľkosti okna ---
    const onWindowResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onWindowResize);

    // --- Vyčistenie ---
    return () => {
      mount.removeChild(renderer.domElement);
      window.removeEventListener("resize", onWindowResize);
    };
  }, []);

  // --- Drop handler ---
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!sceneRef.current || !cameraRef.current || !mountRef.current || !dragType) return;

    const rect = mountRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const mouse = new THREE.Vector2(x, y);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    // Intersect s rovinou Y=0
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, point);

    let mesh: THREE.Mesh;
    if (dragType === "cube") {
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.MeshStandardMaterial({ color: 0x00aaff })
      );
    } else {
      mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 1, 32),
        new THREE.MeshStandardMaterial({ color: 0xffaa00 })
      );
    }
    mesh.position.copy(point);
    sceneRef.current.add(mesh);
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Bočný panel */}
      <div style={{ width: 150, background: "#333", color: "#fff", padding: 10 }}>
        <div
          draggable
          onDragStart={() => setDragType("cube")}
          style={{ padding: 8, marginBottom: 8, background: "#00aaff", cursor: "grab", textAlign: "center" }}
        >
          Kocka
        </div>
        <div
          draggable
          onDragStart={() => setDragType("cylinder")}
          style={{ padding: 8, background: "#ffaa00", cursor: "grab", textAlign: "center" }}
        >
          Valec
        </div>
      </div>

      {/* Three.js scéna */}
      <div
        ref={mountRef}
        style={{ flex: 1 }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      />
    </div>
  );
}
