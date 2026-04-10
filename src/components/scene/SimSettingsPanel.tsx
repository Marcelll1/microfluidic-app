import { useState, useEffect } from "react";

export default function SimSettingsPanel({ projectId }: { projectId: string | null }) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [settings, setSettings] = useState({
    agrid: 1.0,
    dens: 1.0,
    visc: 1.0,
    tau: 0.1,
    skin: 0.2,
    time_step: 0.1,
    gamma: 1.5,
    duration: 1000
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}`)
      .then(res => res.json())
      .then(data => {
        if (data?.settings) {
          setEnabled(data.settings.enabled ?? false);
          setSettings({ ...settings, ...data.settings });
        }
      })
      .catch(err => console.error("Failed to load settings:", err));
  }, [projectId]);

  const saveSettings = async (newEnabled: boolean, newSettings: any) => {
    if (!projectId) return;
    setSaving(true);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { ...newSettings, enabled: newEnabled } })
    }).catch(err => console.error("Failed to save settings:", err));
    setSaving(false);
  };

  const handleApply = () => {
    saveSettings(enabled, settings);
    setOpen(false);
  };

  if (!projectId) return null;

  return (
    <div className="absolute top-4 right-20 z-50">
      <button 
        onClick={() => setOpen(!open)}
        className="bg-slate-800 text-white px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-700 text-sm"
      >
        ⚙️ Physics Params
      </button>

      {open && (
        <div className="mt-2 bg-slate-900 border border-slate-700 rounded p-4 shadow-xl w-64 text-sm text-slate-300 pointer-events-auto">
          <label className="flex items-center space-x-2 text-white font-semibold mb-4">
            <input 
              type="checkbox" 
              checked={enabled} 
              onChange={e => {
                setEnabled(e.target.checked);
              }}
              className="accent-sky-500" 
            />
            <span>Enable Custom Physics Params</span>
          </label>

          {enabled && (
            <div className="space-y-2">
              {Object.keys(settings).map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="capitalize">{key}</span>
                  <input
                    type="number"
                    step="any"
                    value={(settings as any)[key]}
                    onChange={e => setSettings({ ...settings, [key]: parseFloat(e.target.value) || 0 })}
                    className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 outline-none focus:border-sky-500"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-800 flex justify-end">
             <button disabled={saving} onClick={handleApply} className="bg-sky-600 hover:bg-sky-500 text-white px-3 py-1 rounded">
               {saving ? "Saving..." : "Save"}
             </button>
          </div>
        </div>
      )}
    </div>
  );
}