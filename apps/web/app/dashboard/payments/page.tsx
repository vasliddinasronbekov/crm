import { redirect } from 'next/navigation'

export default function PaymentsPage() {
  redirect('/dashboard/finance?tab=receivables&focus=cashflow')
}
