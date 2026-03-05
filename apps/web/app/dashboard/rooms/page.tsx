'use client'

import { useState, useEffect } from 'react'
import apiService from '@/lib/api'
import toast from '@/lib/toast'
import {
import LoadingScreen from '@/components/LoadingScreen'
  DoorOpen,
  Plus,
  Edit,
  Trash2,
  Users,
  Building2,
  Search,
  X,
  MapPin,
  TrendingUp,
  AlertCircle
} from 'lucide-react'

interface Branch {
  id: number
  name: string
  address: string
  phone: string
  is_active: boolean
}

interface Room {
  id: number
  name: string
  capacity: number
  branch: number
  branch_details?: Branch
}

interface Group {
  id: number
  name: string
  room?: number
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    capacity: 20,
    branch: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [roomsData, branchesData, groupsData] = await Promise.all([
        apiService.getRooms(),
        apiService.getBranches(),
        apiService.getGroups()
      ])

      const roomsList = roomsData.results || roomsData || []
      const branchesList = branchesData.results || branchesData || []
      const groupsList = groupsData.results || groupsData || []

      // Enrich rooms with branch details
      const enrichedRooms = roomsList.map((room: Room) => ({
        ...room,
        branch_details: branchesList.find((b: Branch) => b.id === room.branch)
      }))

      setRooms(enrichedRooms)
      setBranches(branchesList)
      setGroups(groupsList)
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Failed to load rooms')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.branch || !formData.capacity) {
      toast.warning('Please fill in all required fields')
      return
    }

    try {
      await apiService.createRoom({
        name: formData.name,
        capacity: Number(formData.capacity),
        branch: Number(formData.branch)
      })
      toast.success('Room created successfully!')
      setShowModal(false)
      resetForm()
      loadData()
    } catch (error: any) {
      console.error('Failed to create room:', error)
      toast.error(error.response?.data?.detail || 'Failed to create room')
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRoom) return

    try {
      await apiService.updateRoom(editingRoom.id, {
        name: formData.name,
        capacity: Number(formData.capacity),
        branch: Number(formData.branch)
      })
      toast.success('Room updated successfully!')
      setShowModal(false)
      setEditingRoom(null)
      resetForm()
      loadData()
    } catch (error: any) {
      console.error('Failed to update room:', error)
      toast.error(error.response?.data?.detail || 'Failed to update room')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this room? This will unassign all groups from this room.')) return

    try {
      await apiService.deleteRoom(id)
      toast.success('Room deleted successfully')
      loadData()
    } catch (error: any) {
      console.error('Failed to delete room:', error)
      toast.error(error.response?.data?.detail || 'Failed to delete room')
    }
  }

  const openEditModal = (room: Room) => {
    setEditingRoom(room)
    setFormData({
      name: room.name,
      capacity: room.capacity,
      branch: room.branch.toString()
    })
    setShowModal(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      capacity: 20,
      branch: ''
    })
  }

  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.branch_details?.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesBranch = selectedBranch ? room.branch === parseInt(selectedBranch) : true
    return matchesSearch && matchesBranch
  })

  // Calculate statistics
  const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0)
  const avgCapacity = rooms.length > 0 ? Math.round(totalCapacity / rooms.length) : 0
  const assignedRooms = rooms.filter(room => groups.some(g => g.room === room.id)).length
  const utilizationRate = rooms.length > 0 ? Math.round((assignedRooms / rooms.length) * 100) : 0

  if (loading) {
    return <LoadingScreen message="Loading rooms..." />
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <DoorOpen className="h-10 w-10 text-primary" />
          Rooms Management
        </h1>
        <p className="text-text-secondary">Manage classrooms and learning spaces</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="stat-card border-l-4 border-l-primary">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-secondary text-sm font-medium">Total Rooms</p>
            <DoorOpen className="h-5 w-5 text-primary" />
          </div>
          <p className="text-3xl font-bold">{rooms.length}</p>
          <p className="text-xs text-text-secondary mt-2">All learning spaces</p>
        </div>

        <div className="stat-card border-l-4 border-l-success">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-secondary text-sm font-medium">Total Capacity</p>
            <Users className="h-5 w-5 text-success" />
          </div>
          <p className="text-3xl font-bold text-success">{totalCapacity}</p>
          <p className="text-xs text-text-secondary mt-2">Students can fit</p>
        </div>

        <div className="stat-card border-l-4 border-l-info">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-secondary text-sm font-medium">Average Capacity</p>
            <TrendingUp className="h-5 w-5 text-info" />
          </div>
          <p className="text-3xl font-bold text-info">{avgCapacity}</p>
          <p className="text-xs text-text-secondary mt-2">Per room</p>
        </div>

        <div className="stat-card border-l-4 border-l-warning">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-secondary text-sm font-medium">Utilization</p>
            <AlertCircle className="h-5 w-5 text-warning" />
          </div>
          <p className="text-3xl font-bold text-warning">{utilizationRate}%</p>
          <p className="text-xs text-text-secondary mt-2">{assignedRooms} of {rooms.length} assigned</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
            <input
              type="text"
              placeholder="Search by room name or branch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Branch Filter */}
          <div>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Branches</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          {/* Add Button */}
          <button
            onClick={() => {
              setEditingRoom(null)
              resetForm()
              setShowModal(true)
            }}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Add Room
          </button>
        </div>
      </div>

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRooms.map(room => {
          const assignedGroups = groups.filter(g => g.room === room.id)
          const isAssigned = assignedGroups.length > 0

          return (
            <div
              key={room.id}
              className="card hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                    isAssigned ? 'bg-success/10' : 'bg-primary/10'
                  }`}>
                    <DoorOpen className={`h-6 w-6 ${isAssigned ? 'text-success' : 'text-primary'}`} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{room.name}</h3>
                    <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
                      isAssigned
                        ? 'bg-success/10 text-success'
                        : 'bg-text-secondary/10 text-text-secondary'
                    }`}>
                      {isAssigned ? 'In Use' : 'Available'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-text-secondary" />
                  <span className="text-text-secondary">
                    {room.branch_details?.name || 'Unknown Branch'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-text-secondary" />
                  <span className="text-text-secondary">
                    Capacity: {room.capacity} students
                  </span>
                </div>

                {isAssigned && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-success" />
                    <span className="text-success">
                      {assignedGroups.length} group{assignedGroups.length !== 1 ? 's' : ''} assigned
                    </span>
                  </div>
                )}
              </div>

              {assignedGroups.length > 0 && (
                <div className="mb-4 p-3 bg-background rounded-lg">
                  <p className="text-xs text-text-secondary mb-2">Assigned Groups:</p>
                  <div className="flex flex-wrap gap-1">
                    {assignedGroups.map(group => (
                      <span
                        key={group.id}
                        className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-lg"
                      >
                        {group.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-border">
                <button
                  onClick={() => openEditModal(room)}
                  className="flex-1 px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(room.id)}
                  className="px-4 py-2 bg-error/10 text-error rounded-xl hover:bg-error/20 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {filteredRooms.length === 0 && (
        <div className="card text-center py-12">
          <DoorOpen className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
          <p className="text-text-secondary text-lg">No rooms found</p>
          <p className="text-text-secondary text-sm mt-1">
            {searchTerm || selectedBranch
              ? 'Try adjusting your filters'
              : 'Create your first room to get started'}
          </p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                {editingRoom ? 'Edit Room' : 'Create New Room'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingRoom(null)
                  resetForm()
                }}
                className="p-2 hover:bg-background rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={editingRoom ? handleUpdate : handleCreate} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Room Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Room 101"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Branch *</label>
                <select
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">Select Branch</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Capacity (Students) *</label>
                <input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="20"
                  min="1"
                  max="200"
                  required
                />
                <p className="text-xs text-text-secondary mt-1">
                  How many students can this room accommodate?
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingRoom(null)
                    resetForm()
                  }}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  {editingRoom ? 'Update Room' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}