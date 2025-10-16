"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { add } from "three/tsl";

export default function Home() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [sceneObjects, setSceneObjects] = useState<THREE.Mesh[]>([]);

  useEffect(() => {
    const mount = mountRef.current!;
    
    // Scéna
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    // Kamera
    const camera = new THREE.PerspectiveCamera(
      75,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );
    camera.position.set(5, 5, 5);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // Svetlá
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.enablePan = true;

    // Animácia
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    //Pokladanie na kurzor
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseClick = (event: MouseEvent) => {
      mouse.x = (event.clientX / mount.clientWidth) * 2 - 1;
      mouse.y = -(event.clientY / mount.clientHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      addObject("cube");
    };

    mount.addEventListener("click", onMouseClick);

    // GridHelper
    const gridHelper = new THREE.GridHelper(20, 20);
    scene.add(gridHelper);

    // AxesHelper
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    // Reagovanie na zmenu veľkosti okna
    const onWindowResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onWindowResize);  
      
    

    // Funkcia na pridanie objektov do scény
    const addObject = (type: "cube" | "cylinder") => {
      let mesh: THREE.Mesh;
      if (type === "cube") {
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshStandardMaterial({ color: 0x00aaff });
        mesh = new THREE.Mesh(geometry, material);
      } else {
        const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
        const material = new THREE.MeshStandardMaterial({ color: 0xffaa00 });
        mesh = new THREE.Mesh(geometry, material);
      }
      mesh.position.set
      scene.add(mesh);

      //setSceneObjects((prev) => [...prev, mesh]);
    };

    // Vyčistenie
    return () => {
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <>
      <div style={{ position: "absolute", top: 10, left: 10, zIndex: 10 }}>
        
      </div>
      <div ref={mountRef} style={{ width: "100%", height: "100vh" }} />
    </>
  );
}
