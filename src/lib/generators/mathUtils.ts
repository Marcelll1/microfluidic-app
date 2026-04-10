// Utility function to format numbers to 6 decimal places. Returns 0 if not a finite number.
export function formatFloatToSix(n: unknown): number {
  const x = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Number(x.toFixed(6));
}

export function f(n: unknown): number {
  return formatFloatToSix(n);
}

// 3D Euler Transformation
export function eulerTransform(
  x: number, y: number, z: number,
  rx: number, ry: number, rz: number
): [number, number, number] {
  let cx = Math.cos(rx), sx = Math.sin(rx);
  let cy = Math.cos(ry), sy = Math.sin(ry);
  let cz = Math.cos(rz), sz = Math.sin(rz);

  let m11 = cy * cz;
  let m12 = -cy * sz;
  let m13 = sy;

  let m21 = cx * sz + sx * sy * cz;
  let m22 = cx * cz - sx * sy * sz;
  let m23 = -sx * cy;

  let m31 = sx * sz - cx * sy * cz;
  let m32 = sx * cz + cx * sy * sz;
  let m33 = cx * cy;

  return [
    x * m11 + y * m12 + z * m13,
    x * m21 + y * m22 + z * m23,
    x * m31 + y * m32 + z * m33
  ];
}

export function edgeGroupToSet(group: string | undefined): Set<string> {
  switch (group) {
    case "Všetky": return new Set(["vert-fl","vert-fr","vert-bl","vert-br","top-front","top-back","top-left","top-right","bot-front","bot-back","bot-left","bot-right"]);
    case "Zvislé rohy": return new Set(["vert-fl","vert-fr","vert-bl","vert-br"]);
    case "Horné hrany": return new Set(["top-front","top-back","top-left","top-right"]);
    case "Dolné hrany": return new Set(["bot-front","bot-back","bot-left","bot-right"]);
    case "Bočné hrany": return new Set(["top-left","top-right","bot-left","bot-right"]);
    default: return new Set();
  }
}
