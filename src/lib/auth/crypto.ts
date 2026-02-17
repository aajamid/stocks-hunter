import "server-only"

import bcrypt from "bcryptjs"
import { createHash, randomBytes } from "node:crypto"

import { authConfig, getTokenPepper } from "@/lib/auth/config"

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function hashPassword(plainPassword: string) {
  return bcrypt.hash(plainPassword, authConfig.bcryptRounds)
}

export async function verifyPassword(plainPassword: string, passwordHash: string) {
  return bcrypt.compare(plainPassword, passwordHash)
}

export function generateSessionToken() {
  return randomBytes(32).toString("hex")
}

export function hashSessionToken(rawToken: string) {
  const pepper = getTokenPepper()
  return createHash("sha256").update(`${rawToken}:${pepper}`).digest("hex")
}

export function generateCsrfToken() {
  return randomBytes(24).toString("hex")
}
