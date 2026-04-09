import re

with open('src/lib/pythonBoundaries.ts', 'r', encoding='utf-8') as f:
    code = f.read()

start_idx = code.find('function handleCube(')
end_idx = code.find('  for (const o of objects) {')

new_handled = """function edgeGroupToSet(group: string | undefined): Set<string> {
  switch (group) {
    case "Všetky": return new Set(["vert-fl","vert-fr","vert-bl","vert-br","top-front","top-back","top-left","top-right","bot-front","bot-back","bot-left","bot-right"]);
    case "Zvislé rohy": return new Set(["vert-fl","vert-fr","vert-bl","vert-br"]);
    case "Horné hrany": return new Set(["top-front","top-back","top-left","top-right"]);
    case "Dolné hrany": return new Set(["bot-front","bot-back","bot-left","bot-right"]);
    case "Bočné hrany": return new Set(["top-left","top-right","bot-left","bot-right"]);
    default: return new Set();
  }
}

function handleCube(namePrefix: string, ox: number, oy: number, oz: number, w: number, h: number, d: number, rx: number, ry: number, rz: number, bevel: number, edgesRaw: string[] | undefined, groupRaw: string | undefined) {
    let edges = edgesRaw ? new Set(edgesRaw) : edgeGroupToSet(groupRaw || "Všetky");
    let r = Math.min(bevel, w / 2.0, h / 2.0, d / 2.0);
    if (r <= 0 || edges.size === 0) {
      outputRhomboid(namePrefix + " (Solid Cube)", ox, oy, oz, w, h, d, rx, ry, rz);
      return;
    }
    
    const R = (id: string) => edges.has(id);
    function isEdgeRounded(i: number, j: number, k: number) {
      if (i===0 && j===1 && k===0) return R("vert-bl");
      if (i===2 && j===1 && k===0) return R("vert-br");
      if (i===2 && j===1 && k===2) return R("vert-fr");
      if (i===0 && j===1 && k===2) return R("vert-fl");

      if (i===0 && j===2 && k===1) return R("top-left");
      if (i===2 && j===2 && k===1) return R("top-right");
      if (i===0 && j===0 && k===1) return R("bot-left");
      if (i===2 && j===0 && k===1) return R("bot-right");

      if (i===1 && j===0 && k===0) return R("bot-back");
      if (i===1 && j===0 && k===2) return R("bot-front");
      if (i===1 && j===2 && k===0) return R("top-back");
      if (i===1 && j===2 && k===2) return R("top-front");
      return false;
    }

    const xs = [0, r, w-r, w];
    const ys = [0, r, h-r, h];
    const zs = [0, r, d-r, d];

    for(let i=0; i<3; i++) {
      for(let j=0; j<3; j++) {
        for(let k=0; k<3; k++) {
          let cx_val = xs[i]; let wx = xs[i+1] - xs[i];
          let cy_val = ys[j]; let wy = ys[j+1] - ys[j];
          let cz_val = zs[k]; let wz = zs[k+1] - zs[k];
          
          if (wx <= 0.0001 && wy <= 0.0001 && wz <= 0.0001) continue;

          let ones = (i===1?1:0) + (j===1?1:0) + (k===1?1:0);

          if (ones >= 2) {
             // Core or face - solid block
             let b_pt = eulerTransform(cx_val, cy_val, cz_val, rx, ry, rz);
             outputRhomboid(`${namePrefix} (Block ${i}${j}${k})`, ox+b_pt[0], oy+b_pt[1], oz+b_pt[2], wx, wy, wz, rx, ry, rz);
          } else if (ones === 1) {
             // Edge
             if (isEdgeRounded(i, j, k)) {
                if (i===1) {
                   // X edge
                   let cp = eulerTransform(cx_val + wx/2, j===0?r:h-r, k===0?r:d-r, rx, ry, rz);
                   outputCylinder(`${namePrefix} (CylX ${i}${j}${k})`, ox+cp[0], oy+cp[1], oz+cp[2], wx, r, rx, ry, rz - Math.PI/2);
                } else if (j===1) {
                   // Y edge
                   let cp = eulerTransform(i===0?r:w-r, cy_val + wy/2, k===0?r:d-r, rx, ry, rz);
                   outputCylinder(`${namePrefix} (CylY ${i}${j}${k})`, ox+cp[0], oy+cp[1], oz+cp[2], wy, r, rx, ry, rz);
                } else if (k===1) {
                   // Z edge
                   let cp = eulerTransform(i===0?r:w-r, j===0?r:h-r, cz_val + wz/2, rx, ry, rz);
                   outputCylinder(`${namePrefix} (CylZ ${i}${j}${k})`, ox+cp[0], oy+cp[1], oz+cp[2], wz, r, rx + Math.PI/2, ry, rz);
                }
             } else {
                 let b_pt = eulerTransform(cx_val, cy_val, cz_val, rx, ry, rz);
                 outputRhomboid(`${namePrefix} (BlockSharp ${i}${j}${k})`, ox+b_pt[0], oy+b_pt[1], oz+b_pt[2], wx, wy, wz, rx, ry, rz);
             }
          } else if (ones === 0) {
             // Corner
             let c_edges = 0;
             let eX = isEdgeRounded(1, j, k); if (eX) c_edges++;
             let eY = isEdgeRounded(i, 1, k); if (eY) c_edges++;
             let eZ = isEdgeRounded(i, j, 1); if (eZ) c_edges++;

             if (c_edges === 0) {
                 let b_pt = eulerTransform(cx_val, cy_val, cz_val, rx, ry, rz);
                 outputRhomboid(`${namePrefix} (CornerSharp ${i}${j}${k})`, ox+b_pt[0], oy+b_pt[1], oz+b_pt[2], wx, wy, wz, rx, ry, rz);
             } else if (c_edges === 1) {
                 // Spans the corner using the single existing cylinder
                 if (eX) {
                     let cp = eulerTransform(cx_val + wx/2, j===0?r:h-r, k===0?r:d-r, rx, ry, rz);
                     outputCylinder(`${namePrefix} (CylXCor ${i}${j}${k})`, ox+cp[0], oy+cp[1], oz+cp[2], wx, r, rx, ry, rz - Math.PI/2);
                 } else if (eY) {
                     let cp = eulerTransform(i===0?r:w-r, cy_val + wy/2, k===0?r:d-r, rx, ry, rz);
                     outputCylinder(`${namePrefix} (CylYCor ${i}${j}${k})`, ox+cp[0], oy+cp[1], oz+cp[2], wy, r, rx, ry, rz);
                 } else if (eZ) {
                     let cp = eulerTransform(i===0?r:w-r, j===0?r:h-r, cz_val + wz/2, rx, ry, rz);
                     outputCylinder(`${namePrefix} (CylZCor ${i}${j}${k})`, ox+cp[0], oy+cp[1], oz+cp[2], wz, r, rx + Math.PI/2, ry, rz);
                 }
             } else {
                 // Sphere if >= 2 edges are rounded
                 let cp = eulerTransform(i===0?r:w-r, j===0?r:h-r, k===0?r:d-r, rx, ry, rz);
                 outputSphere(`${namePrefix} (Sphere ${i}${j}${k})`, ox+cp[0], oy+cp[1], oz+cp[2], r);
             }
          }
        }
      }
    }
  }

"""
# Modify handleCube calls
code = code.replace(
    'handleCube(`Object ${idx}`, px, py, pz, w, h, d, rx, ry, rz, bevel);',
    'handleCube(`Object ${idx}`, px, py, pz, w, h, d, rx, ry, rz, bevel, p.bevelEdges, p.bevelGroup);'
)
code = code.replace(
    'handleCube(`Merged ${idx} Part ${pi+1}`, pcx, pcy, pcz, w, h, d, local_rx, local_ry, local_rz, bevel);',
    'handleCube(`Merged ${idx} Part ${pi+1}`, pcx, pcy, pcz, w, h, d, local_rx, local_ry, local_rz, bevel, pp.bevelEdges, pp.bevelGroup);'
)

code = code[:start_idx] + new_handled + code[end_idx:]

with open('src/lib/pythonBoundaries.ts', 'w', encoding='utf-8') as f:
    f.write(code)

print("FIXED")
