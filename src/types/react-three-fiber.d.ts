/// <reference types="@react-three/fiber" />

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: any;
      pointLight: any;
      mesh: any;
      group: any;
      sphereGeometry: any;
      cylinderGeometry: any;
      meshStandardMaterial: any;
    }
  }
}

export {};
