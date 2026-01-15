// src/lib/security.ts
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";

export function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function generateToken(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
