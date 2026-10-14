"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ImageUp, Loader2, RotateCcw, Trash2 } from "lucide-react"
import { useRef, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { BrandMark } from "@/components/shell/brand-logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { apiFetch, ApiError } from "@/lib/api-client"
import { cn } from "@/lib/utils"

import { DEFAULT_ACCENT_COLOR, DEFAULT_SIDEBAR_COLOR, HEX, readableOn } from "./theme"

export type BrandingSource = {
  id: string
  name: string
  brandTitle: string | null
  sidebarColor: string | null
  accentColor: string | null
  hasLogo: boolean
  logoWide: boolean
  /** ISO timestamp, used to bust the logo's cache after an upload. */
  updatedAt: string
}

const PRESETS = [
  { name: "Navy & gold", sidebar: "#0f2a4a", accent: "#c79a3d" },
  { name: "Forest", sidebar: "#10382b", accent: "#d4a73a" },
  { name: "Burgundy", sidebar: "#4a1424", accent: "#e0b04c" },
  { name: "Slate & blue", sidebar: "#1e293b", accent: "#3b82f6" },
  { name: "Charcoal & orange", sidebar: "#1f2125", accent: "#f08a24" },
  { name: "Teal", sidebar: "#0d3b43", accent: "#2dd4bf" },
]

const schema = z.object({
  brandTitle: z.string().trim().max(40, "Keep it under 40 characters"),
  sidebarColor: z.string().regex(HEX, "Use a colour like #0f2a4a"),
  accentColor: z.string().regex(HEX, "Use a colour like #c79a3d"),
})
type Values = z.input<typeof schema>

/**
 * Edit a dealership's dashboard branding: title, logo and colours, with a live preview.
 * Used by the dealership admin on /settings and by the super admin on a dealership's page, which only differ in the
 * endpoints they call.
 */
export function BrandingForm({
  dealership,
  endpoints,
  onChanged,
}: {
  dealership: BrandingSource
  endpoints: { settings: string; logo: string; logoImage: string }
  onChanged: () => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      brandTitle: dealership.brandTitle ?? "",
      sidebarColor: dealership.sidebarColor ?? DEFAULT_SIDEBAR_COLOR,
      accentColor: dealership.accentColor ?? DEFAULT_ACCENT_COLOR,
    },
  })
  const values = useWatch({ control: form.control })
  const sidebar = HEX.test(values.sidebarColor ?? "") ? values.sidebarColor! : DEFAULT_SIDEBAR_COLOR
  const accent = HEX.test(values.accentColor ?? "") ? values.accentColor! : DEFAULT_ACCENT_COLOR
  const title = (values.brandTitle ?? "").trim() || dealership.name
  const logoSrc = dealership.hasLogo ? `${endpoints.logoImage}?v=${new Date(dealership.updatedAt).getTime()}` : null

  const save = form.handleSubmit(async (v) => {
    try {
      // Colours equal to the defaults are stored as "not customised", so a future default change still applies.
      await apiFetch(endpoints.settings, {
        method: "PATCH",
        body: JSON.stringify({
          brandTitle: v.brandTitle,
          sidebarColor: v.sidebarColor.toLowerCase() === DEFAULT_SIDEBAR_COLOR ? "" : v.sidebarColor,
          accentColor: v.accentColor.toLowerCase() === DEFAULT_ACCENT_COLOR ? "" : v.accentColor,
        }),
      })
      toast.success("Branding saved")
      form.reset(v)
      onChanged()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save branding")
    }
  })

  const upload = async (file: File) => {
    setUploading(true)
    try {
      // A wordmark-style logo (much wider than tall) fills the sidebar; a squarer one sits beside the title.
      const bitmap = await createImageBitmap(file).catch(() => null)
      const wide = bitmap ? bitmap.width / bitmap.height >= 2 : false
      bitmap?.close()
      const body = new FormData()
      body.set("file", file)
      body.set("wide", String(wide))
      await apiFetch(endpoints.logo, { method: "POST", body })
      toast.success("Logo uploaded")
      onChanged()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't upload the logo")
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  const removeLogo = async () => {
    try {
      await apiFetch(endpoints.logo, { method: "DELETE" })
      toast.success("Logo removed")
      onChanged()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't remove the logo")
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Logo</CardTitle>
            <CardDescription>Shown at the top of the sidebar. PNG, JPG or WebP, up to 1 MB. A transparent background works best.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            <div className="flex h-20 w-44 items-center justify-center rounded-xl border p-2" style={{ background: sidebar }}>
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} alt="Current logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <BrandMark className="size-12" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void upload(file)
                }}
              />
              <Button type="button" variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}>
                {uploading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <ImageUp data-icon="inline-start" />}
                {dealership.hasLogo ? "Replace logo" : "Upload logo"}
              </Button>
              {dealership.hasLogo && (
                <Button type="button" variant="ghost" onClick={() => void removeLogo()}>
                  <Trash2 data-icon="inline-start" />
                  Remove
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <form onSubmit={save} noValidate>
          <Card>
            <CardHeader>
              <CardTitle>Title and colours</CardTitle>
              <CardDescription>The title appears in the sidebar (when there&apos;s no wide logo), the page header and the browser tab.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <Controller
                control={form.control}
                name="brandTitle"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="brand-title">Dashboard title</FieldLabel>
                    <Input id="brand-title" {...field} placeholder={dealership.name} className="h-9" aria-invalid={fieldState.invalid} />
                    <FieldDescription>Leave blank to use “{dealership.name}”.</FieldDescription>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <ColourField form={form} name="sidebarColor" label="Sidebar colour" description="The menu panel on the left" />
                <ColourField form={form} name="accentColor" label="Button & highlight colour" description="Buttons, focus rings, chart highlights" />
              </div>

              <div className="grid gap-2">
                <span className="text-sm font-medium">Quick palettes</span>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        form.setValue("sidebarColor", preset.sidebar, { shouldDirty: true, shouldValidate: true })
                        form.setValue("accentColor", preset.accent, { shouldDirty: true, shouldValidate: true })
                      }}
                      className="flex items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1.5 text-sm transition-colors hover:border-(--gold) hover:bg-accent"
                    >
                      <span className="flex overflow-hidden rounded-full ring-1 ring-black/10">
                        <span className="size-5" style={{ background: preset.sidebar }} />
                        <span className="size-5" style={{ background: preset.accent }} />
                      </span>
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
                  {form.formState.isSubmitting && <Loader2 className="animate-spin" data-icon="inline-start" />}
                  Save branding
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    form.setValue("brandTitle", "", { shouldDirty: true })
                    form.setValue("sidebarColor", DEFAULT_SIDEBAR_COLOR, { shouldDirty: true, shouldValidate: true })
                    form.setValue("accentColor", DEFAULT_ACCENT_COLOR, { shouldDirty: true, shouldValidate: true })
                  }}
                >
                  <RotateCcw data-icon="inline-start" />
                  Reset to default
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>

      <Preview title={title} sidebar={sidebar} accent={accent} logoSrc={logoSrc} wide={dealership.logoWide} />
    </div>
  )
}

function ColourField({
  form,
  name,
  label,
  description,
}: {
  form: ReturnType<typeof useForm<Values>>
  name: "sidebarColor" | "accentColor"
  label: string
  description: string
}) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label={`${label} picker`}
              value={HEX.test(field.value) ? field.value : "#000000"}
              onChange={(event) => field.onChange(event.target.value)}
              className="size-9 shrink-0 cursor-pointer rounded-lg border bg-transparent p-0.5"
            />
            <Input id={name} value={field.value} onChange={(event) => field.onChange(event.target.value)} onBlur={field.onBlur} className="h-9 font-mono uppercase" maxLength={7} aria-invalid={fieldState.invalid} />
          </div>
          <FieldDescription>{description}</FieldDescription>
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

/** A miniature of the dealership's sidebar and a button, so the colours can be judged before saving. */
function Preview({ title, sidebar, accent, logoSrc, wide }: { title: string; sidebar: string; accent: string; logoSrc: string | null; wide: boolean }) {
  const fg = readableOn(sidebar)
  const items = ["Dashboard", "Customers", "Vehicles", "Agreements"]
  return (
    <Card className="h-fit lg:sticky lg:top-20">
      <CardHeader>
        <CardTitle>Preview</CardTitle>
        <CardDescription>How your dashboard will look.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-72 overflow-hidden rounded-xl border">
          <div className="flex w-36 shrink-0 flex-col gap-3 p-3" style={{ background: sidebar, color: fg }}>
            <div className="flex items-center gap-2">
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} alt="" className={cn("object-contain", wide ? "h-9 w-full" : "size-7 shrink-0")} />
              ) : (
                <BrandMark className="size-7 shrink-0" />
              )}
              {!(logoSrc && wide) && <span className="truncate text-sm font-bold">{title}</span>}
            </div>
            <div className="grid gap-1 pt-1">
              {items.map((item, index) => (
                <span
                  key={item}
                  className="rounded-md px-2 py-1 text-xs"
                  style={index === 0 ? { background: `color-mix(in oklch, ${sidebar}, ${fg} 16%)`, fontWeight: 600 } : { opacity: 0.8 }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-3 bg-[#f7f8fa] p-3 text-[#1f2937]">
            <span className="truncate text-xs text-[#5b6472]">{title} › Dashboard</span>
            <span className="text-base font-bold">Good morning</span>
            <span className="w-fit rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: accent, color: readableOn(accent) }}>
              New agreement
            </span>
            <div className="mt-auto h-1.5 overflow-hidden rounded-full bg-black/10">
              <div className="h-full w-2/3 rounded-full" style={{ background: accent }} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
