import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/auth';

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const user = await requireAuth();
        const supabase = await createClient();
        const { id: projectId } = await params;

        // 1. Fetch source project
        const { data: sourceProject, error: projectError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (projectError || !sourceProject) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // 2. Fetch objects
        const { data: objects, error: objectsError } = await supabase
            .from('objects')
            .select('*')
            .eq('project_id', projectId);

        if (objectsError) throw objectsError;

        // 3. Create new project
        const { data: newProject, error: newProjectError } = await supabase
            .from('projects')
            .insert({
                name: `${sourceProject.name} (Copy)`,
                description: sourceProject.description,
                owner_id: user.id,
                visibility: 'private' // default to private
            })
            .select()
            .single();

        if (newProjectError) throw newProjectError;

        // 4. Copy objects
        if (objects && objects.length > 0) {
            const newObjects = objects.map(obj => ({
                project_id: newProject.id,
                name: obj.name,
                type: obj.type,
                parameters: obj.parameters,
                position: obj.position,
                dimensions: obj.dimensions,
                rotation: obj.rotation
            }));

            const { error: insertObjectsError } = await supabase
                .from('objects')
                .insert(newObjects);

            if (insertObjectsError) throw insertObjectsError;
        }

        return NextResponse.json({ id: newProject.id });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
