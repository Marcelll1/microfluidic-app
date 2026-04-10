
import { DbObj } from "../types/shapes";
import { f, eulerTransform, edgeGroupToSet } from "./generators/mathUtils";

/**
 * Generates python code snippet for BOUNDARIES section.
 * Supported:
 *  - cube/rhomboid -> shapes.Rhomboid(...)
 *  - cylinder      -> shapes.Cylinder(...)
 *
 * Assumption:
 *  - pos_* are used as "corner" for rhomboid (matches your current modeling approach)
 *  - cylinder uses center, axis fixed to z; if you later store axis/rotation, extend here.
 */
export function generatePythonBoundaries(objects: DbObj[], settings?: any) {
  const lines: string[] = []; 

  let minX = 99999, minY = 99999, minZ = 99999;
  let maxX = -99999, maxY = -99999, maxZ = -99999;

  function updateBounds(x: number, y: number, z: number) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  // Precalculates bounds for everything
  objects.forEach((o) => {
    const t = String(o.type || "").toLowerCase();
    const p = (o.params as any) ?? {};
    let px = f(o.pos_x), py = f(o.pos_y), pz = f(o.pos_z);
    
    if (t === "cube" || t === "rhomboid") {
      const sx = f(p.scaleX ?? 1.0), sy = f(p.scaleY ?? 1.0), sz = f(p.scaleZ ?? 1.0);
      const w = f(p.width ?? p.w ?? 1) * sx;
      const h = f(p.height ?? p.h ?? 1) * sy;
      const d = f(p.depth ?? p.d ?? 1) * sz;
      const rx = f(p.rotX ?? 0), ry = f(o.rotation_y ?? 0), rz = f(p.rotZ ?? 0);

      for(let i=0; i<=1; i++) {
        for(let j=0; j<=1; j++) {
          for(let k=0; k<=1; k++) {
            let pt = eulerTransform(i*w, j*h, k*d, rx, ry, rz);
            updateBounds(px + pt[0], py + pt[1], pz + pt[2]);
          }
        }
      }
    } else if (t === "cylinder") {
      const sx = f(p.scaleX ?? 1.0), sy = f(p.scaleY ?? 1.0), sz = f(p.scaleZ ?? 1.0);
      const rScale = Math.max(sx, sz);
      const radius = f(p.radius ?? p.r ?? p.radiusTop ?? 1) * rScale;
      const length = f(p.height ?? p.length ?? 1) * sy;
      const rx = f(p.rotX ?? 0), ry = f(o.rotation_y ?? 0), rz = f(p.rotZ ?? 0);

      for(let i=-1; i<=1; i+=2) {
        for(let j=-1; j<=1; j+=2) {
          for(let k=-1; k<=1; k+=2) {
            let pt = eulerTransform(i*radius, (j*length)/2.0, k*radius, rx, ry, rz);
            updateBounds(px + pt[0], py + pt[1], pz + pt[2]);
          }
        }
      }
    } else if (t === "merged") {
      const parts = (p.parts || []) as any[];
      parts.forEach((part: any) => {
        const pp = part.params || {};
        const pt = String(part.type || "").toLowerCase();
        let pcx = px + f(part.pos_x), pcy = py + f(part.pos_y), pcz = pz + f(part.pos_z);
        const local_rx = f(pp.rotX ?? 0), local_ry = f(part.rotation_y ?? 0), local_rz = f(pp.rotZ ?? 0);

        if (pt === "cube" || pt === "rhomboid") {
           const sx = f(pp.scaleX ?? 1.0), sy = f(pp.scaleY ?? 1.0), sz = f(pp.scaleZ ?? 1.0);
           const w = f(pp.width ?? pp.w ?? 1) * sx;
           const h = f(pp.height ?? pp.h ?? 1) * sy;
           const d = f(pp.depth ?? pp.d ?? 1) * sz;
           for(let i=0; i<=1; i++) {
             for(let j=0; j<=1; j++) {
               for(let k=0; k<=1; k++) {
                 let ptEdge = eulerTransform(i*w, j*h, k*d, local_rx, local_ry, local_rz);
                 updateBounds(pcx + ptEdge[0], pcy + ptEdge[1], pcz + ptEdge[2]);
               }
             }
           }
        } else if (pt === "cylinder") {
           const sx = f(pp.scaleX ?? 1.0), sy = f(pp.scaleY ?? 1.0), sz = f(pp.scaleZ ?? 1.0);
           const rScale = Math.max(sx, sz);
           const radius = f(pp.radius ?? pp.r ?? pp.radiusTop ?? 1) * rScale;
           const length = f(pp.height ?? pp.length ?? 1) * sy;
           for(let i=-1; i<=1; i+=2) {
             for(let j=-1; j<=1; j+=2) {
               for(let k=-1; k<=1; k+=2) {
                 let ptEdge = eulerTransform(i*radius, (j*length)/2.0, k*radius, local_rx, local_ry, local_rz);
                 updateBounds(pcx + ptEdge[0], pcy + ptEdge[1], pcz + ptEdge[2]);
               }
             }
           }
        }
      });
    }
  });

  if (minX === 99999) { minX = 0; minY = 0; minZ = 0; maxX = 10; maxY = 10; maxZ = 10; }

  const padX = (maxX - minX) * 0.2 || 10;
  const padY = (maxY - minY) * 0.2 || 10;
  const padZ = (maxZ - minZ) * 0.2 || 10;

  const boxX = Math.ceil(maxX - minX + padX);
  const boxY = Math.ceil(maxY - minY + padY);
  const boxZ = Math.ceil(maxZ - minZ + padZ);

  const shiftX = f(-minX + padX / 2);
  const shiftY = f(-minY + padY / 2);
  const shiftZ = f(-minZ + padZ / 2);

  lines.push("import espressomd");
  lines.push("import espressomd.shapes as shapes");
  lines.push("import espressomd.lbboundaries as lbboundaries");
  lines.push("import numpy as np");
  lines.push("import math");
  lines.push("import sys");
  lines.push("import os");
  lines.push("import object_in_fluid as oif");
  lines.push("");
  lines.push("os.makedirs('output/sim2', exist_ok=True)");
  lines.push("");
  lines.push("boxX = " + boxX);
  lines.push("boxY = " + boxY);
  lines.push("boxZ = " + boxZ);
  lines.push("system = espressomd.System(box_l=[boxX, boxY, boxZ])");
  lines.push(`system.time_step = ${settings?.time_step || 0.1}`);
  lines.push(`system.cell_system.skin = ${settings?.skin || 0.2}`);
  lines.push(`lbf = espressomd.lb.LBFluid(agrid=${settings?.agrid || 1.0}, dens=${settings?.dens || 1.0}, visc=${settings?.visc || 1.0}, tau=${settings?.tau || 0.1})`);
  lines.push("system.actors.add(lbf)");
  lines.push(`system.thermostat.set_lb(LB_fluid=lbf, gamma=${settings?.gamma || 1.5})`);
  
  if (settings?.duration) {
    lines.push(`DURATION = ${settings.duration}`);
  }
  lines.push("");
  lines.push("boundaries = []");
  lines.push("");

  let idx = 0;
  let oifIdx = 0;

  function outputRhomboid(name: string, ox: number, oy: number, oz: number, w: number, h: number, d: number, rx: number, ry: number, rz: number) {
    let ptA = eulerTransform(w, 0, 0, rx, ry, rz);
    let ptB = eulerTransform(0, h, 0, rx, ry, rz);
    let ptC = eulerTransform(0, 0, d, rx, ry, rz);
    lines.push(`# ${name}`);
    lines.push(`tmp_shape = shapes.Rhomboid(corner=[${f(ox)}, ${f(oy)}, ${f(oz)}], a=[${f(ptA[0])}, ${f(ptA[1])}, ${f(ptA[2])}], b=[${f(ptB[0])}, ${f(ptB[1])}, ${f(ptB[2])}], c=[${f(ptC[0])}, ${f(ptC[1])}, ${f(ptC[2])}], direction=1)`);
    lines.push("boundaries.append(tmp_shape)");
    oifIdx++;
    lines.push(`oif.output_vtk_rhomboid(rhom_shape=tmp_shape, out_file="output/sim2/boundary_part_${oifIdx}.vtk")`);
  }

  function outputCylinder(name: string, cx: number, cy: number, cz: number, length: number, radius: number, rx: number, ry: number, rz: number) {
    let axis = eulerTransform(0, 1.0, 0, rx, ry, rz);
    lines.push(`# ${name}`);
    lines.push(`tmp_shape = shapes.Cylinder(center=[${f(cx)}, ${f(cy)}, ${f(cz)}], axis=[${f(axis[0])}, ${f(axis[1])}, ${f(axis[2])}], length=${f(length)}, radius=${f(radius)}, direction=1)`);
    lines.push("boundaries.append(tmp_shape)");
    oifIdx++;
    lines.push(`oif.output_vtk_cylinder(cyl_shape=tmp_shape, n=20, out_file="output/sim2/boundary_part_${oifIdx}.vtk")`);
  }
  
  function outputSphere(name: string, cx: number, cy: number, cz: number, radius: number) {
    lines.push(`# ${name}`);
    lines.push(`tmp_shape = shapes.Sphere(center=[${f(cx)}, ${f(cy)}, ${f(cz)}], radius=${f(radius)}, direction=1)`);
    lines.push("boundaries.append(tmp_shape)");
    oifIdx++;
    // OIF nemusi mat priamo output_vtk_sphere v tomto kontexte, nahradime valcom s l=0.01 pre vtk zobrazenie alebo preskocime vtk
    // V ESPResSo sa proste pouzije
  }

function handleCube(namePrefix: string, ox: number, oy: number, oz: number, w: number, h: number, d: number, rx: number, ry: number, rz: number, bevel: number, edgesRaw: string[] | undefined, groupRaw: string | undefined, isChamfer: boolean) {
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
          
          if (wx <= 0.0001 || wy <= 0.0001 || wz <= 0.0001) continue;

          // Aplikacia vnutorneho presahu na zaistenie prekryvu
          let overlap = Math.min(0.2, Math.max(0.01, r * 0.4));
          let x1 = cx_val; let x2 = cx_val + wx;
          if (i === 0) x2 += overlap;
          if (i === 2) x1 -= overlap;
          
          let y1 = cy_val; let y2 = cy_val + wy;
          if (j === 0) y2 += overlap;
          if (j === 2) y1 -= overlap;

          let z1 = cz_val; let z2 = cz_val + wz;
          if (k === 0) z2 += overlap;
          if (k === 2) z1 -= overlap;

          let mod_cx = x1; let mod_wx = x2 - x1;
          let mod_cy = y1; let mod_wy = y2 - y1;
          let mod_cz = z1; let mod_wz = z2 - z1;

          let ones = (i===1?1:0) + (j===1?1:0) + (k===1?1:0);

          if (ones >= 2) {
             // Core or face - solid block
             let b_pt = eulerTransform(mod_cx, mod_cy, mod_cz, rx, ry, rz);
             outputRhomboid(`${namePrefix} (Block ${i}${j}${k})`, ox+b_pt[0], oy+b_pt[1], oz+b_pt[2], mod_wx, mod_wy, mod_wz, rx, ry, rz);
          } else if (ones === 1) {
             // Edge
             if (isEdgeRounded(i, j, k)) {
                if (i===1) {
                   // X edge
                   let cp = eulerTransform(mod_cx + mod_wx/2, j===0?r:h-r, k===0?r:d-r, rx, ry, rz);
                   outputCylinder(`${namePrefix} (CylX ${i}${j}${k})`, ox+cp[0], oy+cp[1], oz+cp[2], mod_wx, r, rx, ry, rz - Math.PI/2);
                } else if (j===1) {
                   // Y edge
                   let cp = eulerTransform(i===0?r:w-r, mod_cy + mod_wy/2, k===0?r:d-r, rx, ry, rz);
                   outputCylinder(`${namePrefix} (CylY ${i}${j}${k})`, ox+cp[0], oy+cp[1], oz+cp[2], mod_wy, r, rx, ry, rz);
                } else if (k===1) {
                   // Z edge
                   let cp = eulerTransform(i===0?r:w-r, j===0?r:h-r, mod_cz + mod_wz/2, rx, ry, rz);
                   outputCylinder(`${namePrefix} (CylZ ${i}${j}${k})`, ox+cp[0], oy+cp[1], oz+cp[2], mod_wz, r, rx + Math.PI/2, ry, rz);
                }
             } else {
                 let b_pt = eulerTransform(mod_cx, mod_cy, mod_cz, rx, ry, rz);
                 outputRhomboid(`${namePrefix} (BlockSharp ${i}${j}${k})`, ox+b_pt[0], oy+b_pt[1], oz+b_pt[2], mod_wx, mod_wy, mod_wz, rx, ry, rz);
             }
          } else if (ones === 0) {
             // Corner
             let c_edges = 0;
             let eX = isEdgeRounded(1, j, k); if (eX) c_edges++;
             let eY = isEdgeRounded(i, 1, k); if (eY) c_edges++;
             let eZ = isEdgeRounded(i, j, 1); if (eZ) c_edges++;

             if (c_edges === 0) {
                 let b_pt = eulerTransform(mod_cx, mod_cy, mod_cz, rx, ry, rz);
                 outputRhomboid(`${namePrefix} (CornerSharp ${i}${j}${k})`, ox+b_pt[0], oy+b_pt[1], oz+b_pt[2], mod_wx, mod_wy, mod_wz, rx, ry, rz);
             } else if (c_edges === 1) {
                 // Spans the corner using the single existing cylinder
                 if (eX) {
                     let cp = eulerTransform(mod_cx + mod_wx/2, j===0?r:h-r, k===0?r:d-r, rx, ry, rz);
                     outputCylinder(`${namePrefix} (CylXCor ${i}${j}${k})`, ox+cp[0], oy+cp[1], oz+cp[2], mod_wx, r, rx, ry, rz - Math.PI/2);
                 } else if (eY) {
                     let cp = eulerTransform(i===0?r:w-r, mod_cy + mod_wy/2, k===0?r:d-r, rx, ry, rz);
                     outputCylinder(`${namePrefix} (CylYCor ${i}${j}${k})`, ox+cp[0], oy+cp[1], oz+cp[2], mod_wy, r, rx, ry, rz);
                 } else if (eZ) {
                     let cp = eulerTransform(i===0?r:w-r, j===0?r:h-r, mod_cz + mod_wz/2, rx, ry, rz);
                     outputCylinder(`${namePrefix} (CylZCor ${i}${j}${k})`, ox+cp[0], oy+cp[1], oz+cp[2], mod_wz, r, rx + Math.PI/2, ry, rz);
                 }
             } else if (c_edges >= 2) {
                 // Corner where 2 or 3 rounded edges meet. Use a sphere to smooth the intersection fully
                 let cp = eulerTransform(i===0?r:w-r, j===0?r:h-r, k===0?r:d-r, rx, ry, rz);
                 outputSphere(`${namePrefix} (SphereCor ${i}${j}${k})`, ox+cp[0], oy+cp[1], oz+cp[2], r);
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

  for (const o of objects) {
    idx++;
    const t = String(o.type || "").toLowerCase();
    const p = (o.params as any) ?? {};

    const px = f(o.pos_x) + shiftX;
    const py = f(o.pos_y) + shiftY;
    const pz = f(o.pos_z) + shiftZ;

    const sx = f(p.scaleX ?? 1.0);
    const sy = f(p.scaleY ?? 1.0);
    const sz = f(p.scaleZ ?? 1.0);

    const rx = f(p.rotX ?? 0);
    const ry = f(o.rotation_y ?? 0);
    const rz = f(p.rotZ ?? 0);

    if (t === "cube" || t === "rhomboid") {
      const w = f(p.width ?? p.w ?? 1) * sx;
      const h = f(p.height ?? p.h ?? 1) * sy;
      const d = f(p.depth ?? p.d ?? 1) * sz;
      const bevel = f(p.bevelRadius ?? 0);

      handleCube(`Object ${idx}`, px, py, pz, w, h, d, rx, ry, rz, bevel, p.bevelEdges, p.bevelGroup, !!p.isChamfer);
      continue;
    }

    if (t === "cylinder") {
      const rScale = Math.max(sx, sz);
      const radius = f(p.radius ?? p.r ?? p.radiusTop ?? 1) * rScale;
      const length = f(p.height ?? p.length ?? 1) * sy;

      // cylinder uses center by default in setup
      // wait, earlier I used corner translations. ThreeJS cylinder is centered.
      outputCylinder(`Object ${idx} Cylinder`, px, py, pz, length, radius, rx, ry, rz);
      continue;
    }

    if (t === "merged") {
      const parts = (p.parts || []) as any[];
      
      for (let pi = 0; pi < parts.length; pi++) {
        const part = parts[pi];
        const pp = part.params || {};
        const pt = String(part.type || "").toLowerCase();
        
        const pcx = f(part.pos_x) + px;
        const pcy = f(part.pos_y) + py;
        const pcz = f(part.pos_z) + pz;
        
        const local_rx = f(pp.rotX ?? 0);
        const local_ry = f(part.rotation_y ?? 0);
        const local_rz = f(pp.rotZ ?? 0);

        if (pt === "cube" || pt === "rhomboid") {
          const w = f(pp.width ?? pp.w ?? 1) * f(pp.scaleX ?? 1.0);
          const h = f(pp.height ?? pp.h ?? 1) * f(pp.scaleY ?? 1.0);
          const d = f(pp.depth ?? pp.d ?? 1) * f(pp.scaleZ ?? 1.0);
          const bevel = f(pp.bevelRadius ?? 0);
          
          handleCube(`Merged ${idx} Part ${pi+1}`, pcx, pcy, pcz, w, h, d, local_rx, local_ry, local_rz, bevel, pp.bevelEdges, pp.bevelGroup, !!pp.isChamfer);
        } else if (pt === "cylinder") {
          const sx = f(pp.scaleX ?? 1.0);
          const sz = f(pp.scaleZ ?? 1.0);
          const sy = f(pp.scaleY ?? 1.0);
          const radius = f(pp.radiusTop ?? pp.radius ?? pp.r ?? 0.5) * Math.max(sx, sz);
          const length = f(pp.height ?? pp.length ?? 1) * sy;
          
          outputCylinder(`Merged ${idx} Part ${pi+1}`, pcx, pcy, pcz, length, radius, local_rx, local_ry, local_rz);
        }
      }
    }
  }

  lines.push("for b_shape in boundaries:");
  lines.push("    system.lbboundaries.add(lbboundaries.LBBoundary(shape=b_shape))");
  lines.push("    system.constraints.add(shape=b_shape, particle_type=10, penetrable=False)");
  lines.push("");
  lines.push("vtk_file = 'boundaries_grid_output.vtk'");
  lines.push("lbf.print_vtk_boundary(vtk_file)");
  lines.push("");
  return lines.join("\n"); 
}
