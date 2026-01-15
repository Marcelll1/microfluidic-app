type DbObj = {
  type: string;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  rotation_y?: number | null;
  params?: any;
};

function f(n: unknown) {
  const x = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Number(x.toFixed(6));
}

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
export function generatePythonBoundaries(objects: DbObj[]) {
  const lines: string[] = [];
  lines.push("# --------------------");
  lines.push("# BOUNDARIES (generated)");
  lines.push("# --------------------");
  lines.push("boundaries = []");
  lines.push("");

  let idx = 0;

  for (const o of objects) {
    idx++;
    const t = String(o.type || "").toLowerCase();
    const p = o.params ?? {};

    // Rhomboid
    if (t === "cube" || t === "rhomboid") {
      const w = f(p.width ?? p.w ?? 1);
      const h = f(p.height ?? p.h ?? 1);
      const d = f(p.depth ?? p.d ?? 1);

      const cx = f(o.pos_x);
      const cy = f(o.pos_y);
      const cz = f(o.pos_z);

      lines.push(`# object ${idx}: Rhomboid`);
      lines.push(
        `tmp_shape = shapes.Rhomboid(corner=[${cx}, ${cy}, ${cz}], a=[${w}, 0.0, 0.0], b=[0.0, ${h}, 0.0], c=[0.0, 0.0, ${d}], direction=1)`
      );
      lines.push("boundaries.append(tmp_shape)");
      lines.push("");
      continue;
    }

    // Cylinder
    if (t === "cylinder") {
      const radius = f(p.radius ?? p.r ?? p.radiusTop ?? 1);
      const length = f(p.height ?? p.length ?? 1);

      const cx = f(o.pos_x);
      const cy = f(o.pos_y);
      const cz = f(o.pos_z);

      lines.push(`# object ${idx}: Cylinder`);
      lines.push(
        `tmp_shape = shapes.Cylinder(center=[${cx}, ${cy}, ${cz}], axis=[0.0, 0.0, 1.0], length=${length}, radius=${radius}, direction=1)`
      );
      lines.push("boundaries.append(tmp_shape)");
      lines.push("");
      continue;
    }

    // iné typy ignoruj
  }

  lines.push("# end of generated boundaries");
  return lines.join("\n");
}
