// src/lib/security.ts
import { createHash, randomBytes } from "crypto"; //pre hash a random tokeny
import bcrypt from "bcryptjs";//pre bezpečné hashovanie hesiel

// Funkcia na vytvorenie SHA-256 hashu z daného vstupu (pouziva sa na hashovanie tokenov)
export function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex"); //vytvorenie a vrátenie hashu v hex formáte
}

// Funkcia na generovanie náhodného tokenu s danou dĺžkou v bajtoch (predvolených 32 bajtov)
export function generateToken(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

// Funkcia na hashovanie hesla pomocou bcrypt s 12 kolami (pouziva sa pri registracii alebo zmene hesla)
export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

// Funkcia na overenie hesla porovnaním so zadaným hashom (pouziva sa pri prihlasovani)
export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
