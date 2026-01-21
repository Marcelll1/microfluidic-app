// src/lib/supabaseServer.ts
import "server-only"; //modul pre Next.js server-only kód
import { createClient } from "@supabase/supabase-js"; //import funkcie na vytvorenie Supabase klienta

const url = process.env.SUPABASE_URL;//získanie URL Supabase z environmentálnych premenných
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; //získanie servisného kľúča (obchadza RLS) preto je nutne aby bol iba na servery

if (!url || !serviceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"); //ak chýba URL alebo kľúč, vyhodiť chybu
}

export const supabase = createClient(url, serviceKey); //vytvorenie a export Supabase klienta s daným URL a servisným kľúčom


