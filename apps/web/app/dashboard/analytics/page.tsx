'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useRouter } from 'next/navigation'
import toast from '@/lib/toast'
import {
  BarChart3, TrendingUp, Users, GraduationCap, DollarSign,
  Calendar, Download, RefreshCw, FileText, Activity,
  Award, BookOpen, Target, Filter, ChevronDown, Loader2
} from 'lucide-react'
import {
  useDashboardStats,
  useAnalytics,
  useReports,
  useGenerateReport,
  useRefreshAnalytics,
  Report,
} from '@/lib/hooks/useAnalytics'

export default function AnalyticsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const { formatCurrencyFromMinor, formatCurrency } = useSettings()
  const router = useRouter()

  // React Query hooks - automatic caching, loading, and error states
  const { data: dashboardStats, isLoading: statsLoading } = useDashboardStats()
  const { data: analytics, isLoading: analyticsLoading } = useAnalytics()
  const { data: reportsData = { results: [], count: 0, next: null, previous: null }, isLoading: reportsLoading } = useReports()
  const generateReport = useGenerateReport()
  const refreshAnalytics = useRefreshAnalytics()

  // Loading state
  const loading = statsLoading || analyticsLoading || reportsLoading

  // Local UI state
  const [activeTab, setActiveTab] = useState<'overview' | 'reports'>('overview')

  // Report generation form
  const [reportType, setReportType] = useState('student-performance')
  const [reportPeriod, setReportPeriod] = useState('month')
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)

  const handleGenerateReport = async () => {
    generateReport.mutate(
      {
        reportType,
        options: { period: reportPeriod },
      },
      {
        onSuccess: (report) => {
          setSelectedReport(report)
        },
      }
    )
  }

  const handleRefresh = () => {
    refreshAnalytics()
    toast.success('Data refreshed')
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-text-secondary">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-primary" />
                Analytics & Reports
              </h1>
              <p className="text-text-secondary">Track performance and generate detailed reports</p>
            </div>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-surface border border-border rounded-xl hover:bg-border/50 transition-colors flex items-center gap-2 font-medium"
            >
              <RefreshCw className="h-5 w-5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Overview Statistics Cards */}
        {dashboardStats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="bg-surface p-6 rounded-2xl border border-border hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <p className="text-3xl font-bold mb-1">{dashboardStats.total_students}</p>
              <p className="text-sm text-text-secondary">Total Students</p>
            </div>

            <div className="bg-surface p-6 rounded-2xl border border-border hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <GraduationCap className="h-6 w-6 text-success" />
                </div>
                <span className="text-xs text-text-secondary">Active</span>
              </div>
              <p className="text-3xl font-bold mb-1">{dashboardStats.total_teachers}</p>
              <p className="text-sm text-text-secondary">Total Teachers</p>
            </div>

            <div className="bg-surface p-6 rounded-2xl border border-border hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-info/10 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-info" />
                </div>
                <span className="text-xs text-text-secondary">Running</span>
              </div>
              <p className="text-3xl font-bold mb-1">{dashboardStats.total_groups}</p>
              <p className="text-sm text-text-secondary">Total Groups</p>
            </div>

            <div className="bg-surface p-6 rounded-2xl border border-border hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Award className="h-6 w-6 text-warning" />
                </div>
                <span className="text-xs text-text-secondary">Available</span>
              </div>
              <p className="text-3xl font-bold mb-1">{dashboardStats.active_courses}</p>
              <p className="text-sm text-text-secondary">Active Courses</p>
            </div>

            <div className="bg-surface p-6 rounded-2xl border border-border hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-error/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-error" />
                </div>
                <span className="text-xs text-text-secondary">Pending</span>
              </div>
              <p className="text-3xl font-bold mb-1">{dashboardStats.pending_tasks}</p>
              <p className="text-sm text-text-secondary">Pending Tasks</p>
            </div>
          </div>
        )}

        {/* Monthly Analytics */}
        {analytics && (
          <div className="bg-surface p-6 rounded-2xl border border-border mb-8">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              This Month&apos;s Performance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="p-4 bg-background rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-text-secondary text-sm">New Students</p>
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <p className="text-2xl font-bold">{analytics.this_month.new_students}</p>
                <p className="text-xs text-success mt-1">+{analytics.this_month.new_students} joined</p>
              </div>

              <div className="p-4 bg-background rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-text-secondary text-sm">Income</p>
                  <DollarSign className="h-5 w-5 text-success" />
                </div>
                <p className="text-2xl font-bold">{formatCurrencyFromMinor(analytics.this_month.income)}</p>
                <p className="text-xs text-text-secondary mt-1">Total revenue</p>
              </div>

              <div className="p-4 bg-background rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-text-secondary text-sm">Expenses</p>
                  <TrendingUp className="h-5 w-5 text-error" />
                </div>
                <p className="text-2xl font-bold">{formatCurrencyFromMinor(analytics.this_month.expense)}</p>
                <p className="text-xs text-text-secondary mt-1">Total spent</p>
              </div>

              <div className="p-4 bg-background rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-text-secondary text-sm">Net Profit</p>
                  <Activity className="h-5 w-5 text-info" />
                </div>
                <p className="text-2xl font-bold">{formatCurrencyFromMinor(analytics.this_month.net_profit)}</p>
                <p className="text-xs text-success mt-1">
                  {analytics.this_month.net_profit > 0 ? '+' : ''}{((analytics.this_month.net_profit / analytics.this_month.income) * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* CRM Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="p-4 bg-background rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-text-secondary text-sm">Active Leads</p>
                  <Target className="h-5 w-5 text-warning" />
                </div>
                <p className="text-2xl font-bold">{analytics.general.active_leads}</p>
                <p className="text-xs text-text-secondary mt-1">In progress</p>
              </div>

              <div className="p-4 bg-background rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-text-secondary text-sm">New Leads</p>
                  <Users className="h-5 w-5 text-info" />
                </div>
                <p className="text-2xl font-bold">{analytics.this_month.new_leads}</p>
                <p className="text-xs text-text-secondary mt-1">This month</p>
              </div>

              <div className="p-4 bg-background rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-text-secondary text-sm">Conversion Rate</p>
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <p className="text-2xl font-bold">{analytics.this_month.lead_conversion_rate}</p>
                <p className="text-xs text-success mt-1">
                  {analytics.this_month.converted_leads} converted
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'overview'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <BarChart3 className="h-4 w-4 inline mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'reports'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <FileText className="h-4 w-4 inline mr-2" />
            Reports
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Quick Stats */}
              <div className="bg-surface p-6 rounded-2xl border border-border">
                <h3 className="text-lg font-bold mb-4">Quick Statistics</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-background rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <span className="font-medium">Active Students</span>
                    </div>
                    <span className="text-xl font-bold">{analytics?.general.total_active_students || 0}</span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-background rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                        <BookOpen className="h-5 w-5 text-success" />
                      </div>
                      <span className="font-medium">Total Groups</span>
                    </div>
                    <span className="text-xl font-bold">{analytics?.general.total_groups || 0}</span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-background rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                        <Award className="h-5 w-5 text-warning" />
                      </div>
                      <span className="font-medium">Active Courses</span>
                    </div>
                    <span className="text-xl font-bold">{dashboardStats?.active_courses || 0}</span>
                  </div>
                </div>
              </div>

              {/* Revenue Trends Chart */}
              <div className="bg-surface p-6 rounded-2xl border border-border">
                <h3 className="text-lg font-bold mb-4">Revenue Trends</h3>
                {analytics && (
                  <div className="space-y-4">
                    {/* Monthly Revenue */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-text-secondary font-medium">This Month</span>
                        <span className="font-bold text-success">{formatCurrencyFromMinor(analytics.this_month.income)}</span>
                      </div>
                      <div className="w-full bg-background rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-success to-success/80 rounded-full"
                          style={{ width: '85%' }}
                        />
                      </div>
                    </div>

                    {/* Monthly Expenses */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-text-secondary font-medium">Expenses</span>
                        <span className="font-bold text-error">{formatCurrencyFromMinor(analytics.this_month.expense)}</span>
                      </div>
                      <div className="w-full bg-background rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-error to-error/80 rounded-full"
                          style={{ width: `${(analytics.this_month.expense / analytics.this_month.income) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Net Profit */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-text-secondary font-medium">Net Profit</span>
                        <span className="font-bold text-primary">{formatCurrencyFromMinor(analytics.this_month.net_profit)}</span>
                      </div>
                      <div className="w-full bg-background rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
                          style={{ width: `${(analytics.this_month.net_profit / analytics.this_month.income) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Visual Bar Chart */}
                    <div className="mt-6 pt-6 border-t border-border">
                      <div className="flex items-end justify-around gap-4 h-48">
                        {/* Income Bar */}
                        <div className="flex-1 flex flex-col items-center">
                          <div
                            className="w-full bg-gradient-to-t from-success to-success/80 rounded-t-lg"
                            style={{ height: '100%' }}
                          ></div>
                          <p className="text-xs text-text-secondary mt-2 font-medium">Income</p>
                          <p className="text-sm font-bold text-success">{formatCurrencyFromMinor(analytics.this_month.income)}</p>
                        </div>

                        {/* Expenses Bar */}
                        <div className="flex-1 flex flex-col items-center">
                          <div
                            className="w-full bg-gradient-to-t from-error to-error/80 rounded-t-lg"
                            style={{ height: `${(analytics.this_month.expense / analytics.this_month.income) * 100}%` }}
                          ></div>
                          <p className="text-xs text-text-secondary mt-2 font-medium">Expenses</p>
                          <p className="text-sm font-bold text-error">{formatCurrencyFromMinor(analytics.this_month.expense)}</p>
                        </div>

                        {/* Profit Bar */}
                        <div className="flex-1 flex flex-col items-center">
                          <div
                            className="w-full bg-gradient-to-t from-primary to-primary/80 rounded-t-lg"
                            style={{ height: `${(analytics.this_month.net_profit / analytics.this_month.income) * 100}%` }}
                          ></div>
                          <p className="text-xs text-text-secondary mt-2 font-medium">Profit</p>
                          <p className="text-sm font-bold text-primary">{formatCurrencyFromMinor(analytics.this_month.net_profit)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Additional Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Enrollment Funnel */}
              <div className="bg-surface p-6 rounded-2xl border border-border">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Lead Conversion Funnel
                </h3>
                {analytics && (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-text-secondary">Active Leads</span>
                        <span className="font-bold">{analytics.general.active_leads}</span>
                      </div>
                      <div className="w-full bg-background rounded-full h-3">
                        <div className="h-full bg-gradient-to-r from-info to-info/80 rounded-full" style={{ width: '100%' }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-text-secondary">New Leads (This Month)</span>
                        <span className="font-bold">{analytics.this_month.new_leads}</span>
                      </div>
                      <div className="w-full bg-background rounded-full h-3">
                        <div className="h-full bg-gradient-to-r from-warning to-warning/80 rounded-full" style={{ width: `${(analytics.this_month.new_leads / analytics.general.active_leads) * 100}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-text-secondary">Converted Leads</span>
                        <span className="font-bold">{analytics.this_month.converted_leads}</span>
                      </div>
                      <div className="w-full bg-background rounded-full h-3">
                        <div className="h-full bg-gradient-to-r from-success to-success/80 rounded-full" style={{ width: `${(analytics.this_month.converted_leads / analytics.this_month.new_leads) * 100}%` }} />
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Conversion Rate</span>
                        <span className="text-2xl font-bold text-success">{analytics.this_month.lead_conversion_rate}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Financial Health */}
              <div className="bg-surface p-6 rounded-2xl border border-border">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Financial Health
                </h3>
                {analytics && dashboardStats && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-background rounded-xl">
                      <div>
                        <p className="text-text-secondary text-sm mb-1">Profit Margin</p>
                        <p className="text-2xl font-bold text-success">
                          {analytics.this_month.income > 0 ? ((analytics.this_month.net_profit / analytics.this_month.income) * 100).toFixed(1) : 0}%
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-success" />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-background rounded-xl">
                      <div>
                        <p className="text-text-secondary text-sm mb-1">Revenue per Student</p>
                        <p className="text-2xl font-bold text-primary">
                          {formatCurrency(dashboardStats.total_students > 0 ? (analytics.this_month.income / 100) / dashboardStats.total_students : 0)}
                        </p>
                      </div>
                      <Users className="h-8 w-8 text-primary" />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-background rounded-xl">
                      <div>
                        <p className="text-text-secondary text-sm mb-1">Active Students</p>
                        <p className="text-2xl font-bold text-info">{analytics.general.total_active_students}</p>
                      </div>
                      <GraduationCap className="h-8 w-8 text-info" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div>
            {/* Report Generation Form */}
            <div className="bg-surface p-6 rounded-2xl border border-border mb-6">
              <h3 className="text-lg font-bold mb-4">Generate New Report</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Report Type</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="student-performance">Student Performance</option>
                    <option value="attendance-summary">Attendance Summary</option>
                    <option value="financial-report">Financial Report</option>
                    <option value="teacher-workload">Teacher Workload</option>
                    <option value="course-completion">Course Completion</option>
                    <option value="enrollment-trends">Enrollment Trends</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Period</label>
                  <select
                    value={reportPeriod}
                    onChange={(e) => setReportPeriod(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="week">Last Week</option>
                    <option value="month">Last Month</option>
                    <option value="quarter">Last Quarter</option>
                    <option value="year">Last Year</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleGenerateReport}
                    disabled={generateReport.isPending}
                    className="w-full px-6 py-3 bg-primary text-background rounded-xl hover:bg-primary/90 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generateReport.isPending ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <FileText className="h-5 w-5" />
                        Generate Report
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Generated Report Display */}
            {selectedReport && (
              <div className="bg-surface p-6 rounded-2xl border border-border mb-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold">{selectedReport.title}</h3>
                    <p className="text-sm text-text-secondary">
                      Generated: {new Date(selectedReport.generated_at).toLocaleString()} | Period: {selectedReport.period}
                    </p>
                  </div>
                  <button className="px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors flex items-center gap-2 font-medium">
                    <Download className="h-5 w-5" />
                    Export
                  </button>
                </div>

                {/* Report Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {Object.entries(selectedReport.summary).map(([key, value]) => (
                    <div key={key} className="p-4 bg-background rounded-xl">
                      <p className="text-sm text-text-secondary capitalize mb-1">
                        {key.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xl font-bold">{value?.toString() || 'N/A'}</p>
                    </div>
                  ))}
                </div>

                {/* Report Data Table */}
                {selectedReport.data && selectedReport.data.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-background border-b border-border">
                        <tr>
                          {Object.keys(selectedReport.data[0]).map((key) => (
                            <th key={key} className="text-left p-4 font-medium text-text-secondary capitalize">
                              {key.replace(/_/g, ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReport.data.map((row, idx) => (
                          <tr key={idx} className="border-b border-border hover:bg-background transition-colors">
                            {Object.values(row).map((value, colIdx) => (
                              <td key={colIdx} className="p-4">
                                {typeof value === 'object' ? JSON.stringify(value) : value?.toString() || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Empty State */}
            {!selectedReport && reportsData.results.length === 0 && (
              <div className="text-center py-12 bg-surface rounded-2xl border border-border">
                <FileText className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
                <p className="text-text-secondary text-lg mb-2">No reports generated yet</p>
                <p className="text-sm text-text-secondary">
                  Generate your first report to view detailed analytics
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
