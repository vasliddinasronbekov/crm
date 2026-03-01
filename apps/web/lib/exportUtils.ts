/**
 * Export utilities for downloading data in various formats
 */

export type ExportFormat = 'csv' | 'excel' | 'json';

interface ExportOptions {
  filename?: string;
  sheetName?: string;
}

/**
 * Convert data to CSV format
 */
export function convertToCSV(data: any[], headers?: string[]): string {
  if (!data || data.length === 0) return '';

  // Get headers from first object if not provided
  const csvHeaders = headers || Object.keys(data[0]);

  // Create CSV header row
  const headerRow = csvHeaders.join(',');

  // Create data rows
  const dataRows = data.map(row => {
    return csvHeaders.map(header => {
      const value = row[header];
      // Handle values that contain commas, quotes, or newlines
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Download CSV file
 */
export function downloadCSV(data: any[], filename: string, headers?: string[]): void {
  const csv = convertToCSV(data, headers);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Download JSON file
 */
export function downloadJSON(data: any, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  downloadBlob(blob, `${filename}.json`);
}

/**
 * Download Excel file using XLSX library
 * Note: Requires 'xlsx' package to be installed
 */
export async function downloadExcel(
  data: any[] | Record<string, any[]>,
  filename: string,
  options?: ExportOptions
): Promise<void> {
  try {
    // Dynamically import xlsx to reduce bundle size
    const XLSX = await import('xlsx');

    let workbook: any;

    if (Array.isArray(data)) {
      // Single sheet
      const worksheet = XLSX.utils.json_to_sheet(data);
      workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        options?.sheetName || 'Sheet1'
      );
    } else {
      // Multiple sheets
      workbook = XLSX.utils.book_new();
      Object.entries(data).forEach(([sheetName, sheetData]) => {
        const worksheet = XLSX.utils.json_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      });
    }

    // Generate Excel file and download
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  } catch (error) {
    console.error('Failed to export Excel:', error);
    // Fallback to CSV if Excel export fails
    if (Array.isArray(data)) {
      downloadCSV(data, filename);
    } else {
      // Export first sheet as CSV
      const firstSheet = Object.values(data)[0];
      downloadCSV(firstSheet, filename);
    }
  }
}

/**
 * Helper function to download a blob
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Format date-based data for export
 */
export interface DateDataExport {
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

/**
 * Export all date data to Excel with multiple sheets
 */
export async function exportDateDataToExcel(
  data: DateDataExport,
  date: Date
): Promise<void> {
  const dateStr = date.toISOString().split('T')[0];
  const filename = `data-export-${dateStr}`;

  // Prepare data for each sheet
  const sheets: Record<string, any[]> = {};

  // Students
  if (data.students?.length > 0) {
    sheets['Students'] = data.students.map(s => ({
      'ID': s.id,
      'Name': `${s.first_name} ${s.last_name}`,
      'Email': s.email,
      'Phone': s.phone,
      'Branch': s.branch_name || 'N/A',
      'Joined Date': s.date_joined ? new Date(s.date_joined).toLocaleDateString() : 'N/A'
    }));
  }

  // Teachers
  if (data.teachers?.length > 0) {
    sheets['Teachers'] = data.teachers.map(t => ({
      'ID': t.id,
      'Name': `${t.first_name} ${t.last_name}`,
      'Email': t.email,
      'Phone': t.phone,
      'Branch': t.branch_name || 'N/A',
      'Salary %': t.salary_percentage || 'N/A'
    }));
  }

  // Attendance
  if (data.attendance?.length > 0) {
    sheets['Attendance'] = data.attendance.map(a => ({
      'Student': a.student_name || 'N/A',
      'Group': a.group_name || 'N/A',
      'Date': a.date,
      'Status': a.status || (a.is_present ? 'Present' : 'Absent'),
      'Time': a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : 'N/A'
    }));
  }

  // Payments
  if (data.payments?.length > 0) {
    sheets['Payments'] = data.payments.map(p => ({
      'Student': p.student_name || p.by_user_name || 'N/A',
      'Amount': p.amount || 0,
      'Type': p.payment_type || 'N/A',
      'Status': p.status || 'N/A',
      'Date': p.date,
      'Group': p.group_name || 'N/A'
    }));
  }

  // Tasks
  if (data.tasks?.length > 0) {
    sheets['Tasks'] = data.tasks.map(t => ({
      'Title': t.title || 'Untitled',
      'Description': t.description || '',
      'Assigned To': t.user_name || 'N/A',
      'Due Date': t.due_date ? new Date(t.due_date).toLocaleDateString() : 'N/A',
      'Status': t.is_done ? 'Completed' : 'Pending',
      'Created': t.created_at ? new Date(t.created_at).toLocaleDateString() : 'N/A'
    }));
  }

  // Messages
  if (data.messages?.length > 0) {
    sheets['Messages'] = data.messages.map(m => ({
      'Recipient': m.recipient_name || 'N/A',
      'Phone': m.phone_number || 'N/A',
      'Message': m.message_text || '',
      'Status': m.status || 'N/A',
      'Sent At': m.sent_at ? new Date(m.sent_at).toLocaleString() : 'N/A'
    }));
  }

  // Exam Scores
  if (data.examScores?.length > 0) {
    sheets['Exam Scores'] = data.examScores.map(s => ({
      'Student': s.student_name || 'N/A',
      'Group': s.group_name || 'N/A',
      'Score': s.score || 0,
      'Max Score': s.max_score || 100,
      'Percentage': s.max_score ? `${((s.score / s.max_score) * 100).toFixed(1)}%` : 'N/A',
      'Date': s.date,
      'Teacher': s.teacher_name || 'N/A'
    }));
  }

  // Groups
  if (data.groups?.length > 0) {
    sheets['Groups'] = data.groups.map(g => ({
      'Name': g.name || 'N/A',
      'Course': g.course_name || 'N/A',
      'Teacher': g.main_teacher_name || 'N/A',
      'Branch': g.branch_name || 'N/A',
      'Start Date': g.start_day,
      'End Date': g.end_day,
      'Schedule': g.days || 'N/A',
      'Students': g.student_count || 0
    }));
  }

  // Export to Excel
  await downloadExcel(sheets, filename);
}

/**
 * Export single category to CSV
 */
export function exportCategoryToCSV(
  data: any[],
  category: string,
  date: Date
): void {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  const dateStr = date.toISOString().split('T')[0];
  const filename = `${category.toLowerCase()}-${dateStr}`;

  downloadCSV(data, filename);
}

/**
 * Generate summary statistics for export
 */
export function generateExportSummary(data: DateDataExport, date: Date): any[] {
  return [
    {
      'Date': date.toISOString().split('T')[0],
      'Students': data.students?.length || 0,
      'Teachers': data.teachers?.length || 0,
      'Attendance Records': data.attendance?.length || 0,
      'Present': data.attendance?.filter(a => a.status === 'present' || a.is_present).length || 0,
      'Absent': data.attendance?.filter(a => a.status === 'absent' || !a.is_present).length || 0,
      'Payments': data.payments?.length || 0,
      'Total Payment Amount': data.payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
      'Tasks': data.tasks?.length || 0,
      'Completed Tasks': data.tasks?.filter(t => t.is_done || t.status === 'completed').length || 0,
      'Messages Sent': data.messages?.length || 0,
      'Exam Scores': data.examScores?.length || 0,
      'Average Score': data.examScores?.length > 0
        ? (data.examScores.reduce((sum, s) => sum + (s.score || 0), 0) / data.examScores.length).toFixed(2)
        : 0,
      'Groups': data.groups?.length || 0
    }
  ];
}
