'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import FuzzySearch from 'fuzzy-search'
import { useVoiceControl } from './useVoiceControl'
import toast from '@/lib/toast'
import apiService from '@/lib/api'

const pages = [
  { title: 'Dashboard', url: '/dashboard', keywords: ['home', 'main', 'overview'] },
  { title: 'Students', url: '/dashboard/students', keywords: ['student', 'pupil', 'learner'] },
  { title: 'Teachers', url: '/dashboard/teachers', keywords: ['teacher', 'staff', 'instructor'] },
  { title: 'Groups', url: '/dashboard/groups', keywords: ['group', 'class', 'course'] },
  { title: 'Tasks', url: '/dashboard/tasks', keywords: ['task', 'todo', 'kanban'] },
  { title: 'Shop & Rewards', url: '/dashboard/shop', keywords: ['shop', 'reward', 'coin', 'product'] },
  { title: 'Events', url: '/dashboard/events', keywords: ['event', 'activity', 'calendar'] },
  { title: 'Support', url: '/dashboard/support', keywords: ['support', 'ticket', 'help'] },
  { title: 'Email Marketing', url: '/dashboard/email', keywords: ['email', 'campaign', 'template'] },
  { title: 'Announcements', url: '/dashboard/announcements', keywords: ['announcement', 'notice', 'broadcast'] },
  { title: 'Expenses', url: '/dashboard/expenses', keywords: ['expense', 'cost', 'spending'] },
  { title: 'Leaderboard', url: '/dashboard/leaderboard', keywords: ['leaderboard', 'ranking', 'top'] },
  { title: 'Certificates', url: '/dashboard/certificates', keywords: ['certificate', 'award', 'diploma'] },
  { title: 'Payments', url: '/dashboard/payments', keywords: ['payment', 'transaction', 'money'] },
  { title: 'Analytics', url: '/dashboard/analytics', keywords: ['analytics', 'report', 'stats'] },
  { title: 'HR & Salary', url: '/dashboard/hr', keywords: ['hr', 'salary', 'payroll'] },
]

const searcher = new FuzzySearch(pages, ['title', 'keywords'], {
  caseSensitive: false,
  sort: true,
})

export const useVoiceRouter = () => {
  const voiceControl = useVoiceControl()
  const router = useRouter()
  const [processedIntent, setProcessedIntent] = useState<string | null>(null)

  useEffect(() => {
    const handleIntent = async () => {
      const { lastIntent, lastConfidence, lastResponse, lastTranscript } = voiceControl.state

      if (lastIntent && lastIntent !== processedIntent) {
        setProcessedIntent(lastIntent)

        console.log(`New intent detected: ${lastIntent}, Confidence: ${lastConfidence}`)

        // Log the interaction
        apiService.logInteraction({
          type: 'voice',
          transcript: lastTranscript,
          intent: lastIntent,
          confidence: lastConfidence,
          response: lastResponse,
        })

        // 1. Handle Navigation
        if (lastIntent.startsWith('navigate_')) {
          const destination = lastIntent.replace('navigate_', '').replace('_', ' ')
          const results = searcher.search(destination)

          if (results.length > 0) {
            const bestMatch = results[0]
            toast.success(`Navigating to ${bestMatch.title}...`)
            router.push(bestMatch.url)
          } else {
            toast.error(`Sorry, I couldn't find the page "${destination}".`)
          }
          return
        }

        // 2. Handle Search
        if (lastIntent === 'search') {
          // This would integrate with the GlobalSearch component, which is complex.
          // For now, we can just show a toast.
          toast.info("Search intent recognized. To complete this, we'll need to integrate with the GlobalSearch component state.")
          return
        }

        // 3. Handle other commands
        switch (lastIntent) {
          case 'get_dashboard_stats':
            // In a real app, you'd fetch this data and display it.
            // For now, we'll just use the voice response.
            if (lastResponse) {
              voiceControl.speak(lastResponse)
            }
            break
          
          // Add more cases for other intents here...

          default:
            // If the intent is not for navigation or a known action,
            // but there is a voice response, speak it.
            if (lastResponse) {
              voiceControl.speak(lastResponse)
            }
            break
        }
      }
    }

    handleIntent()
  }, [voiceControl.state, router, processedIntent, voiceControl])

  return voiceControl
}
