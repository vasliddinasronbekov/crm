import { redirect } from 'next/navigation'

export default function AccountingPage() {
  redirect('/dashboard/finance?tab=overview&focus=risk')
}
