import { Building2 } from 'lucide-react'

interface BranchScopeChipProps {
  scopeName: string
  className?: string
}

export default function BranchScopeChip({ scopeName, className = '' }: BranchScopeChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary ${className}`}
    >
      <Building2 className="h-3.5 w-3.5" />
      Branch scope: {scopeName}
    </span>
  )
}
