import "server-only"

import { NextResponse, type NextRequest } from "next/server"

import { authConfig, getCookieSecureFlag } from "@/lib/auth/config"
import {
  generateCsrfToken,
  generateSessionToken,
  hashSessionToken,
} from "@/lib/auth/crypto"
import { query } from "@/lib/db"
import type { AuthContext, AuthUser } from "@/lib/auth/types"

type AuthQueryRow = {
  user_id: string
  email: string
  full_name: string | null
  is_active: boolean
  roles: string[] | null
  permissions: string[] | null
  session_id: string
  session_expires_at: string
}

export function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? null
  return request.headers.get("x-real-ip")
}

export function getUserAgent(request: NextRequest) {
  return request.headers.get("user-agent")
}

export function ensureSameOrigin(request: NextRequest) {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return null
  }

  const originHeader = request.headers.get("origin")
  if (!originHeader) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 })
  }

  try {
    const origin = new URL(originHeader)
    if (origin.host !== request.nextUrl.host) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 })
  }

  return null
}

export async function createSession(userId: string, request: NextRequest) {
  const rawToken = generateSessionToken()
  const tokenHash = hashSessionToken(rawToken)
  const expiresAt = new Date(Date.now() + authConfig.sessionTtlHours * 60 * 60 * 1000)
  const ipAddress = getClientIp(request)
  const userAgent = getUserAgent(request)

  const result = await query<{ id: string }>(
    `
    INSERT INTO public.sessions (
      user_id,
      token_hash,
      expires_at,
      ip_address,
      user_agent
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
    `,
    [userId, tokenHash, expiresAt.toISOString(), ipAddress, userAgent]
  )

  return {
    sessionId: result.rows[0]?.id,
    rawToken,
    expiresAt,
  }
}

export async function revokeSessionByToken(rawToken: string) {
  const tokenHash = hashSessionToken(rawToken)
  await query(
    `
    UPDATE public.sessions
    SET revoked_at = NOW()
    WHERE token_hash = $1
      AND revoked_at IS NULL
    `,
    [tokenHash]
  )
}

export async function revokeSessionById(sessionId: string) {
  await query(
    `
    UPDATE public.sessions
    SET revoked_at = NOW()
    WHERE id = $1
      AND revoked_at IS NULL
    `,
    [sessionId]
  )
}

function mapAuthContext(row: AuthQueryRow, sessionToken: string): AuthContext {
  const user: AuthUser = {
    id: row.user_id,
    email: row.email,
    fullName: row.full_name,
    isActive: row.is_active,
    roles: row.roles ?? [],
    permissions: row.permissions ?? [],
  }

  return {
    user,
    sessionId: row.session_id,
    sessionExpiresAt: row.session_expires_at,
    sessionToken,
  }
}

export async function getAuthContextFromRequest(request: NextRequest) {
  const sessionToken = request.cookies.get(authConfig.sessionCookieName)?.value
  if (!sessionToken) return null

  const tokenHash = hashSessionToken(sessionToken)
  const result = await query<AuthQueryRow>(
    `
    SELECT
      u.id as user_id,
      u.email,
      u.full_name,
      u.is_active,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT r.name), NULL) as roles,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.key), NULL) as permissions,
      s.id as session_id,
      to_char(s.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as session_expires_at
    FROM public.sessions s
    INNER JOIN public.users u
      ON u.id = s.user_id
    LEFT JOIN public.user_roles ur
      ON ur.user_id = u.id
    LEFT JOIN public.roles r
      ON r.id = ur.role_id
    LEFT JOIN public.role_permissions rp
      ON rp.role_id = r.id
    LEFT JOIN public.permissions p
      ON p.id = rp.permission_id
    WHERE s.token_hash = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > NOW()
      AND u.is_active = TRUE
    GROUP BY u.id, s.id
    `,
    [tokenHash]
  )

  const row = result.rows[0]
  if (!row) return null
  return mapAuthContext(row, sessionToken)
}

export function attachSessionCookies(
  response: NextResponse,
  rawSessionToken: string,
  expiresAt: Date,
  csrfToken?: string
) {
  const secure = getCookieSecureFlag()
  response.cookies.set({
    name: authConfig.sessionCookieName,
    value: rawSessionToken,
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  })

  response.cookies.set({
    name: authConfig.csrfCookieName,
    value: csrfToken ?? generateCsrfToken(),
    httpOnly: false,
    secure,
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  })
}

export function clearSessionCookies(response: NextResponse) {
  const secure = getCookieSecureFlag()
  response.cookies.set({
    name: authConfig.sessionCookieName,
    value: "",
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  })
  response.cookies.set({
    name: authConfig.csrfCookieName,
    value: "",
    httpOnly: false,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  })
}

export async function rotateSession(request: NextRequest, context: AuthContext) {
  const nextSession = await createSession(context.user.id, request)
  await revokeSessionById(context.sessionId)
  return nextSession
}
