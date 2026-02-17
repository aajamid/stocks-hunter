import "server-only"

const DEFAULT_SESSION_COOKIE = "stocks_hunter_session"
const DEFAULT_CSRF_COOKIE = "stocks_hunter_csrf"
const DEFAULT_SESSION_TTL_HOURS = 24
const DEFAULT_BCRYPT_ROUNDS = 12

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

export const authConfig = {
  sessionCookieName:
    process.env.AUTH_SESSION_COOKIE_NAME?.trim() || DEFAULT_SESSION_COOKIE,
  csrfCookieName: process.env.AUTH_CSRF_COOKIE_NAME?.trim() || DEFAULT_CSRF_COOKIE,
  sessionTtlHours: parsePositiveInt(
    process.env.AUTH_SESSION_TTL_HOURS,
    DEFAULT_SESSION_TTL_HOURS
  ),
  bcryptRounds: parsePositiveInt(
    process.env.AUTH_BCRYPT_ROUNDS,
    DEFAULT_BCRYPT_ROUNDS
  ),
}

export function getTokenPepper() {
  const pepper = process.env.AUTH_TOKEN_PEPPER?.trim()
  if (pepper) return pepper
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_TOKEN_PEPPER must be set in production.")
  }
  return "dev-only-pepper-change-me"
}

export function getCookieSecureFlag() {
  if (process.env.AUTH_COOKIE_SECURE === "true") return true
  if (process.env.AUTH_COOKIE_SECURE === "false") return false
  return process.env.NODE_ENV === "production"
}
