"use client"

import type { AgreementDetailData } from "@/features/agreements/queries"

import { legacyAgreement, legacyInvoice, type InvoiceDocumentInput } from "./adapters"

// Generators are loaded on demand: jsPDF is ~300 kB and only needed when someone actually downloads.

export async function downloadAgreementPdf(agreement: AgreementDetailData) {
  const data = legacyAgreement(agreement)
  if (agreement.type === "hire_purchase") {
    const { generateHpAgreementPDF } = await import("./legacy/hire-purchase-agreement")
    generateHpAgreementPDF(data)
  } else if (agreement.type === "buying") {
    const { generateBuyingAgreementPDF } = await import("./legacy/buying-agreement")
    generateBuyingAgreementPDF(data)
  } else {
    const { generateAgreementPDF } = await import("./legacy/cash-sale-agreement")
    generateAgreementPDF(data)
  }
}

export async function downloadInvoicePdf(kind: "proforma" | "final", input: InvoiceDocumentInput) {
  const data = legacyInvoice(input)
  if (kind === "proforma") {
    const { generatePDF } = await import("./legacy/proforma-invoice")
    await generatePDF(data)
  } else {
    const { generateFinalInvoicePDF } = await import("./legacy/final-invoice")
    await generateFinalInvoicePDF(data)
  }
}

export async function downloadStatementPdf(agreement: AgreementDetailData) {
  const { generateStatementPdf } = await import("./statement")
  await generateStatementPdf(agreement)
}
