import { redirect } from 'next/navigation'

export default function ExpensesPage() {
  redirect('/dashboard/finance?tab=operations&focus=cashflow')
}
