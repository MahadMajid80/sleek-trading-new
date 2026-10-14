import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AgreementDetailView } from "@/features/agreements/agreement-detail-view"
import { formatAgreementNumber } from "@/features/agreements/schema"
import { getAgreement } from "@/features/agreements/server"
import { toJson } from "@/lib/serialize"
import { currentDealershipId } from "@/server/tenant"

const UUID = /^[0-9a-f-]{36}$/i

async function load(id: string) {
  return UUID.test(id) ? getAgreement(await currentDealershipId(), id) : null
}

export async function generateMetadata({ params }: PageProps<"/agreements/[id]">): Promise<Metadata> {
  const agreement = await load((await params).id)
  return { title: agreement ? formatAgreementNumber(agreement.number, agreement.dealership.code) : "Agreement not found" }
}

export default async function AgreementPage({ params }: PageProps<"/agreements/[id]">) {
  const agreement = await load((await params).id)
  if (!agreement) notFound()
  return <AgreementDetailView initial={toJson(agreement)} />
}
