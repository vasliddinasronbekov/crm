'use client'

import { useState, useEffect } from 'react'
import apiService from '@/lib/api'
import toast from '@/lib/toast'
import {
import LoadingScreen from '@/components/LoadingScreen'
  Plus,
  MoreVertical,
  Trash2,
  Edit,
  CheckCircle,
  Circle,
  Calendar,
  User,
  Clipboard
} from 'lucide-react'

interface Task {
  id: number
  title: string
  description: string
  is_done: boolean
  due_date: string | null
  user: number
  list: number
  created_at: string
}

interface List {
  id: number
  name: string
  order: number
  board: number
  color: string
  status: number
  tasks?: Task[]
}

interface Board {
  id: number
  name: string
}

export default function TasksPage() {
  const [boards, setBoards] = useState<Board[]>([])
  const [selectedBoard, setSelectedBoard] = useState<number | null>(null)
  const [lists, setLists] = useState<List[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  // Modals
  const [showBoardModal, setShowBoardModal] = useState(false)
  const [showListModal, setShowListModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)

  // Forms
  const [boardName, setBoardName] = useState('')
  const [listData, setListData] = useState({ name: '', color: '#00d4ff' })
  const [taskData, setTaskData] = useState({
    title: '',
    description: '',
    due_date: '',
    list: 0
  })

  useEffect(() => {
    loadBoards()
  }, [])

  useEffect(() => {
    if (selectedBoard) {
      loadBoardData()
    }
  }, [selectedBoard])

  const loadBoards = async () => {
    try {
      setLoading(true)
      const data = await apiService.getBoards()
      const boardsArray = data.results || data || []
      setBoards(boardsArray)
      if (boardsArray.length > 0 && !selectedBoard) {
        setSelectedBoard(boardsArray[0].id)
      }
    } catch (error) {
      console.error('Failed to load boards:', error)
      toast.error('Failed to load boards')
    } finally {
      setLoading(false)
    }
  }

  const loadBoardData = async () => {
    try {
      const [listsData, tasksData] = await Promise.all([
        apiService.getLists({ board: selectedBoard }),
        apiService.getTasks({ list__board: selectedBoard })
      ])

      const listsArray = (listsData.results || listsData || []).sort((a: List, b: List) => a.order - b.order)
      setLists(listsArray)
      setTasks(tasksData.results || tasksData || [])
    } catch (error) {
      console.error('Failed to load board data:', error)
      toast.error('Failed to load board data')
    }
  }

  const createBoard = async () => {
    if (!boardName.trim()) {
      toast.warning('Please enter a board name')
      return
    }

    try {
      await apiService.createBoard({ name: boardName })
      toast.success('Board created successfully!')
      setBoardName('')
      setShowBoardModal(false)
      loadBoards()
    } catch (error) {
      console.error('Failed to create board:', error)
      toast.error('Failed to create board')
    }
  }

  const createList = async () => {
    if (!listData.name.trim()) {
      toast.warning('Please enter a list name')
      return
    }

    try {
      await apiService.createList({
        ...listData,
        board: selectedBoard,
        order: lists.length,
        status: 1
      })
      toast.success('List created successfully!')
      setListData({ name: '', color: '#00d4ff' })
      setShowListModal(false)
      loadBoardData()
    } catch (error) {
      console.error('Failed to create list:', error)
      toast.error('Failed to create list')
    }
  }

  const createTask = async () => {
    if (!taskData.title.trim() || !taskData.list) {
      toast.warning('Please fill in all required fields')
      return
    }

    try {
      await apiService.createTask(taskData)
      toast.success('Task created successfully!')
      setTaskData({ title: '', description: '', due_date: '', list: 0 })
      setShowTaskModal(false)
      loadBoardData()
    } catch (error) {
      console.error('Failed to create task:', error)
      toast.error('Failed to create task')
    }
  }

  const toggleTaskStatus = async (task: Task) => {
    try {
      await apiService.updateTask(task.id, { is_done: !task.is_done })
      loadBoardData()
    } catch (error) {
      console.error('Failed to update task:', error)
      toast.error('Failed to update task')
    }
  }

  const deleteTask = async (id: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      await apiService.deleteTask(id)
      toast.success('Task deleted successfully')
      loadBoardData()
    } catch (error) {
      console.error('Failed to delete task:', error)
      toast.error('Failed to delete task')
    }
  }

  const deleteList = async (id: number) => {
    if (!confirm('Are you sure you want to delete this list? All tasks will be deleted.')) return

    try {
      await apiService.deleteList(id)
      toast.success('List deleted successfully')
      loadBoardData()
    } catch (error) {
      console.error('Failed to delete list:', error)
      toast.error('Failed to delete list')
    }
  }

  const getTasksForList = (listId: number) => {
    return tasks.filter(task => task.list === listId)
  }

  if (loading) {
    return <LoadingScreen message="Loading tasks..." />
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Task Management 📋</h1>
        <p className="text-text-secondary">Organize your work with Kanban boards</p>
      </div>

      {/* Board Selector */}
      <div className="flex items-center gap-4 mb-6">
        <select
          value={selectedBoard || ''}
          onChange={(e) => setSelectedBoard(parseInt(e.target.value))}
          className="px-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary"
        >
          <option value="">Select a board</option>
          {boards.map(board => (
            <option key={board.id} value={board.id}>{board.name}</option>
          ))}
        </select>

        <button
          onClick={() => setShowBoardModal(true)}
          className="btn-secondary flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          New Board
        </button>

        {selectedBoard && (
          <>
            <button
              onClick={() => setShowListModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Add List
            </button>

            <button
              onClick={() => setShowTaskModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Add Task
            </button>
          </>
        )}
      </div>

      {/* Kanban Board */}
      {selectedBoard ? (
        <div className="flex gap-6 overflow-x-auto pb-8">
          {lists.map((list) => (
            <div
              key={list.id}
              className="min-w-[320px] flex-shrink-0"
            >
              {/* List Header */}
              <div className="card mb-4" style={{ borderTopColor: list.color, borderTopWidth: '4px' }}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Clipboard className="h-5 w-5" style={{ color: list.color }} />
                    {list.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-secondary bg-background px-3 py-1 rounded-full">
                      {getTasksForList(list.id).length}
                    </span>
                    <button
                      onClick={() => deleteList(list.id)}
                      className="p-2 hover:bg-error/10 text-error rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tasks */}
              <div className="space-y-3">
                {getTasksForList(list.id).map((task) => (
                  <div key={task.id} className="card hover:shadow-lg transition-shadow">
                    <div className="flex items-start gap-3 mb-2">
                      <button
                        onClick={() => toggleTaskStatus(task)}
                        className="mt-1"
                      >
                        {task.is_done ? (
                          <CheckCircle className="h-5 w-5 text-success" />
                        ) : (
                          <Circle className="h-5 w-5 text-text-secondary" />
                        )}
                      </button>
                      <div className="flex-1">
                        <h4 className={`font-semibold ${task.is_done ? 'line-through text-text-secondary' : ''}`}>
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-sm text-text-secondary mt-1">{task.description}</p>
                        )}
                        {task.due_date && (
                          <div className="flex items-center gap-1 text-xs text-warning mt-2">
                            <Calendar className="h-3 w-3" />
                            {new Date(task.due_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-2 hover:bg-error/10 text-error rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {getTasksForList(list.id).length === 0 && (
                  <div className="card text-center py-8 text-text-secondary">
                    <p className="text-sm">No tasks yet</p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {lists.length === 0 && (
            <div className="card text-center py-16 w-full">
              <p className="text-text-secondary mb-4">No lists in this board</p>
              <button
                onClick={() => setShowListModal(true)}
                className="btn-primary"
              >
                Create Your First List
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="card text-center py-16">
          <p className="text-text-secondary mb-4">No board selected</p>
          <button
            onClick={() => setShowBoardModal(true)}
            className="btn-primary"
          >
            Create Your First Board
          </button>
        </div>
      )}

      {/* Create Board Modal */}
      {showBoardModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Create New Board</h2>
            <input
              type="text"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              placeholder="Board name"
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBoardModal(false)
                  setBoardName('')
                }}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button onClick={createBoard} className="flex-1 btn-primary">
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create List Modal */}
      {showListModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Create New List</h2>
            <input
              type="text"
              value={listData.name}
              onChange={(e) => setListData({ ...listData, name: e.target.value })}
              placeholder="List name"
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary mb-4"
            />
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Color</label>
              <input
                type="color"
                value={listData.color}
                onChange={(e) => setListData({ ...listData, color: e.target.value })}
                className="w-full h-12 rounded-xl cursor-pointer"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowListModal(false)
                  setListData({ name: '', color: '#00d4ff' })
                }}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button onClick={createList} className="flex-1 btn-primary">
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Create New Task</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">List *</label>
                <select
                  value={taskData.list}
                  onChange={(e) => setTaskData({ ...taskData, list: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                >
                  <option value={0}>Select a list</option>
                  {lists.map(list => (
                    <option key={list.id} value={list.id}>{list.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Title *</label>
                <input
                  type="text"
                  value={taskData.title}
                  onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
                  placeholder="Task title"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={taskData.description}
                  onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
                  placeholder="Task description"
                  rows={3}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Due Date</label>
                <input
                  type="datetime-local"
                  value={taskData.due_date}
                  onChange={(e) => setTaskData({ ...taskData, due_date: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowTaskModal(false)
                  setTaskData({ title: '', description: '', due_date: '', list: 0 })
                }}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button onClick={createTask} className="flex-1 btn-primary">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}