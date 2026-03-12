'use client'

/**
 * Pricing Plans Component
 *
 * Displays subscription plans in a beautiful pricing table
 * Perfect for public-facing pricing page or upgrade modal
 */

import React, { useCallback, useEffect, useState } from 'react'

// Types
interface SubscriptionPlan {
  id: number
  name: string
  description: string
  price: string
  interval: string
  monthly_price?: string
  trial_period_days: number
  is_featured: boolean
  features: string[]
  max_users?: number
  max_courses?: number
  max_storage_gb?: number
}

interface PricingPlansProps {
  onSelectPlan?: (plan: SubscriptionPlan) => void
  currentPlanId?: number
  showFeaturedOnly?: boolean
}

export function PricingPlans({
  onSelectPlan,
  currentPlanId,
  showFeaturedOnly = false
}: PricingPlansProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly')

  const fetchPlans = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.crmai.uz'
      const response = await fetch(`${apiUrl}/api/subscriptions/plans/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      })

      const data = await response.json()
      let allPlans: SubscriptionPlan[] = data.results || data

      // Filter featured if needed
      if (showFeaturedOnly) {
        allPlans = allPlans.filter(p => p.is_featured)
      }

      setPlans(allPlans)
    } catch (error) {
      console.error('Failed to load plans:', error)
    } finally {
      setLoading(false)
    }
  }, [showFeaturedOnly])

  useEffect(() => {
    void fetchPlans()
  }, [fetchPlans])

  const filteredPlans = plans.filter(p =>
    p.interval === billingInterval || p.interval === 'lifetime'
  )

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Billing Interval Toggle */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-100 rounded-lg p-1 inline-flex">
          <button
            onClick={() => setBillingInterval('monthly')}
            className={`px-6 py-2 rounded-md transition-all ${
              billingInterval === 'monthly'
                ? 'bg-white shadow-sm text-blue-600'
                : 'text-gray-600'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingInterval('yearly')}
            className={`px-6 py-2 rounded-md transition-all ${
              billingInterval === 'yearly'
                ? 'bg-white shadow-sm text-blue-600'
                : 'text-gray-600'
            }`}
          >
            Yearly
            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-8">
        {filteredPlans.map((plan) => {
          const isCurrentPlan = plan.id === currentPlanId
          const isFree = plan.price === '0' || plan.price === '0.00'

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 p-8 ${
                plan.is_featured
                  ? 'border-blue-500 shadow-xl scale-105'
                  : 'border-gray-200'
              } ${isCurrentPlan ? 'ring-2 ring-green-500' : ''}`}
            >
              {/* Featured Badge */}
              {plan.is_featured && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Current Plan Badge */}
              {isCurrentPlan && (
                <div className="absolute top-4 right-4">
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                    Current Plan
                  </span>
                </div>
              )}

              {/* Plan Name */}
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {plan.name}
              </h3>

              {/* Description */}
              <p className="text-gray-600 mb-6">
                {plan.description}
              </p>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline">
                  <span className="text-5xl font-extrabold text-gray-900">
                    ${plan.price}
                  </span>
                  <span className="ml-2 text-gray-600">
                    /{plan.interval === 'yearly' ? 'year' : plan.interval}
                  </span>
                </div>
                {plan.interval === 'yearly' && plan.monthly_price && (
                  <p className="text-sm text-gray-500 mt-1">
                    ${plan.monthly_price}/month billed annually
                  </p>
                )}
              </div>

              {/* Trial Period */}
              {plan.trial_period_days > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                  <p className="text-sm text-blue-700 text-center">
                    🎁 {plan.trial_period_days} days free trial
                  </p>
                </div>
              )}

              {/* CTA Button */}
              <button
                onClick={() => onSelectPlan?.(plan)}
                disabled={isCurrentPlan}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-all ${
                  isCurrentPlan
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : plan.is_featured
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                {isCurrentPlan ? 'Current Plan' : isFree ? 'Get Started' : 'Upgrade Now'}
              </button>

              {/* Features List */}
              <div className="mt-8 space-y-4">
                <p className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  What&apos;s Included:
                </p>
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg
                        className="h-5 w-5 text-green-500 mr-3 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Limits */}
              {(plan.max_users || plan.max_courses || plan.max_storage_gb) && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    {plan.max_users && (
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          {plan.max_users}
                        </p>
                        <p className="text-xs text-gray-600">Users</p>
                      </div>
                    )}
                    {plan.max_courses && (
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          {plan.max_courses}
                        </p>
                        <p className="text-xs text-gray-600">Courses</p>
                      </div>
                    )}
                    {plan.max_storage_gb && (
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          {plan.max_storage_gb}GB
                        </p>
                        <p className="text-xs text-gray-600">Storage</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* FAQ or Additional Info */}
      <div className="mt-16 text-center">
        <p className="text-gray-600">
          All plans include 24/7 support • Cancel anytime • No hidden fees
        </p>
      </div>
    </div>
  )
}
