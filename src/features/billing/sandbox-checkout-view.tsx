"use client"

import { ArrowLeft, Check, FlaskConical, Lock } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { useDealership } from "@/components/shell/dealership-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api-client"
import { cn } from "@/lib/utils"

import { formatMoney } from "./meta"
import { useBilling, useSandboxCheckout } from "./queries"

const TEST_CARDS = [
  { value: "approves", label: "Visa •••• 4242", hint: "Test card: payment succeeds" },
  { value: "declines", label: "Visa •••• 0002", hint: "Test card: payment is declined" },
] as const

/** Stands in for Stripe Checkout while the app runs without Stripe keys. No card details are collected. */
export function SandboxCheckoutView() {
  const params = useSearchParams()
  const router = useRouter()
  const { current } = useDealership()
  const { data } = useBilling()
  const checkout = useSandboxCheckout()
  const [card, setCard] = useState<(typeof TEST_CARDS)[number]["value"]>("approves")
  const [error, setError] = useState<string | null>(null)
  const plan = data?.plans.find((p) => p.id === params.get("plan"))

  if (data && (!plan || data.mode !== "sandbox")) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>Checkout unavailable</CardTitle>
          <CardDescription>{data.mode !== "sandbox" ? "Payments go through Stripe Checkout." : "That plan no longer exists."}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href={"/billing" as Route}>Back to billing</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const submit = () => {
    if (!plan) return
    setError(null)
    checkout.mutate(
      { planId: plan.id, outcome: card },
      {
        onSuccess: () => router.push("/billing?checkout=success" as Route),
        onError: (e) => setError(e instanceof ApiError ? e.message : "Payment failed"),
      },
    )
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 py-4 md:grid-cols-2 md:py-10">
      <div className="grid content-start gap-6">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href={"/billing?checkout=canceled" as Route}>
            <ArrowLeft data-icon="inline-start" />
            Back
          </Link>
        </Button>
        {plan ? (
          <div className="grid gap-4">
            <span className="text-sm text-muted-foreground">Subscribe {current.name} to</span>
            <h1 className="text-3xl font-semibold tracking-tight">AutoVault {plan.name}</h1>
            <div className="flex items-baseline gap-1">
              <span className="font-heading text-4xl font-semibold tabular-nums">{formatMoney(plan.amount, plan.currency)}</span>
              <span className="text-muted-foreground">per {plan.interval}</span>
            </div>
            <ul className="grid gap-2 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="size-4 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Skeleton className="h-48" />
        )}
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="size-4" />
            Sandbox checkout
          </CardTitle>
          <CardDescription>Simulates Stripe Checkout. No card details are collected and no money moves.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <RadioGroup value={card} onValueChange={(value) => setCard(value as typeof card)} className="gap-2">
            {TEST_CARDS.map((option) => (
              <label
                key={option.value}
                className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/60", card === option.value && "border-primary bg-primary/6")}
              >
                <RadioGroupItem value={option.value} />
                <span className="grid">
                  <span className="font-mono text-sm font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.hint}</span>
                </span>
              </label>
            ))}
          </RadioGroup>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Separator />
          {plan && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Due today</span>
              <span className="font-semibold tabular-nums">{formatMoney(plan.amount, plan.currency)}</span>
            </div>
          )}
          <Button size="lg" className="w-full" disabled={!plan || checkout.isPending} onClick={submit}>
            <Lock data-icon="inline-start" />
            {checkout.isPending ? "Processing…" : "Subscribe"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">Renews automatically each {plan?.interval ?? "month"}. Cancel any time from Billing.</p>
        </CardContent>
      </Card>
    </div>
  )
}
