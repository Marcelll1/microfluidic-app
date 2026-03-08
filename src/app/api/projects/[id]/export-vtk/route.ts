import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function GET(
  _: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: projectId } = await params;

  // Načítanie projektu a kontrola prístupu
  const { data: project, error: e1 } = await supabase
    .from("projects")
    .select("id, owner_id, name")
    .eq("id", projectId)
    .maybeSingle();

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  if (auth.user.role !== "admin" && project.owner_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Načítanie 3D objektov projektu
  const { data: objects, error: e2 } = await supabase
    .from("object3d")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  const vtk = generateVTK(objects ?? [], project.name ?? projectId);

  const safeName = (project.name ?? projectId).replace(/[^a-zA-Z0-9_-]/g, "_");

  return new Response(vtk, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeName}.vtk"`,
    },
  });
}

function generateVTK(objects: any[], sceneName: string): string {
  const lines: string[] = [];
  lines.push("# vtk DataFile Version 3.0");
  lines.push(sceneName.replace(/\n/g, " "));
  lines.push("ASCII");
  lines.push("DATASET UNSTRUCTURED_GRID");

  const points: number[][] = [];
  const cells: number[][] = [];
  const cellTypes: number[] = [];

  for (const obj of objects) {
    const p = obj.params ?? {};
    const t = String(obj.type ?? "").toLowerCase();

    if (t === "cube" || t === "rhomboid") {
      const w: number = p.width ?? 1;
      const h: number = p.height ?? 1;
      const d: number = p.depth ?? 1;
      const x: number = obj.pos_x ?? 0;
      const y: number = obj.pos_y ?? 0;
      const z: number = obj.pos_z ?? 0;
      const base = points.length;

      // 8 rohov hexahedra
      points.push(
        [x,     y,     z    ], [x + w, y,     z    ],
        [x + w, y + h, z    ], [x,     y + h, z    ],
        [x,     y,     z + d], [x + w, y,     z + d],
        [x + w, y + h, z + d], [x,     y + h, z + d],
      );
      cells.push([8, base, base+1, base+2, base+3, base+4, base+5, base+6, base+7]);
      cellTypes.push(12); // VTK_HEXAHEDRON

    } else if (t === "cylinder") {
      const r: number = p.radiusTop ?? p.radiusBottom ?? 0.5;
      const h: number = p.height ?? 1;
      const cx: number = obj.pos_x ?? 0;
      const cy: number = obj.pos_y ?? 0;
      const cz: number = obj.pos_z ?? 0;
      const segs = 16;
      const base = points.length;

      // Kruhové vrcholy pre dolnú a hornú základňu
      for (let i = 0; i < segs; i++) {
        const angle = (i / segs) * Math.PI * 2;
        const px = cx + r * Math.cos(angle);
        const pz = cz + r * Math.sin(angle);
        points.push([px, cy,     pz]);
        points.push([px, cy + h, pz]);
      }

      // Klínové bunky (VTK_WEDGE = 13) – jedna na každý segment
      for (let i = 0; i < segs; i++) {
        const n = (i + 1) % segs;
        const b0 = base + i * 2;
        const b1 = base + n * 2;
        // dolná trojuholníková základna: b0, b1, stred (aproximácia bez stredu = degenerovane)
        // používame 6-uzlový klin: b0_bot, b1_bot, b0_bot, b0_top, b1_top, b0_top
        cells.push([6, b0, b1, b0, b0+1, b1+1, b0+1]);
        cellTypes.push(13); // VTK_WEDGE
      }

    } else if (t === "rbc") {
      const verts = p.vertices as number[] | undefined;
      const idxs  = p.indices  as number[] | undefined;
      if (verts && idxs) {
        const x0: number = obj.pos_x ?? 0;
        const y0: number = obj.pos_y ?? 0;
        const z0: number = obj.pos_z ?? 0;
        const base = points.length;

        for (let i = 0; i < verts.length; i += 3) {
          points.push([verts[i] + x0, verts[i+1] + y0, verts[i+2] + z0]);
        }
        for (let i = 0; i < idxs.length; i += 3) {
          cells.push([3, base + idxs[i], base + idxs[i+1], base + idxs[i+2]]);
          cellTypes.push(5); // VTK_TRIANGLE
        }
      }

    } else if (t === "merged") {
      // Každá part je kocka alebo valec
      const parts = (p.parts ?? []) as any[];
      for (const part of parts) {
        const pp = part.params ?? {};
        const pt = String(part.type ?? "").toLowerCase();
        const x: number = part.pos_x ?? 0;
        const y: number = part.pos_y ?? 0;
        const z: number = part.pos_z ?? 0;

        if (pt === "cube") {
          const w: number = pp.width ?? 1;
          const h: number = pp.height ?? 1;
          const d: number = pp.depth ?? 1;
          const base = points.length;
          points.push(
            [x,     y,     z    ], [x + w, y,     z    ],
            [x + w, y + h, z    ], [x,     y + h, z    ],
            [x,     y,     z + d], [x + w, y,     z + d],
            [x + w, y + h, z + d], [x,     y + h, z + d],
          );
          cells.push([8, base, base+1, base+2, base+3, base+4, base+5, base+6, base+7]);
          cellTypes.push(12);
        } else if (pt === "cylinder") {
          const r: number = pp.radiusTop ?? pp.radiusBottom ?? 0.5;
          const h: number = pp.height ?? 1;
          const segs = 16;
          const base = points.length;
          for (let i = 0; i < segs; i++) {
            const angle = (i / segs) * Math.PI * 2;
            const px = x + r * Math.cos(angle);
            const pz = z + r * Math.sin(angle);
            points.push([px, y,     pz]);
            points.push([px, y + h, pz]);
          }
          for (let i = 0; i < segs; i++) {
            const n = (i + 1) % segs;
            const b0 = base + i * 2;
            const b1 = base + n * 2;
            cells.push([6, b0, b1, b0, b0+1, b1+1, b0+1]);
            cellTypes.push(13);
          }
        }
      }
    }
  }

  lines.push(`POINTS ${points.length} float`);
  for (const pt of points) {
    lines.push(pt.map(v => v.toFixed(6)).join(" "));
  }

  const cellDataSize = cells.reduce((s, c) => s + c.length, 0);
  lines.push(`CELLS ${cells.length} ${cellDataSize}`);
  for (const c of cells) {
    lines.push(c.join(" "));
  }

  lines.push(`CELL_TYPES ${cells.length}`);
  for (const ct of cellTypes) {
    lines.push(String(ct));
  }

  return lines.join("\n") + "\n";
}
