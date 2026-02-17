import { z } from "zod"

export const loginPayloadSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
})

export const createUserPayloadSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(10).max(128),
  fullName: z.string().min(1).max(180),
  isActive: z.boolean().optional(),
})

export const updateUserPayloadSchema = z.object({
  fullName: z.string().min(1).max(180).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(10).max(128).optional(),
})

export const createRolePayloadSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(280).optional(),
})

export const updateRolePayloadSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(280).optional(),
})

export const assignRolePayloadSchema = z.object({
  user_id: z.string().uuid(),
  role_id: z.string().uuid(),
})

export const rolePermissionPayloadSchema = z.object({
  role_id: z.string().uuid(),
  permission_ids: z.array(z.string().uuid()).max(250),
})

export function validateStrongPassword(password: string) {
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasDigit = /\d/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)
  return hasUpper && hasLower && hasDigit && hasSymbol
}
