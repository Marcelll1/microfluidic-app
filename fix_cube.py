import re

with open('src/lib/pythonBoundaries.ts', 'r', encoding='utf-8') as f:
    code = f.read()

start_idx = code.find('function handleCube(')
end_idx = code.find('  for (const o of objects) {')

new_handled = """function handleCube(namePrefix: string, ox: number, oy: number, oz: number, w: number, h: number, d: number, rx: number, ry: number, rz: number, bevel: number) {
    let r = Math.min(bevel, w / 2.0, d / 2.0);
    if (r <= 0) {
      outputRhomboid(namePrefix + " (Solid Cube)", ox, oy, oz, w, h, d, rx, ry, rz);
      return;
    }
    
    // Zjednoduseny pre klasicky 2D mikrofluidicky kanal:
    // Namiesto 3D guli a capov do vsetkych stran vytvorime iba klasicke pretnute bloky a 4 rohy
    
    // 1. Box A (Core X) plna sirka w, zmensena hlbka
    let bA_pt = eulerTransform(0, 0, r, rx, ry, rz);
    outputRhomboid(namePrefix + " (Core X)", ox + bA_pt[0], oy + bA_pt[1], oz + bA_pt[2], w, h, d - 2*r, rx, ry, rz);
    
    // 2. Box B (Core Z) plna hlbka d, zmensena sirka
    let bB_pt = eulerTransform(r, 0, 0, rx, ry, rz);
    outputRhomboid(namePrefix + " (Core Z)", ox + bB_pt[0], oy + bB_pt[1], oz + bB_pt[2], w - 2*r, h, d, rx, ry, rz);

    // 3. 4 Vertikalne Valce v rohoch
    let corners = [
        [r, h/2.0, r],
        [w - r, h/2.0, r],
        [r, h/2.0, d - r],
        [w - r, h/2.0, d - r]
    ];
    let cnames = ["Edge BL", "Edge BR", "Edge TL", "Edge TR"];
    for(let i=0; i<4; i++) {
        let cp = eulerTransform(corners[i][0], corners[i][1], corners[i][2], rx, ry, rz);
        outputCylinder(namePrefix + " (" + cnames[i] + ")", ox + cp[0], oy + cp[1], oz + cp[2], h, r, rx, ry, rz);
    }
  }

"""
code = code[:start_idx] + new_handled + code[end_idx:]

# Odkomentovanie oif.output suborov pre zobrazenie
code = code.replace('// lines.push(`oif.output_vtk', 'lines.push(`oif.output_vtk')
code = code.replace('function outputCylEdge', 'function DUMMY_DEL(')

with open('src/lib/pythonBoundaries.ts', 'w', encoding='utf-8') as f:
    f.write(code)

print("FIXED")
