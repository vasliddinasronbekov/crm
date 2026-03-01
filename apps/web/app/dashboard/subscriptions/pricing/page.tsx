'use client'

import { PricingPlans } from '@/components/subscriptions'
import { useRouter } from 'next/navigation'

export default function PricingPage() {
  const router = useRouter()

  const handleSelectPlan = async (plan: any) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8008'
      const response = await fetch(`${apiUrl}/api/subscriptions/subscriptions/subscribe/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ plan_id: plan.id })
      })

      if (response.ok) {
        alert(`Successfully subscribed to ${plan.name}!`)
        router.push('/dashboard/subscriptions')
      } else {
        const error = await response.json()
        alert(error.detail || 'Failed to subscribe to plan')
      }
    } catch (error) {
      console.error('Subscription error:', error)
      alert('Failed to subscribe to plan')
    }
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Plan</h1>
        <p className="text-xl text-gray-600">Select the perfect plan for your educational institution</p>
      </div>

      <PricingPlans onSelectPlan={handleSelectPlan} />
    </div>
  )
}
