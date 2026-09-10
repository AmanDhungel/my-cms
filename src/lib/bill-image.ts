import { money, quantity } from "@/lib/billing"
import type { BillDTO } from "@/models/bill"

export type BillLayout = "tax" | "customer"

/** Green settled, red owing, marigold waiting on a cheque. */
const PAYMENT_INK: Record<BillDTO["payment"], string> = {
  paid: "#1da76b",
  unpaid: "#e5484d",
  cheque: "#a86a0a",
  quotation: "#2f7de1",
}

function paymentLine(bill: BillDTO) {
  if (bill.payment === "cheque") {
    return bill.chequeNo ? `CHEQUE ${bill.chequeNo}` : "CHEQUE"
  }
  return bill.payment.toUpperCase()
}

export type BillImageInput = {
  bill: BillDTO
  business: { name: string; pan: string | null }
  layout: BillLayout
  issuedBy?: string | null
}

/**
 * Draws the bill onto a canvas and hands back a PNG.
 *
 * This paints the bill rather than screenshotting the page: the app's palette
 * is written in `oklch()`, which the html-to-image libraries can't parse, and
 * a bill is a fixed layout anyway — nothing here needs to mirror the DOM.
 */
export async function renderBillPng(input: BillImageInput): Promise<Blob> {
  const W = 760
  const PAD = 40
  const scale = Math.min(window.devicePixelRatio || 1, 2) * 2

  const { bill, business, layout } = input
  const taxLayout = layout === "tax"

  const rowH = 30
  // The paper is cut to the bill rather than to a page size, so a two-line
  // bill does not come out with half a screen of white under it.
  const detailRows = [
    bill.customer.phone,
    bill.customer.address,
    taxLayout && bill.customer.pan ? bill.customer.pan : null,
  ].filter(Boolean).length
  const totalsRows =
    2 + (bill.discountTotal > 0 ? 1 : 0) + (bill.vatRate > 0 ? 2 : 0)
  const height =
    234 +
    detailRows * 17 +
    bill.lines.length * rowH +
    26 +
    totalsRows * 28 +
    (bill.note ? 28 : 0) +
    46

  const canvas = document.createElement("canvas")
  canvas.width = W * scale
  canvas.height = height * scale

  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("This browser wouldn't give us a canvas")
  ctx.scale(scale, scale)

  const ink = "#1b1815"
  const muted = "#6b625a"
  const line = "#ddd6cd"
  const petrol = "#0e7c7b"
  const sans = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

  const font = (size: number, weight = "400") =>
    `${weight} ${size}px ${sans}`

  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, W, height)

  const rule = (y: number, colour = line) => {
    ctx.strokeStyle = colour
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(PAD, y + 0.5)
    ctx.lineTo(W - PAD, y + 0.5)
    ctx.stroke()
  }

  const text = (
    value: string,
    x: number,
    y: number,
    options: { size?: number; weight?: string; colour?: string; align?: CanvasTextAlign } = {}
  ) => {
    ctx.font = font(options.size ?? 13, options.weight ?? "400")
    ctx.fillStyle = options.colour ?? ink
    ctx.textAlign = options.align ?? "left"
    ctx.fillText(value, x, y)
    ctx.textAlign = "left"
  }

  /** Cuts a long item name so it can't run into the quantity column. */
  const clip = (value: string, max: number, size: number) => {
    ctx.font = font(size)
    if (ctx.measureText(value).width <= max) return value
    let cut = value
    while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) {
      cut = cut.slice(0, -1)
    }
    return `${cut}…`
  }

  // ---- header ------------------------------------------------------------
  ctx.fillStyle = petrol
  ctx.fillRect(0, 0, W, 6)

  const quote = bill.payment === "quotation"

  let y = 62
  text(business.name, PAD, y, { size: 25, weight: "700" })
  // A quotation says so at the top; it is not an invoice of any kind.
  text(quote ? "QUOTATION" : taxLayout ? "TAX INVOICE" : "BILL", W - PAD, y, {
    size: 17,
    weight: "700",
    align: "right",
    colour: petrol,
  })

  y += 22
  if (taxLayout && business.pan) {
    text(`PAN ${business.pan}`, PAD, y, { size: 12, colour: muted })
  }
  text(bill.number, W - PAD, y, { size: 13, weight: "600", align: "right" })

  y += 18
  text(
    new Date(bill.createdAt).toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    W - PAD,
    y,
    { size: 12, colour: muted, align: "right" }
  )

  y += 18
  if (!quote) {
    text(paymentLine(bill), W - PAD, y, {
      size: 11.5,
      weight: "700",
      align: "right",
      colour: PAYMENT_INK[bill.payment],
    })
  }

  y += 26
  rule(y)

  // ---- customer ----------------------------------------------------------
  y += 26
  text("BILL TO", PAD, y, { size: 10.5, weight: "600", colour: muted })
  y += 20
  text(bill.customer.name, PAD, y, { size: 15, weight: "600" })

  const details = [
    bill.customer.phone,
    bill.customer.address,
    taxLayout && bill.customer.pan ? `PAN ${bill.customer.pan}` : null,
  ].filter(Boolean) as string[]

  for (const detail of details) {
    y += 17
    text(detail, PAD, y, { size: 12, colour: muted })
  }

  // ---- lines -------------------------------------------------------------
  y += 30
  const cols = {
    name: PAD,
    qty: W - PAD - 330,
    rate: W - PAD - 220,
    disc: W - PAD - 110,
    amount: W - PAD,
  }

  ctx.fillStyle = "#f5f2ee"
  ctx.fillRect(PAD, y - 16, W - PAD * 2, 26)

  text("ITEM", cols.name + 8, y, { size: 10.5, weight: "600", colour: muted })
  text("QTY", cols.qty, y, { size: 10.5, weight: "600", colour: muted, align: "right" })
  text("RATE", cols.rate, y, { size: 10.5, weight: "600", colour: muted, align: "right" })
  text("DISC", cols.disc, y, { size: 10.5, weight: "600", colour: muted, align: "right" })
  text("AMOUNT", cols.amount, y, { size: 10.5, weight: "600", colour: muted, align: "right" })

  y += 12

  for (const item of bill.lines) {
    y += rowH
    text(clip(item.name, 290, 13), cols.name + 8, y - 9, { size: 13 })
    text(`${quantity(item.qty)} ${item.unit}`, cols.qty, y - 9, {
      size: 12.5,
      align: "right",
      colour: muted,
    })
    text(money(item.price), cols.rate, y - 9, { size: 12.5, align: "right" })
    text(
      item.discountPct > 0 ? `${quantity(item.discountPct)}%` : "—",
      cols.disc,
      y - 9,
      { size: 12.5, align: "right", colour: item.discountPct > 0 ? petrol : muted }
    )
    text(money(item.net), cols.amount, y - 9, { size: 13, weight: "600", align: "right" })
    rule(y - 2, "#efeae3")
  }

  // ---- totals ------------------------------------------------------------
  y += 26
  const totalRow = (label: string, value: string, strong = false) => {
    text(label, cols.disc, y, {
      size: strong ? 14 : 12.5,
      weight: strong ? "700" : "400",
      colour: strong ? ink : muted,
      align: "right",
    })
    text(value, cols.amount, y, {
      size: strong ? 16 : 13,
      weight: strong ? "700" : "500",
      align: "right",
    })
    y += 28
  }

  totalRow("Subtotal", money(bill.subtotal))
  if (bill.discountTotal > 0) {
    totalRow("Discount", `- ${money(bill.discountTotal)}`)
  }
  if (bill.vatRate > 0) {
    totalRow("Taxable", money(bill.taxable))
    totalRow(`VAT ${quantity(bill.vatRate)}%`, money(bill.vatAmount))
  }
  rule(y - 18)
  y += 4
  totalRow("Total", money(bill.total), true)

  // ---- footer ------------------------------------------------------------
  if (bill.note) {
    y += 6
    text(clip(bill.note, W - PAD * 2, 12), PAD, y, { size: 12, colour: muted })
  }

  y += 22
  text(
    input.issuedBy ? `Issued by ${input.issuedBy}` : "Thank you",
    PAD,
    y,
    { size: 11.5, colour: muted }
  )

  if (bill.status === "void") {
    ctx.save()
    ctx.translate(W / 2, height / 2)
    ctx.rotate(-0.35)
    ctx.globalAlpha = 0.16
    text("VOID", 0, 0, { size: 130, weight: "700", colour: "#e5484d", align: "center" })
    ctx.restore()
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("The image came back empty")),
      "image/png"
    )
  })
}

/** The one-paragraph version of a bill, for a WhatsApp or email message. */
export function billSummary(bill: BillDTO, businessName: string) {
  const lines = bill.lines
    .map(
      (line) =>
        `• ${line.name} — ${quantity(line.qty)} ${line.unit} × ${money(line.price)}${
          line.discountPct > 0 ? ` (-${quantity(line.discountPct)}%)` : ""
        } = ${money(line.net)}`
    )
    .join("\n")

  const tail = [
    bill.discountTotal > 0 ? `Discount: ${money(bill.discountTotal)}` : null,
    bill.vatRate > 0 ? `VAT ${quantity(bill.vatRate)}%: ${money(bill.vatAmount)}` : null,
    `Total: ${money(bill.total)}`,
    // Whether it is settled matters as much as the amount.
    paymentLine(bill),
  ]
    .filter(Boolean)
    .join("\n")

  return `${businessName}\n${bill.number} · ${new Date(bill.createdAt).toLocaleDateString("en-GB")}\n\n${lines}\n\n${tail}`
}
