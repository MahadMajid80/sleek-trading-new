import { format, parseISO } from "date-fns"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

import type { AgreementDetailData } from "@/features/agreements/queries"
import { formatAgreementNumber } from "@/features/agreements/schema"
import { amountDue, remainingAmount, statusMeta } from "@/features/installments/ledger"

const GOLD: [number, number, number] = [176, 128, 32]
const CHARCOAL: [number, number, number] = [64, 64, 64]
const ksh = (value: number) => `KSh ${Math.round(value).toLocaleString("en-KE")}`

/** Customer-facing account statement for a hire purchase agreement. */
export async function generateStatementPdf(a: AgreementDetailData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14

  // Uses the issuing dealership's own name: statements are produced for every dealership on the platform.
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...CHARCOAL)
  doc.text(a.dealership.name, margin, 17)
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...CHARCOAL)
  doc.text("ACCOUNT STATEMENT", pageWidth - margin, 17, { align: "right" })
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110)
  doc.text(`${formatAgreementNumber(a.number, a.dealership.code)} · Hire purchase`, pageWidth - margin, 22, { align: "right" })
  doc.text(`Generated ${format(new Date(), "d MMM yyyy, HH:mm")}`, pageWidth - margin, 26.5, { align: "right" })
  doc.setDrawColor(...GOLD).setLineWidth(0.8).line(margin, 31, pageWidth - margin, 31)

  const buyer = a.buyer
  const car = a.car
  doc.setFontSize(8).setTextColor(130).text("CUSTOMER", margin, 39)
  doc.text("VEHICLE", pageWidth / 2, 39)
  doc.setFontSize(10).setTextColor(...CHARCOAL).setFont("helvetica", "bold")
  doc.text(buyer?.name ?? "—", margin, 44.5)
  doc.text(`${car.year} ${car.brand} ${car.name}`, pageWidth / 2, 44.5)
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(90)
  doc.text([`ID ${buyer?.nationalId ?? "—"} · KRA ${buyer?.kraPin ?? "—"}`, `Tel ${buyer?.telephone ?? "—"}`], margin, 49.5)
  doc.text([`Reg ${car.regNo ?? "—"} · Chassis ${car.chassisNo ?? "—"}`, `${car.color} · ${car.cc.toLocaleString("en-KE")} cc`], pageWidth / 2, 49.5)

  const paid = a.payments.reduce((sum, p) => sum + p.amount, 0)
  const outstanding = a.installments.reduce((sum, i) => sum + remainingAmount(i), 0)
  const overdue = a.installments.filter((i) => i.status === "overdue")
  const summary: [string, string][] = [
    ["Agreed price", ksh(a.agreedPrice)],
    ["Deposit", ksh(a.deposit)],
    ["Financed balance", ksh(a.balance)],
    ["Paid to date", ksh(paid)],
    ["Outstanding", ksh(outstanding)],
    ["Overdue", overdue.length ? `${ksh(overdue.reduce((s, i) => s + remainingAmount(i), 0))} (${overdue.length})` : "None"],
  ]
  const boxWidth = (pageWidth - margin * 2) / 3
  summary.forEach(([label, value], index) => {
    const x = margin + (index % 3) * boxWidth
    const y = 62 + Math.floor(index / 3) * 15
    doc.setFillColor(250, 246, 236).roundedRect(x, y, boxWidth - 3, 12, 1.5, 1.5, "F")
    doc.setFontSize(7.5).setTextColor(130).text(label.toUpperCase(), x + 3, y + 4.5)
    doc.setFontSize(10.5).setTextColor(...CHARCOAL).setFont("helvetica", "bold").text(value, x + 3, y + 9.5)
    doc.setFont("helvetica", "normal")
  })

  autoTable(doc, {
    startY: 96,
    margin: { left: margin, right: margin },
    head: [["#", "Due date", "Installment", "Amount due", "Paid", "Balance", "Status"]],
    body: a.installments.map((i) => [
      String(i.sequence),
      format(parseISO(i.dueDate), "d MMM yyyy"),
      ksh(i.amount),
      ksh(amountDue(i)),
      ksh(i.paid),
      ksh(remainingAmount(i)),
      statusMeta[i.status].label,
    ]),
    styles: { fontSize: 8.5, cellPadding: 2.2, textColor: CHARCOAL },
    headStyles: { fillColor: GOLD, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [252, 250, 245] },
    columnStyles: { 0: { cellWidth: 9 }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 6 && data.cell.raw === "Overdue") data.cell.styles.textColor = [185, 28, 28]
    },
  })

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setFontSize(7.5).setTextColor(150)
    doc.text(`${a.dealership.name} · Amounts in Kenya Shillings`, margin, 290)
    doc.text(`Page ${page} of ${pages}`, pageWidth - margin, 290, { align: "right" })
  }

  doc.save(`${formatAgreementNumber(a.number, a.dealership.code)}-statement-${format(new Date(), "yyyy-MM-dd")}.pdf`)
}
