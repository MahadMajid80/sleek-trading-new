"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { BarChart3, CarFront, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { BrandMark } from "@/components/shell/brand-logo"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, apiFetch } from "@/lib/api-client"

const schema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
})
type Values = z.input<typeof schema>

const POINTS = [
  { icon: CarFront, text: "Vehicles, customers and agreements in one place" },
  { icon: BarChart3, text: "Hire purchase schedules, payments and collections" },
  { icon: ShieldCheck, text: "Each dealership sees only its own data" },
]

export function LoginView() {
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } })
  const { errors, isSubmitting } = form.formState

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      const result = await apiFetch<{ redirect: string }>("/api/auth/login", { method: "POST", body: JSON.stringify(values) })
      // Full navigation: the root layout reads the new session to apply the dealership's branding.
      window.location.assign(result.redirect)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't reach the server. Check your connection and try again.")
    }
  })

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-(--navy) p-12 text-white lg:flex">
        <div aria-hidden className="absolute -top-40 -right-40 size-[34rem] rounded-full bg-(--gold) opacity-15 blur-[120px]" />
        <div className="relative flex items-center gap-3">
          <BrandMark className="size-12" />
          <span className="font-heading text-3xl font-bold tracking-tight">AutoVault</span>
        </div>
        <div className="relative grid gap-8">
          <h1 className="max-w-md text-4xl leading-tight font-bold text-balance">Run your whole dealership from one dashboard.</h1>
          <ul className="grid gap-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[#eaeff6]">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-(--gold-light)">
                  <Icon className="size-4.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-[#c2ccda]">Vehicle sales, hire purchase and finance software for dealerships.</p>
      </section>

      <section className="flex items-center justify-center bg-background p-6">
        <form onSubmit={submit} noValidate className="grid w-full max-w-sm gap-6">
          <div className="grid gap-2">
            <div className="flex items-center gap-2.5 lg:hidden">
              <BrandMark className="size-9" />
              <span className="font-heading text-2xl font-bold tracking-tight">AutoVault</span>
            </div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground">Use the email and password your administrator gave you.</p>
          </div>

          {error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" autoFocus className="h-10" aria-invalid={Boolean(errors.email)} {...form.register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="h-10 pr-10"
                aria-invalid={Boolean(errors.password)}
                {...form.register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>

          <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
            {isSubmitting && <Loader2 className="animate-spin" data-icon="inline-start" />}
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </section>
    </main>
  )
}
