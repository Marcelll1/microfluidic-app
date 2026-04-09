import { generatePythonBoundaries } from "./src/lib/pythonBoundaries";
const data = [
  { type: "cube", pos_x: 0, pos_y: 0, pos_z: 0, rotation_y: Math.PI/4, params: { width: 2, height: 1, depth: 3 } }
];
console.log(generatePythonBoundaries(data));
