import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { AgreementForm } from "@/features/agreements/agreement-form"
import { AGREEMENT_TYPES, type AgreementType } from "@/features/agreements/schema"

export const metadata: Metadata = { title: "New agreement" }

export default async function NewAgreementPage({ searchParams }: PageProps<"/agreements/new">) {
  const { type } = await searchParams
  const initialType = AGREEMENT_TYPES.includes(type as AgreementType) ? (type as AgreementType) : "hire_purchase"
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="New agreement" description="Fill in the parties, vehicle and terms. The number is assigned when you save." />
      <AgreementForm initialType={initialType} />
    </div>
  )
}
