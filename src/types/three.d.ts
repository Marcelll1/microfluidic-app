declare module 'three/examples/jsm/controls/TransformControls' {
  import { Camera, Object3D, Event } from 'three';
  import { EventDispatcher } from 'three';

  export class TransformControls extends EventDispatcher {
    constructor(camera: Camera, domElement: HTMLElement);
    attach(object: Object3D): void;
    detach(): void;
    getMode(): string;
    setMode(mode: 'translate' | 'rotate' | 'scale'): void;
    addEventListener(type: string, listener: (event: { value: boolean }) => void): void;
    removeEventListener(type: string, listener: (event: { value: boolean }) => void): void;
  }
}
