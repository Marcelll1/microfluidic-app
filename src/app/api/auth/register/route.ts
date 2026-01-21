import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabaseServer";
import { hashPassword } from "@/lib/security";

//definícia schémy pre validáciu vstupných dát pomocou zod, email a heslo
const Schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(6).max(200),
});

//funkcia na spracovanie POST požiadavky pre registráciu používateľa
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();//normalizácia emailu na lowercase
  const passwordHash = await hashPassword(parsed.data.password);//hashovanie hesla

  //vloženie nového používateľa do databázy
  const { data, error } = await supabase
    .from("users")
    .insert({ email, password_hash: passwordHash, role: "user" })
    .select("id,email,role")
    .single();

    //spracovanie možných chýb pri vkladaní používateľa
  if (error) {
    if (error.message.toLowerCase().includes("duplicate")) {
      return NextResponse.json({ error: "Email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
  //vrátenie úspešnej odpovede s informáciami o novom používateľovi
  return NextResponse.json({ user: data }, { status: 201 });
}
