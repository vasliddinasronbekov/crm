'use client'

type LoadingScreenProps = {
  message?: string
  fullHeight?: boolean
}

export default function LoadingScreen({ message = 'Loading...', fullHeight = true }: LoadingScreenProps) {
  const heightClass = fullHeight ? 'min-h-screen' : 'min-h-full'

  return (
    <div className={`flex items-center justify-center ${heightClass} bg-background`}>
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-text-secondary">{message}</p>
      </div>
    </div>
  )
}
