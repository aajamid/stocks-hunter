"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { Button } from "@/components/ui/button"

type AuthMePayload = {
  user: {
    id: string
    email: string
    fullName: string | null
    roles: string[]
    permissions: string[]
  }
}

export function AuthNav() {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState<AuthMePayload["user"] | null>(null)

  useEffect(() => {
    let mounted = true
    const run = async () => {
      try {
        const response = await fetch("/api/auth/me", { method: "GET" })
        if (!response.ok) {
          if (mounted) setMe(null)
          return
        }
        const payload = (await response.json()) as AuthMePayload
        if (mounted) setMe(payload.user)
      } catch {
        if (mounted) setMe(null)
      }
    }
    void run()
    return () => {
      mounted = false
    }
  }, [pathname])

  const canOpenAdmin = useMemo(() => {
    if (!me) return false
    const roles = new Set(me.roles.map((role) => role.toUpperCase()))
    const permissions = new Set(me.permissions)
    return (
      roles.has("ADMIN") ||
      permissions.has("admin:all") ||
      permissions.has("admin:users:read")
    )
  }, [me])

  const onLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setMe(null)
    router.replace("/login")
    router.refresh()
  }

  if (pathname === "/login") {
    return (
      <nav
        className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end"
        aria-label="Primary navigation"
      >
        <ThemeToggle />
      </nav>
    )
  }

  return (
    <nav
      className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end"
      aria-label="Primary navigation"
    >
      <ThemeToggle />
      {canOpenAdmin ? (
        <Button asChild variant="ghost" size="sm" className="flex-1 sm:flex-none">
          <Link href="/admin">Admin</Link>
        </Button>
      ) : null}
      <Button asChild variant="secondary" size="sm" className="flex-1 sm:flex-none">
        <Link href="/">Dashboard</Link>
      </Button>
      <Button asChild variant="ghost" size="sm" className="flex-1 sm:flex-none">
        <Link href="/scenarios">Scenarios</Link>
      </Button>
      {me ? (
        <>
          <span className="max-w-[180px] truncate text-xs text-muted-foreground">
            {me.fullName ?? me.email}
          </span>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            Logout
          </Button>
        </>
      ) : null}
    </nav>
  )
}
