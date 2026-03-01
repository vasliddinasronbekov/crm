'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { toast } from 'react-hot-toast'

interface Question {
  question_type: string
  order: number
  passage_text?: string
  question_text: string
  options: string[]
  correct_answer: any
  points: number
  speaking_prompts?: string[]
  time_limit_seconds?: number
}

interface ExamDraft {
  section: string
  title: string
  description: string
  instructions: string
  coin_cost: number
  coin_refund: number
  time_limit_minutes: number
  passing_band_score: number
  questions: Question[]
}

const QUESTION_TYPES = {
  reading: [
    { value: 'multiple_choice', label: 'Multiple Choice' },
    { value: 'true_false_notgiven', label: 'True/False/Not Given' },
    { value: 'matching_headings', label: 'Matching Headings' },
    { value: 'sentence_completion', label: 'Sentence Completion' },
    { value: 'summary_completion', label: 'Summary Completion' },
  ],
  listening: [
    { value: 'multiple_choice', label: 'Multiple Choice' },
    { value: 'form_completion', label: 'Form Completion' },
    { value: 'note_completion', label: 'Note Completion' },
    { value: 'table_completion', label: 'Table Completion' },
    { value: 'diagram_labeling', label: 'Diagram Labeling' },
  ],
  writing: [
    { value: 'task1_academic', label: 'Task 1 (Academic)' },
    { value: 'task2_essay', label: 'Task 2 (Essay)' },
  ],
  speaking: [
    { value: 'introduction', label: 'Part 1: Introduction & Interview' },
    { value: 'long_turn', label: 'Part 2: Long Turn (Cue Card)' },
    { value: 'discussion', label: 'Part 3: Discussion' },
  ],
}

export default function CreateExamPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<ExamDraft>({
    section: 'reading',
    title: '',
    description: '',
    instructions: '',
    coin_cost: 50,
    coin_refund: 10,
    time_limit_minutes: 60,
    passing_band_score: 5.0,
    questions: [],
  })

  const [currentQuestion, setCurrentQuestion] = useState<Question>({
    question_type: 'multiple_choice',
    order: 1,
    question_text: '',
    options: ['', '', '', ''],
    correct_answer: {},
    points: 1,
  })

  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null)

  // Step 1: Basic Info
  const renderBasicInfo = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-text-primary">Basic Information</h2>

      {/* Section */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Exam Section <span className="text-red-500">*</span>
        </label>
        <select
          value={draft.section}
          onChange={(e) => setDraft({ ...draft, section: e.target.value, questions: [] })}
          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="reading">Reading</option>
          <option value="listening">Listening</option>
          <option value="writing">Writing</option>
          <option value="speaking">Speaking</option>
        </select>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Exam Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="e.g., IELTS Reading Practice Test 1"
          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Description</label>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="Brief description of this exam..."
          rows={4}
          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>
    </div>
  )

  // Step 2: Settings
  const renderSettings = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-text-primary">Exam Settings</h2>

      <div className="grid grid-cols-2 gap-6">
        {/* Time Limit */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Time Limit (minutes) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={draft.time_limit_minutes}
            onChange={(e) => setDraft({ ...draft, time_limit_minutes: parseInt(e.target.value) })}
            min="1"
            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Passing Band Score */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Passing Band Score <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={draft.passing_band_score}
            onChange={(e) => setDraft({ ...draft, passing_band_score: parseFloat(e.target.value) })}
            min="0"
            max="9"
            step="0.5"
            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Coin Cost */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Coin Cost <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={draft.coin_cost}
            onChange={(e) => setDraft({ ...draft, coin_cost: parseInt(e.target.value) })}
            min="0"
            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Coin Refund */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Coin Refund (on pass) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={draft.coin_refund}
            onChange={(e) => setDraft({ ...draft, coin_refund: parseInt(e.target.value) })}
            min="0"
            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Instructions */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Exam Instructions
        </label>
        <textarea
          value={draft.instructions}
          onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
          placeholder="Instructions for students taking this exam..."
          rows={6}
          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>
    </div>
  )

  // Step 3: Questions
  const handleAddQuestion = () => {
    if (!currentQuestion.question_text.trim()) {
      toast.error('Question text is required')
      return
    }

    if (editingQuestionIndex !== null) {
      // Update existing question
      const updatedQuestions = [...draft.questions]
      updatedQuestions[editingQuestionIndex] = currentQuestion
      setDraft({ ...draft, questions: updatedQuestions })
      toast.success('Question updated')
    } else {
      // Add new question
      setDraft({ ...draft, questions: [...draft.questions, currentQuestion] })
      toast.success('Question added')
    }

    // Reset form
    setCurrentQuestion({
      question_type: 'multiple_choice',
      order: draft.questions.length + 1,
      question_text: '',
      options: ['', '', '', ''],
      correct_answer: {},
      points: 1,
    })
    setEditingQuestionIndex(null)
  }

  const handleEditQuestion = (index: number) => {
    setCurrentQuestion(draft.questions[index])
    setEditingQuestionIndex(index)
  }

  const handleDeleteQuestion = (index: number) => {
    const updatedQuestions = draft.questions.filter((_, i) => i !== index)
    setDraft({ ...draft, questions: updatedQuestions })
    toast.success('Question deleted')
  }

  const renderQuestions = () => {
    const questionTypes = QUESTION_TYPES[draft.section as keyof typeof QUESTION_TYPES]

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-text-primary">
          Questions ({draft.questions.length})
        </h2>

        {/* Question Form */}
        <div className="bg-surface p-6 rounded-lg border border-border space-y-4">
          <h3 className="text-lg font-semibold text-text-primary">
            {editingQuestionIndex !== null ? 'Edit Question' : 'Add New Question'}
          </h3>

          {/* Question Type */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Question Type
            </label>
            <select
              value={currentQuestion.question_type}
              onChange={(e) =>
                setCurrentQuestion({ ...currentQuestion, question_type: e.target.value })
              }
              className="w-full px-4 py-2 border border-border rounded-lg"
            >
              {questionTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Passage Text (for Reading) */}
          {draft.section === 'reading' && (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Passage Text
              </label>
              <textarea
                value={currentQuestion.passage_text || ''}
                onChange={(e) =>
                  setCurrentQuestion({ ...currentQuestion, passage_text: e.target.value })
                }
                placeholder="Reading passage text..."
                rows={6}
                className="w-full px-4 py-2 border border-border rounded-lg font-mono text-sm"
              />
            </div>
          )}

          {/* Question Text */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Question Text <span className="text-red-500">*</span>
            </label>
            <textarea
              value={currentQuestion.question_text}
              onChange={(e) =>
                setCurrentQuestion({ ...currentQuestion, question_text: e.target.value })
              }
              placeholder="Enter your question..."
              rows={3}
              className="w-full px-4 py-2 border border-border rounded-lg"
            />
          </div>

          {/* Options (for multiple choice) */}
          {currentQuestion.question_type === 'multiple_choice' && (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Options</label>
              <div className="space-y-2">
                {currentQuestion.options.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="flex items-center justify-center w-8 h-10 bg-surface-hover rounded text-text-secondary font-medium">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...currentQuestion.options]
                        newOptions[index] = e.target.value
                        setCurrentQuestion({ ...currentQuestion, options: newOptions })
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                      className="flex-1 px-4 py-2 border border-border rounded-lg"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Correct Answer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Correct Answer
              </label>
              <input
                type="text"
                value={currentQuestion.correct_answer.answer || ''}
                onChange={(e) =>
                  setCurrentQuestion({
                    ...currentQuestion,
                    correct_answer: { ...currentQuestion.correct_answer, answer: e.target.value },
                  })
                }
                placeholder="Enter correct answer"
                className="w-full px-4 py-2 border border-border rounded-lg"
              />
            </div>

            {/* Points */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Points</label>
              <input
                type="number"
                value={currentQuestion.points}
                onChange={(e) =>
                  setCurrentQuestion({ ...currentQuestion, points: parseFloat(e.target.value) })
                }
                min="0"
                step="0.5"
                className="w-full px-4 py-2 border border-border rounded-lg"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleAddQuestion}
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium"
            >
              {editingQuestionIndex !== null ? 'Update Question' : 'Add Question'}
            </button>
            {editingQuestionIndex !== null && (
              <button
                onClick={() => {
                  setEditingQuestionIndex(null)
                  setCurrentQuestion({
                    question_type: 'multiple_choice',
                    order: draft.questions.length + 1,
                    question_text: '',
                    options: ['', '', '', ''],
                    correct_answer: {},
                    points: 1,
                  })
                }}
                className="px-6 py-2 bg-surface text-text-primary rounded-lg hover:bg-surface-hover font-medium"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </div>

        {/* Questions List */}
        {draft.questions.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-text-primary">Added Questions</h3>
            {draft.questions.map((question, index) => (
              <div
                key={index}
                className="p-4 bg-surface rounded-lg border border-border flex items-start justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs font-medium">
                      Q{index + 1}
                    </span>
                    <span className="text-xs text-text-tertiary">{question.question_type}</span>
                    <span className="text-xs text-text-tertiary">• {question.points} pts</span>
                  </div>
                  <p className="text-sm text-text-primary">{question.question_text}</p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEditQuestion(index)}
                    className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteQuestion(index)}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Step 4: Preview & Submit
  const renderPreview = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-text-primary">Preview & Submit</h2>

      <div className="bg-surface p-6 rounded-lg border border-border space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-text-secondary">Section:</span>
            <p className="font-medium text-text-primary capitalize">{draft.section}</p>
          </div>
          <div>
            <span className="text-sm text-text-secondary">Title:</span>
            <p className="font-medium text-text-primary">{draft.title || '(No title)'}</p>
          </div>
          <div>
            <span className="text-sm text-text-secondary">Time Limit:</span>
            <p className="font-medium text-text-primary">{draft.time_limit_minutes} minutes</p>
          </div>
          <div>
            <span className="text-sm text-text-secondary">Questions:</span>
            <p className="font-medium text-text-primary">{draft.questions.length}</p>
          </div>
          <div>
            <span className="text-sm text-text-secondary">Coin Cost:</span>
            <p className="font-medium text-text-primary">{draft.coin_cost} coins</p>
          </div>
          <div>
            <span className="text-sm text-text-secondary">Passing Score:</span>
            <p className="font-medium text-text-primary">{draft.passing_band_score}/9.0</p>
          </div>
        </div>

        {draft.description && (
          <div>
            <span className="text-sm text-text-secondary">Description:</span>
            <p className="text-text-primary mt-1">{draft.description}</p>
          </div>
        )}

        {draft.instructions && (
          <div>
            <span className="text-sm text-text-secondary">Instructions:</span>
            <p className="text-text-primary mt-1 whitespace-pre-wrap">{draft.instructions}</p>
          </div>
        )}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          ⚠️ After saving as draft, you can submit it for AI review. The AI will analyze your exam
          and provide quality feedback and suggestions.
        </p>
      </div>
    </div>
  )

  // Save Draft
  const handleSaveDraft = async () => {
    if (!draft.title.trim()) {
      toast.error('Please enter an exam title')
      return
    }

    try {
      setSaving(true)
      await api.createExamDraft(draft)
      toast.success('Exam draft saved successfully!')
      router.push('/dashboard/exams')
    } catch (error: any) {
      console.error('Failed to save draft:', error)
      toast.error(error.response?.data?.detail || 'Failed to save draft')
    } finally {
      setSaving(false)
    }
  }

  // Navigation
  const canProceed = () => {
    if (step === 1) return draft.section && draft.title.trim()
    if (step === 2) return true
    if (step === 3) return true
    return true
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Create IELTS Exam</h1>
        <p className="text-text-secondary">
          Create a new IELTS exam draft with AI-powered quality review
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {['Basic Info', 'Settings', 'Questions', 'Preview'].map((label, index) => {
            const stepNum = index + 1
            const isActive = step === stepNum
            const isCompleted = step > stepNum

            return (
              <div key={stepNum} className="flex items-center flex-1">
                <div className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isActive
                        ? 'bg-primary-500 text-white'
                        : 'bg-surface text-text-tertiary border border-border'
                    }`}
                  >
                    {isCompleted ? '✓' : stepNum}
                  </div>
                  <span
                    className={`ml-2 font-medium ${
                      isActive ? 'text-text-primary' : 'text-text-secondary'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {index < 3 && (
                  <div
                    className={`flex-1 h-1 mx-4 ${
                      isCompleted ? 'bg-green-500' : 'bg-border'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg border border-border p-8 mb-6">
        {step === 1 && renderBasicInfo()}
        {step === 2 && renderSettings()}
        {step === 3 && renderQuestions()}
        {step === 4 && renderPreview()}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => step > 1 && setStep(step - 1)}
          disabled={step === 1}
          className="px-6 py-2 border border-border rounded-lg hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          Previous
        </button>

        <div className="flex gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={saving || !draft.title.trim()}
            className="px-6 py-2 border border-primary-500 text-primary-500 rounded-lg hover:bg-primary-50 disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>

          {step < 4 ? (
            <button
              onClick={() => canProceed() && setStep(step + 1)}
              disabled={!canProceed()}
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSaveDraft}
              disabled={saving || !draft.title.trim() || draft.questions.length === 0}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {saving ? 'Creating...' : 'Create Draft'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
