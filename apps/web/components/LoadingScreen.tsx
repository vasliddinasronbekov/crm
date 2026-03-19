'use client'

type LoadingScreenProps = {
  message?: string
  fullHeight?: boolean
}

export default function LoadingScreen({ message = 'Loading...', fullHeight = true }: LoadingScreenProps) {
  const heightClass = fullHeight ? 'min-h-screen' : 'min-h-full'

  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${heightClass}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgb(var(--primary)/0.2),transparent_38%),radial-gradient(circle_at_82%_22%,rgb(var(--success)/0.1),transparent_35%),radial-gradient(circle_at_48%_84%,rgb(var(--warning)/0.08),transparent_40%)]" />
      <div className="glass-panel-strong relative z-10 rounded-3xl px-10 py-8 text-center">
        <div className="mx-auto inline-block h-12 w-12 animate-spin rounded-full border-2 border-primary/30 border-t-primary"></div>
        <p className="mt-4 text-text-secondary">{message}</p>
      </div>
    </div>
  )
}
