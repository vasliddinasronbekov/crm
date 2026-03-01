'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

import { api } from '@/lib/api'

interface SATExamDetail {
  id: number
  title: string
  description: string
  coin_cost: number
  coin_refund: number
  passing_score: number
  rw_total_questions: number
  rw_time_minutes: number
  math_total_questions: number
  math_time_minutes: number
  is_official: boolean
  is_published: boolean
  test_number: number | null
  created_at: string
  updated_at: string
}

interface SATQualityReport {
  summary: {
    is_publish_ready: boolean
    total_questions: number
    target_questions: number
    completion_percentage: number
    required_modules: number
    actual_modules: number
  }
  blockers: string[]
  warnings: string[]
  missing_modules: Array<{
    section: string
    section_label: string
    module_number: number
  }>
  module_readiness: Array<{
    id: number
    section: string
    section_label: string
    module_number: number
    difficulty: string
    time_minutes: number
    question_count: number
    target_question_count: number
    completion_percentage: number
    is_complete: boolean
    issues: string[]
  }>
  coverage: {
    by_section: Array<{
      section: string
      label: string
      actual: number
      target: number
      completion_percentage: number
    }>
    question_types: Record<string, Array<{ key: string; count: number }>>
    difficulty: Array<{ key: string; count: number }>
  }
  data_quality: {
    missing_explanations: number
    missing_correct_answers: number
    invalid_option_sets: number
    missing_classification: number
    duplicate_clusters: Array<{
      question_ids: number[]
      count: number
      preview: string
    }>
  }
  analytics: {
    total_attempts: number
    completed_attempts: number
    pass_rate: number
    average_total_score: number
    average_rw_score: number
    average_math_score: number
    average_time_minutes: number
    hardest_questions: Array<{
      id: number
      question_number: number
      module__section: string
      module__module_number: number
      preview: string
      submissions: number
      correct_submissions: number
      accuracy_percentage: number
    }>
  }
}

const qualityTone = (ready: boolean) =>
  ready
    ? 'border-emerald-300/70 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : 'border-amber-300/70 bg-amber-500/10 text-amber-700 dark:text-amber-300'

export default function SATExamDetailPage() {
  const params = useParams()
  const router = useRouter()
  const examId = Number(params.id)

  const [exam, setExam] = useState<SATExamDetail | null>(null)
  const [report, setReport] = useState<SATQualityReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!Number.isFinite(examId)) {
      router.push('/dashboard/sat/exams')
      return
    }

    const load = async () => {
      try {
        setLoading(true)
        const [examData, reportData] = await Promise.all([
          api.get<SATExamDetail>(`/v1/student-profile/sat/exams/${examId}/`),
          api.getSATExamQualityReport(examId),
        ])
        setExam(examData)
        setReport(reportData)
      } catch (error) {
        console.error('Failed to load SAT exam detail:', error)
        toast.error('Failed to load SAT exam insights')
        router.push('/dashboard/sat/exams')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [examId, router])

  const readinessLabel = useMemo(() => {
    if (!report) return 'Loading'
    return report.summary.is_publish_ready ? 'Publish Ready' : 'Needs Attention'
  }, [report])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    )
  }

  if (!exam || !report) {
    return null
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-surface/80 p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <Link href="/dashboard/sat/exams" className="inline-flex items-center gap-2 text-sm text-primary-500 hover:text-primary-600">
            <span>&larr;</span>
            Back to SAT Exams
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-text-primary">{exam.title}</h1>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${qualityTone(report.summary.is_publish_ready)}`}>
              {readinessLabel}
            </span>
            {exam.is_published ? (
              <span className="rounded-full border border-emerald-300/70 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                Published
              </span>
            ) : (
              <span className="rounded-full border border-slate-300/70 bg-slate-500/10 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Draft
              </span>
            )}
            {exam.is_official ? (
              <span className="rounded-full border border-violet-300/70 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300">
                Official {exam.test_number ? `#${exam.test_number}` : ''}
              </span>
            ) : null}
          </div>
          <p className="max-w-3xl text-sm text-text-secondary">
            {exam.description || 'Use this page to validate structure, detect authoring issues, and review live performance analytics before publishing.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/dashboard/sat/exams/create?id=${exam.id}`}
            className="rounded-2xl border border-border bg-background px-4 py-2 text-sm font-medium text-text-primary transition hover:border-primary-300 hover:text-primary-600"
          >
            Edit Exam
          </Link>
          <Link
            href={`/dashboard/sat/exams/${exam.id}/questions`}
            className="rounded-2xl bg-primary-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-600"
          >
            Manage Questions
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Question Inventory" value={`${report.summary.total_questions}/${report.summary.target_questions}`} helper={`${report.summary.completion_percentage}% complete`} />
        <MetricCard label="Modules Ready" value={`${report.summary.actual_modules}/${report.summary.required_modules}`} helper={`${report.missing_modules.length} missing`} />
        <MetricCard label="Average Score" value={report.analytics.average_total_score || '—'} helper={`${report.analytics.completed_attempts} completed attempts`} />
        <MetricCard label="Pass Rate" value={`${report.analytics.pass_rate}%`} helper={`${report.analytics.total_attempts} total attempts`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-6">
          <Panel title="Readiness Guardrails" subtitle="Blocking issues stop publish. Warnings indicate quality debt.">
            <div className="grid gap-4 md:grid-cols-2">
              <IssueList
                title={`Blockers (${report.blockers.length})`}
                tone="danger"
                items={report.blockers.length ? report.blockers : ['No blocking issues detected.']}
              />
              <IssueList
                title={`Warnings (${report.warnings.length})`}
                tone="warning"
                items={report.warnings.length ? report.warnings : ['No warnings detected.']}
              />
            </div>
          </Panel>

          <Panel title="Module Readiness" subtitle="Each SAT exam should ship with two Reading & Writing modules and two Math modules.">
            <div className="grid gap-4 lg:grid-cols-2">
              {report.module_readiness.map((module) => (
                <div key={module.id} className="rounded-2xl border border-border bg-background/70 p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-text-primary">
                        {module.section_label} - Module {module.module_number}
                      </div>
                      <div className="text-xs text-text-secondary">
                        {module.difficulty} difficulty • {module.time_minutes} min
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${module.is_complete ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                      {module.question_count}/{module.target_question_count}
                    </span>
                  </div>
                  <div className="mb-3 h-2 overflow-hidden rounded-full bg-border/60">
                    <div
                      className={`h-full rounded-full ${module.is_complete ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${Math.min(module.completion_percentage, 100)}%` }}
                    />
                  </div>
                  <ul className="space-y-2 text-sm text-text-secondary">
                    {module.issues.length ? module.issues.map((issue) => <li key={issue}>• {issue}</li>) : <li>• Ready for publish.</li>}
                  </ul>
                </div>
              ))}
              {report.missing_modules.map((module) => (
                <div key={`${module.section}-${module.module_number}`} className="rounded-2xl border border-dashed border-red-300 bg-red-500/5 p-4">
                  <div className="text-sm font-semibold text-red-600">
                    Missing {module.section_label} Module {module.module_number}
                  </div>
                  <p className="mt-2 text-sm text-red-500">
                    Create this module before students can take the full exam.
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Coverage & Difficulty Mix" subtitle="Use this to spot thin topic coverage before publishing.">
            <div className="grid gap-4 lg:grid-cols-2">
              {report.coverage.by_section.map((section) => (
                <div key={section.section} className="rounded-2xl border border-border bg-background/70 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold text-text-primary">{section.label}</h3>
                    <span className="text-sm text-text-secondary">
                      {section.actual}/{section.target}
                    </span>
                  </div>
                  <div className="mb-3 h-2 overflow-hidden rounded-full bg-border/60">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.min(section.completion_percentage, 100)}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(report.coverage.question_types[section.section] || []).map((item) => (
                      <span key={item.key} className="rounded-full bg-primary-500/10 px-2.5 py-1 text-xs font-medium text-primary-600">
                        {item.key.replaceAll('_', ' ')} · {item.count}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {report.coverage.difficulty.map((item) => (
                <span key={item.key} className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-secondary">
                  {item.key} · {item.count}
                </span>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Data Quality" subtitle="These checks catch authoring mistakes that hurt runtime accuracy.">
            <div className="grid grid-cols-2 gap-3">
              <StatPill label="Missing explanations" value={report.data_quality.missing_explanations} />
              <StatPill label="Missing answers" value={report.data_quality.missing_correct_answers} />
              <StatPill label="Invalid MCQ options" value={report.data_quality.invalid_option_sets} />
              <StatPill label="Missing classification" value={report.data_quality.missing_classification} />
            </div>
            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">Duplicate Questions</h3>
              {report.data_quality.duplicate_clusters.length ? (
                report.data_quality.duplicate_clusters.map((cluster) => (
                  <div key={cluster.question_ids.join('-')} className="rounded-2xl border border-border bg-background/70 p-3">
                    <div className="text-sm font-medium text-text-primary">{cluster.preview}</div>
                    <div className="mt-1 text-xs text-text-secondary">
                      {cluster.count} copies • IDs: {cluster.question_ids.join(', ')}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-text-secondary">No duplicate question clusters detected.</p>
              )}
            </div>
          </Panel>

          <Panel title="Live Performance Analytics" subtitle="This updates as students complete attempts.">
            <div className="grid grid-cols-2 gap-3">
              <StatPill label="Completed attempts" value={report.analytics.completed_attempts} />
              <StatPill label="Avg RW" value={report.analytics.average_rw_score || '—'} />
              <StatPill label="Avg Math" value={report.analytics.average_math_score || '—'} />
              <StatPill label="Avg time" value={report.analytics.average_time_minutes ? `${report.analytics.average_time_minutes}m` : '—'} />
            </div>
            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">Hardest Questions</h3>
              {report.analytics.hardest_questions.length ? (
                report.analytics.hardest_questions.map((question) => (
                  <div key={question.id} className="rounded-2xl border border-border bg-background/70 p-3">
                    <div className="text-sm font-medium text-text-primary">{question.preview}</div>
                    <div className="mt-1 text-xs text-text-secondary">
                      {question.module__section === 'reading_writing' ? 'Reading & Writing' : 'Math'} Module {question.module__module_number} • Q{question.question_number}
                    </div>
                    <div className="mt-2 text-xs font-medium text-amber-600">
                      {question.accuracy_percentage}% accuracy across {question.submissions} submissions
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-text-secondary">No completed attempt data yet.</p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-3xl border border-border bg-surface/80 p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-text-secondary">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}

function MetricCard({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <div className="rounded-3xl border border-border bg-surface/80 p-5 shadow-sm">
      <div className="text-sm text-text-secondary">{label}</div>
      <div className="mt-2 text-3xl font-bold text-text-primary">{value}</div>
      <div className="mt-1 text-xs text-text-tertiary">{helper}</div>
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-3">
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="mt-1 text-lg font-semibold text-text-primary">{value}</div>
    </div>
  )
}

function IssueList({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: 'danger' | 'warning'
}) {
  const accentClass =
    tone === 'danger'
      ? 'border-red-300 bg-red-500/5 text-red-700 dark:text-red-300'
      : 'border-amber-300 bg-amber-500/5 text-amber-700 dark:text-amber-300'

  return (
    <div className={`rounded-2xl border p-4 ${accentClass}`}>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  )
}
