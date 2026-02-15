import Image from "next/image"
import Link from "next/link"

import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { Button } from "@/components/ui/button"

type AppShellProps = {
  title: string
  subtitle?: string
  children: React.ReactNode
}

export function AppShell({ title, subtitle, children }: AppShellProps) {
  return (
    <div className="min-h-screen px-6 pb-10 pt-6 text-foreground">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2">
            <Image
              src="/autad-logo-white.png"
              alt="Autad"
              width={200}
              height={78}
              priority
              className="h-9 w-auto invert transition dark:invert-0"
            />
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Saudi Stocks Hunter
          </p>
          <h1 className="text-3xl font-semibold">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="secondary" size="sm">
            <Link href="/">Dashboard</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/scenarios">Scenarios</Link>
          </Button>
        </nav>
      </header>
      {children}
    </div>
  )
}
