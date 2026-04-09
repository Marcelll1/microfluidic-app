import re

ts_file = 'src/lib/pythonBoundaries.ts'
with open(ts_file, 'r', encoding='utf-8') as f:
    content = f.read()

func_start = "export function generatePythonBoundaries"
idx = content.find(func_start)
pre = content[:idx]

func_str = """export function generatePythonBoundaries(objects: DbObj[]) {
  const lines: string[] = []; 

  function eulerTransform(x: number, y: number, z: number, rx: number, ry: number, rz: number): [number, number, number] {
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
    const p = o.params ?? {};
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
  lines.push("system.time_step = 0.1");
  lines.push("system.cell_system.skin = 0.2");
  lines.push("lbf = espressomd.lb.LBFluid(agrid=1.0, dens=1.0, visc=1.0, tau=0.1)");
  lines.push("system.actors.add(lbf)");
  lines.push("system.thermostat.set_lb(LB_fluid=lbf, gamma=1.5)");
  lines.push("");
  lines.push("boundaries = []");
  lines.push("");

  let idx = 0;
  let oifIdx = 0;

  function outputRhomboid(name: string, ox: number, oy: number, oz: number, w: number, h: number, d: number, rx: number, ry: number, rz: number) {
    let ptA = eulerTransform(w, 0, 0, rx, ry, rz);
    let ptB = eulerTransform(0, h, 0, rx, ry, rz);
    let ptC = eulerTransform(0, 0, d, rx, ry, rz);
    lines.push(\`# \${name}\`);
    lines.push(\`tmp_shape = shapes.Rhomboid(corner=[\${f(ox)}, \${f(oy)}, \${f(oz)}], a=[\${f(ptA[0])}, \${f(ptA[1])}, \${f(ptA[2])}], b=[\${f(ptB[0])}, \${f(ptB[1])}, \${f(ptB[2])}], c=[\${f(ptC[0])}, \${f(ptC[1])}, \${f(ptC[2])}], direction=1)\`);
    lines.push("boundaries.append(tmp_shape)");
    oifIdx++;
    lines.push(\`oif.output_vtk_rhomboid(rhom_shape=tmp_shape, out_file="output/sim2/boundary_part_\${oifIdx}.vtk")\`);
  }

  function outputCylinder(name: string, cx: number, cy: number, cz: number, length: number, radius: number, rx: number, ry: number, rz: number) {
    let axis = eulerTransform(0, 1.0, 0, rx, ry, rz);
    lines.push(\`# \${name}\`);
    lines.push(\`tmp_shape = shapes.Cylinder(center=[\${f(cx)}, \${f(cy)}, \${f(cz)}], axis=[\${f(axis[0])}, \${f(axis[1])}, \${f(axis[2])}], length=\${f(length)}, radius=\${f(radius)}, direction=1)\`);
    lines.push("boundaries.append(tmp_shape)");
    oifIdx++;
    lines.push(\`oif.output_vtk_cylinder(cyl_shape=tmp_shape, n=20, out_file="output/sim2/boundary_part_\${oifIdx}.vtk")\`);
  }
  
  function outputSphere(name: string, cx: number, cy: number, cz: number, radius: number) {
    lines.push(\`# \${name}\`);
    lines.push(\`tmp_shape = shapes.Sphere(center=[\${f(cx)}, \${f(cy)}, \${f(cz)}], radius=\${f(radius)}, direction=1)\`);
    lines.push("boundaries.append(tmp_shape)");
    oifIdx++;
    // OIF nemusi mat priamo output_vtk_sphere v tomto kontexte, nahradime valcom s l=0.01 pre vtk zobrazenie alebo preskocime vtk
    // V ESPResSo sa proste pouzije
  }

  function handleCube(namePrefix: string, ox: number, oy: number, oz: number, w: number, h: number, d: number, rx: number, ry: number, rz: number, bevel: number) {
     if (bevel <= 0) {
        outputRhomboid(namePrefix + " (Solid Cube)", ox, oy, oz, w, h, d, rx, ry, rz);
        return;
     }
     
     // 1. Central Core Box
     let c_ox = ox, c_oy = oy, c_oz = oz;
     let c_pt = eulerTransform(bevel, bevel, bevel, rx, ry, rz);
     outputRhomboid(namePrefix + " (Core)", ox + c_pt[0], oy + c_pt[1], oz + c_pt[2], w - 2*bevel, h - 2*bevel, d - 2*bevel, rx, ry, rz);
     
     // 2. 6 Face extensions (top, bottom, left, right, front, back)
     // Top / Bottom
     let t_pt = eulerTransform(bevel, h - bevel, bevel, rx, ry, rz);
     outputRhomboid(namePrefix + " (Top)", ox + t_pt[0], oy + t_pt[1], oz + t_pt[2], w - 2*bevel, bevel, d - 2*bevel, rx, ry, rz);
     let b_pt = eulerTransform(bevel, 0, bevel, rx, ry, rz);
     outputRhomboid(namePrefix + " (Bottom)", ox + b_pt[0], oy + b_pt[1], oz + b_pt[2], w - 2*bevel, bevel, d - 2*bevel, rx, ry, rz);

     // Left / Right
     let l_pt = eulerTransform(0, bevel, bevel, rx, ry, rz);
     outputRhomboid(namePrefix + " (Left)", ox + l_pt[0], oy + l_pt[1], oz + l_pt[2], bevel, h - 2*bevel, d - 2*bevel, rx, ry, rz);
     let r_pt = eulerTransform(w - bevel, bevel, bevel, rx, ry, rz);
     outputRhomboid(namePrefix + " (Right)", ox + r_pt[0], oy + r_pt[1], oz + r_pt[2], bevel, h - 2*bevel, d - 2*bevel, rx, ry, rz);

     // Front / Back
     let f_pt = eulerTransform(bevel, bevel, d - bevel, rx, ry, rz);
     outputRhomboid(namePrefix + " (Front)", ox + f_pt[0], oy + f_pt[1], oz + f_pt[2], w - 2*bevel, h - 2*bevel, bevel, rx, ry, rz);
     let bk_pt = eulerTransform(bevel, bevel, 0, rx, ry, rz);
     outputRhomboid(namePrefix + " (Back)", ox + bk_pt[0], oy + bk_pt[1], oz + bk_pt[2], w - 2*bevel, h - 2*bevel, bevel, rx, ry, rz);

     // 3. 12 Edges as cylinders
     // Vertical edges (height is along Y originally)
     let ve1_pt = eulerTransform(bevel, h/2, bevel, rx, ry, rz);
     outputCylinder(namePrefix + " (Edge VL)", ox + ve1_pt[0], oy + ve1_pt[1], oz + ve1_pt[2], h - 2*bevel, bevel, rx, ry, rz);
     let ve2_pt = eulerTransform(w - bevel, h/2, bevel, rx, ry, rz);
     outputCylinder(namePrefix + " (Edge VR)", ox + ve2_pt[0], oy + ve2_pt[1], oz + ve2_pt[2], h - 2*bevel, bevel, rx, ry, rz);
     let ve3_pt = eulerTransform(bevel, h/2, d - bevel, rx, ry, rz);
     outputCylinder(namePrefix + " (Edge VLF)", ox + ve3_pt[0], oy + ve3_pt[1], oz + ve3_pt[2], h - 2*bevel, bevel, rx, ry, rz);
     let ve4_pt = eulerTransform(w - bevel, h/2, d - bevel, rx, ry, rz);
     outputCylinder(namePrefix + " (Edge VRF)", ox + ve4_pt[0], oy + ve4_pt[1], oz + ve4_pt[2], h - 2*bevel, bevel, rx, ry, rz);

     // Horizontal edges (along X originally -> meaning their axis must be X. To do this with ESPResSo cylinder, we'd need to supply an axis vector. Our outputCylinder rotates [0,1,0]. We need to rotate by -PI/2 on Z to make it point along X before applying rx,ry,rz. Same for Z)
     
     function outputCylEdge(name: string, cx: number, cy: number, cz: number, length: number, radius: number, rotEdgeX: number, rotEdgeY: number, rotEdgeZ: number) {
        let axis = eulerTransform(0, 1.0, 0, rotEdgeX, rotEdgeY, rotEdgeZ);
        // Then apply global rotation rx, ry, rz
        let finalAxis = eulerTransform(axis[0], axis[1], axis[2], rx, ry, rz);
        lines.push(\`# \${name}\`);
        lines.push(\`tmp_shape = shapes.Cylinder(center=[\${f(ox + cx)}, \${f(oy + cy)}, \${f(oz + cz)}], axis=[\${f(finalAxis[0])}, \${f(finalAxis[1])}, \${f(finalAxis[2])}], length=\${f(length)}, radius=\${f(radius)}, direction=1)\`);
        lines.push("boundaries.append(tmp_shape)");
        oifIdx++;
        lines.push(\`oif.output_vtk_cylinder(cyl_shape=tmp_shape, n=20, out_file="output/sim2/boundary_part_\${oifIdx}.vtk")\`);
     }

     // Top/Bottom X edges
     let he1_cx = eulerTransform(w/2, bevel, bevel, rx, ry, rz);
     outputCylEdge(namePrefix + " (Edge BotX1)", he1_cx[0], he1_cx[1], he1_cx[2], w - 2*bevel, bevel, 0, 0, -Math.PI/2);
     let he2_cx = eulerTransform(w/2, h - bevel, bevel, rx, ry, rz);
     outputCylEdge(namePrefix + " (Edge TopX1)", he2_cx[0], he2_cx[1], he2_cx[2], w - 2*bevel, bevel, 0, 0, -Math.PI/2);
     let he3_cx = eulerTransform(w/2, bevel, d - bevel, rx, ry, rz);
     outputCylEdge(namePrefix + " (Edge BotX2)", he3_cx[0], he3_cx[1], he3_cx[2], w - 2*bevel, bevel, 0, 0, -Math.PI/2);
     let he4_cx = eulerTransform(w/2, h - bevel, d - bevel, rx, ry, rz);
     outputCylEdge(namePrefix + " (Edge TopX2)", he4_cx[0], he4_cx[1], he4_cx[2], w - 2*bevel, bevel, 0, 0, -Math.PI/2);

     // Top/Bottom Z edges
     let ze1_cx = eulerTransform(bevel, bevel, d/2, rx, ry, rz);
     outputCylEdge(namePrefix + " (Edge BotZ1)", ze1_cx[0], ze1_cx[1], ze1_cx[2], d - 2*bevel, bevel, Math.PI/2, 0, 0);
     let ze2_cx = eulerTransform(w - bevel, bevel, d/2, rx, ry, rz);
     outputCylEdge(namePrefix + " (Edge BotZ2)", ze2_cx[0], ze2_cx[1], ze2_cx[2], d - 2*bevel, bevel, Math.PI/2, 0, 0);
     let ze3_cx = eulerTransform(bevel, h - bevel, d/2, rx, ry, rz);
     outputCylEdge(namePrefix + " (Edge TopZ1)", ze3_cx[0], ze3_cx[1], ze3_cx[2], d - 2*bevel, bevel, Math.PI/2, 0, 0);
     let ze4_cx = eulerTransform(w - bevel, h - bevel, d/2, rx, ry, rz);
     outputCylEdge(namePrefix + " (Edge TopZ2)", ze4_cx[0], ze4_cx[1], ze4_cx[2], d - 2*bevel, bevel, Math.PI/2, 0, 0);

     // 4. 8 Corners as spheres
     const xs = [bevel, w - bevel];
     const ys = [bevel, h - bevel];
     const zs = [bevel, d - bevel];
     for (let x of xs) {
       for (let y of ys) {
         for (let z of zs) {
           let sp_pt = eulerTransform(x, y, z, rx, ry, rz);
           outputSphere(namePrefix + " (Corner)", ox + sp_pt[0], oy + sp_pt[1], oz + sp_pt[2], bevel);
         }
       }
     }
  }

  for (const o of objects) {
    idx++;
    const t = String(o.type || "").toLowerCase();
    const p = o.params ?? {};

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

      handleCube(\`Object \${idx}\`, px, py, pz, w, h, d, rx, ry, rz, bevel);
      continue;
    }

    if (t === "cylinder") {
      const rScale = Math.max(sx, sz);
      const radius = f(p.radius ?? p.r ?? p.radiusTop ?? 1) * rScale;
      const length = f(p.height ?? p.length ?? 1) * sy;

      // cylinder uses center by default in setup
      // wait, earlier I used corner translations. ThreeJS cylinder is centered.
      outputCylinder(\`Object \${idx} Cylinder\`, px, py, pz, length, radius, rx, ry, rz);
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
          
          handleCube(\`Merged \${idx} Part \${pi+1}\`, pcx, pcy, pcz, w, h, d, local_rx, local_ry, local_rz, bevel);
        } else if (pt === "cylinder") {
          const sx = f(pp.scaleX ?? 1.0);
          const sz = f(pp.scaleZ ?? 1.0);
          const sy = f(pp.scaleY ?? 1.0);
          const radius = f(pp.radiusTop ?? pp.radius ?? pp.r ?? 0.5) * Math.max(sx, sz);
          const length = f(pp.height ?? pp.length ?? 1) * sy;
          
          outputCylinder(\`Merged \${idx} Part \${pi+1}\`, pcx, pcy, pcz, length, radius, local_rx, local_ry, local_rz);
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
  return lines.join("\\n"); 
}
"""

with open(ts_file, 'w', encoding='utf-8') as f:
    f.write(pre + func_str)

print("Updated script.")
