# Microfluidic Design Application (VAII)

Semestrálna práca z predmetu **VAII**.  
Aplikácia na správu projektov a 3D editor (Three.js) pre návrh objektov v projekte, s generovaním výstupných súborov.

---

## 1) Technológie

- **Frontend/Backend:** Next.js (React, TypeScript) – App Router
- **DB:** PostgreSQL (Supabase)
- **3D editor:** Three.js
- **Štýlovanie:** Tailwind + vlastné CSS

---

## 2) Požiadavky na spustenie

- Node.js **18+**
- npm (alebo pnpm/yarn)
- Supabase projekt (PostgreSQL)

---

## 3) Inštalácia projektu (dependencies)

1. Stiahni projekt (ZIP alebo git clone) a prejdi do priečinka:
```bash
cd microfluidic-app
Nainštaluj dependencies:

npm install


Spusti aplikáciu:

npm run dev


Aplikácia beží na:

http://localhost:3000
4) Nastavenie databázy (Supabase)
4.1 Vytvor Supabase projekt

V Supabase vytvor nový projekt (PostgreSQL DB).

V Settings → API si skopíruj:

Project URL

anon public key

4.2 Vytvor tabuľky v databáze

V Supabase otvor SQL Editor a spusti SQL migráciu.

Poznámka: názvy tabuliek a stĺpcov vychádzajú z DB schémy v projekte.

Použi tento základný SQL setup (tabuľky, ktoré aplikácia používa):

-- USERS
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  full_name text,
  force_password_reset boolean not null default false
);

-- PROJECTS
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  owner_id uuid not null references users(id) on delete cascade
);

-- OBJECTS (1:N project -> objects)
create table if not exists object3d (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  pos_x float8 not null,
  pos_y float8 not null,
  pos_z float8 not null,
  rotation_y float8 not null,
  params jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  project_id uuid not null references projects(id) on delete cascade
);

-- GENERATED ARTIFACTS
create table if not exists generated_artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  created_by uuid not null references users(id) on delete cascade,
  kind text not null,
  filename text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- SESSIONS
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- PASSWORD RESET REQUESTS
create table if not exists password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  completed_at timestamptz,
  approved_by uuid references users(id) on delete set null,
  reset_code_hash text,
  note text
);

-- AUDIT LOG
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  action text not null,
  entity text not null,
  entity_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

4.3 Nastav environment premenné

V root projekte vytvor súbor .env.local:

SUPABASE_URL=PASTE_SUPABASE_PROJECT_URL
SUPABASE_ANON_KEY=PASTE_SUPABASE_ANON_KEY


.env.local sa nesmie commitovať (má byť v .gitignore).

5) Prvé spustenie a test

Spusť dev server:

npm run dev


Otvor:

http://localhost:3000/register – vytvor účet

http://localhost:3000/login – prihlásenie

http://localhost:3000/projects – vytvor projekt

otvor projekt → editor → pridaj objekt → posuň → vymaž → refresh (CRUD test)


6) Build (produkčný build)
npm run build
npm run start

7) Poznámky

Pri práci s projektmi a objektami sú endpointy chránené kontrolou prihlásenia a autorizácie (owner/admin).

Reset hesla funguje cez požiadavku na admina a následné nastavenie hesla pomocou kódu.
