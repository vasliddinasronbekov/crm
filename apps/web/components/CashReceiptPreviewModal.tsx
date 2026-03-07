'use client'

import { useEffect, useMemo } from 'react'
import Image from 'next/image'
import { Printer, X } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import type { CashReceiptPayload } from '@/lib/hooks/usePayments'

interface CashReceiptPreviewModalProps {
  isOpen: boolean
  receipt: CashReceiptPayload | null
  autoPrintKey?: number
  onAutoPrintHandled?: () => void
  onClose: () => void
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const row = (label: string, value: string): string => `
  <div class="row">
    <span class="label">${escapeHtml(label)}</span>
    <span class="value">${escapeHtml(value)}</span>
  </div>
`

export default function CashReceiptPreviewModal({
  isOpen,
  receipt,
  autoPrintKey,
  onAutoPrintHandled,
  onClose,
}: CashReceiptPreviewModalProps) {
  const { formatCurrencyFromMinor } = useSettings()

  const formattedPaidAmount = useMemo(
    () => (receipt ? formatCurrencyFromMinor(receipt.paid_amount) : ''),
    [formatCurrencyFromMinor, receipt],
  )
  const formattedRemainingBalance = useMemo(
    () => (receipt ? formatCurrencyFromMinor(receipt.remaining_balance) : ''),
    [formatCurrencyFromMinor, receipt],
  )

  const printReceipt = () => {
    if (!receipt) return

    const printWindow = window.open('', '_blank', 'width=420,height=900')
    if (!printWindow) return

    const receiptHtml = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Receipt ${escapeHtml(receipt.receipt_number)}</title>
          <style>
            body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #ffffff; }
            .paper { width: 80mm; min-height: 100vh; margin: 0 auto; padding: 8px 6px 12px; color: #0f172a; }
            .header { text-align: center; margin-bottom: 10px; }
            .logo { width: 34px; height: 34px; border-radius: 999px; object-fit: cover; margin: 0 auto 6px; display: block; }
            .title { font-size: 14px; font-weight: 700; line-height: 1.3; }
            .subtitle { font-size: 11px; color: #334155; }
            .line { border-top: 1px dashed #94a3b8; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; gap: 10px; margin: 4px 0; font-size: 11px; }
            .label { color: #334155; }
            .value { font-weight: 600; text-align: right; word-break: break-word; }
            .strong { font-size: 12px; }
            .note { font-size: 11px; margin-top: 6px; color: #334155; white-space: pre-wrap; word-break: break-word; }
            .qr-wrap { margin-top: 12px; text-align: center; }
            .qr-wrap img { width: 140px; height: 140px; object-fit: contain; }
            .footer { text-align: center; margin-top: 8px; font-size: 10px; color: #334155; }
            @page { size: 80mm auto; margin: 0; }
            @media print {
              body { margin: 0; }
              .paper { width: 80mm; padding: 6mm 4mm 8mm; }
            }
          </style>
        </head>
        <body>
          <div class="paper">
            <div class="header">
              ${receipt.logo_url ? `<img class="logo" src="${escapeHtml(receipt.logo_url)}" alt="Logo" />` : ''}
              <div class="title">${escapeHtml(receipt.education_center_name)}</div>
              <div class="subtitle">${escapeHtml(receipt.branch || 'Main branch')}</div>
            </div>
            <div class="line"></div>
            ${row('Receipt #', receipt.receipt_number)}
            ${row('Date/Time', receipt.issued_at_display)}
            ${row('Cashier', receipt.cashier_full_name || '-')}
            ${row('Student', receipt.student_full_name || '-')}
            ${row('Group', receipt.group_name || '-')}
            ${row('Course/Service', receipt.course_service_name || '-')}
            ${row('Method', 'Cash')}
            <div class="line"></div>
            ${row('Paid Amount', formattedPaidAmount)}
            ${row('Remaining', formattedRemainingBalance)}
            ${row('Txn / Receipt ID', receipt.transaction_id || receipt.receipt_number)}
            ${receipt.note ? `<div class="note"><strong>Note:</strong> ${escapeHtml(receipt.note)}</div>` : ''}
            <div class="qr-wrap">
              <img src="${receipt.qr_code_image}" alt="Receipt QR" />
            </div>
            <div class="footer">Verify: ${escapeHtml(receipt.verification_url)}</div>
          </div>
        </body>
      </html>
    `

    printWindow.document.open()
    printWindow.document.write(receiptHtml)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  useEffect(() => {
    if (!isOpen || !receipt || !autoPrintKey) return
    printReceipt()
    onAutoPrintHandled?.()
    // autoPrintKey acts as an explicit print trigger token
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrintKey, isOpen, receipt, onAutoPrintHandled])

  if (!isOpen || !receipt) return null

  return (
    <div className="fixed inset-0 z-[70] bg-black/55 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-lg font-semibold">Cash Receipt Preview</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-background transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-5">
          <div className="mx-auto w-[320px] rounded-xl border border-border bg-background p-4">
            <div className="text-center mb-3">
              {receipt.logo_url ? (
                <div className="mb-2 flex justify-center">
                  <Image
                    src={receipt.logo_url}
                    alt="Center logo"
                    width={44}
                    height={44}
                    unoptimized
                    className="h-11 w-11 rounded-full object-cover border border-border"
                  />
                </div>
              ) : null}
              <p className="text-sm font-semibold">{receipt.education_center_name}</p>
              <p className="text-xs text-text-secondary">{receipt.branch || 'Main branch'}</p>
            </div>

            <div className="border-t border-dashed border-border py-2 space-y-1 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-text-secondary">Receipt #</span>
                <span className="font-medium text-right">{receipt.receipt_number}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-secondary">Date/Time</span>
                <span className="font-medium text-right">{receipt.issued_at_display}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-secondary">Cashier</span>
                <span className="font-medium text-right">{receipt.cashier_full_name || '-'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-secondary">Student</span>
                <span className="font-medium text-right">{receipt.student_full_name || '-'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-secondary">Group</span>
                <span className="font-medium text-right">{receipt.group_name || '-'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-secondary">Course/Service</span>
                <span className="font-medium text-right">{receipt.course_service_name || '-'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-secondary">Method</span>
                <span className="font-medium text-right">Cash</span>
              </div>
            </div>

            <div className="border-t border-dashed border-border py-2 space-y-1 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-text-secondary">Paid Amount</span>
                <span className="font-semibold text-right">{formattedPaidAmount}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-secondary">Remaining</span>
                <span className="font-semibold text-right">{formattedRemainingBalance}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-secondary">Txn / Receipt ID</span>
                <span className="font-medium text-right">{receipt.transaction_id || receipt.receipt_number}</span>
              </div>
            </div>

            {receipt.note ? (
              <div className="text-xs border-t border-dashed border-border pt-2 text-text-secondary">
                <span className="font-medium text-foreground">Note: </span>
                {receipt.note}
              </div>
            ) : null}

            <div className="mt-3 flex justify-center">
              <Image
                src={receipt.qr_code_image}
                alt="Receipt QR"
                width={144}
                height={144}
                unoptimized
                className="h-36 w-36 rounded-md bg-white p-1"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="btn-secondary">Close</button>
          <button onClick={printReceipt} className="btn-primary flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  )
}
