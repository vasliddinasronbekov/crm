import { SubscriptionDashboard } from '@/components/subscriptions'

export const metadata = {
  title: 'Subscription | EduVoice',
  description: 'Manage your subscription and billing'
}

export default function SubscriptionPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Subscription Management</h1>
        <p className="text-gray-600 mt-2">View and manage your subscription plan and billing information</p>
      </div>

      <SubscriptionDashboard />
    </div>
  )
}
