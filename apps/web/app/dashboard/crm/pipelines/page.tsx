'use client'

import { useState, useEffect } from 'react'
import apiService from '@/lib/api'
import { toast } from 'react-hot-toast'
import {
  Plus, Edit, Trash2, X, DollarSign, Calendar, User,
  TrendingUp, Activity, ChevronRight, Clock, Target,
  Filter, Search, MoreVertical, Eye, CheckCircle, AlertCircle
} from 'lucide-react'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import LoadingScreen from '@/components/LoadingScreen'

interface Pipeline {
  id: number
  name: string
  description?: string
  stages?: PipelineStage[]
  created_at?: string
}

interface PipelineStage {
  id: number
  name: string
  order: number
  pipeline: number
  color?: string
}

interface Deal {
  id: number
  name: string
  amount: number
  stage?: any
  lead?: any
  probability?: number
  expected_close_date?: string
  description?: string
  created_at?: string
  updated_at?: string
}

interface Activity {
  id: number
  type: string
  description: string
  deal?: any
  lead?: any
  created_at: string
  created_by?: any
}

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null)
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Modals
  const [showPipelineModal, setShowPipelineModal] = useState(false)
  const [showDealModal, setShowDealModal] = useState(false)
  const [showStageModal, setShowStageModal] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)

  // Forms
  const [pipelineForm, setPipelineForm] = useState({ name: '', description: '' })
  const [dealForm, setDealForm] = useState({
    name: '',
    amount: 0,
    stage: 0,
    probability: 50,
    expected_close_date: '',
    description: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedPipeline) {
      loadPipelineDetails()
    }
  }, [selectedPipeline])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [pipelinesData, dealsData, activitiesData] = await Promise.all([
        apiService.getPipelines().catch(() => ({ results: [] })),
        apiService.getDeals().catch(() => ({ results: [] })),
        apiService.getActivities().catch(() => ({ results: [] }))
      ])

      const pipelineList = pipelinesData.results || [];
      setPipelines(pipelineList);
      setDeals(dealsData.results || []);
      setActivities(activitiesData.results || []);

      if (pipelineList.length > 0 && !selectedPipeline) {
        setSelectedPipeline(pipelineList[0]);
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Failed to load pipelines')
    } finally {
      setIsLoading(false)
    }
  }

  const loadPipelineDetails = async () => {
    if (!selectedPipeline) return

    try {
      const stagesData = await apiService.getPipelineStages({ pipeline: selectedPipeline.id })
      setStages(stagesData.results || stagesData || [])
    } catch (error) {
      console.error('Failed to load stages:', error)
    }
  }

  const handleCreatePipeline = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const newPipeline = await apiService.createPipeline(pipelineForm)
      setPipelines([...pipelines, newPipeline])
      setShowPipelineModal(false)
      setPipelineForm({ name: '', description: '' })
      toast.success('Pipeline created successfully')
      loadData()
    } catch (error) {
      toast.error('Failed to create pipeline')
    }
  }

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const newDeal = await apiService.createDeal(dealForm)
      setDeals([...deals, newDeal])
      setShowDealModal(false)
      setDealForm({ name: '', amount: 0, stage: 0, probability: 50, expected_close_date: '', description: '' })
      toast.success('Deal created successfully')
      loadData()
    } catch (error) {
      toast.error('Failed to create deal')
    }
  }

  const handleDeleteDeal = async (deal: Deal) => {
    if (!confirm(`Delete deal "${deal.name}"?`)) return

    try {
      await apiService.deleteDeal(deal.id)
      setDeals(deals.filter(d => d.id !== deal.id))
      toast.success('Deal deleted')
    } catch (error) {
      toast.error('Failed to delete deal')
    }
  }

  const getDealsByStage = (stageId: number) => {
    return deals.filter(deal => deal.stage?.id === stageId)
  }

  const calculateStageValue = (stageId: number) => {
    const stageDeals = getDealsByStage(stageId)
    return stageDeals.reduce((sum, deal) => sum + (deal.amount || 0), 0)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const getStageColor = (index: number) => {
    const colors = [
      'border-blue-500 bg-blue-500/10',
      'border-yellow-500 bg-yellow-500/10',
      'border-orange-500 bg-orange-500/10',
      'border-green-500 bg-green-500/10',
      'border-purple-500 bg-purple-500/10'
    ]
    return colors[index % colors.length]
  }

  const stats = {
    totalDeals: deals.length,
    totalValue: deals.reduce((sum, d) => sum + (d.amount || 0), 0),
    avgDealSize: deals.length > 0 ? deals.reduce((sum, d) => sum + (d.amount || 0), 0) / deals.length : 0,
    recentActivities: activities.slice(0, 5)
  }

  if (isLoading) {
    return <LoadingScreen message="Loading pipelines..." />
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-[1800px] mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                  <Target className="h-8 w-8 text-primary" />
                  Sales Pipelines
                </h1>
                <p className="text-text-secondary">Manage deals across pipeline stages</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDealModal(true)}
                  className="px-4 py-2 bg-primary text-background rounded-xl hover:bg-primary/90 flex items-center gap-2 font-medium"
                >
                  <Plus className="h-5 w-5" />
                  New Deal
                </button>
                <button
                  onClick={() => setShowPipelineModal(true)}
                  className="px-4 py-2 bg-background border border-border rounded-xl hover:bg-border/50 flex items-center gap-2 font-medium"
                >
                  <Plus className="h-5 w-5" />
                  New Pipeline
                </button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-surface p-6 rounded-2xl border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <p className="text-3xl font-bold mb-1">{stats.totalDeals}</p>
              <p className="text-sm text-text-secondary">Total Deals</p>
            </div>

            <div className="bg-surface p-6 rounded-2xl border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-success" />
                </div>
              </div>
              <p className="text-3xl font-bold mb-1">{formatCurrency(stats.totalValue)}</p>
              <p className="text-sm text-text-secondary">Total Pipeline Value</p>
            </div>

            <div className="bg-surface p-6 rounded-2xl border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-info/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-info" />
                </div>
              </div>
              <p className="text-3xl font-bold mb-1">{formatCurrency(stats.avgDealSize)}</p>
              <p className="text-sm text-text-secondary">Avg Deal Size</p>
            </div>

            <div className="bg-surface p-6 rounded-2xl border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Activity className="h-6 w-6 text-warning" />
                </div>
              </div>
              <p className="text-3xl font-bold mb-1">{pipelines.length}</p>
              <p className="text-sm text-text-secondary">Active Pipelines</p>
            </div>
          </div>

          {/* Pipeline Selector */}
          {pipelines.length > 0 && (
            <div className="mb-6">
              <div className="bg-surface rounded-2xl border border-border p-1">
                <div className="flex gap-1 overflow-x-auto">
                  {pipelines.map((pipeline) => (
                    <button
                      key={pipeline.id}
                      onClick={() => setSelectedPipeline(pipeline)}
                      className={`px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
                        selectedPipeline?.id === pipeline.id
                          ? 'bg-primary text-background'
                          : 'hover:bg-background text-text-secondary'
                      }`}
                    >
                      {pipeline.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Kanban Board */}
          {selectedPipeline && stages.length > 0 ? (
            <div className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {stages.sort((a, b) => a.order - b.order).map((stage, index) => {
                  const stageDeals = getDealsByStage(stage.id)
                  const stageValue = calculateStageValue(stage.id)

                  return (
                    <div key={stage.id} className="flex flex-col min-h-[500px]">
                      {/* Stage Header */}
                      <div className={`bg-surface rounded-t-2xl border-t-4 ${getStageColor(index)} p-4`}>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-bold text-lg">{stage.name}</h3>
                          <span className="px-3 py-1 bg-background rounded-full text-sm font-medium">
                            {stageDeals.length}
                          </span>
                        </div>
                        <p className="text-sm text-text-secondary font-medium">
                          {formatCurrency(stageValue)}
                        </p>
                      </div>

                      {/* Deals in Stage */}
                      <div className="bg-surface border-x border-b border-border rounded-b-2xl p-4 flex-1 space-y-3 overflow-y-auto">
                        {stageDeals.length > 0 ? (
                          stageDeals.map((deal) => (
                            <div
                              key={deal.id}
                              className="bg-background border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all cursor-pointer group"
                              onClick={() => setSelectedDeal(deal)}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">
                                  {deal.name}
                                </h4>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteDeal(deal)
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-error/10 rounded transition-opacity"
                                >
                                  <Trash2 className="h-4 w-4 text-error" />
                                </button>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-text-secondary">Value</span>
                                  <span className="font-bold text-primary text-sm">
                                    {formatCurrency(deal.amount || 0)}
                                  </span>
                                </div>

                                {deal.probability && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-text-secondary">Probability</span>
                                    <span className="text-xs font-medium">{deal.probability}%</span>
                                  </div>
                                )}

                                {deal.expected_close_date && (
                                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                                    <Calendar className="h-3 w-3" />
                                    <span>{new Date(deal.expected_close_date).toLocaleDateString()}</span>
                                  </div>
                                )}

                                {deal.lead && (
                                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                                    <User className="h-3 w-3" />
                                    <span>{deal.lead.first_name} {deal.lead.last_name}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 text-text-secondary text-sm">
                            <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No deals in this stage</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="bg-surface rounded-2xl border border-border p-12 text-center">
              <Target className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
              <p className="text-text-secondary text-lg mb-4">No pipeline stages found</p>
              <button
                onClick={() => setShowPipelineModal(true)}
                className="px-6 py-3 bg-primary text-background rounded-xl hover:bg-primary/90 font-medium"
              >
                Create Your First Pipeline
              </button>
            </div>
          )}

          {/* Recent Activities */}
          {stats.recentActivities.length > 0 && (
            <div className="bg-surface rounded-2xl border border-border p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Activity className="h-6 w-6 text-primary" />
                Recent Activities
              </h3>
              <div className="space-y-3">
                {stats.recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-3 bg-background rounded-xl">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Activity className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.type}</p>
                      <p className="text-xs text-text-secondary">{activity.description}</p>
                      <p className="text-xs text-text-secondary mt-1">
                        {new Date(activity.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Create Pipeline Modal */}
        {showPipelineModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-surface rounded-2xl border border-border w-full max-w-md">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-xl font-bold">Create Pipeline</h2>
                <button onClick={() => setShowPipelineModal(false)} className="p-2 hover:bg-background rounded-lg">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleCreatePipeline} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Pipeline Name *</label>
                  <input
                    type="text"
                    value={pipelineForm.name}
                    onChange={(e) => setPipelineForm({ ...pipelineForm, name: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., Sales Pipeline 2024"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={pipelineForm.description}
                    onChange={(e) => setPipelineForm({ ...pipelineForm, description: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={3}
                    placeholder="Pipeline description..."
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPipelineModal(false)}
                    className="flex-1 px-6 py-3 bg-background border border-border rounded-xl hover:bg-border/50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-primary text-background rounded-xl hover:bg-primary/90 font-medium"
                  >
                    Create Pipeline
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Deal Modal */}
        {showDealModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-surface rounded-2xl border border-border w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-surface">
                <h2 className="text-xl font-bold">Create Deal</h2>
                <button onClick={() => setShowDealModal(false)} className="p-2 hover:bg-background rounded-lg">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleCreateDeal} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Deal Name *</label>
                  <input
                    type="text"
                    value={dealForm.name}
                    onChange={(e) => setDealForm({ ...dealForm, name: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., Enterprise License Deal"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Amount *</label>
                  <input
                    type="number"
                    value={dealForm.amount}
                    onChange={(e) => setDealForm({ ...dealForm, amount: parseFloat(e.target.value) })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Stage</label>
                  <select
                    value={dealForm.stage}
                    onChange={(e) => setDealForm({ ...dealForm, stage: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value={0}>Select Stage</option>
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>{stage.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Probability (%)</label>
                  <input
                    type="number"
                    value={dealForm.probability}
                    onChange={(e) => setDealForm({ ...dealForm, probability: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Expected Close Date</label>
                  <input
                    type="date"
                    value={dealForm.expected_close_date}
                    onChange={(e) => setDealForm({ ...dealForm, expected_close_date: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={dealForm.description}
                    onChange={(e) => setDealForm({ ...dealForm, description: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={3}
                    placeholder="Deal notes..."
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowDealModal(false)}
                    className="flex-1 px-6 py-3 bg-background border border-border rounded-xl hover:bg-border/50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-primary text-background rounded-xl hover:bg-primary/90 font-medium"
                  >
                    Create Deal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Deal Detail Modal */}
        {selectedDeal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-surface rounded-2xl border border-border w-full max-w-2xl">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-xl font-bold">{selectedDeal.name}</h2>
                <button onClick={() => setSelectedDeal(null)} className="p-2 hover:bg-background rounded-lg">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background p-4 rounded-xl">
                    <p className="text-sm text-text-secondary mb-2">Deal Value</p>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(selectedDeal.amount || 0)}</p>
                  </div>
                  <div className="bg-background p-4 rounded-xl">
                    <p className="text-sm text-text-secondary mb-2">Probability</p>
                    <p className="text-2xl font-bold">{selectedDeal.probability || 0}%</p>
                  </div>
                </div>

                {selectedDeal.expected_close_date && (
                  <div className="bg-background p-4 rounded-xl">
                    <p className="text-sm text-text-secondary mb-2">Expected Close Date</p>
                    <p className="font-medium">{new Date(selectedDeal.expected_close_date).toLocaleDateString()}</p>
                  </div>
                )}

                {selectedDeal.description && (
                  <div className="bg-background p-4 rounded-xl">
                    <p className="text-sm text-text-secondary mb-2">Description</p>
                    <p className="text-sm">{selectedDeal.description}</p>
                  </div>
                )}

                {selectedDeal.lead && (
                  <div className="bg-background p-4 rounded-xl">
                    <p className="text-sm text-text-secondary mb-2">Contact</p>
                    <p className="font-medium">{selectedDeal.lead.first_name} {selectedDeal.lead.last_name}</p>
                    {selectedDeal.lead.email && (
                      <p className="text-sm text-text-secondary">{selectedDeal.lead.email}</p>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setSelectedDeal(null)}
                    className="flex-1 px-6 py-3 bg-background border border-border rounded-xl hover:bg-border/50 font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}