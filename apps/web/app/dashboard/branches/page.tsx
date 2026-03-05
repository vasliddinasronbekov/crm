'use client'

import { useState, useEffect } from 'react'
import apiService from '@/lib/api'
import toast from '@/lib/toast'
import {
import LoadingScreen from '@/components/LoadingScreen'
  Building2,
  Plus,
  Edit,
  Trash2,
  MapPin,
  Phone,
  Users,
  DollarSign,
  BookOpen,
  TrendingUp,
  X,
  Search
} from 'lucide-react'

interface Branch {
  id: number
  name: string
  address: string
  phone: string
  is_active: boolean
  created_at: string
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    is_active: true
  })

  useEffect(() => {
    loadBranches()
  }, [])

  const loadBranches = async () => {
    try {
      setLoading(true)
      const data = await apiService.getBranches()
      setBranches(data.results || data || [])
    } catch (error) {
      console.error('Failed to load branches:', error)
      toast.error('Failed to load branches')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.address) {
      toast.warning('Please fill in all required fields')
      return
    }

    try {
      await apiService.createBranch(formData)
      toast.success('Branch created successfully!')
      setShowModal(false)
      resetForm()
      loadBranches()
    } catch (error: any) {
      console.error('Failed to create branch:', error)
      toast.error(error.response?.data?.detail || 'Failed to create branch')
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingBranch) return

    try {
      await apiService.updateBranch(editingBranch.id, formData)
      toast.success('Branch updated successfully!')
      setShowModal(false)
      setEditingBranch(null)
      resetForm()
      loadBranches()
    } catch (error: any) {
      console.error('Failed to update branch:', error)
      toast.error(error.response?.data?.detail || 'Failed to update branch')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this branch?')) return

    try {
      await apiService.deleteBranch(id)
      toast.success('Branch deleted successfully')
      loadBranches()
    } catch (error) {
      console.error('Failed to delete branch:', error)
      toast.error('Failed to delete branch')
    }
  }

  const openEditModal = (branch: Branch) => {
    setEditingBranch(branch)
    setFormData({
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      is_active: branch.is_active
    })
    setShowModal(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      phone: '',
      is_active: true
    })
  }

  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.address.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return <LoadingScreen message="Loading branches..." />
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <Building2 className="h-10 w-10 text-primary" />
          Branches Management
        </h1>
        <p className="text-text-secondary">Manage your educational institution branches</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="stat-card border-l-4 border-l-primary">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-secondary text-sm font-medium">Total Branches</p>
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <p className="text-3xl font-bold">{branches.length}</p>
          <p className="text-xs text-text-secondary mt-2">All locations</p>
        </div>

        <div className="stat-card border-l-4 border-l-success">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-secondary text-sm font-medium">Active Branches</p>
            <TrendingUp className="h-5 w-5 text-success" />
          </div>
          <p className="text-3xl font-bold text-success">
            {branches.filter(b => b.is_active).length}
          </p>
          <p className="text-xs text-text-secondary mt-2">Currently operating</p>
        </div>

        <div className="stat-card border-l-4 border-l-warning">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-secondary text-sm font-medium">Inactive</p>
            <Building2 className="h-5 w-5 text-warning" />
          </div>
          <p className="text-3xl font-bold text-warning">
            {branches.filter(b => !b.is_active).length}
          </p>
          <p className="text-xs text-text-secondary mt-2">Not operating</p>
        </div>

        <div className="stat-card border-l-4 border-l-info">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-secondary text-sm font-medium">Coverage</p>
            <MapPin className="h-5 w-5 text-info" />
          </div>
          <p className="text-3xl font-bold text-info">{branches.length}</p>
          <p className="text-xs text-text-secondary mt-2">Cities/locations</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
          <input
            type="text"
            placeholder="Search branches by name or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <button
          onClick={() => {
            setEditingBranch(null)
            resetForm()
            setShowModal(true)
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Add Branch
        </button>
      </div>

      {/* Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBranches.map(branch => (
          <div
            key={branch.id}
            className="card hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{branch.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
                    branch.is_active
                      ? 'bg-success/10 text-success'
                      : 'bg-error/10 text-error'
                  }`}>
                    {branch.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                <span className="text-text-secondary">{branch.address}</span>
              </div>

              {branch.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-text-secondary" />
                  <span className="text-text-secondary">{branch.phone}</span>
                </div>
              )}

              <div className="text-xs text-text-secondary">
                Created: {new Date(branch.created_at).toLocaleDateString()}
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-border">
              <button
                onClick={() => openEditModal(branch)}
                className="flex-1 px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <Edit className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={() => handleDelete(branch.id)}
                className="px-4 py-2 bg-error/10 text-error rounded-xl hover:bg-error/20 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredBranches.length === 0 && (
        <div className="card text-center py-12">
          <Building2 className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
          <p className="text-text-secondary text-lg">No branches found</p>
          <p className="text-text-secondary text-sm mt-1">
            {searchTerm ? 'Try adjusting your search' : 'Create your first branch to get started'}
          </p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                {editingBranch ? 'Edit Branch' : 'Create New Branch'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingBranch(null)
                  resetForm()
                }}
                className="p-2 hover:bg-background rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={editingBranch ? handleUpdate : handleCreate} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Branch Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Main Campus"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Address *</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={3}
                  placeholder="123 Main Street, City, State"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 rounded border-border focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-sm font-medium">Branch is active</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingBranch(null)
                    resetForm()
                  }}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  {editingBranch ? 'Update Branch' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}