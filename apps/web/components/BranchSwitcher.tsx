'use client'

import Link from 'next/link'
import { Building2, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useBranchContext } from '@/contexts/BranchContext'
import { useSettings } from '@/contexts/SettingsContext'
import { usePermissions } from '@/lib/permissions'

export default function BranchSwitcher() {
  const { user } = useAuth()
  const { branches, activeBranchId, isGlobalScope, isLoading, isSwitching, setActiveBranch } = useBranchContext()
  const { translateText } = useSettings()
  const permissions = usePermissions(user)
  const canOpenBranches = permissions.canAccessPage('/dashboard/branches')

  const selectedValue = activeBranchId === null ? 'all' : String(activeBranchId)
  const hasMultipleOptions = branches.length > 1 || isGlobalScope

  const handleChange = async (value: string) => {
    const branchId = value === 'all' ? null : Number.parseInt(value, 10)
    if (Number.isNaN(branchId as number) && value !== 'all') {
      return
    }
    try {
      await setActiveBranch(value === 'all' ? null : branchId)
    } catch (error) {
      console.error('Failed to switch active branch', error)
    }
  }

  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-2">
        <div className="glass-chip inline-flex h-9 items-center gap-2 rounded-lg border border-border/60 px-3 text-xs text-text-secondary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>{translateText('Loading branch...')}</span>
        </div>
        {canOpenBranches && (
          <Link
            href="/dashboard/branches"
            className="glass-chip inline-flex h-9 items-center rounded-lg border border-border/60 px-2 text-xs text-text-secondary transition-colors hover:bg-background/80 hover:text-text-primary"
            title={translateText('Manage branches')}
            aria-label={translateText('Manage branches')}
          >
            <Building2 className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    )
  }

  if (!branches.length) {
    return null
  }

  if (!hasMultipleOptions) {
    return (
      <div className="inline-flex items-center gap-2">
        <div className="glass-chip inline-flex h-9 items-center gap-2 rounded-lg border border-border/60 px-3 text-xs text-text-secondary">
          <Building2 className="h-3.5 w-3.5" />
          <span className="max-w-[140px] truncate">{branches[0]?.name}</span>
        </div>
        {canOpenBranches && (
          <Link
            href="/dashboard/branches"
            className="glass-chip inline-flex h-9 items-center rounded-lg border border-border/60 px-2 text-xs text-text-secondary transition-colors hover:bg-background/80 hover:text-text-primary"
            title={translateText('Manage branches')}
            aria-label={translateText('Manage branches')}
          >
            <Building2 className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-2">
      <label className="glass-chip inline-flex h-9 items-center gap-2 rounded-lg border border-border/60 px-2 text-xs text-text-secondary">
        {isSwitching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Building2 className="h-3.5 w-3.5" />}
        <select
          aria-label={translateText('Active branch')}
          value={selectedValue}
          onChange={(event) => {
            void handleChange(event.target.value)
          }}
          disabled={isSwitching}
          className="h-full max-w-[180px] bg-transparent pr-2 text-xs text-text-primary focus:outline-none disabled:cursor-not-allowed"
        >
          {isGlobalScope && <option value="all">{translateText('All branches')}</option>}
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </label>
      {canOpenBranches && (
        <Link
          href="/dashboard/branches"
          className="glass-chip inline-flex h-9 items-center rounded-lg border border-border/60 px-2 text-xs text-text-secondary transition-colors hover:bg-background/80 hover:text-text-primary"
          title={translateText('Manage branches')}
          aria-label={translateText('Manage branches')}
        >
          <Building2 className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}
