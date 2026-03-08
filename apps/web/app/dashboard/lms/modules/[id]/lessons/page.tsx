'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import LoadingScreen from '@/components/LoadingScreen'

export default function ModuleLessonsRedirectPage() {
  const params = useParams()
  const router = useRouter()

  useEffect(() => {
    const moduleId = Array.isArray(params.id) ? params.id[0] : params.id
    if (!moduleId) {
      router.replace('/dashboard/lms/lessons')
      return
    }

    router.replace(`/dashboard/lms/lessons?module=${moduleId}`)
  }, [params.id, router])

  return <LoadingScreen message="Opening module lessons..." />
}
