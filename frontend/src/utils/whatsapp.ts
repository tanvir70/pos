import { formatTk } from "./currency"

/**
 * WhatsApp Integration Utility for Agrochemical Dealer Ledger
 * 
 * BUSINESS DECISION: Direct WhatsApp messaging automatically formats Bangladesh mobile numbers
 * to 880 international format and generates a pre-composed polite Bengali balance reminder message.
 */

/**
 * Normalizes any Bangladeshi phone number to international 8801XXXXXXXXX format.
 * Handles variations like: "01711223344", "+8801711-223344", "880 1711 223344".
 */
export function normalizeBDPhone(phone: string | undefined | null): string {
  if (!phone) return ""
  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, "")

  // If starts with 880 and length 13 (8801XXXXXXXXX)
  if (digits.startsWith("880") && digits.length === 13) {
    return digits
  }

  // If starts with 01 and length 11 (01XXXXXXXXX)
  if (digits.startsWith("01") && digits.length === 11) {
    return `88${digits}`
  }

  // If length 10 without leading 0 (1XXXXXXXXX)
  if (digits.length === 10 && digits.startsWith("1")) {
    return `880${digits}`
  }

  // Fallback return cleaned digits
  return digits
}

export interface DueReminderParams {
  phone: string
  customerName: string
  businessName?: string | null
  dueAmount: number
  shopName?: string
}

/**
 * Generates an instant WhatsApp Click-to-Chat URL with polite Bengali debt notification text.
 */
export function generateDueReminderUrl({
  phone,
  customerName,
  businessName,
  dueAmount,
  shopName = "মেসার্স আল-আমিন ট্রেডার্স",
}: DueReminderParams): string {
  const normalizedPhone = normalizeBDPhone(phone)
  if (!normalizedPhone) return ""

  const displayName = businessName ? `${customerName} (${businessName})` : customerName
  const formattedDue = formatTk(dueAmount)

  const message = `আসসালামু আলাইকুম ${displayName} সাহেব,
${shopName} এ আপনার বর্তমান বকেয়া হিসাব ${formattedDue}। 

অনুগ্ৰহ করে আপনার সুবিধাজনক সময়ে বকেয়া পরিশোধ করে সহযোগিতা করার জন্য বিনীত অনুরোধ জানাচ্ছি।

ধন্যবাদান্তে,
${shopName}`

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
}

/**
 * Opens a WhatsApp chat with invoice summary or payment notification for an invoice.
 */
export function openWhatsAppPaymentReminder(
  phone: string,
  customerName: string,
  totalAmount: number,
  remainingDue: number,
  invoiceNumber?: string,
  shopName = "মেসার্স আল-আমিন ট্রেডার্স",
): void {
  const normalizedPhone = normalizeBDPhone(phone)
  if (!normalizedPhone) return

  let message = `আসসালামু আলাইকুম ${customerName} সাহেব,
${shopName} থেকে আপনার ক্রয়কৃত পণ্যের ইনভয়েস #${invoiceNumber || ""} সফলভাবে তৈরি হয়েছে।
মোট বিল: ${formatTk(totalAmount)}।`

  if (remainingDue > 0) {
    message += `
পরিশোধের পর বর্তমান বাকি: ${formatTk(remainingDue)}।`
  } else {
    message += `
সম্পূর্ণ বিল পরিশোধিত হয়েছে।`
  }

  message += `

ধন্যবাদান্তে,
${shopName}`

  const url = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
  window.open(url, "_blank", "noopener,noreferrer")
}

