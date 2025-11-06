import * as THREE from "three";
export default function DragMenu({config}: {config? : any}) {

const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!config.sceneRef || !config.cameraRef.current || !config.mountRef.current || !config.dragType) return;

    const rect = config.mountRef.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const mouse = new THREE.Vector2(x, y);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, config.cameraRef);

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, point);

    let mesh: THREE.Mesh;
    if (config.dragType === "cube") {
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
    config.sceneRef.add(mesh);
  };


 }

