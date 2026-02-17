import "server-only"

type Bucket = {
  count: number
  windowStart: number
  blockedUntil: number
}

const loginBuckets = new Map<string, Bucket>()

const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 8
const BLOCK_MS = 10 * 60 * 1000

function now() {
  return Date.now()
}

export function getLoginThrottleState(key: string) {
  const bucket = loginBuckets.get(key)
  if (!bucket) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
    }
  }

  const ts = now()
  if (bucket.blockedUntil > ts) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.blockedUntil - ts) / 1000),
    }
  }

  if (ts - bucket.windowStart > WINDOW_MS) {
    loginBuckets.set(key, { count: 0, windowStart: ts, blockedUntil: 0 })
    return {
      allowed: true,
      retryAfterSeconds: 0,
    }
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
  }
}

export function registerLoginFailure(key: string) {
  const ts = now()
  const current = loginBuckets.get(key)
  if (!current || ts - current.windowStart > WINDOW_MS) {
    loginBuckets.set(key, {
      count: 1,
      windowStart: ts,
      blockedUntil: 0,
    })
    return
  }

  const nextCount = current.count + 1
  const blockedUntil = nextCount >= MAX_ATTEMPTS ? ts + BLOCK_MS : 0
  loginBuckets.set(key, {
    count: nextCount,
    windowStart: current.windowStart,
    blockedUntil,
  })
}

export function registerLoginSuccess(key: string) {
  loginBuckets.delete(key)
}
