'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { toast } from 'react-hot-toast'

export default function GenerateExamPage() {
  const router = useRouter()
  const [generating, setGenerating] = useState(false)
  const [formData, setFormData] = useState({
    section: 'reading',
    difficulty_level: 'intermediate',
    topic: '',
    custom_instructions: '',
  })

  const handleGenerate = async () => {
    try {
      setGenerating(true)
      const result = await api.generateExamWithAI(formData)
      toast.success(
        'AI exam generation started! You will be notified when it\'s ready.',
        { duration: 5000 }
      )
      router.push('/dashboard/exams')
    } catch (error: any) {
      console.error('Failed to generate exam:', error)
      toast.error(error.response?.data?.detail || 'Failed to start AI generation')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-2">AI Exam Generator</h1>
        <p className="text-text-secondary">
          Let AI create a complete IELTS exam based on your requirements
        </p>
      </div>

      {/* Generator Card */}
      <div className="bg-white rounded-lg border border-border p-8 space-y-6">
        {/* Section */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Exam Section <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.section}
            onChange={(e) => setFormData({ ...formData, section: e.target.value })}
            className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
          >
            <option value="reading">📖 Reading</option>
            <option value="listening">🎧 Listening</option>
            <option value="writing">✍️ Writing</option>
            <option value="speaking">🗣️ Speaking</option>
          </select>
          <p className="mt-2 text-sm text-text-tertiary">
            Select which IELTS section to generate
          </p>
        </div>

        {/* Difficulty Level */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Difficulty Level <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {['beginner', 'intermediate', 'advanced'].map((level) => (
              <button
                key={level}
                onClick={() => setFormData({ ...formData, difficulty_level: level })}
                className={`px-4 py-3 rounded-lg border-2 font-medium capitalize transition-all ${
                  formData.difficulty_level === level
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-border hover:border-primary-300 text-text-secondary'
                }`}
              >
                {level === 'beginner' && '⭐'}
                {level === 'intermediate' && '⭐⭐'}
                {level === 'advanced' && '⭐⭐⭐'}
                <span className="ml-2">{level}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-text-tertiary">
            Choose the difficulty level for generated questions
          </p>
        </div>

        {/* Topic */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Topic Focus (Optional)
          </label>
          <input
            type="text"
            value={formData.topic}
            onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
            placeholder="e.g., Technology, Environment, Education, Health..."
            className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <p className="mt-2 text-sm text-text-tertiary">
            Specify a topic for the exam content (leave blank for general topics)
          </p>
        </div>

        {/* Custom Instructions */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Custom Instructions (Optional)
          </label>
          <textarea
            value={formData.custom_instructions}
            onChange={(e) => setFormData({ ...formData, custom_instructions: e.target.value })}
            placeholder="Add any specific requirements or preferences for the exam generation..."
            rows={5}
            className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <p className="mt-2 text-sm text-text-tertiary">
            Provide additional instructions for AI (e.g., "Focus on academic vocabulary", "Include
            real-world scenarios")
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <div className="text-2xl">🤖</div>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-1">How it works:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>
                  • AI will generate a complete exam with authentic IELTS-style questions
                </li>
                <li>
                  • Generation typically takes 30-60 seconds depending on section complexity
                </li>
                <li>
                  • You'll receive a notification when the exam is ready
                </li>
                <li>
                  • Generated exam will be saved as a draft that you can review and edit
                </li>
                <li>
                  • You can submit it for AI review and approval like any other draft
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Expected Output */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-semibold text-purple-900 mb-2">Expected Output:</h4>
          <div className="grid grid-cols-2 gap-3 text-sm text-purple-800">
            <div>
              <strong>Reading:</strong> 40 questions, 60 minutes
            </div>
            <div>
              <strong>Listening:</strong> 40 questions, 30 minutes
            </div>
            <div>
              <strong>Writing:</strong> 2 tasks, 60 minutes
            </div>
            <div>
              <strong>Speaking:</strong> 3 parts, 11-14 minutes
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4">
          <button
            onClick={() => router.back()}
            className="flex-1 px-6 py-3 border border-border rounded-lg hover:bg-surface-hover font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Generating...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>🤖</span>
                Generate Exam with AI
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Recent Generations */}
      <div className="mt-8 bg-white rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Recent AI Generations</h3>
        <p className="text-sm text-text-secondary">
          View your recent AI-generated exams in the{' '}
          <button
            onClick={() => router.push('/dashboard/exams')}
            className="text-primary-500 hover:text-primary-600 font-medium"
          >
            Exam Drafts
          </button>{' '}
          page
        </p>
      </div>
    </div>
  )
}