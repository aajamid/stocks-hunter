import Image from "next/image"

import { AuthNav } from "@/components/layout/AuthNav"

type AppShellProps = {
  title: string
  subtitle?: string
  children: React.ReactNode
}

export function AppShell({ title, subtitle, children }: AppShellProps) {
  return (
    <div className="min-h-screen px-4 pb-8 pt-4 text-foreground sm:px-6 sm:pb-10 sm:pt-6">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
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
          <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
          {subtitle ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
        <AuthNav />
      </header>
      {children}
    </div>
  )
}
