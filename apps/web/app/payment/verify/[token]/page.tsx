'use client'

import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useParams } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Loader2, Receipt } from 'lucide-react'
import apiService from '@/lib/api'

interface CashReceiptVerificationResponse {
  valid: boolean
  receipt_number: string
  issued_at: string
  education_center_name: string
  student_full_name: string
  paid_amount: number
  payment_method: string
  transaction_id: string
  detail?: string
}

const formatAmountFromMinor = (minorAmount: number): string =>
  new Intl.NumberFormat('uz-UZ', {
    style: 'currency',
    currency: 'UZS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((minorAmount || 0) / 100)

const formatDateTime = (value: string): string => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data
    if (typeof data === 'string') return data
    if (data?.detail) return data.detail
    if (data?.error) return data.error
  }
  if (error instanceof Error) return error.message
  return 'Unable to verify receipt.'
}

export default function CashReceiptVerifyPage() {
  const params = useParams<{ token: string }>()
  const token = useMemo(
    () => (Array.isArray(params?.token) ? params.token[0] : params?.token),
    [params],
  )

  const [loading, setLoading] = useState(true)
  const [receipt, setReceipt] = useState<CashReceiptVerificationResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setErrorMessage('Receipt token is missing.')
      return
    }

    let cancelled = false

    const loadReceipt = async () => {
      try {
        setLoading(true)
        const data = await apiService.verifyCashReceiptToken(token)
        if (cancelled) return

        if (!data?.valid) {
          setReceipt(null)
          setErrorMessage(data?.detail || 'Receipt is invalid.')
          return
        }

        setReceipt(data)
        setErrorMessage('')
      } catch (error) {
        if (cancelled) return
        setReceipt(null)
        setErrorMessage(getErrorMessage(error))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadReceipt()

    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 text-center">
          <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-foreground">
            <Receipt className="h-6 w-6 text-primary" />
            Cash Receipt Verification
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Verify payment receipt authenticity from EduVoice CRM.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
              <p className="mt-3 text-sm text-text-secondary">Checking receipt...</p>
            </div>
          ) : receipt ? (
            <>
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-success/40 bg-success/10 p-4">
                <CheckCircle2 className="mt-0.5 h-6 w-6 text-success" />
                <div>
                  <p className="font-semibold text-success">Valid receipt</p>
                  <p className="text-sm text-text-secondary">
                    This receipt is registered in the system.
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Education Center</span>
                  <span className="text-right font-medium">{receipt.education_center_name || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Receipt Number</span>
                  <span className="text-right font-medium">{receipt.receipt_number || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Issued At</span>
                  <span className="text-right font-medium">{formatDateTime(receipt.issued_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Student</span>
                  <span className="text-right font-medium">{receipt.student_full_name || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Payment Method</span>
                  <span className="text-right font-medium uppercase">{receipt.payment_method || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Paid Amount</span>
                  <span className="text-right text-base font-semibold text-primary">
                    {formatAmountFromMinor(receipt.paid_amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Transaction ID</span>
                  <span className="text-right font-medium">{receipt.transaction_id || '-'}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="py-10 text-center">
              <AlertTriangle className="mx-auto h-10 w-10 text-error" />
              <p className="mt-3 text-lg font-semibold text-foreground">Receipt not valid</p>
              <p className="mt-2 text-sm text-text-secondary">
                {errorMessage || 'Receipt was not found in the system.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
