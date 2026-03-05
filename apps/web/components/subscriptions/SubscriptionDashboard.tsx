'use client'

/**
 * Subscription Dashboard Component
 *
 * Shows current subscription status, usage, and billing information
 */

import React, { useEffect, useState } from 'react'

// Types
interface SubscriptionPlan {
  id: number
  name: string
  description: string
  price: string
  interval: string
  features: string[]
}

interface UserSubscription {
  id: number
  plan: SubscriptionPlan
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired'
  current_period_end: string
  days_until_renewal: number
  auto_renew: boolean
  cancel_at_period_end: boolean
  is_trial: boolean
  trial_end?: string
}

interface Invoice {
  id: number
  invoice_number: string
  issue_date: string
  total: string
  currency: string
  status: 'paid' | 'open' | 'void'
  pdf_url?: string
}

interface Payment {
  id: number
  amount: string
  date: string
  status: string
}

export function SubscriptionDashboard() {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [showCancelModal, setShowCancelModal] = useState(false)

  useEffect(() => {
    fetchSubscriptionData()
  }, [])

  async function fetchSubscriptionData() {
    try {
      const token = localStorage.getItem('access_token')
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.crmai.uz'

      // Fetch current subscription
      const subResponse = await fetch(
        `${apiUrl}/api/subscriptions/subscriptions/my_subscription/`,
        { headers }
      )

      if (subResponse.ok) {
        const subData = await subResponse.json()
        setSubscription(subData)
      }

      // Fetch invoices
      const invoicesResponse = await fetch(
        `${apiUrl}/api/subscriptions/invoices/`,
        { headers }
      )
      const invoicesData = await invoicesResponse.json()
      setInvoices(invoicesData.results || invoicesData)

      // Fetch payment history
      const paymentsResponse = await fetch(
        `${apiUrl}/api/subscriptions/payments/`,
        { headers }
      )
      const paymentsData = await paymentsResponse.json()
      setPayments(paymentsData.results || paymentsData)

    } catch (error) {
      console.error('Failed to load subscription data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelSubscription(immediate: boolean = false) {
    if (!subscription) return

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.crmai.uz'
      const response = await fetch(
        `${apiUrl}/api/subscriptions/subscriptions/${subscription.id}/cancel/`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ immediate })
        }
      )

      if (response.ok) {
        alert(immediate ? 'Subscription canceled immediately' : 'Subscription will cancel at period end')
        fetchSubscriptionData()
        setShowCancelModal(false)
      }
    } catch (error) {
      console.error('Failed to cancel subscription:', error)
      alert('Failed to cancel subscription')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>
  }

  if (!subscription) {
    return (
      <div className="text-center py-12">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">No Active Subscription</h3>
        <p className="text-gray-600 mb-6">Choose a plan to get started</p>
        <a href="/dashboard/subscriptions/pricing" className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 inline-block">
          View Plans
        </a>
      </div>
    )
  }

  const statusColors = {
    active: 'bg-green-100 text-green-800',
    trialing: 'bg-blue-100 text-blue-800',
    past_due: 'bg-yellow-100 text-yellow-800',
    canceled: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Current Subscription Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {subscription.plan.name}
            </h2>
            <p className="text-gray-600">{subscription.plan.description}</p>
          </div>
          <span className={`px-4 py-2 rounded-full font-semibold ${statusColors[subscription.status]}`}>
            {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
          </span>
        </div>

        {/* Subscription Details Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div>
            <p className="text-sm text-gray-600">Price</p>
            <p className="text-2xl font-bold text-gray-900">
              ${subscription.plan.price} <span className="text-sm font-normal">/{subscription.plan.interval}</span>
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Current Period</p>
            <p className="text-lg font-semibold text-gray-900">
              {new Date(subscription.current_period_end).toLocaleDateString()}
            </p>
            <p className="text-sm text-gray-600">
              {subscription.days_until_renewal} days remaining
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Auto-Renew</p>
            <p className="text-lg font-semibold text-gray-900">
              {subscription.auto_renew ? 'Enabled' : 'Disabled'}
            </p>
            {subscription.cancel_at_period_end && (
              <p className="text-sm text-red-600">Cancels on {new Date(subscription.current_period_end).toLocaleDateString()}</p>
            )}
          </div>
        </div>

        {/* Trial Badge */}
        {subscription.is_trial && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-700">
              🎁 You&apos;re on a free trial until {new Date(subscription.trial_end || '').toLocaleDateString()}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <a href="/dashboard/subscriptions/pricing" className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600">
            Upgrade Plan
          </a>
          {!subscription.cancel_at_period_end && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="border border-red-500 text-red-500 px-6 py-2 rounded-lg hover:bg-red-50"
            >
              Cancel Subscription
            </button>
          )}
        </div>
      </div>

      {/* Usage/Features */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Plan Features</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {subscription.plan.features.map((feature, index) => (
            <div key={index} className="flex items-center">
              <svg className="h-5 w-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-700">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Billing History</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoices.slice(0, 5).map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {invoice.invoice_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(invoice.issue_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${invoice.total} {invoice.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                      invoice.status === 'open' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    {invoice.pdf_url && (
                      <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                        Download
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Cancel Subscription?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to cancel your subscription? You can choose to cancel immediately or at the end of your billing period.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => handleCancelSubscription(false)}
                className="flex-1 bg-yellow-500 text-white px-6 py-3 rounded-lg hover:bg-yellow-600"
              >
                Cancel at Period End
              </button>
              <button
                onClick={() => handleCancelSubscription(true)}
                className="flex-1 bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600"
              >
                Cancel Now
              </button>
            </div>
            <button
              onClick={() => setShowCancelModal(false)}
              className="w-full mt-4 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50"
            >
              Keep Subscription
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
