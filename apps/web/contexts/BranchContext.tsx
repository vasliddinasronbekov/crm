'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import apiService from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

export interface BranchOption {
  id: number
  name: string
}

interface BranchContextPayload {
  is_global_scope: boolean
  active_branch_id: number | null
  accessible_branch_ids: number[]
  branches: BranchOption[]
}

interface BranchContextValue {
  branches: BranchOption[]
  activeBranchId: number | null
  isGlobalScope: boolean
  isLoading: boolean
  isSwitching: boolean
  setActiveBranch: (branchId: number | null) => Promise<void>
  refreshBranchContext: () => Promise<void>
  patchBranchOption: (branchId: number, updates: Partial<BranchOption>) => void
}

const BranchContext = createContext<BranchContextValue | undefined>(undefined)

export function BranchProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const [contextPayload, setContextPayload] = useState<BranchContextPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSwitching, setIsSwitching] = useState(false)

  const loadContext = useCallback(async () => {
    if (!isAuthenticated) {
      setContextPayload(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const preferredBranchId = apiService.getActiveBranchId()
      let response: BranchContextPayload
      try {
        response = await apiService.getBranchContext(preferredBranchId)
      } catch (error) {
        if (preferredBranchId !== null) {
          // Stale local preference from another account/session - retry without forcing branch.
          apiService.setActiveBranchId(null)
          response = await apiService.getBranchContext()
        } else {
          throw error
        }
      }
      const resolvedBranchId = response.active_branch_id

      apiService.setActiveBranchId(resolvedBranchId)
      setContextPayload({
        ...response,
        active_branch_id: resolvedBranchId,
      })
    } catch (error) {
      console.error('Failed to load branch context', error)
      setContextPayload(null)
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthLoading) {
      return
    }
    void loadContext()
  }, [isAuthLoading, loadContext])

  const setActiveBranch = useCallback(
    async (branchId: number | null) => {
      if (!isAuthenticated) {
        return
      }

      if (contextPayload?.active_branch_id === branchId) {
        return
      }

      setIsSwitching(true)
      const previousBranchId = contextPayload?.active_branch_id ?? null
      try {
        apiService.setActiveBranchId(branchId)
        const response = await apiService.getBranchContext(branchId)
        const resolvedBranchId = response.active_branch_id
        apiService.setActiveBranchId(resolvedBranchId)

        setContextPayload({
          ...response,
          active_branch_id: resolvedBranchId,
        })

        await queryClient.invalidateQueries()
      } catch (error) {
        apiService.setActiveBranchId(previousBranchId)
        throw error
      } finally {
        setIsSwitching(false)
      }
    },
    [contextPayload?.active_branch_id, isAuthenticated, queryClient],
  )

  const patchBranchOption = useCallback((branchId: number, updates: Partial<BranchOption>) => {
    setContextPayload((previousPayload) => {
      if (!previousPayload) return previousPayload

      let changed = false
      const nextBranches = previousPayload.branches.map((branch) => {
        if (branch.id !== branchId) return branch
        changed = true
        return {
          ...branch,
          ...updates,
        }
      })

      if (!changed) return previousPayload

      return {
        ...previousPayload,
        branches: nextBranches,
      }
    })
  }, [])

  const value = useMemo<BranchContextValue>(
    () => ({
      branches: contextPayload?.branches ?? [],
      activeBranchId: contextPayload?.active_branch_id ?? null,
      isGlobalScope: contextPayload?.is_global_scope ?? false,
      isLoading,
      isSwitching,
      setActiveBranch,
      refreshBranchContext: loadContext,
      patchBranchOption,
    }),
    [contextPayload, isLoading, isSwitching, setActiveBranch, loadContext, patchBranchOption],
  )

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
}

export function useBranchContext() {
  const context = useContext(BranchContext)
  if (!context) {
    throw new Error('useBranchContext must be used within a BranchProvider')
  }
  return context
}
