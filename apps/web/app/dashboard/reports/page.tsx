'use client'

import { useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Play,
  Download,
  Eye,
  FileDown,
  FileText,
  Filter,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import LoadingScreen from '@/components/LoadingScreen'
import PaginationControls from '@/components/PaginationControls'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import {
  Report,
  ReportGeneration,
  ScheduledReport,
  useCreateScheduledReport,
  useDeleteScheduledReport,
  useReportGenerations,
  useGenerateReport,
  useReport,
  useReports,
  useRunScheduledReport,
  useScheduledReports,
  useToggleScheduledReport,
} from '@/lib/hooks/useAnalytics'
import { usePermissions } from '@/lib/permissions'
import apiService from '@/lib/api'
import toast from '@/lib/toast'

type ReportPeriod = 'week' | 'month' | 'quarter' | 'year'

type ReportTemplate = {
  id: string
  title: string
  description: string
  accent: string
  icon: string
  cta: string
}

type ScheduleFrequency = 'daily' | 'weekly' | 'monthly'
type ScheduleEnabledFilter = 'all' | 'enabled' | 'disabled'

type ScheduleFormState = {
  templateId: string
  frequency: ScheduleFrequency
  dayOfWeek: string
  time: string
  recipients: string
  enabled: boolean
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'student-performance',
    title: 'Student Performance',
    description: 'Scores, pass rates, top performers, and students at risk.',
    accent: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30',
    icon: '🎯',
    cta: 'Generate performance insight',
  },
  {
    id: 'attendance-summary',
    title: 'Attendance Summary',
    description: 'Attendance health by group with present and absent patterns.',
    accent: 'from-emerald-500/20 to-green-500/10 border-emerald-500/30',
    icon: '✅',
    cta: 'Generate attendance health',
  },
  {
    id: 'financial-report',
    title: 'Financial Report',
    description: 'Revenue, expense, net profit, and pending obligations.',
    accent: 'from-yellow-500/20 to-orange-500/10 border-yellow-500/30',
    icon: '💰',
    cta: 'Generate finance snapshot',
  },
  {
    id: 'profit-loss',
    title: 'Profit & Loss',
    description: 'Profit margin and monthly revenue vs expense trajectory.',
    accent: 'from-violet-500/20 to-indigo-500/10 border-violet-500/30',
    icon: '📉',
    cta: 'Generate P&L statement',
  },
  {
    id: 'cash-flow',
    title: 'Cash Flow',
    description: 'Cash inflow/outflow movement to monitor liquidity.',
    accent: 'from-teal-500/20 to-cyan-500/10 border-teal-500/30',
    icon: '💵',
    cta: 'Generate cash-flow report',
  },
  {
    id: 'accounts-receivable',
    title: 'Accounts Receivable',
    description: 'Outstanding balances and payment aging visibility.',
    accent: 'from-orange-500/20 to-red-500/10 border-orange-500/30',
    icon: '🧾',
    cta: 'Generate receivables report',
  },
  {
    id: 'teacher-compensation',
    title: 'Teacher Compensation',
    description: 'Earnings, payouts, and pending teacher obligations.',
    accent: 'from-purple-500/20 to-fuchsia-500/10 border-purple-500/30',
    icon: '👨‍🏫',
    cta: 'Generate compensation report',
  },
  {
    id: 'teacher-workload',
    title: 'Teacher Workload',
    description: 'Group assignments, estimated hours, and load balance.',
    accent: 'from-sky-500/20 to-blue-500/10 border-sky-500/30',
    icon: '📚',
    cta: 'Generate workload report',
  },
  {
    id: 'course-completion',
    title: 'Course Completion',
    description: 'Course completion and in-progress distribution.',
    accent: 'from-indigo-500/20 to-violet-500/10 border-indigo-500/30',
    icon: '🎓',
    cta: 'Generate completion report',
  },
  {
    id: 'enrollment-trends',
    title: 'Enrollment Trends',
    description: 'Enrollment momentum and growth trajectory over time.',
    accent: 'from-pink-500/20 to-rose-500/10 border-pink-500/30',
    icon: '📈',
    cta: 'Generate trend report',
  },
]

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  week: 'Last 7 days',
  month: 'Last 30 days',
  quarter: 'Last 90 days',
  year: 'Last 365 days',
}

const SCHEDULED_REPORT_TYPE_LABELS: Record<string, string> = {
  attendance: 'Attendance Summary',
  enrollment: 'Enrollment Trends',
  performance: 'Student Performance',
  revenue: 'Financial Report',
  lead_conversion: 'Lead Conversion',
  profit_loss: 'Profit & Loss',
  cash_flow: 'Cash Flow',
  accounts_receivable: 'Accounts Receivable',
  teacher_compensation: 'Teacher Compensation',
  custom: 'Custom Report',
}

const TEMPLATE_TO_SCHEDULED_TYPE: Record<string, string> = {
  'attendance-summary': 'attendance',
  'enrollment-trends': 'enrollment',
  'student-performance': 'performance',
  'financial-report': 'revenue',
  'profit-loss': 'profit_loss',
  'cash-flow': 'cash_flow',
  'accounts-receivable': 'accounts_receivable',
  'teacher-compensation': 'teacher_compensation',
}

const FREQUENCY_OPTIONS: Array<{ value: ScheduleFrequency; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const DAY_OF_WEEK_OPTIONS = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
]

const MONEY_KEY_HINTS = [
  'amount',
  'revenue',
  'profit',
  'expense',
  'income',
  'cash',
  'balance',
  'earn',
  'payment',
  'compensation',
  'outstanding',
]

const PERCENT_KEY_HINTS = ['rate', 'percentage', 'margin', 'change']

function getReportIdentifier(report: Report): string {
  return report.report_id || report.id
}

function formatSummaryValue(
  key: string,
  value: unknown,
  formatCurrency: (amountInUzs: number) => string,
): string {
  if (value === null || value === undefined || value === '') return '—'

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    const lowerKey = key.toLowerCase()
    if (PERCENT_KEY_HINTS.some((hint) => lowerKey.includes(hint))) {
      return `${value.toFixed(1)}%`
    }

    if (MONEY_KEY_HINTS.some((hint) => lowerKey.includes(hint))) {
      return formatCurrency(value)
    }

    return value.toLocaleString()
  }

  return String(value)
}

function statusBadge(status: string | undefined): string {
  switch (status) {
    case 'completed':
      return 'bg-success/10 text-success border-success/20'
    case 'failed':
      return 'bg-error/10 text-error border-error/20'
    default:
      return 'bg-warning/10 text-warning border-warning/20'
  }
}

function generationStatusBadge(status: string | undefined): string {
  switch (status) {
    case 'completed':
      return 'bg-success/10 text-success border-success/20'
    case 'failed':
      return 'bg-error/10 text-error border-error/20'
    case 'processing':
      return 'bg-primary/10 text-primary border-primary/20'
    default:
      return 'bg-warning/10 text-warning border-warning/20'
  }
}

function getScheduledReportDisplayName(item: ScheduledReport): string {
  const templateId = typeof item.parameters?.template_id === 'string' ? item.parameters.template_id : null
  if (templateId) {
    const template = REPORT_TEMPLATES.find((entry) => entry.id === templateId)
    if (template) return template.title
  }

  return SCHEDULED_REPORT_TYPE_LABELS[item.report_type] || item.report_type
}

function getGenerationReportDisplayName(item: ReportGeneration): string {
  const templateId = typeof item.parameters?.template_id === 'string' ? item.parameters.template_id : null
  if (templateId) {
    const template = REPORT_TEMPLATES.find((entry) => entry.id === templateId)
    if (template) return template.title
  }

  return SCHEDULED_REPORT_TYPE_LABELS[item.report_type] || item.report_type
}

function SimpleBarChart({ data }: { data: Array<Record<string, unknown>> }) {
  const normalized = data
    .map((item) => ({
      label: String(item.label ?? item.name ?? item.month ?? 'Item'),
      value: Number(item.value ?? 0),
      color: String(item.color ?? '#3b82f6'),
    }))
    .filter((item) => Number.isFinite(item.value))

  if (!normalized.length) {
    return <p className="text-sm text-text-secondary">No chart data available.</p>
  }

  const max = Math.max(1, ...normalized.map((item) => item.value))

  return (
    <div className="space-y-3">
      {normalized.map((item, index) => (
        <div key={`${item.label}-${index}`}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-text-secondary">{item.label}</span>
            <span className="font-semibold">{item.value.toLocaleString()}</span>
          </div>
          <div className="h-2.5 rounded-full bg-border/70">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(4, (item.value / max) * 100)}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function MultiSeriesTable({ data }: { data: Array<Record<string, unknown>> }) {
  const rows = data.slice(0, 8)
  if (!rows.length || typeof rows[0] !== 'object') {
    return <p className="text-sm text-text-secondary">No chart data available.</p>
  }

  const keys = Object.keys(rows[0])
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/80">
            {keys.map((key) => (
              <th key={key} className="px-3 py-2 text-left font-medium capitalize text-text-secondary">
                {key.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border/40">
              {keys.map((key) => (
                <td key={`${index}-${key}`} className="px-3 py-2">
                  {String(row[key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReportPreviewModal({
  report,
  loading,
  onClose,
  onExport,
  onPrint,
  formatCurrency,
}: {
  report: Report | null
  loading: boolean
  onClose: () => void
  onExport: (format: 'csv' | 'json') => Promise<void>
  onPrint: () => void
  formatCurrency: (amountInUzs: number) => string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col rounded-2xl border border-border bg-surface/95 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold">Report Preview</h2>
            {report && (
              <p className="text-sm text-text-secondary">
                {report.title} • {new Date(report.generated_at).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onExport('csv')}
              className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-border/50"
              disabled={loading || !report}
            >
              <span className="flex items-center gap-2">
                <FileDown className="h-4 w-4" />
                CSV
              </span>
            </button>
            <button
              onClick={() => onExport('json')}
              className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-border/50"
              disabled={loading || !report}
            >
              <span className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                JSON
              </span>
            </button>
            <button
              onClick={onPrint}
              className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/20"
              disabled={loading || !report}
            >
              Print
            </button>
            <button onClick={onClose} className="rounded-xl p-2 hover:bg-border/50">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex items-center justify-center py-16 text-text-secondary">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading report details...
            </div>
          )}

          {!loading && !report && (
            <div className="py-16 text-center text-text-secondary">Unable to load report details.</div>
          )}

          {!loading && report && (
            <div className="space-y-6" id="report-preview-content">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-text-secondary">Report ID</p>
                  <p className="mt-1 font-semibold">{getReportIdentifier(report)}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-text-secondary">Type</p>
                  <p className="mt-1 font-semibold capitalize">{(report.type || report.report_type || 'N/A').replace(/-/g, ' ')}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-text-secondary">Period</p>
                  <p className="mt-1 font-semibold capitalize">{report.period}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-text-secondary">Status</p>
                  <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusBadge(report.status)}`}>
                    {report.status || 'completed'}
                  </span>
                </div>
              </div>

              {report.summary && Object.keys(report.summary).length > 0 && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold">Summary</h3>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {Object.entries(report.summary).map(([key, value]) => (
                      <div key={key} className="rounded-xl border border-border bg-background/60 p-3">
                        <p className="text-xs uppercase tracking-wide text-text-secondary">{key.replace(/_/g, ' ')}</p>
                        <p className="mt-1 text-base font-semibold">
                          {formatSummaryValue(key, value, formatCurrency)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.charts && report.charts.length > 0 && (
                <div className="rounded-2xl border border-border bg-background/50 p-4">
                  <h3 className="mb-4 text-lg font-semibold">Charts</h3>
                  <div className="space-y-4">
                    {report.charts.map((chart, index) => {
                      const chartType = String(chart.type || 'table')
                      const chartData = Array.isArray(chart.data) ? chart.data as Array<Record<string, unknown>> : []
                      return (
                        <div key={`${chartType}-${index}`} className="rounded-xl border border-border/70 p-4">
                          <p className="mb-3 text-sm font-medium capitalize text-text-secondary">{chartType} chart</p>
                          {chartType === 'bar' || chartType === 'pie' ? (
                            <SimpleBarChart data={chartData} />
                          ) : (
                            <MultiSeriesTable data={chartData} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {Array.isArray(report.data) && report.data.length > 0 && typeof report.data[0] === 'object' && (
                <div className="rounded-2xl border border-border bg-background/50 p-4">
                  <h3 className="mb-4 text-lg font-semibold">Detailed Data ({report.data.length})</h3>
                  <div className="max-h-[360px] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-surface">
                        <tr className="border-b border-border/80">
                          {Object.keys(report.data[0] as Record<string, unknown>).map((key) => (
                            <th key={key} className="px-3 py-2 text-left font-medium capitalize text-text-secondary">
                              {key.replace(/_/g, ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.data.slice(0, 200).map((row, index) => {
                          const item = row as Record<string, unknown>
                          return (
                            <tr key={index} className="border-b border-border/40">
                              {Object.keys(report.data?.[0] as Record<string, unknown>).map((key) => (
                                <td key={`${index}-${key}`} className="px-3 py-2 align-top">
                                  {String(item[key] ?? '—')}
                                </td>
                              ))}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const { user } = useAuth()
  const permissions = usePermissions(user)
  const { formatCurrency } = useSettings()

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [period, setPeriod] = useState<ReportPeriod>('month')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [previewReportId, setPreviewReportId] = useState<string | null>(null)
  const [activeTemplateId, setActiveTemplateId] = useState<string>(REPORT_TEMPLATES[0].id)
  const [scheduledPage, setScheduledPage] = useState(1)
  const [scheduledLimit, setScheduledLimit] = useState(5)
  const [scheduledEnabledFilter, setScheduledEnabledFilter] = useState<ScheduleEnabledFilter>('all')
  const [scheduledFrequencyFilter, setScheduledFrequencyFilter] = useState('')
  const [scheduledTypeFilter, setScheduledTypeFilter] = useState('')
  const [generationPage, setGenerationPage] = useState(1)
  const [generationLimit, setGenerationLimit] = useState(8)
  const [generationStatusFilter, setGenerationStatusFilter] = useState('')
  const [generationTypeFilter, setGenerationTypeFilter] = useState('')
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>({
    templateId: REPORT_TEMPLATES[0].id,
    frequency: 'daily',
    dayOfWeek: 'monday',
    time: '08:00',
    recipients: '',
    enabled: true,
  })

  const canViewReports = permissions.hasPermission('reports.view')
  const canGenerate = permissions.hasPermission('reports.create')
  const canExport = permissions.hasPermission('reports.export')
  const canManageSchedules = canGenerate

  const reportFilters = useMemo(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      report_type: filterType || undefined,
      status: filterStatus || undefined,
    }),
    [filterStatus, filterType, limit, page, search],
  )

  const {
    data: reportsData,
    isLoading: isLoadingReports,
    isError: isReportsError,
  } = useReports(reportFilters)

  const scheduledFilters = useMemo(
    () => ({
      page: scheduledPage,
      limit: scheduledLimit,
      enabled:
        scheduledEnabledFilter === 'all'
          ? undefined
          : scheduledEnabledFilter === 'enabled',
      frequency: scheduledFrequencyFilter || undefined,
      report_type: scheduledTypeFilter || undefined,
    }),
    [scheduledEnabledFilter, scheduledFrequencyFilter, scheduledLimit, scheduledPage, scheduledTypeFilter],
  )

  const {
    data: scheduledReportsData,
    isLoading: isLoadingScheduledReports,
    isError: isScheduledReportsError,
  } = useScheduledReports(scheduledFilters)

  const generationFilters = useMemo(
    () => ({
      page: generationPage,
      limit: generationLimit,
      status: generationStatusFilter || undefined,
      report_type: generationTypeFilter || undefined,
    }),
    [generationLimit, generationPage, generationStatusFilter, generationTypeFilter],
  )

  const {
    data: reportGenerationData,
    isLoading: isLoadingGenerations,
    isError: isReportGenerationsError,
  } = useReportGenerations(generationFilters)

  const generateReportMutation = useGenerateReport()
  const createScheduledReportMutation = useCreateScheduledReport()
  const toggleScheduledReportMutation = useToggleScheduledReport()
  const deleteScheduledReportMutation = useDeleteScheduledReport()
  const runScheduledReportMutation = useRunScheduledReport()

  const {
    data: previewReport,
    isLoading: isLoadingPreview,
  } = useReport(previewReportId)

  const reportRows = useMemo(() => reportsData?.results ?? [], [reportsData?.results])
  const scheduledRows = useMemo(
    () => scheduledReportsData?.results ?? [],
    [scheduledReportsData?.results],
  )
  const generationRows = useMemo(
    () => reportGenerationData?.results ?? [],
    [reportGenerationData?.results],
  )

  const reportStats = useMemo(() => {
    const completed = reportRows.filter((item) => item.status === 'completed').length
    const failed = reportRows.filter((item) => item.status === 'failed').length
    const latestGeneratedAt = reportRows[0]?.generated_at

    return {
      total: reportsData?.count || 0,
      completed,
      failed,
      latestGeneratedAt,
    }
  }, [reportRows, reportsData?.count])

  const activeTemplate = useMemo(
    () => REPORT_TEMPLATES.find((template) => template.id === activeTemplateId) || REPORT_TEMPLATES[0],
    [activeTemplateId],
  )

  const handleGenerate = async (templateId?: string) => {
    const targetTemplate = templateId || activeTemplate.id

    if (!canGenerate) {
      toast.error('You do not have permission to generate reports.')
      return
    }

    try {
      const generated = await generateReportMutation.mutateAsync({
        reportType: targetTemplate,
        options: {
          period,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        },
      })

      const generatedId = getReportIdentifier(generated)
      setPreviewReportId(generatedId)
      toast.success('Report generated and saved successfully.')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to generate report.')
    }
  }

  const handleCreateScheduledReport = async () => {
    if (!canManageSchedules) {
      toast.error('You do not have permission to schedule reports.')
      return
    }

    if (!scheduleForm.recipients.trim()) {
      toast.error('Please add at least one recipient email.')
      return
    }

    const mappedReportType = TEMPLATE_TO_SCHEDULED_TYPE[scheduleForm.templateId] || 'custom'
    const selectedTemplate = REPORT_TEMPLATES.find((item) => item.id === scheduleForm.templateId)

    try {
      await createScheduledReportMutation.mutateAsync({
        report_type: mappedReportType,
        frequency: scheduleForm.frequency,
        day_of_week: scheduleForm.frequency === 'weekly' ? scheduleForm.dayOfWeek : null,
        time: scheduleForm.time,
        recipients: scheduleForm.recipients,
        enabled: scheduleForm.enabled,
        parameters: {
          template_id: scheduleForm.templateId,
          template_title: selectedTemplate?.title || scheduleForm.templateId,
          period,
          start_date: startDate || null,
          end_date: endDate || null,
        },
      })

      toast.success('Scheduled report created.')
      setScheduledPage(1)
      setScheduleForm((prev) => ({
        ...prev,
        recipients: '',
      }))
    } catch {
      // Error toast is handled by mutation hook.
    }
  }

  const handleToggleScheduledReport = async (id: number) => {
    if (!canManageSchedules) {
      toast.error('You do not have permission to manage schedules.')
      return
    }

    try {
      await toggleScheduledReportMutation.mutateAsync(id)
      toast.success('Schedule status updated.')
    } catch {
      // Error toast is handled by mutation hook.
    }
  }

  const handleRunScheduledReportNow = async (id: number) => {
    if (!canManageSchedules) {
      toast.error('You do not have permission to manage schedules.')
      return
    }

    try {
      const response = await runScheduledReportMutation.mutateAsync(id)
      toast.success(response?.message || 'Report generation triggered.')
      setGenerationPage(1)
    } catch {
      // Error toast is handled by mutation hook.
    }
  }

  const handleDeleteScheduledReport = async (id: number) => {
    if (!canManageSchedules) {
      toast.error('You do not have permission to manage schedules.')
      return
    }

    const confirmed = window.confirm('Delete this scheduled report?')
    if (!confirmed) return

    try {
      await deleteScheduledReportMutation.mutateAsync(id)
      toast.success('Scheduled report deleted.')
    } catch {
      // Error toast is handled by mutation hook.
    }
  }

  const handleDownload = async (report: Report, format: 'csv' | 'json') => {
    if (!canExport) {
      toast.error('You do not have permission to export reports.')
      return
    }

    const reportId = getReportIdentifier(report)

    try {
      const blob = await apiService.downloadReport(reportId, format)
      const fileUrl = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = fileUrl
      anchor.download = `${reportId}.${format}`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(fileUrl)
      toast.success(`Report downloaded as ${format.toUpperCase()}.`)
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to download report.')
    }
  }

  const handlePrintReport = () => {
    if (!previewReport) return

    const summaryRows = Object.entries(previewReport.summary || {})
      .map(
        ([key, value]) =>
          `<tr><td style="padding:6px 8px;border:1px solid #ddd;">${key.replace(/_/g, ' ')}</td><td style="padding:6px 8px;border:1px solid #ddd;">${formatSummaryValue(key, value, formatCurrency)}</td></tr>`,
      )
      .join('')

    const previewWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700')
    if (!previewWindow) {
      toast.error('Please allow popups for printing.')
      return
    }

    previewWindow.document.write(`
      <html>
        <head>
          <title>${previewReport.title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { font-size: 22px; margin-bottom: 4px; }
            .meta { color: #555; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th { text-align:left; background: #f3f4f6; padding: 8px; border:1px solid #ddd; }
            td { padding: 8px; border:1px solid #ddd; }
          </style>
        </head>
        <body>
          <h1>${previewReport.title}</h1>
          <div class="meta">Report ID: ${getReportIdentifier(previewReport)} • ${new Date(previewReport.generated_at).toLocaleString()}</div>
          <h3>Summary</h3>
          <table>
            <tbody>${summaryRows || '<tr><td>No summary data</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `)

    previewWindow.document.close()
    previewWindow.focus()
    previewWindow.print()
  }

  if (isLoadingReports) {
    return <LoadingScreen message="Loading reports workspace..." />
  }

  if (!canViewReports) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-error/30 bg-error/10 px-6 py-5 text-center">
          <p className="mb-1 text-lg font-semibold text-error">Access denied</p>
          <p className="text-sm text-text-secondary">Your role cannot open reports.</p>
        </div>
      </div>
    )
  }

  if (isReportsError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-error/30 bg-error/10 px-6 py-5 text-center">
          <p className="mb-1 text-lg font-semibold text-error">Unable to load reports</p>
          <p className="text-sm text-text-secondary">Please refresh and try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-border bg-surface/90 p-6 backdrop-blur-md">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-3xl font-bold">
                <Sparkles className="h-7 w-7 text-primary" />
                Reports Command Center
              </h1>
              <p className="mt-1 text-text-secondary">
                Generate, audit, and export operational reports with persisted history from backend truth.
              </p>
            </div>
            <button
              onClick={() => handleGenerate()}
              disabled={!canGenerate || generateReportMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generateReportMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Generate {activeTemplate.title}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-border bg-background/60 p-4">
              <p className="text-xs uppercase tracking-wide text-text-secondary">Total reports</p>
              <p className="mt-2 text-2xl font-bold">{reportStats.total}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/60 p-4">
              <p className="text-xs uppercase tracking-wide text-text-secondary">Completed (page)</p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-success">
                <CheckCircle2 className="h-5 w-5" />
                {reportStats.completed}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/60 p-4">
              <p className="text-xs uppercase tracking-wide text-text-secondary">Failed (page)</p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-error">
                <AlertCircle className="h-5 w-5" />
                {reportStats.failed}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/60 p-4">
              <p className="text-xs uppercase tracking-wide text-text-secondary">Latest generated</p>
              <p className="mt-2 text-sm font-semibold">
                {reportStats.latestGeneratedAt
                  ? new Date(reportStats.latestGeneratedAt).toLocaleString()
                  : 'No reports yet'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="rounded-2xl border border-border bg-surface/90 p-5 backdrop-blur-md xl:col-span-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Generator</h2>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
                {PERIOD_LABELS[period]}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Quick period</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['week', 'month', 'quarter', 'year'] as ReportPeriod[]).map((periodKey) => (
                    <button
                      key={periodKey}
                      onClick={() => setPeriod(periodKey)}
                      className={`rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                        period === periodKey
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border hover:bg-border/40'
                      }`}
                    >
                      {periodKey}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-sm text-text-secondary">Start date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-text-secondary">End date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border/80 bg-background/50 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xl">{activeTemplate.icon}</span>
                  <p className="font-semibold">{activeTemplate.title}</p>
                </div>
                <p className="text-sm text-text-secondary">{activeTemplate.description}</p>
                <button
                  onClick={() => handleGenerate(activeTemplate.id)}
                  disabled={!canGenerate || generateReportMutation.isPending}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generateReportMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {activeTemplate.cta}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface/90 p-5 backdrop-blur-md xl:col-span-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Report Templates</h2>
              <p className="text-sm text-text-secondary">Pick a template, configure range, then generate.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {REPORT_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setActiveTemplateId(template.id)}
                  className={`rounded-xl border bg-gradient-to-r p-4 text-left transition-all hover:shadow-lg ${template.accent} ${
                    activeTemplateId === template.id
                      ? 'ring-1 ring-primary/60'
                      : 'border-border/70'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-2xl">{template.icon}</span>
                    {activeTemplateId === template.id && (
                      <span className="rounded-full border border-primary/40 bg-primary/20 px-2 py-0.5 text-xs text-primary">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="font-semibold">{template.title}</p>
                  <p className="mt-1 text-sm text-text-secondary">{template.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="rounded-2xl border border-border bg-surface/90 p-5 backdrop-blur-md xl:col-span-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <CalendarClock className="h-5 w-5 text-primary" />
                Scheduled Reports
              </h2>
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-text-secondary">
                Backend synced
              </span>
            </div>

            <div className="space-y-3 rounded-xl border border-border/70 bg-background/50 p-4">
              {!canManageSchedules && (
                <div className="rounded-lg border border-border/70 bg-background/70 p-3 text-sm text-text-secondary">
                  Schedule management is read-only for your role.
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-wide text-text-secondary">Template</label>
                  <select
                    value={scheduleForm.templateId}
                    onChange={(event) =>
                      setScheduleForm((prev) => ({ ...prev, templateId: event.target.value }))
                    }
                    disabled={!canManageSchedules}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {REPORT_TEMPLATES.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-wide text-text-secondary">Frequency</label>
                  <select
                    value={scheduleForm.frequency}
                    onChange={(event) =>
                      setScheduleForm((prev) => ({ ...prev, frequency: event.target.value as ScheduleFrequency }))
                    }
                    disabled={!canManageSchedules}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {FREQUENCY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {scheduleForm.frequency === 'weekly' && (
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-text-secondary">Day</label>
                    <select
                      value={scheduleForm.dayOfWeek}
                      onChange={(event) =>
                        setScheduleForm((prev) => ({ ...prev, dayOfWeek: event.target.value }))
                      }
                      disabled={!canManageSchedules}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {DAY_OF_WEEK_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-wide text-text-secondary">Time</label>
                  <input
                    type="time"
                    value={scheduleForm.time}
                    onChange={(event) =>
                      setScheduleForm((prev) => ({ ...prev, time: event.target.value }))
                    }
                    disabled={!canManageSchedules}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
                <label className="mt-6 inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={scheduleForm.enabled}
                    onChange={(event) =>
                      setScheduleForm((prev) => ({ ...prev, enabled: event.target.checked }))
                    }
                    disabled={!canManageSchedules}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  Enabled
                </label>
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-text-secondary">Recipients</label>
                <input
                  value={scheduleForm.recipients}
                  onChange={(event) =>
                    setScheduleForm((prev) => ({ ...prev, recipients: event.target.value }))
                  }
                  placeholder="finance@school.uz, owner@school.uz"
                  disabled={!canManageSchedules}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <button
                onClick={handleCreateScheduledReport}
                disabled={!canManageSchedules || createScheduledReportMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createScheduledReportMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Save schedule
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <select
                value={scheduledEnabledFilter}
                onChange={(event) => {
                  setScheduledPage(1)
                  setScheduledEnabledFilter(event.target.value as ScheduleEnabledFilter)
                }}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="all">All status</option>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
              <select
                value={scheduledFrequencyFilter}
                onChange={(event) => {
                  setScheduledPage(1)
                  setScheduledFrequencyFilter(event.target.value)
                }}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="">All frequencies</option>
                {FREQUENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={scheduledTypeFilter}
                onChange={(event) => {
                  setScheduledPage(1)
                  setScheduledTypeFilter(event.target.value)
                }}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="">All types</option>
                {Object.entries(SCHEDULED_REPORT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {isScheduledReportsError && (
              <p className="mt-3 text-sm text-error">Failed to load scheduled reports.</p>
            )}

            <div className="mt-3 overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-background/70">
                  <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-text-secondary">
                    <th className="px-3 py-2">Report</th>
                    <th className="px-3 py-2">Schedule</th>
                    <th className="px-3 py-2">Recipients</th>
                    <th className="px-3 py-2">Next run</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingScheduledReports && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-text-secondary">
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading schedules...
                        </span>
                      </td>
                    </tr>
                  )}
                  {!isLoadingScheduledReports && scheduledRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-text-secondary">
                        No scheduled reports found.
                      </td>
                    </tr>
                  )}
                  {scheduledRows.map((item) => (
                    <tr key={item.id} className="border-b border-border/40 hover:bg-background/30">
                      <td className="px-3 py-3">
                        <p className="font-medium">{getScheduledReportDisplayName(item)}</p>
                        <p className="text-xs text-text-secondary">#{item.id}</p>
                      </td>
                      <td className="px-3 py-3 text-text-secondary">
                        <p className="capitalize">{item.frequency}</p>
                        {item.day_of_week && <p className="text-xs capitalize">{item.day_of_week}</p>}
                      </td>
                      <td className="px-3 py-3 text-text-secondary">
                        <p className="line-clamp-2">{item.recipients_list?.join(', ') || item.recipients}</p>
                      </td>
                      <td className="px-3 py-3 text-text-secondary">
                        {item.next_run ? new Date(item.next_run).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleRunScheduledReportNow(item.id)}
                            disabled={!canManageSchedules || runScheduledReportMutation.isPending}
                            className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-border/50 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Run now"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleScheduledReport(item.id)}
                            disabled={!canManageSchedules || toggleScheduledReportMutation.isPending}
                            className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-border/50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {item.enabled ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => handleDeleteScheduledReport(item.id)}
                            disabled={!canManageSchedules || deleteScheduledReportMutation.isPending}
                            className="rounded-lg border border-error/40 px-2 py-1 text-xs text-error hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {scheduledReportsData && scheduledReportsData.count > scheduledLimit && (
              <div className="mt-3">
                <PaginationControls
                  totalItems={scheduledReportsData.count}
                  itemsPerPage={scheduledLimit}
                  currentPage={scheduledPage}
                  onPageChange={setScheduledPage}
                  onItemsPerPageChange={setScheduledLimit}
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-surface/90 p-5 backdrop-blur-md xl:col-span-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Report Generation History</h2>
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-text-secondary">
                Live backend records
              </span>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select
                value={generationStatusFilter}
                onChange={(event) => {
                  setGenerationPage(1)
                  setGenerationStatusFilter(event.target.value)
                }}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
              <select
                value={generationTypeFilter}
                onChange={(event) => {
                  setGenerationPage(1)
                  setGenerationTypeFilter(event.target.value)
                }}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="">All types</option>
                {Object.entries(SCHEDULED_REPORT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {isReportGenerationsError && (
              <p className="mb-3 text-sm text-error">Failed to load generation history.</p>
            )}

            <div className="overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="bg-background/70">
                  <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-text-secondary">
                    <th className="px-3 py-2">Report</th>
                    <th className="px-3 py-2">Started</th>
                    <th className="px-3 py-2">Duration</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingGenerations && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-text-secondary">
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading generation history...
                        </span>
                      </td>
                    </tr>
                  )}
                  {!isLoadingGenerations && generationRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-text-secondary">
                        No generation records yet.
                      </td>
                    </tr>
                  )}
                  {generationRows.map((item) => (
                    <tr key={item.id} className="border-b border-border/40 hover:bg-background/30">
                      <td className="px-3 py-3">
                        <p className="font-medium">{getGenerationReportDisplayName(item)}</p>
                        <p className="text-xs text-text-secondary">
                          {item.scheduled_report_info?.frequency || 'manual trigger'}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-text-secondary">
                        {new Date(item.started_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-text-secondary">
                        {item.duration ? `${item.duration}s` : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${generationStatusBadge(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-text-secondary">
                        {item.error_message || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {reportGenerationData && reportGenerationData.count > generationLimit && (
              <div className="mt-3">
                <PaginationControls
                  totalItems={reportGenerationData.count}
                  itemsPerPage={generationLimit}
                  currentPage={generationPage}
                  onPageChange={setGenerationPage}
                  onItemsPerPageChange={setGenerationLimit}
                />
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface/90 p-5 backdrop-blur-md">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-xl font-semibold">Generated Reports</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                <input
                  value={search}
                  onChange={(event) => {
                    setPage(1)
                    setSearch(event.target.value)
                  }}
                  placeholder="Search title / report ID"
                  className="w-56 rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <select
                value={filterType}
                onChange={(event) => {
                  setPage(1)
                  setFilterType(event.target.value)
                }}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="">All types</option>
                {REPORT_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(event) => {
                  setPage(1)
                  setFilterStatus(event.target.value)
                }}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="">All statuses</option>
                <option value="completed">Completed</option>
                <option value="generating">Generating</option>
                <option value="failed">Failed</option>
              </select>

              <button
                onClick={() => {
                  setPage(1)
                  setSearch('')
                  setFilterType('')
                  setFilterStatus('')
                }}
                className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-border/50"
              >
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Reset
                </span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px]">
              <thead>
                <tr className="border-b border-border/80 text-left text-xs uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-3">Report</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Period</th>
                  <th className="px-3 py-3">Generated</th>
                  <th className="px-3 py-3">By</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-12 text-center text-text-secondary">
                      <div className="mb-2 flex items-center justify-center">
                        <FileText className="h-10 w-10 opacity-40" />
                      </div>
                      No reports found for current filters.
                    </td>
                  </tr>
                )}

                {reportRows.map((report) => (
                  <tr key={getReportIdentifier(report)} className="border-b border-border/40 hover:bg-background/40">
                    <td className="px-3 py-3">
                      <p className="font-medium">{report.title || 'Untitled report'}</p>
                      <p className="text-xs text-text-secondary">ID: {getReportIdentifier(report)}</p>
                    </td>
                    <td className="px-3 py-3 text-sm capitalize text-text-secondary">
                      {(report.type || report.report_type || 'N/A').replace(/-/g, ' ')}
                    </td>
                    <td className="px-3 py-3 text-sm text-text-secondary capitalize">
                      {report.period}
                    </td>
                    <td className="px-3 py-3 text-sm text-text-secondary">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        {new Date(report.generated_at).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-text-secondary">
                      {report.generated_by_name || 'System'}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusBadge(report.status)}`}>
                        {report.status || 'completed'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setPreviewReportId(getReportIdentifier(report))}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-border/50"
                        >
                          <span className="flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            Preview
                          </span>
                        </button>
                        <button
                          onClick={() => handleDownload(report, 'csv')}
                          disabled={!canExport}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-border/50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="flex items-center gap-1">
                            <Download className="h-3.5 w-3.5" />
                            CSV
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {reportsData && reportsData.count > limit && (
            <div className="mt-4">
              <PaginationControls
                totalItems={reportsData.count}
                itemsPerPage={limit}
                currentPage={page}
                onPageChange={setPage}
                onItemsPerPageChange={setLimit}
              />
            </div>
          )}
        </div>
      </div>

      {previewReportId && (
        <ReportPreviewModal
          report={previewReport || null}
          loading={isLoadingPreview}
          onClose={() => setPreviewReportId(null)}
          onExport={async (format) => {
            if (!previewReport) return
            await handleDownload(previewReport, format)
          }}
          onPrint={handlePrintReport}
          formatCurrency={formatCurrency}
        />
      )}
    </div>
  )
}
