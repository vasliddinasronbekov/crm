'use client'

import { useState, useEffect } from 'react'
import {
  FileText, Download, Calendar, Filter, TrendingUp, Users,
  DollarSign, BookOpen, Award, BarChart3, PieChart, LineChart,
  ArrowUp, ArrowDown, Eye, X, Trash2
} from 'lucide-react'
import { useReports, Report, PaginatedResponse } from '@/lib/hooks/useAnalytics'
import { useGenerateReport } from '@/lib/hooks/useAnalytics'
import toast from '@/lib/toast'
import { useSettings } from '@/contexts/SettingsContext'
import PaginationControls from '@/components/PaginationControls' // Assuming this component exists
import LoadingScreen from '@/components/LoadingScreen'

interface ReportData {
  id: string
  type: string
  title: string
  generated_at: string
  period: string
  summary: {
    total?: number
    average?: number
    change?: number
    [key: string]: any
  }
  data: any[]
  charts?: {
    type: string
    data: any[]
  }[]
}

const reportTypes = [
  {
    id: 'student-performance',
    title: 'Student Performance Report',
    description: 'Detailed analysis of student grades and progress',
    icon: '📊',
    color: 'blue',
  },
  {
    id: 'attendance-summary',
    title: 'Attendance Summary',
    description: 'Overview of attendance rates by group and student',
    icon: '✅',
    color: 'green',
  },
  {
    id: 'financial-report',
    title: 'Financial Report',
    description: 'Revenue, expenses, and payment tracking',
    icon: '💰',
    color: 'yellow',
  },
  {
    id: 'profit-loss-statement',
    title: 'Profit & Loss Statement',
    description: 'Comprehensive P&L with revenue and expense breakdown',
    icon: '💼',
    color: 'emerald',
  },
  {
    id: 'cash-flow-statement',
    title: 'Cash Flow Statement',
    description: 'Operating, investing, and financing cash flows',
    icon: '💵',
    color: 'teal',
  },
  {
    id: 'accounts-receivable',
    title: 'Accounts Receivable Report',
    description: 'Outstanding balances and aging analysis',
    icon: '📋',
    color: 'orange',
  },
  {
    id: 'teacher-compensation',
    title: 'Teacher Compensation Report',
    description: 'Earnings, payments, and pending amounts by teacher',
    icon: '👨‍💼',
    color: 'violet',
  },
  {
    id: 'teacher-workload',
    title: 'Teacher Workload',
    description: 'Teaching hours and group assignments',
    icon: '👨‍🏫',
    color: 'purple',
  },
  {
    id: 'course-completion',
    title: 'Course Completion',
    description: 'Completion rates and timelines by course',
    icon: '🎓',
    color: 'indigo',
  },
  {
    id: 'enrollment-trends',
    title: 'Enrollment Trends',
    description: 'Historical enrollment data and forecasting',
    icon: '📈',
    color: 'pink',
  },
]

export default function ReportsPage() {
  const { formatCurrency } = useSettings()
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const [selectedReportType, setSelectedReportType] = useState<string | null>(null)
  const [currentReport, setCurrentReport] = useState<ReportData | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [isGenerating, setIsGenerating] = useState(false)
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  })
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [scheduleConfig, setScheduleConfig] = useState({
    reportType: '',
    frequency: 'weekly',
    dayOfWeek: 'monday',
    time: '09:00',
    recipients: '',
    enabled: true
  })
  const [scheduledReports, setScheduledReports] = useState<any[]>([])
  const [compareMode, setCompareMode] = useState(false)
  const [comparisonReport, setComparisonReport] = useState<ReportData | null>(null)

  const { data: reportsData, isLoading: isLoadingReports, isError: isReportsError } = useReports({ page, limit })
  const generateReportMutation = useGenerateReport()

  useEffect(() => {
    // Set default date range to last month
    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - 1)
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    })
  }, [])

  const handleGenerateReport = async (reportType: string) => {
    setIsGenerating(true)
    setSelectedReportType(reportType)

    try {
      const response = await generateReportMutation.mutateAsync({
        reportType,
        options: {
          period: selectedPeriod,
          start_date: dateRange.start,
          end_date: dateRange.end
        }
      })

      // Use real data from backend
      setCurrentReport(response as ReportData)
      toast.success('Report generated successfully!')
      // The useGenerateReport hook already invalidates queries, so no need to manually refetch
    } catch (error: any) {
      console.error('Failed to generate report:', error)
      toast.error(error.response?.data?.detail || 'Failed to generate report. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const generateMockReportData = (type: string, period: string): ReportData => {
    const now = new Date()

    switch (type) {
      case 'student-performance':
        return {
          id: `report-${Date.now()}`,
          type,
          title: 'Student Performance Report',
          generated_at: now.toISOString(),
          period,
          summary: {
            total_students: 245,
            average_score: 78.5,
            passing_rate: 85.3,
            change: 5.2,
            top_performers: 45,
            needs_attention: 12
          },
          data: [
            { student_name: 'John Doe', course: 'Mathematics', score: 92, grade: 'A', attendance: '95%' },
            { student_name: 'Jane Smith', course: 'Physics', score: 88, grade: 'B+', attendance: '90%' },
            { student_name: 'Bob Johnson', course: 'Chemistry', score: 75, grade: 'C+', attendance: '85%' },
            { student_name: 'Alice Brown', course: 'Biology', score: 95, grade: 'A', attendance: '98%' },
            { student_name: 'Charlie Davis', course: 'Mathematics', score: 82, grade: 'B', attendance: '92%' },
            { student_name: 'Diana Wilson', course: 'Physics', score: 78, grade: 'C+', attendance: '88%' },
            { student_name: 'Eve Martinez', course: 'Chemistry', score: 91, grade: 'A-', attendance: '96%' },
            { student_name: 'Frank Garcia', course: 'Biology', score: 85, grade: 'B', attendance: '91%' },
          ],
          charts: [
            {
              type: 'bar',
              data: [
                { label: 'A (90-100)', value: 45, color: '#10b981' },
                { label: 'B (80-89)', value: 78, color: '#3b82f6' },
                { label: 'C (70-79)', value: 85, color: '#f59e0b' },
                { label: 'D (60-69)', value: 25, color: '#ef4444' },
                { label: 'F (0-59)', value: 12, color: '#dc2626' },
              ]
            }
          ]
        }

      case 'attendance-summary':
        return {
          id: `report-${Date.now()}`,
          type,
          title: 'Attendance Summary Report',
          generated_at: now.toISOString(),
          period,
          summary: {
            total_classes: 450,
            average_attendance: 87.3,
            perfect_attendance: 56,
            change: 2.1,
            total_students: 245
          },
          data: [
            { group: 'Group A - Mathematics', total_classes: 20, attended: 18, rate: '90%', students: 25 },
            { group: 'Group B - Physics', total_classes: 20, attended: 17, rate: '85%', students: 22 },
            { group: 'Group C - Chemistry', total_classes: 20, attended: 19, rate: '95%', students: 28 },
            { group: 'Group D - Biology', total_classes: 20, attended: 16, rate: '80%', students: 20 },
            { group: 'Group E - English', total_classes: 20, attended: 18, rate: '90%', students: 30 },
            { group: 'Group F - History', total_classes: 20, attended: 17, rate: '85%', students: 24 },
          ],
          charts: [
            {
              type: 'line',
              data: [
                { label: 'Week 1', value: 85 },
                { label: 'Week 2', value: 87 },
                { label: 'Week 3', value: 89 },
                { label: 'Week 4', value: 88 },
              ]
            }
          ]
        }

      case 'financial-report':
        return {
          id: `report-${Date.now()}`,
          type,
          title: 'Financial Report',
          generated_at: now.toISOString(),
          period,
          summary: {
            total_revenue: 125400,
            total_expenses: 45200,
            net_profit: 80200,
            change: 12.5,
            pending_payments: 15600
          },
          data: [
            { category: 'Tuition Fees', revenue: 95000, expenses: 0, net: 95000, percentage: '75.8%' },
            { category: 'Course Materials', revenue: 12400, expenses: 8500, net: 3900, percentage: '9.9%' },
            { category: 'Salaries', revenue: 0, expenses: 28000, net: -28000, percentage: '22.3%' },
            { category: 'Facilities', revenue: 8000, expenses: 4200, net: 3800, percentage: '3.0%' },
            { category: 'Marketing', revenue: 5000, expenses: 2500, net: 2500, percentage: '2.0%' },
            { category: 'Other', revenue: 5000, expenses: 2000, net: 3000, percentage: '2.4%' },
          ],
          charts: [
            {
              type: 'pie',
              data: [
                { label: 'Revenue', value: 125400, color: '#10b981' },
                { label: 'Expenses', value: 45200, color: '#ef4444' },
              ]
            }
          ]
        }

      case 'teacher-workload':
        return {
          id: `report-${Date.now()}`,
          type,
          title: 'Teacher Workload Report',
          generated_at: now.toISOString(),
          period,
          summary: {
            total_teachers: 28,
            average_hours: 32.5,
            total_groups: 45,
            change: -1.2
          },
          data: [
            { teacher_name: 'Dr. Smith', groups: 3, students: 75, hours_week: 35, subjects: 'Math, Physics' },
            { teacher_name: 'Prof. Johnson', groups: 4, students: 98, hours_week: 40, subjects: 'Chemistry' },
            { teacher_name: 'Ms. Williams', groups: 2, students: 52, hours_week: 28, subjects: 'Biology' },
            { teacher_name: 'Mr. Brown', groups: 3, students: 68, hours_week: 33, subjects: 'English' },
            { teacher_name: 'Dr. Davis', groups: 2, students: 45, hours_week: 25, subjects: 'History' },
          ],
          charts: [
            {
              type: 'bar',
              data: [
                { label: 'Dr. Smith', value: 35 },
                { label: 'Prof. Johnson', value: 40 },
                { label: 'Ms. Williams', value: 28 },
                { label: 'Mr. Brown', value: 33 },
                { label: 'Dr. Davis', value: 25 },
              ]
            }
          ]
        }

      case 'course-completion':
        return {
          id: `report-${Date.now()}`,
          type,
          title: 'Course Completion Report',
          generated_at: now.toISOString(),
          period,
          summary: {
            total_courses: 24,
            completion_rate: 78.5,
            completed_students: 192,
            change: 8.3,
            in_progress: 53
          },
          data: [
            { course: 'Web Development', enrolled: 45, completed: 38, in_progress: 5, dropped: 2, rate: '84%' },
            { course: 'Data Science', enrolled: 38, completed: 28, in_progress: 8, dropped: 2, rate: '74%' },
            { course: 'Mobile Development', enrolled: 32, completed: 25, in_progress: 6, dropped: 1, rate: '78%' },
            { course: 'UI/UX Design', enrolled: 28, completed: 24, in_progress: 3, dropped: 1, rate: '86%' },
            { course: 'Digital Marketing', enrolled: 35, completed: 30, in_progress: 4, dropped: 1, rate: '86%' },
          ],
          charts: [
            {
              type: 'bar',
              data: [
                { label: 'Completed', value: 192, color: '#10b981' },
                { label: 'In Progress', value: 53, color: '#3b82f6' },
                { label: 'Dropped', value: 10, color: '#ef4444' },
              ]
            }
          ]
        }

      case 'enrollment-trends':
        return {
          id: `report-${Date.now()}`,
          type,
          title: 'Enrollment Trends Report',
          generated_at: now.toISOString(),
          period,
          summary: {
            total_enrollments: 312,
            average_monthly: 78,
            growth_rate: 15.2,
            change: 15.2,
            projected_next_month: 90
          },
          data: [
            { month: 'January', enrollments: 65, revenue: 32500, courses: 8 },
            { month: 'February', enrollments: 72, revenue: 36000, courses: 9 },
            { month: 'March', enrollments: 68, revenue: 34000, courses: 8 },
            { month: 'April', enrollments: 78, revenue: 39000, courses: 10 },
            { month: 'May', enrollments: 82, revenue: 41000, courses: 11 },
            { month: 'June', enrollments: 90, revenue: 45000, courses: 12 },
          ],
          charts: [
            {
              type: 'line',
              data: [
                { label: 'Jan', value: 65 },
                { label: 'Feb', value: 72 },
                { label: 'Mar', value: 68 },
                { label: 'Apr', value: 78 },
                { label: 'May', value: 82 },
                { label: 'Jun', value: 90 },
              ]
            }
          ]
        }

      case 'profit-loss-statement':
        return {
          id: `report-${Date.now()}`,
          type,
          title: 'Profit & Loss Statement',
          generated_at: now.toISOString(),
          period,
          summary: {
            total_revenue: 185400,
            total_expenses: 89600,
            gross_profit: 95800,
            net_profit: 95800,
            profit_margin: '51.7%',
            change: 8.5
          },
          data: [
            { category: 'Revenue', subcategory: 'Tuition Fees', amount: 145000, percentage: '78.2%' },
            { category: 'Revenue', subcategory: 'Course Materials', amount: 18400, percentage: '9.9%' },
            { category: 'Revenue', subcategory: 'Registration Fees', amount: 12000, percentage: '6.5%' },
            { category: 'Revenue', subcategory: 'Other Income', amount: 10000, percentage: '5.4%' },
            { category: 'Expenses', subcategory: 'Teacher Salaries', amount: 52000, percentage: '58.0%' },
            { category: 'Expenses', subcategory: 'Facility Rent', amount: 18000, percentage: '20.1%' },
            { category: 'Expenses', subcategory: 'Marketing', amount: 8600, percentage: '9.6%' },
            { category: 'Expenses', subcategory: 'Utilities', amount: 6000, percentage: '6.7%' },
            { category: 'Expenses', subcategory: 'Supplies', amount: 5000, percentage: '5.6%' },
          ],
          charts: [
            {
              type: 'bar',
              data: [
                { label: 'Revenue', value: 185400, color: '#10b981' },
                { label: 'Expenses', value: 89600, color: '#ef4444' },
                { label: 'Net Profit', value: 95800, color: '#3b82f6' },
              ]
            }
          ]
        }

      case 'cash-flow-statement':
        return {
          id: `report-${Date.now()}`,
          type,
          title: 'Cash Flow Statement',
          generated_at: now.toISOString(),
          period,
          summary: {
            operating_cash_flow: 78500,
            investing_cash_flow: -15000,
            financing_cash_flow: 5000,
            net_cash_flow: 68500,
            beginning_cash: 45000,
            ending_cash: 113500,
            change: 12.3
          },
          data: [
            { activity: 'Operating Activities', item: 'Cash from Tuition', amount: 142000, type: 'inflow' },
            { activity: 'Operating Activities', item: 'Cash from Fees', amount: 28000, type: 'inflow' },
            { activity: 'Operating Activities', item: 'Teacher Salaries Paid', amount: -52000, type: 'outflow' },
            { activity: 'Operating Activities', item: 'Rent Paid', amount: -18000, type: 'outflow' },
            { activity: 'Operating Activities', item: 'Operating Expenses', amount: -21500, type: 'outflow' },
            { activity: 'Investing Activities', item: 'Equipment Purchase', amount: -12000, type: 'outflow' },
            { activity: 'Investing Activities', item: 'Software Licenses', amount: -3000, type: 'outflow' },
            { activity: 'Financing Activities', item: 'Owner Investment', amount: 5000, type: 'inflow' },
          ],
          charts: [
            {
              type: 'bar',
              data: [
                { label: 'Operating', value: 78500, color: '#10b981' },
                { label: 'Investing', value: -15000, color: '#ef4444' },
                { label: 'Financing', value: 5000, color: '#3b82f6' },
              ]
            }
          ]
        }

      case 'accounts-receivable':
        return {
          id: `report-${Date.now()}`,
          type,
          title: 'Accounts Receivable Report',
          generated_at: now.toISOString(),
          period,
          summary: {
            total_outstanding: 45600,
            current_0_30_days: 28400,
            overdue_31_60_days: 10200,
            overdue_61_90_days: 4500,
            overdue_90_plus_days: 2500,
            collection_rate: '87.5%',
            change: -3.2
          },
          data: [
            { student: 'John Doe', group: 'Math A', balance: 850, days_overdue: 15, status: 'Current' },
            { student: 'Jane Smith', group: 'Physics B', balance: 1200, days_overdue: 45, status: '31-60 Days' },
            { student: 'Bob Johnson', group: 'Chemistry C', balance: 650, days_overdue: 8, status: 'Current' },
            { student: 'Alice Brown', group: 'Biology A', balance: 2100, days_overdue: 75, status: '61-90 Days' },
            { student: 'Charlie Davis', group: 'English A', balance: 950, days_overdue: 22, status: 'Current' },
            { student: 'Diana Wilson', group: 'Math B', balance: 1500, days_overdue: 105, status: '90+ Days' },
            { student: 'Eve Martinez', group: 'Physics A', balance: 750, days_overdue: 12, status: 'Current' },
            { student: 'Frank Garcia', group: 'Chemistry A', balance: 1100, days_overdue: 52, status: '31-60 Days' },
          ],
          charts: [
            {
              type: 'pie',
              data: [
                { label: 'Current (0-30)', value: 28400, color: '#10b981' },
                { label: '31-60 Days', value: 10200, color: '#f59e0b' },
                { label: '61-90 Days', value: 4500, color: '#ef4444' },
                { label: '90+ Days', value: 2500, color: '#dc2626' },
              ]
            }
          ]
        }

      case 'teacher-compensation':
        return {
          id: `report-${Date.now()}`,
          type,
          title: 'Teacher Compensation Report',
          generated_at: now.toISOString(),
          period,
          summary: {
            total_earned: 58000,
            total_paid: 52000,
            total_pending: 6000,
            average_earning: 2071,
            highest_earner: 4500,
            change: 5.8
          },
          data: [
            { teacher: 'Dr. Smith', groups: 3, students: 75, earned: 4500, paid: 4500, pending: 0, status: 'Paid' },
            { teacher: 'Prof. Johnson', groups: 4, students: 98, earned: 5200, paid: 5200, pending: 0, status: 'Paid' },
            { teacher: 'Ms. Williams', groups: 2, students: 52, earned: 3100, paid: 2400, pending: 700, status: 'Partial' },
            { teacher: 'Mr. Brown', groups: 3, students: 68, earned: 3800, paid: 3800, pending: 0, status: 'Paid' },
            { teacher: 'Dr. Davis', groups: 2, students: 45, earned: 2600, paid: 2600, pending: 0, status: 'Paid' },
            { teacher: 'Ms. Rodriguez', groups: 3, students: 72, earned: 4100, paid: 3500, pending: 600, status: 'Partial' },
            { teacher: 'Prof. Lee', groups: 2, students: 48, earned: 2800, paid: 0, pending: 2800, status: 'Pending' },
            { teacher: 'Dr. Anderson', groups: 3, students: 65, earned: 3700, paid: 3700, pending: 0, status: 'Paid' },
          ],
          charts: [
            {
              type: 'bar',
              data: [
                { label: 'Total Earned', value: 58000, color: '#10b981' },
                { label: 'Total Paid', value: 52000, color: '#3b82f6' },
                { label: 'Pending', value: 6000, color: '#f59e0b' },
              ]
            }
          ]
        }

      default:
        return {
          id: `report-${Date.now()}`,
          type,
          title: 'General Report',
          generated_at: now.toISOString(),
          period,
          summary: {},
          data: []
        }
    }
  }

  const exportToCSV = (report: ReportData) => {
    if (!report.data || report.data.length === 0) {
      toast.error('No data to export')
      return
    }

    const headers = Object.keys(report.data[0]).join(',')
    const rows = report.data.map(row =>
      Object.values(row).map(val => `"${val}"`).join(',')
    ).join('\n')

    const csv = `${headers}\n${rows}`
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.type}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    toast.success('Report exported successfully!')
  }

  const exportToPDF = (report: ReportData) => {
    if (!report) {
      toast.error('No report to export')
      return
    }

    // Create a printable HTML version
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Please allow popups to export PDF')
      return
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${report.title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          h1 { color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 10px; }
          .header { margin-bottom: 30px; }
          .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 30px 0; }
          .summary-card { border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; }
          .summary-card h3 { margin: 0 0 5px 0; font-size: 14px; color: #6b7280; }
          .summary-card p { margin: 0; font-size: 24px; font-weight: bold; color: #1f2937; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
          th { background-color: #f3f4f6; font-weight: 600; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${report.title}</h1>
          <p><strong>Generated:</strong> ${new Date(report.generated_at).toLocaleString()}</p>
          <p><strong>Period:</strong> ${report.period}</p>
        </div>

        <div class="summary">
          ${Object.entries(report.summary).map(([key, value]) => `
            <div class="summary-card">
              <h3>${key.replace(/_/g, ' ').toUpperCase()}</h3>
              <p>${typeof value === 'number' && (key.includes('revenue') || key.includes('amount') || key.includes('profit') || key.includes('expense'))
                ? formatCurrency(value)
                : value}</p>
            </div>
          `).join('')}
        </div>

        ${report.data && report.data.length > 0 ? `
          <h2>Detailed Data</h2>
          <table>
            <thead>
              <tr>
                ${Object.keys(report.data[0]).map(key => `<th>${key.replace(/_/g, ' ').toUpperCase()}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${report.data.map(row => `
                <tr>
                  ${Object.values(row).map(cell => `<td>${cell}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        <div class="footer">
          <p>© ${new Date().getFullYear()} Educational Management System - Generated automatically</p>
        </div>
      </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()

    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.print()
      toast.success('PDF export ready - Use Print dialog to save as PDF')
    }
  }

  const handleScheduleReport = () => {
    if (!scheduleConfig.reportType || !scheduleConfig.recipients) {
      toast.warning('Please select report type and add recipients')
      return
    }

    const newSchedule = {
      id: Date.now(),
      ...scheduleConfig,
      createdAt: new Date().toISOString()
    }

    setScheduledReports([...scheduledReports, newSchedule])
    setIsScheduleModalOpen(false)
    setScheduleConfig({
      reportType: '',
      frequency: 'weekly',
      dayOfWeek: 'monday',
      time: '09:00',
      recipients: '',
      enabled: true
    })
    toast.success('Report scheduled successfully!')
  }

  const deleteScheduledReport = (id: number) => {
    setScheduledReports(scheduledReports.filter(r => r.id !== id))
    toast.success('Scheduled report deleted')
  }

  const toggleScheduledReport = (id: number) => {
    setScheduledReports(scheduledReports.map(r =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    ))
    toast.success('Schedule updated')
  }

  const SimpleBarChart = ({ data }: { data: any[] }) => {
    const maxValue = Math.max(...data.map(d => d.value))

    return (
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={index}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-text-secondary">{item.label}</span>
              <span className="font-semibold">{item.value}</span>
            </div>
            <div className="w-full bg-surface rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(item.value / maxValue) * 100}%`,
                  backgroundColor: item.color || '#3b82f6'
                }}
              />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const SimpleLineChart = ({ data }: { data: any[] }) => {
    const maxValue = Math.max(...data.map(d => d.value))
    const points = data.map((item, index) => ({
      x: (index / (data.length - 1)) * 100,
      y: 100 - (item.value / maxValue) * 80
    }))

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

    return (
      <div className="relative h-48">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path
            d={pathD}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          {points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="1.5"
              fill="#3b82f6"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <div className="flex justify-between mt-2 text-xs text-text-secondary">
          {data.map((item, index) => (
            <span key={index}>{item.label}</span>
          ))}
        </div>
      </div>
    )
  }

  const SimplePieChart = ({ data }: { data: any[] }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0)
    let currentAngle = 0

    return (
      <div className="flex items-center gap-8">
        <div className="relative w-48 h-48">
          <svg className="w-full h-full" viewBox="0 0 100 100">
            {data.map((item, index) => {
              const percentage = (item.value / total) * 100
              const angle = (percentage / 100) * 360
              const startAngle = currentAngle
              currentAngle += angle

              const startX = 50 + 45 * Math.cos((startAngle - 90) * Math.PI / 180)
              const startY = 50 + 45 * Math.sin((startAngle - 90) * Math.PI / 180)
              const endX = 50 + 45 * Math.cos((startAngle + angle - 90) * Math.PI / 180)
              const endY = 50 + 45 * Math.sin((startAngle + angle - 90) * Math.PI / 180)
              const largeArc = angle > 180 ? 1 : 0

              return (
                <path
                  key={index}
                  d={`M 50 50 L ${startX} ${startY} A 45 45 0 ${largeArc} 1 ${endX} ${endY} Z`}
                  fill={item.color || '#3b82f6'}
                  opacity="0.9"
                />
              )
            })}
          </svg>
        </div>
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: item.color || '#3b82f6' }}
              />
              <div>
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-text-secondary">
                  {item.value.toLocaleString()} ({((item.value / total) * 100).toFixed(1)}%)
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (isLoadingReports) {
    return <LoadingScreen message="Loading reports..." />
  }

if (isReportsError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-error text-lg mb-2">Error loading reports.</p>
          <p className="text-text-secondary text-sm">Please try again later.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Reports & Analytics 📊</h1>
            <p className="text-text-secondary">Generate detailed reports with comprehensive data visualization</p>
          </div>
          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Calendar className="h-5 w-5" />
            Schedule Report
          </button>
        </div>
      </div>

      {/* Date Range & Period Selector */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Report Configuration</h2>
          <Filter className="h-5 w-5 text-text-secondary" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium mb-2">Date Range</label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
              />
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Period Selector */}
          <div>
            <label className="block text-sm font-medium mb-2">Quick Period</label>
            <div className="grid grid-cols-4 gap-2">
              {['week', 'month', 'quarter', 'year'].map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                    selectedPeriod === period
                      ? 'bg-primary/10 text-primary border-primary/20'
                      : 'bg-background border-border hover:border-primary/20'
                  }`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Current Report Display */}
      {currentReport && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">{currentReport.title}</h2>
              <p className="text-sm text-text-secondary">
                Generated on {new Date(currentReport.generated_at).toLocaleString()} • Period: {currentReport.period}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => exportToCSV(currentReport)}
                className="btn-secondary flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
              <button
                onClick={() => exportToPDF(currentReport)}
                className="btn-secondary flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Export PDF
              </button>
              <button
                onClick={() => setCompareMode(!compareMode)}
                className={`btn-secondary flex items-center gap-2 ${compareMode ? 'bg-primary/10 text-primary' : ''}`}
              >
                <BarChart3 className="h-4 w-4" />
                Compare
              </button>
              <button
                onClick={() => setCurrentReport(null)}
                className="p-2 hover:bg-surface rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {Object.entries(currentReport.summary).map(([key, value]) => (
              <div key={key} className="card">
                <div className="text-sm text-text-secondary mb-1 capitalize">
                  {key.replace(/_/g, ' ')}
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-2xl font-bold">
                    {key.includes('rate') || key.includes('percentage') ? `${value}%` :
                     key.includes('revenue') || key.includes('profit') || key.includes('expense') || key.includes('payment') ?
                     formatCurrency(typeof value === 'number' ? value : Number(value) || 0) :
                     typeof value === 'number' ? value.toLocaleString() : value}
                  </div>
                  {key === 'change' && typeof value === 'number' && (
                    <div className={`flex items-center gap-1 text-sm ${value >= 0 ? 'text-success' : 'text-error'}`}>
                      {value >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                      {Math.abs(value)}%
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          {currentReport.charts && currentReport.charts.length > 0 && (
            <div className="card mb-6">
              <h3 className="text-lg font-semibold mb-4">Data Visualization</h3>
              {currentReport.charts.map((chart, index) => (
                <div key={index} className="mb-6 last:mb-0">
                  {chart.type === 'bar' && <SimpleBarChart data={chart.data} />}
                  {chart.type === 'line' && <SimpleLineChart data={chart.data} />}
                  {chart.type === 'pie' && <SimplePieChart data={chart.data} />}
                </div>
              ))}
            </div>
          )}

          {/* Data Table */}
          {currentReport.data && currentReport.data.length > 0 && (
            <div className="card overflow-hidden">
              <h3 className="text-lg font-semibold mb-4">Detailed Data</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      {Object.keys(currentReport.data[0]).map((header) => (
                        <th key={header} className="text-left px-4 py-3 text-sm font-semibold capitalize">
                          {header.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentReport.data.map((row, index) => (
                      <tr key={index} className="border-b border-border hover:bg-surface transition-colors">
                        {Object.values(row).map((cell: any, cellIndex) => (
                          <td key={cellIndex} className="px-4 py-3 text-sm">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Report Types */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Generate New Report</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportTypes.map((report) => (
            <div key={report.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4 mb-4">
                <span className="text-4xl">{report.icon}</span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-1">{report.title}</h3>
                  <p className="text-sm text-text-secondary">{report.description}</p>
                </div>
              </div>

              <button
                onClick={() => handleGenerateReport(report.id)}
                disabled={isGenerating}
                className="w-full btn-primary flex items-center justify-center gap-2 text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="h-4 w-4" />
                {isGenerating && selectedReportType === report.id ? 'Generating...' : 'Generate Report'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Reports */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Recent Reports</h2>
        <div className="card">
          {reportsData?.results && reportsData.results.length > 0 ? (
            <div className="space-y-4">
              {reportsData.results.map((report, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-background rounded-xl hover:bg-border transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium mb-1">
                        {report.title || report.type || 'Report'}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-text-secondary">
                        <span>{report.type || 'N/A'}</span>
                        <span>•</span>
                        <span>
                          {new Date(report.generated_at).toISOString().split('T')[0]}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
                      <Eye className="h-4 w-4" />
                      View
                    </button>
                    <button className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-text-secondary mx-auto mb-4 opacity-50" />
              <p className="text-text-secondary text-lg mb-2">No reports yet</p>
              <p className="text-text-secondary text-sm">
                Generate your first report to see it here
              </p>
            </div>
          )}
        </div>
        {reportsData && reportsData.count > limit && (
          <PaginationControls
            totalItems={reportsData.count}
            itemsPerPage={limit}
            currentPage={page}
            onPageChange={setPage}
            onItemsPerPageChange={setLimit}
          />
        )}
      </div>

      {/* Scheduled Reports Section */}
      {scheduledReports.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Scheduled Reports</h2>
          <div className="card">
            <div className="space-y-3">
              {scheduledReports.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between p-4 bg-background rounded-xl"
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-lg ${schedule.enabled ? 'bg-primary/10' : 'bg-border'} flex items-center justify-center`}>
                      <Calendar className={`h-6 w-6 ${schedule.enabled ? 'text-primary' : 'text-text-secondary'}`} />
                    </div>
                    <div>
                      <p className="font-medium mb-1">
                        {reportTypes.find(r => r.id === schedule.reportType)?.title || schedule.reportType}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-text-secondary">
                        <span>{schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1)}</span>
                        {schedule.frequency === 'weekly' && (
                          <>
                            <span>•</span>
                            <span>{schedule.dayOfWeek.charAt(0).toUpperCase() + schedule.dayOfWeek.slice(1)}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{schedule.time}</span>
                        <span>•</span>
                        <span>{schedule.recipients}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleScheduledReport(schedule.id)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        schedule.enabled
                          ? 'bg-success/10 text-success hover:bg-success/20'
                          : 'bg-border text-text-secondary hover:bg-surface'
                      }`}
                    >
                      {schedule.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <button
                      onClick={() => deleteScheduledReport(schedule.id)}
                      className="p-2 hover:bg-surface rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-error" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Report Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-semibold mb-4">Schedule Report</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Report Type *</label>
                <select
                  value={scheduleConfig.reportType}
                  onChange={(e) => setScheduleConfig({ ...scheduleConfig, reportType: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="">Select a report type</option>
                  {reportTypes.map((report) => (
                    <option key={report.id} value={report.id}>
                      {report.icon} {report.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Frequency *</label>
                <select
                  value={scheduleConfig.frequency}
                  onChange={(e) => setScheduleConfig({ ...scheduleConfig, frequency: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {scheduleConfig.frequency === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Day of Week</label>
                  <select
                    value={scheduleConfig.dayOfWeek}
                    onChange={(e) => setScheduleConfig({ ...scheduleConfig, dayOfWeek: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  >
                    <option value="monday">Monday</option>
                    <option value="tuesday">Tuesday</option>
                    <option value="wednesday">Wednesday</option>
                    <option value="thursday">Thursday</option>
                    <option value="friday">Friday</option>
                    <option value="saturday">Saturday</option>
                    <option value="sunday">Sunday</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Time</label>
                <input
                  type="time"
                  value={scheduleConfig.time}
                  onChange={(e) => setScheduleConfig({ ...scheduleConfig, time: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email Recipients *</label>
                <input
                  type="text"
                  value={scheduleConfig.recipients}
                  onChange={(e) => setScheduleConfig({ ...scheduleConfig, recipients: e.target.value })}
                  placeholder="email1@example.com, email2@example.com"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-text-secondary mt-1">Separate multiple emails with commas</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={handleScheduleReport} className="btn-primary flex-1">
                  Schedule Report
                </button>
                <button
                  onClick={() => {
                    setIsScheduleModalOpen(false)
                    setScheduleConfig({
                      reportType: '',
                      frequency: 'weekly',
                      dayOfWeek: 'monday',
                      time: '09:00',
                      recipients: '',
                      enabled: true
                    })
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}