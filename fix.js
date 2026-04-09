const fs = require('fs');

const tsFile = 'src/lib/pythonBoundaries.ts';
let content = fs.readFileSync(tsFile, 'utf8');

const regex = /export function generatePythonBoundaries\([^\{]+{([\s\S]*)/;
const match = regex.exec(content);

if (!match) {
    console.error('Function not found!');
    process.exit(1);
}

const pre = content.substring(0, match.index);

const funcStr = `export function generatePythonBoundaries(objects: DbObj[]) {
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

  objects.forEach((o) => {
    const t = String(o.type || "").toLowerCase();
    const p = o.params ?? {};
    let px = f(o.pos_x), py = f(o.pos_y), pz = f(o.pos_z);
    
    if (t === "cube" || t === "rhomboid") {
      const sx = f(p.scaleX ?? 1.0);
      const sy = f(p.scaleY ?? 1.0);
      const sz = f(p.scaleZ ?? 1.0);
      const w = f(p.width ?? p.w ?? 1) * sx;
      const h = f(p.height ?? p.h ?? 1) * sy;
      const d = f(p.depth ?? p.d ?? 1) * sz;

      const rx = f(p.rotX ?? 0);
      const ry = f(o.rotation_y ?? 0);
      const rz = f(p.rotZ ?? 0);

      for(let i=0; i<=1; i++) {
        for(let j=0; j<=1; j++) {
          for(let k=0; k<=1; k++) {
            let pt = eulerTransform(i*w, j*h, k*d, rx, ry, rz);
            updateBounds(px + pt[0], py + pt[1], pz + pt[2]);
          }
        }
      }
    } else if (t === "cylinder") {
      const sx = f(p.scaleX ?? 1.0);
      const sy = f(p.scaleY ?? 1.0);
      const sz = f(p.scaleZ ?? 1.0);
      const rScale = Math.max(sx, sz);
      const radius = f(p.radius ?? p.r ?? p.radiusTop ?? 1) * rScale;
      const length = f(p.height ?? p.length ?? 1) * sy;

      const rx = f(p.rotX ?? 0);
      const ry = f(o.rotation_y ?? 0);
      const rz = f(p.rotZ ?? 0);

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
        
        let pcx = px + f(part.pos_x);
        let pcy = py + f(part.pos_y);
        let pcz = pz + f(part.pos_z);
        
        const local_rx = f(pp.rotX ?? 0);
        const local_ry = f(part.rotation_y ?? 0);
        const local_rz = f(pp.rotZ ?? 0);

        if (pt === "cube" || pt === "rhomboid") {
           const sx = f(pp.scaleX ?? 1.0);
           const sy = f(pp.scaleY ?? 1.0);
           const sz = f(pp.scaleZ ?? 1.0);
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
           const sx = f(pp.scaleX ?? 1.0);
           const sy = f(pp.scaleY ?? 1.0);
           const sz = f(pp.scaleZ ?? 1.0);
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

  if (minX === 99999) {
    minX = 0; minY = 0; minZ = 0;
    maxX = 10; maxY = 10; maxZ = 10;
  }

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
  lines.push("# Vytvorime zlozku pre zachytenie vystupov simulacie pre ParaView");
  lines.push("os.makedirs('output/sim2', exist_ok=True)");
  lines.push("");
  lines.push("# --------------------");
  lines.push("# SYSTEM INITIALIZATION");
  lines.push("# --------------------");
  lines.push("# Automaticky vypocitana velkost boxu");
  lines.push(\`boxX = \${boxX}\`);
  lines.push(\`boxY = \${boxY}\`);
  lines.push(\`boxZ = \${boxZ}\`);
  lines.push("system = espressomd.System(box_l=[boxX, boxY, boxZ])");
  lines.push("system.time_step = 0.1");
  lines.push("system.cell_system.skin = 0.2");
  lines.push("");
  lines.push("# --------------------");
  lines.push("# LBM FLUID");
  lines.push("# --------------------");
  lines.push("agrid = 1.0");
  lines.push("kin_visc = 1.0");
  lines.push("dens = 1.0");
  lines.push("");
  lines.push("lbf = espressomd.lb.LBFluid(agrid=agrid, dens=dens, visc=kin_visc, tau=0.1)");
  lines.push("system.actors.add(lbf)");
  lines.push("system.thermostat.set_lb(LB_fluid=lbf, gamma=1.5)");
  lines.push("");
  lines.push("# --------------------");
  lines.push("# BOUNDARIES");
  lines.push("# --------------------");
  lines.push("boundaries = []");
  lines.push("");

  let idx = 0;

  for (const o of objects) {
    idx++;
    const t = String(o.type || "").toLowerCase();
    const p = o.params ?? {};

    // Base coordinates
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

      let ptA = eulerTransform(w, 0, 0, rx, ry, rz);
      let ptB = eulerTransform(0, h, 0, rx, ry, rz);
      let ptC = eulerTransform(0, 0, d, rx, ry, rz);

      lines.push(\`# object \${idx}: Rhomboid\`);
      lines.push(\`a_vec = [\${f(ptA[0])}, \${f(ptA[1])}, \${f(ptA[2])}]\`);
      lines.push(\`b_vec = [\${f(ptB[0])}, \${f(ptB[1])}, \${f(ptB[2])}]\`);
      lines.push(\`c_vec = [\${f(ptC[0])}, \${f(ptC[1])}, \${f(ptC[2])}]\`);
      lines.push(\`corner = [\${px}, \${py}, \${pz}]\`);
      lines.push(\`tmp_shape = shapes.Rhomboid(corner=corner, a=a_vec, b=b_vec, c=c_vec, direction=1)\`);
      lines.push("boundaries.append(tmp_shape)");
      lines.push(\`oif.output_vtk_rhomboid(rhom_shape=tmp_shape, out_file="output/sim2/boundary_obj_\${idx}.vtk")\`);
      lines.push("");
      continue;
    }

    if (t === "cylinder") {
      const rScale = Math.max(sx, sz);
      const radius = f(p.radius ?? p.r ?? p.radiusTop ?? 1) * rScale;
      const length = f(p.height ?? p.length ?? 1) * sy;

      let axis = eulerTransform(0, 1.0, 0, rx, ry, rz);
      lines.push(\`# object \${idx}: Cylinder\`);
      lines.push(\`axis = [\${f(axis[0])}, \${f(axis[1])}, \${f(axis[2])}]\`);
      lines.push(\`tmp_shape = shapes.Cylinder(center=[\${px}, \${py}, \${pz}], axis=axis, length=\${length}, radius=\${radius}, direction=1)\`);
      lines.push("boundaries.append(tmp_shape)");
      lines.push(\`oif.output_vtk_cylinder(cyl_shape=tmp_shape, n=20, out_file="output/sim2/boundary_obj_\${idx}.vtk")\`);
      lines.push("");
      continue;
    }

    if (t === "merged") {
      const parts = (p.parts || []) as any[];
      lines.push(\`# object \${idx}: Merged (\${parts.length} parts)\`);
      
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
          
          let ptA = eulerTransform(w, 0, 0, local_rx, local_ry, local_rz);
          let ptB = eulerTransform(0, h, 0, local_rx, local_ry, local_rz);
          let ptC = eulerTransform(0, 0, d, local_rx, local_ry, local_rz);

          lines.push(\`# merged part \${pi + 1}: Rhomboid\`);
          lines.push(\`a_vec = [\${f(ptA[0])}, \${f(ptA[1])}, \${f(ptA[2])}]\`);
          lines.push(\`b_vec = [\${f(ptB[0])}, \${f(ptB[1])}, \${f(ptB[2])}]\`);
          lines.push(\`c_vec = [\${f(ptC[0])}, \${f(ptC[1])}, \${f(ptC[2])}]\`);
          lines.push(\`corner = [\${pcx}, \${pcy}, \${pcz}]\`);
          lines.push(\`tmp_shape = shapes.Rhomboid(corner=corner, a=a_vec, b=b_vec, c=c_vec, direction=1)\`);
          lines.push("boundaries.append(tmp_shape)");
          lines.push(\`oif.output_vtk_rhomboid(rhom_shape=tmp_shape, out_file="output/sim2/boundary_obj_\${idx}_part_\${pi + 1}.vtk")\`);
          lines.push("");
        } else if (pt === "cylinder") {
          const sx = f(pp.scaleX ?? 1.0);
          const sz = f(pp.scaleZ ?? 1.0);
          const sy = f(pp.scaleY ?? 1.0);
          const radius = f(pp.radiusTop ?? pp.radius ?? pp.r ?? 0.5) * Math.max(sx, sz);
          const length = f(pp.height ?? pp.length ?? 1) * sy;
          
          let axis = eulerTransform(0, 1.0, 0, local_rx, local_ry, local_rz);
          lines.push(\`# merged part \${pi + 1}: Cylinder\`);
          lines.push(\`axis = [\${f(axis[0])}, \${f(axis[1])}, \${f(axis[2])}]\`);
          lines.push(\`tmp_shape = shapes.Cylinder(center=[\${pcx}, \${pcy}, \${pcz}], axis=axis, length=\${length}, radius=\${radius}, direction=1)\`);
          lines.push("boundaries.append(tmp_shape)");
          lines.push(\`oif.output_vtk_cylinder(cyl_shape=tmp_shape, n=20, out_file="output/sim2/boundary_obj_\${idx}_part_\${pi + 1}.vtk")\`);
          lines.push("");
        }
      }
      continue;
    }
  }

  lines.push("# --------------------");
  lines.push("# ADD BOUNDARIES TO LB");
  lines.push("# --------------------");
  lines.push("for b_shape in boundaries:");
  lines.push("    system.lbboundaries.add(lbboundaries.LBBoundary(shape=b_shape))");
  lines.push("    system.constraints.add(shape=b_shape, particle_type=10, penetrable=False)");
  lines.push("");
  lines.push("print(f'Done! Successfully added {len(boundaries)} LB boundaries to the espresso system.')");
  lines.push("");
  lines.push("# --------------------");
  lines.push("# VTK EXPORT");
  lines.push("# --------------------");
  lines.push("vtk_file = 'boundaries_grid_output.vtk'");
  lines.push("print(f'Exporting simulation boundary grid to {vtk_file} ...')");
  lines.push("lbf.print_vtk_boundary(vtk_file)");
  lines.push("");
  lines.push("print('Simulation setup and export completed successfully!')");
  lines.push("");
  lines.push("# end of generated boundaries");
  return lines.join("\\n"); 
}`;

const final = pre + funcStr + '\n';
fs.writeFileSync(tsFile, final);
console.log('Done!');
