'use client'

import { useState } from 'react'
import { useSettings } from '@/contexts/SettingsContext'
import {
  DollarSign,
  Plus,
  Calendar,
  Check,
  X,
  Trash2
} from 'lucide-react'
import {
  useTeachers,
  useGroups,
  useEnrichedTeacherSalaries,
  useEnrichedGroupSalaries,
  useCreateTeacherSalary,
  useCreateGroupSalary,
  useUpdateTeacherSalaryStatus,
  useDeleteTeacherSalary,
  useSalaryStats,
  type TeacherSalary,
  type Teacher,
  type Group
} from '@/lib/hooks/useHR'
import toast from '@/lib/toast'

export default function HRPage() {
  const { currency, formatCurrency, fromSelectedCurrency } = useSettings()
  // Filters
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // React Query hooks
  const { data: teachers = [] } = useTeachers()
  const { data: groups = [] } = useGroups()
  const { data: teacherSalariesData, isLoading: isLoadingSalaries } = useEnrichedTeacherSalaries({
    page,
    limit,
    month: selectedMonth + '-01',
    status: statusFilter,
  })
  const { data: groupSalaries = [], isLoading: isLoadingGroupSalaries } = useEnrichedGroupSalaries({
    month: selectedMonth + '-01',
  })

  const teacherSalaries = teacherSalariesData?.results || []
  const totalSalariesCount = teacherSalariesData?.count || 0
  const totalPages = Math.ceil(totalSalariesCount / limit)

  // Mutations
  const createTeacherSalaryMutation = useCreateTeacherSalary()
  const createGroupSalaryMutation = useCreateGroupSalary()
  const updateSalaryStatusMutation = useUpdateTeacherSalaryStatus()
  const deleteSalaryMutation = useDeleteTeacherSalary()

  const loading = isLoadingSalaries || isLoadingGroupSalaries

  // Calculate stats
  const { totalSalaries, paidSalaries, pendingSalaries } = useSalaryStats(teacherSalaries)

  // Modals
  const [showSalaryModal, setShowSalaryModal] = useState(false)
  const [showGroupSalaryModal, setShowGroupSalaryModal] = useState(false)

  // Forms
  const [salaryData, setSalaryData] = useState({
    teacher: 0,
    amount: '',
    month: selectedMonth + '-01',
    status: 'calculated' as 'calculated' | 'paid' | 'rejected',
    comment: '',
  })

  const [groupSalaryData, setGroupSalaryData] = useState({
    mentor: 0,
    group: 0,
    amount: '',
    month: selectedMonth + '-01',
  })

  const createSalary = async () => {
    // Validate required fields
    if (!salaryData.teacher || salaryData.teacher <= 0) {
      toast.warning('Please select a teacher')
      return
    }
    if (!salaryData.amount || parseFloat(salaryData.amount) <= 0) {
      toast.warning('Please enter a valid amount')
      return
    }

    const payload = {
      teacher: salaryData.teacher,
      amount: fromSelectedCurrency(parseFloat(salaryData.amount)),
      month: salaryData.month,
      status: salaryData.status,
      comment: salaryData.comment || '',
    }

    createTeacherSalaryMutation.mutate(payload, {
      onSuccess: () => {
        setSalaryData({
          teacher: 0,
          amount: '',
          month: selectedMonth + '-01',
          status: 'calculated',
          comment: '',
        })
        setShowSalaryModal(false)
      },
    })
  }

  const createGroupSalary = async () => {
    // Validate required fields
    if (!groupSalaryData.mentor || groupSalaryData.mentor <= 0) {
      toast.warning('Please select a mentor/teacher')
      return
    }
    if (!groupSalaryData.group || groupSalaryData.group <= 0) {
      toast.warning('Please select a group')
      return
    }
    if (!groupSalaryData.amount || parseFloat(groupSalaryData.amount) <= 0) {
      toast.warning('Please enter a valid amount')
      return
    }

    const payload = {
      mentor: groupSalaryData.mentor,
      group: groupSalaryData.group,
      amount: fromSelectedCurrency(parseFloat(groupSalaryData.amount)),
      month: groupSalaryData.month,
    }

    createGroupSalaryMutation.mutate(payload, {
      onSuccess: () => {
        setGroupSalaryData({
          mentor: 0,
          group: 0,
          amount: '',
          month: selectedMonth + '-01',
        })
        setShowGroupSalaryModal(false)
      },
    })
  }

  const updateSalaryStatus = (id: number, status: 'calculated' | 'paid' | 'rejected') => {
    updateSalaryStatusMutation.mutate({ id, status })
  }

  const deleteSalary = (id: number) => {
    if (!confirm('Are you sure you want to delete this salary record?')) return
    deleteSalaryMutation.mutate(id)
  }

  const PaginationControls = () => (
    <div className="flex justify-between items-center mt-6 p-4">
      <div className="text-sm text-text-secondary">
        Showing {teacherSalaries.length} of {totalSalariesCount} salaries
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage((p) => Math.max(p - 1, 1))}
          disabled={page <= 1}
          className="btn-secondary"
        >
          Previous
        </button>
        <span className="text-text-secondary text-sm">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
          disabled={page >= totalPages}
          className="btn-secondary"
        >
          Next
        </button>
      </div>
    </div>
  )

  if (loading && page === 1) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading salary data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">HR & Salary Management 💰</h1>
        <p className="text-text-secondary">Track teacher salaries and payments</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="stat-card">
          <div className="stat-value">{teachers.length}</div>
          <div className="stat-label">Total Teachers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-primary">{formatCurrency(totalSalaries)}</div>
          <div className="stat-label">Total Salaries (Page)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-success">{formatCurrency(paidSalaries)}</div>
          <div className="stat-label">Paid (Page)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-warning">{formatCurrency(pendingSalaries)}</div>
          <div className="stat-label">Pending (Page)</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-text-secondary" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value)
              setPage(1)
            }}
            className="px-4 py-2 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          className="px-4 py-2 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary"
        >
          <option value="all">All Statuses</option>
          <option value="calculated">Calculated</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>

        <button
          onClick={() => setShowSalaryModal(true)}
          className="btn-primary flex items-center gap-2 ml-auto"
        >
          <Plus className="h-5 w-5" />
          Add Salary
        </button>

        <button
          onClick={() => setShowGroupSalaryModal(true)}
          className="btn-secondary flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Add Group Salary
        </button>
      </div>

      {/* Teacher Salaries Table */}
      <div className="card mb-6">
        <h2 className="text-2xl font-bold mb-4">Teacher Salaries ({totalSalariesCount})</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4">Teacher</th>
                <th className="text-left py-3 px-4">Month</th>
                <th className="text-right py-3 px-4">Amount</th>
                <th className="text-center py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Comment</th>
                <th className="text-center py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teacherSalaries.map((salary: TeacherSalary) => (
                <tr key={salary.id} className="border-b border-border/50 hover:bg-background/50">
                  <td className="py-3 px-4 font-medium">{salary.teacher_name}</td>
                  <td className="py-3 px-4 text-text-secondary">
                    {new Date(salary.month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-primary">
                    {formatCurrency(parseFloat(salary.amount))}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-3 py-1 rounded-lg text-sm font-medium ${
                        salary.status === 'paid'
                          ? 'bg-success/10 text-success'
                          : salary.status === 'rejected'
                          ? 'bg-error/10 text-error'
                          : 'bg-warning/10 text-warning'
                      }`}
                    >
                      {salary.status.charAt(0).toUpperCase() + salary.status.slice(1)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-text-secondary">
                    {salary.comment || '-'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      {salary.status !== 'paid' && (
                        <button
                          onClick={() => updateSalaryStatus(salary.id, 'paid')}
                          className="p-2 hover:bg-success/10 text-success rounded-lg transition-colors"
                          title="Mark as Paid"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      {salary.status !== 'rejected' && (
                        <button
                          onClick={() => updateSalaryStatus(salary.id, 'rejected')}
                          className="p-2 hover:bg-error/10 text-error rounded-lg transition-colors"
                          title="Reject"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteSalary(salary.id)}
                        className="p-2 hover:bg-error/10 text-error rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {teacherSalaries.length === 0 && (
            <div className="text-center py-12 text-text-secondary">
              No salary records found for this month
            </div>
          )}
        </div>
        {totalPages > 1 && <PaginationControls />}
      </div>

      {/* Group Salaries Table */}
      <div className="card">
        <h2 className="text-2xl font-bold mb-4">Group-Based Salaries</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4">Teacher</th>
                <th className="text-left py-3 px-4">Group</th>
                <th className="text-left py-3 px-4">Month</th>
                <th className="text-right py-3 px-4">Amount</th>
              </tr>
            </thead>
            <tbody>
              {groupSalaries.map((gs) => (
                <tr key={gs.id} className="border-b border-border/50 hover:bg-background/50">
                  <td className="py-3 px-4 font-medium">{gs.mentor_name}</td>
                  <td className="py-3 px-4 text-text-secondary">{gs.group_name}</td>
                  <td className="py-3 px-4 text-text-secondary">
                    {new Date(gs.month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-primary">
                    {formatCurrency(parseFloat(gs.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {groupSalaries.length === 0 && (
            <div className="text-center py-12 text-text-secondary">
              No group salary records found
            </div>
          )}
        </div>
      </div>

      {/* Create Salary Modal */}
      {showSalaryModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Add Teacher Salary</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Teacher *</label>
                <select
                  value={salaryData.teacher}
                  onChange={(e) => setSalaryData({ ...salaryData, teacher: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                >
                  <option value={0}>Select a teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.first_name} {teacher.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Amount ({currency}) *</label>
                <input
                  type="number"
                  value={salaryData.amount}
                  onChange={(e) => setSalaryData({ ...salaryData, amount: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Month *</label>
                <input
                  type="date"
                  value={salaryData.month}
                  onChange={(e) => setSalaryData({ ...salaryData, month: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={salaryData.status}
                  onChange={(e) => setSalaryData({ ...salaryData, status: e.target.value as any })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                >
                  <option value="calculated">Calculated</option>
                  <option value="paid">Paid</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Comment</label>
                <textarea
                  value={salaryData.comment}
                  onChange={(e) => setSalaryData({ ...salaryData, comment: e.target.value })}
                  placeholder="Optional notes..."
                  rows={3}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowSalaryModal(false)
                  setSalaryData({
                    teacher: 0,
                    amount: '',
                    month: selectedMonth + '-01',
                    status: 'calculated',
                    comment: '',
                  })
                }}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button onClick={createSalary} className="flex-1 btn-primary">
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Group Salary Modal */}
      {showGroupSalaryModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Add Group Salary</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Teacher *</label>
                <select
                  value={groupSalaryData.mentor}
                  onChange={(e) => setGroupSalaryData({ ...groupSalaryData, mentor: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                >
                  <option value={0}>Select a teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.first_name} {teacher.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Group *</label>
                <select
                  value={groupSalaryData.group}
                  onChange={(e) => setGroupSalaryData({ ...groupSalaryData, group: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                >
                  <option value={0}>Select a group</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} - {group.course.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Amount ({currency}) *</label>
                <input
                  type="number"
                  value={groupSalaryData.amount}
                  onChange={(e) => setGroupSalaryData({ ...groupSalaryData, amount: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Month *</label>
                <input
                  type="date"
                  value={groupSalaryData.month}
                  onChange={(e) => setGroupSalaryData({ ...groupSalaryData, month: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowGroupSalaryModal(false)
                  setGroupSalaryData({
                    mentor: 0,
                    group: 0,
                    amount: '',
                    month: selectedMonth + '-01',
                  })
                }}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button onClick={createGroupSalary} className="flex-1 btn-primary">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
