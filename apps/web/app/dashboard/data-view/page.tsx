'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Calendar,
  Users,
  BookOpen,
  ClipboardCheck,
  DollarSign,
  MessageSquare,
  TrendingUp,
  ArrowLeft,
  Download,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import apiService from '@/lib/api';
import { toast } from 'react-hot-toast';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useSettings } from '@/contexts/SettingsContext';
import { useBranchContext } from '@/contexts/BranchContext';
import {
  exportDateDataToExcel,
  exportCategoryToCSV,
  downloadJSON,
  generateExportSummary,
} from '@/lib/exportUtils';
import LoadingScreen from '@/components/LoadingScreen'
import BranchScopeChip from '@/components/BranchScopeChip';

interface DateData {
  students: any[];
  teachers: any[];
  attendance: any[];
  payments: any[];
  tasks: any[];
  messages: any[];
  examScores: any[];
  groups: any[];
  [key: string]: any[];
}

function DataViewContent() {
  const { formatCurrency } = useSettings();
  const { activeBranchId, branches } = useBranchContext();
  const searchParams = useSearchParams();
  const router = useRouter();
  const dateParam = searchParams.get('date');
  const branchScopeKey = activeBranchId ?? 'all';
  const activeBranchName = useMemo(
    () => (
      activeBranchId === null
        ? 'All branches'
        : branches.find((branch) => branch.id === activeBranchId)?.name || `Branch #${activeBranchId}`
    ),
    [activeBranchId, branches],
  );

  const [selectedDate, setSelectedDate] = useState<Date>(
    dateParam ? new Date(dateParam) : new Date()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<DateData>({
    students: [],
    teachers: [],
    attendance: [],
    payments: [],
    tasks: [],
    messages: [],
    examScores: [],
    groups: [],
  });
  const [activeTab, setActiveTab] = useState<
    'all' | 'attendance' | 'payments' | 'tasks' | 'messages' | 'scores'
  >('all');
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv' | 'json'>('excel');
  const [isExporting, setIsExporting] = useState(false);
  const branchScopeRef = useRef<string>(String(branchScopeKey));

  useEffect(() => {
    branchScopeRef.current = String(branchScopeKey);
  }, [branchScopeKey]);

  const loadDataForDate = useCallback(async (date: Date) => {
    const requestScope = String(branchScopeKey);
    setIsLoading(true);
    try {
      const dateStr = date.toISOString().split('T')[0];

      // Fetch all data for the selected date
      const [
        studentsRes,
        teachersRes,
        attendanceRes,
        paymentsRes,
        tasksRes,
        messagesRes,
        scoresRes,
        groupsRes,
      ] = await Promise.allSettled([
        apiService.getStudents({ date: dateStr }),
        apiService.getTeachers({ date: dateStr }),
        apiService.getAttendance({ date: dateStr }),
        apiService.getPayments({ date: dateStr }),
        apiService.getTasks({ date: dateStr }),
        apiService.getMessages({ date: dateStr }),
        apiService.getExamScores({ date: dateStr }),
        apiService.getGroups({ date: dateStr }),
      ]);

      if (branchScopeRef.current !== requestScope) {
        return;
      }

      setData({
        students: studentsRes.status === 'fulfilled' ? studentsRes.value.results || studentsRes.value || [] : [],
        teachers: teachersRes.status === 'fulfilled' ? teachersRes.value.results || teachersRes.value || [] : [],
        attendance: attendanceRes.status === 'fulfilled' ? attendanceRes.value.results || attendanceRes.value || [] : [],
        payments: paymentsRes.status === 'fulfilled' ? paymentsRes.value.results || paymentsRes.value || [] : [],
        tasks: tasksRes.status === 'fulfilled' ? tasksRes.value.results || tasksRes.value || [] : [],
        messages: messagesRes.status === 'fulfilled' ? messagesRes.value.results || messagesRes.value || [] : [],
        examScores: scoresRes.status === 'fulfilled' ? scoresRes.value.results || scoresRes.value || [] : [],
        groups: groupsRes.status === 'fulfilled' ? groupsRes.value.results || groupsRes.value || [] : [],
      });
    } catch (error) {
      if (branchScopeRef.current !== requestScope) {
        return;
      }
      console.error('Failed to load data:', error);
      toast.error('Failed to load data for selected date');
    } finally {
      if (branchScopeRef.current === requestScope) {
        setIsLoading(false);
      }
    }
  }, [branchScopeKey]);

  useEffect(() => {
    void loadDataForDate(selectedDate);
  }, [loadDataForDate, selectedDate]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getAttendanceStats = () => {
    const total = data.attendance.length;
    const present = data.attendance.filter((a) => a.status === 'present').length;
    const absent = data.attendance.filter((a) => a.status === 'absent').length;
    const late = data.attendance.filter((a) => a.status === 'late').length;

    return { total, present, absent, late };
  };

  const getTotalPayments = () => {
    return data.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
  };

  const getTaskStats = () => {
    const total = data.tasks.length;
    const completed = data.tasks.filter((t) => t.status === 'completed').length;
    const pending = data.tasks.filter((t) => t.status === 'pending').length;
    const overdue = data.tasks.filter((t) => t.status === 'overdue').length;

    return { total, completed, pending, overdue };
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const hasDataToExport = Object.values(data).some(arr => arr && arr.length > 0);
      if (!hasDataToExport) {
        toast.error('No data to export for the selected date.');
        setIsExporting(false);
        return;
      }

      if (exportFormat === 'excel') {
        // Export all data to Excel with multiple sheets
        await exportDateDataToExcel(data, selectedDate);
        toast.success('Data exported to Excel successfully!');
      } else if (exportFormat === 'csv') {
        // Export each category as separate CSV files
        const dateStr = selectedDate.toISOString().split('T')[0];
        let exportCount = 0;

        if (data.students.length > 0) {
          exportCategoryToCSV(data.students, 'students', selectedDate);
          exportCount++;
        }
        if (data.teachers.length > 0) {
          exportCategoryToCSV(data.teachers, 'teachers', selectedDate);
          exportCount++;
        }
        if (data.attendance.length > 0) {
          exportCategoryToCSV(data.attendance, 'attendance', selectedDate);
          exportCount++;
        }
        if (data.payments.length > 0) {
          exportCategoryToCSV(data.payments, 'payments', selectedDate);
          exportCount++;
        }
        if (data.tasks.length > 0) {
          exportCategoryToCSV(data.tasks, 'tasks', selectedDate);
          exportCount++;
        }
        if (data.messages.length > 0) {
          exportCategoryToCSV(data.messages, 'messages', selectedDate);
          exportCount++;
        }
        if (data.examScores.length > 0) {
          exportCategoryToCSV(data.examScores, 'exam-scores', selectedDate);
          exportCount++;
        }
        if (data.groups.length > 0) {
          exportCategoryToCSV(data.groups, 'groups', selectedDate);
          exportCount++;
        }

        if (exportCount > 0) {
          toast.success(`Exported ${exportCount} CSV files successfully!`);
        } else {
          toast.error('No data to export');
        }
      } else if (exportFormat === 'json') {
        // Export complete data as JSON
        const dateStr = selectedDate.toISOString().split('T')[0];
        const exportData = {
          date: dateStr,
          summary: generateExportSummary(data, selectedDate),
          data: data,
        };
        downloadJSON(exportData, `complete-data-${dateStr}`);
        toast.success('Data exported to JSON successfully!');
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const attendanceStats = getAttendanceStats();
  const taskStats = getTaskStats();
  const totalPayments = getTotalPayments();

  if (isLoading) {
    return <LoadingScreen message="Loading data..." />
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 hover:bg-surface rounded-xl transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadDataForDate(selectedDate)}
              className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-background rounded-xl transition-colors border border-border"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>

            {/* Export Format Selector */}
            <div className="flex items-center gap-2 px-3 py-2 bg-surface rounded-xl border border-border">
              {(['excel', 'csv', 'json'] as const).map((format) => (
                <button
                  key={format}
                  onClick={() => setExportFormat(format)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                    exportFormat === format
                      ? 'bg-gradient-to-r from-primary to-cyan-500 text-white'
                      : 'text-text-secondary hover:text-text-primary hover:bg-background'
                  }`}
                >
                  {format.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-cyan-500 text-white rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Export Data</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-cyan-500/20 flex items-center justify-center border-2 border-primary/30">
            <Calendar className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">
              {formatDate(selectedDate)}
            </h1>
            <p className="text-text-secondary">Complete system data overview</p>
            <BranchScopeChip scopeName={activeBranchName} className="mt-2" />
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Attendance */}
        <div className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
              <ClipboardCheck className="h-6 w-6 text-success" />
            </div>
            <span className="text-xs text-text-secondary">
              {attendanceStats.total > 0
                ? `${Math.round((attendanceStats.present / attendanceStats.total) * 100)}%`
                : '0%'}
            </span>
          </div>
          <p className="text-3xl font-bold mb-1">{attendanceStats.present}</p>
          <p className="text-sm text-text-secondary mb-2">Present Today</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-error">{attendanceStats.absent} absent</span>
            <span className="text-warning">{attendanceStats.late} late</span>
          </div>
        </div>

        {/* Payments */}
        <div className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <TrendingUp className="h-5 w-5 text-success" />
          </div>
          <p className="text-3xl font-bold mb-1">{formatCurrency(totalPayments)}</p>
          <p className="text-sm text-text-secondary mb-2">Total Payments</p>
          <div className="text-xs text-text-secondary">{data.payments.length} transactions</div>
        </div>

        {/* Tasks */}
        <div className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="h-12 w-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-cyan-500" />
            </div>
            <span className="text-xs text-text-secondary">
              {taskStats.total > 0
                ? `${Math.round((taskStats.completed / taskStats.total) * 100)}%`
                : '0%'}
            </span>
          </div>
          <p className="text-3xl font-bold mb-1">{taskStats.completed}</p>
          <p className="text-sm text-text-secondary mb-2">Tasks Completed</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-warning">{taskStats.pending} pending</span>
            <span className="text-error">{taskStats.overdue} overdue</span>
          </div>
        </div>

        {/* Messages */}
        <div className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-warning" />
            </div>
            <Clock className="h-5 w-5 text-text-secondary" />
          </div>
          <p className="text-3xl font-bold mb-1">{data.messages.length}</p>
          <p className="text-sm text-text-secondary mb-2">Messages Sent</p>
          <div className="text-xs text-text-secondary">Communication activity</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-surface rounded-2xl border border-border p-2 mb-6 flex gap-2 overflow-x-auto">
        {[
          { id: 'all', label: 'All Data', icon: Filter },
          { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
          { id: 'payments', label: 'Payments', icon: DollarSign },
          { id: 'tasks', label: 'Tasks', icon: CheckCircle },
          { id: 'messages', label: 'Messages', icon: MessageSquare },
          { id: 'scores', label: 'Exam Scores', icon: TrendingUp },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-primary to-cyan-500 text-white shadow-lg'
                : 'hover:bg-background text-text-secondary'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span className="text-sm font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Data Display */}
      <div className="space-y-6">
        {/* Attendance Data */}
        {(activeTab === 'all' || activeTab === 'attendance') && (
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="p-6 border-b border-border bg-background/50">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-success" />
                Attendance Records
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="text-left p-4 font-medium text-text-secondary">Student</th>
                    <th className="text-left p-4 font-medium text-text-secondary">Group</th>
                    <th className="text-left p-4 font-medium text-text-secondary">Status</th>
                    <th className="text-left p-4 font-medium text-text-secondary">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.attendance.length > 0 ? (
                    data.attendance.map((record, index) => (
                      <tr key={index} className="border-b border-border hover:bg-background transition-colors">
                        <td className="p-4">{record.student_name || 'N/A'}</td>
                        <td className="p-4">{record.group_name || 'N/A'}</td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold ${
                              record.status === 'present'
                                ? 'bg-success/20 text-success'
                                : record.status === 'absent'
                                ? 'bg-error/20 text-error'
                                : 'bg-warning/20 text-warning'
                            }`}
                          >
                            {record.status === 'present' && <CheckCircle className="h-3 w-3" />}
                            {record.status === 'absent' && <XCircle className="h-3 w-3" />}
                            {record.status === 'late' && <AlertCircle className="h-3 w-3" />}
                            {record.status || 'Unknown'}
                          </span>
                        </td>
                        <td className="p-4 text-text-secondary text-sm">
                          {record.timestamp
                            ? new Date(record.timestamp).toLocaleTimeString()
                            : 'N/A'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-text-secondary">
                        No attendance records for this date
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payments Data */}
        {(activeTab === 'all' || activeTab === 'payments') && (
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="p-6 border-b border-border bg-background/50">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Payment Transactions
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="text-left p-4 font-medium text-text-secondary">Student</th>
                    <th className="text-left p-4 font-medium text-text-secondary">Amount</th>
                    <th className="text-left p-4 font-medium text-text-secondary">Type</th>
                    <th className="text-left p-4 font-medium text-text-secondary">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.length > 0 ? (
                    data.payments.map((payment, index) => (
                      <tr key={index} className="border-b border-border hover:bg-background transition-colors">
                        <td className="p-4">{payment.student_name || 'N/A'}</td>
                        <td className="p-4 font-bold text-success">
                          {formatCurrency(payment.amount || 0)}
                        </td>
                        <td className="p-4">{payment.payment_type || 'N/A'}</td>
                        <td className="p-4">
                          <span className="inline-flex px-3 py-1 rounded-lg text-xs font-semibold bg-success/20 text-success">
                            {payment.status || 'Completed'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-text-secondary">
                        No payments for this date
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tasks Data */}
        {(activeTab === 'all' || activeTab === 'tasks') && (
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="p-6 border-b border-border bg-background/50">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-cyan-500" />
                Tasks
              </h3>
            </div>
            <div className="p-6">
              {data.tasks.length > 0 ? (
                <div className="space-y-3">
                  {data.tasks.map((task, index) => (
                    <div
                      key={index}
                      className="p-4 bg-background rounded-xl border border-border hover:border-primary/50 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold mb-1">{task.title || 'Untitled Task'}</h4>
                          <p className="text-sm text-text-secondary">{task.description || ''}</p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                            task.status === 'completed'
                              ? 'bg-success/20 text-success'
                              : task.status === 'pending'
                              ? 'bg-warning/20 text-warning'
                              : 'bg-error/20 text-error'
                          }`}
                        >
                          {task.status || 'pending'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-text-secondary">No tasks for this date</div>
              )}
            </div>
          </div>
        )}

        {/* Messages Data */}
        {(activeTab === 'all' || activeTab === 'messages') && (
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="p-6 border-b border-border bg-background/50">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-warning" />
                Messages
              </h3>
            </div>
            <div className="p-6">
              {data.messages.length > 0 ? (
                <div className="space-y-3">
                  {data.messages.map((message, index) => (
                    <div
                      key={index}
                      className="p-4 bg-background rounded-xl border border-border"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-cyan-500/20 flex items-center justify-center">
                          <MessageSquare className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold">{message.sender_name || 'Unknown'}</span>
                            <span className="text-xs text-text-secondary">
                              {message.timestamp
                                ? new Date(message.timestamp).toLocaleTimeString()
                                : ''}
                            </span>
                          </div>
                          <p className="text-sm text-text-secondary">{message.content || ''}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-text-secondary">No messages for this date</div>
              )}
            </div>
          </div>
        )}

        {/* Exam Scores Data */}
        {(activeTab === 'all' || activeTab === 'scores') && (
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="p-6 border-b border-border bg-background/50">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-info" />
                Exam Scores
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="text-left p-4 font-medium text-text-secondary">Student</th>
                    <th className="text-left p-4 font-medium text-text-secondary">Exam</th>
                    <th className="text-left p-4 font-medium text-text-secondary">Score</th>
                    <th className="text-left p-4 font-medium text-text-secondary">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {data.examScores.length > 0 ? (
                    data.examScores.map((score, index) => (
                      <tr key={index} className="border-b border-border hover:bg-background transition-colors">
                        <td className="p-4">{score.student_name || 'N/A'}</td>
                        <td className="p-4">{score.exam_name || 'N/A'}</td>
                        <td className="p-4">
                          <span className="font-bold text-primary">
                            {score.score || '0'}/{score.max_score || '100'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex px-3 py-1 rounded-lg text-xs font-semibold ${
                              score.grade === 'A' || score.grade === 'B'
                                ? 'bg-success/20 text-success'
                                : score.grade === 'C'
                                ? 'bg-warning/20 text-warning'
                                : 'bg-error/20 text-error'
                            }`}
                          >
                            {score.grade || 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-text-secondary">
                        No exam scores for this date
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DataViewPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        }
      >
        <DataViewContent />
      </Suspense>
    </ProtectedRoute>
  );
}
