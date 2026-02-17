import { LoginPage } from "@/components/auth/LoginPage"
import { AppShell } from "@/components/layout/AppShell"

type LoginRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function LoginRoute({ searchParams }: LoginRouteProps) {
  const resolved = await searchParams
  const nextParam = resolved.next
  const nextPath =
    typeof nextParam === "string" && nextParam.startsWith("/")
      ? nextParam
      : "/"

  return (
    <AppShell
      title="Secure Access"
      subtitle="Sign in to continue to your dashboard."
    >
      <LoginPage nextPath={nextPath} />
    </AppShell>
  )
}
