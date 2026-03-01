'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import apiService from '@/lib/api'
import toast from '@/lib/toast'
import {  Search, Plus, Edit, Trash2, Copy, BarChart, Eye } from 'lucide-react'

interface Quiz {
  id: number
  title: string
  description: string
  quiz_type: string
  quiz_type_display: string
  time_limit_minutes: number
  passing_score: number
  is_published: boolean
  question_count: number
  total_points: number
  created_at: string
}

export default function QuizzesPage() {
  const router = useRouter()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'practice' | 'graded' | 'exam'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchQuizzes()
  }, [filter])

  const fetchQuizzes = async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (filter !== 'all') {
        params.quiz_type = filter
      }

      const response = await apiService.getQuizzes(params)
      setQuizzes(response.results || response)
    } catch (error) {
      console.error('Error fetching quizzes:', error)
      toast.error('Failed to load quizzes')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return
    }

    try {
      await apiService.deleteQuiz(id)
      toast.success('Quiz deleted successfully')
      fetchQuizzes()
    } catch (error) {
      console.error('Error deleting quiz:', error)
      toast.error('Failed to delete quiz')
    }
  }

  const handleDuplicate = async (id: number) => {
    try {
      await apiService.duplicateQuiz(id)
      toast.success('Quiz duplicated successfully!')
      fetchQuizzes()
    } catch (error) {
      console.error('Error duplicating quiz:', error)
      toast.error('Failed to duplicate quiz')
    }
  }

  const togglePublished = async (quiz: Quiz) => {
    try {
      await apiService.updateQuiz(quiz.id, {
        is_published: !quiz.is_published
      })
      toast.success(`Quiz ${quiz.is_published ? 'unpublished' : 'published'} successfully`)
      fetchQuizzes()
    } catch (error) {
      console.error('Error updating quiz:', error)
      toast.error('Failed to update quiz')
    }
  }

  const filteredQuizzes = quizzes.filter(quiz =>
    quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quiz.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Quiz Management 📝</h1>
        <p className="text-text-secondary">Create and manage quizzes for your courses</p>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-text-secondary" />
          <input
            type="text"
            placeholder="Search quizzes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Create Button */}
        <button
          onClick={() => router.push('/dashboard/quizzes/create')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Create Quiz
        </button>
      </div>

      {/* Filter Buttons */}
      <div className="mb-6">
        <div className="flex gap-2">
          {(['all', 'practice', 'graded', 'exam'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === type
                  ? 'bg-primary text-background'
                  : 'bg-surface text-text-secondary hover:bg-border'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Quiz List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading quizzes...</p>
          </div>
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-text-secondary text-lg mb-4">No quizzes found</p>
          <button
            onClick={() => router.push('/dashboard/quizzes/create')}
            className="btn-primary"
          >
            Create Your First Quiz
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQuizzes.map((quiz) => (
            <div key={quiz.id} className="card hover:shadow-lg transition-shadow">
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  quiz.quiz_type === 'practice' ? 'bg-success/10 text-success' :
                  quiz.quiz_type === 'graded' ? 'bg-primary/10 text-primary' :
                  'bg-purple-500/10 text-purple-500'
                }`}>
                  {quiz.quiz_type_display}
                </span>
                <button
                  onClick={() => togglePublished(quiz)}
                  className={`p-2 rounded-lg transition-colors ${
                    quiz.is_published
                      ? 'bg-success/10 text-success hover:bg-success/20'
                      : 'bg-surface text-text-secondary hover:bg-border'
                  }`}
                  title={quiz.is_published ? 'Published' : 'Draft'}
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <h3 className="text-xl font-bold mb-2">{quiz.title}</h3>
              <p className="text-sm text-text-secondary mb-4 line-clamp-2">
                {quiz.description || 'No description'}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-text-secondary">Questions</p>
                  <p className="text-lg font-semibold">{quiz.question_count}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Total Points</p>
                  <p className="text-lg font-semibold">{quiz.total_points}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Time Limit</p>
                  <p className="text-lg font-semibold">{quiz.time_limit_minutes}m</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Passing</p>
                  <p className="text-lg font-semibold">{quiz.passing_score}%</p>
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-border pt-4 flex gap-2">
                <button
                  onClick={() => router.push(`/dashboard/quizzes/${quiz.id}/edit`)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-background rounded-lg hover:bg-primary/90 transition-colors"
                  title="Edit"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() => router.push(`/dashboard/quizzes/${quiz.id}/stats`)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-surface text-text hover:bg-border rounded-lg transition-colors"
                  title="Statistics"
                >
                  <BarChart className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDuplicate(quiz.id)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-surface text-text hover:bg-border rounded-lg transition-colors"
                  title="Duplicate"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(quiz.id, quiz.title)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-error/10 text-error hover:bg-error/20 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
