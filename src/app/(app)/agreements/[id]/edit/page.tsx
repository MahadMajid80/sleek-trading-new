import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { AgreementForm } from "@/features/agreements/agreement-form"
import { formatAgreementNumber } from "@/features/agreements/schema"
import { getAgreement } from "@/features/agreements/server"
import { toJson } from "@/lib/serialize"
import { currentDealershipId } from "@/server/tenant"

export const metadata: Metadata = { title: "Edit agreement" }

export default async function EditAgreementPage({ params }: PageProps<"/agreements/[id]/edit">) {
  const { id } = await params
  const agreement = /^[0-9a-f-]{36}$/i.test(id) ? await getAgreement(await currentDealershipId(), id) : null
  if (!agreement) notFound()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Edit ${formatAgreementNumber(agreement.number, agreement.dealership.code)}`} description="Changes apply to the agreement and its printed documents." />
      <AgreementForm agreement={toJson(agreement)} initialType={agreement.type} />
    </div>
  )
}
