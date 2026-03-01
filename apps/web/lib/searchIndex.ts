/**
 * System-wide search index
 * Contains all pages, features, settings, and actions searchable in the app
 */

export interface SearchAction {
  id: string
  title: string
  description?: string
  keywords: string[]
  category: 'page' | 'feature' | 'setting' | 'action'
  path?: string
  icon?: string
  action?: () => void
}

export type IndexSearchScope = 'all' | 'pages' | 'features' | 'settings' | 'actions'

export interface SearchIndexOptions {
  scope?: IndexSearchScope
  limit?: number
}

export const SEARCH_INDEX: SearchAction[] = [
  // Dashboard Pages
  {
    id: 'dashboard-home',
    title: 'Dashboard',
    description: 'Main dashboard overview',
    keywords: ['home', 'overview', 'main', 'dashboard', 'stats'],
    category: 'page',
    path: '/dashboard',
    icon: 'home'
  },
  {
    id: 'dashboard-students',
    title: 'Students',
    description: 'View and manage students',
    keywords: ['students', 'pupils', 'learners', 'users', 'list'],
    category: 'page',
    path: '/dashboard/students',
    icon: 'users'
  },
  {
    id: 'dashboard-teachers',
    title: 'Teachers',
    description: 'View and manage teachers',
    keywords: ['teachers', 'instructors', 'staff', 'educators'],
    category: 'page',
    path: '/dashboard/teachers',
    icon: 'user-tie'
  },
  {
    id: 'dashboard-groups',
    title: 'Groups',
    description: 'View and manage student groups',
    keywords: ['groups', 'classes', 'cohorts', 'sections'],
    category: 'page',
    path: '/dashboard/groups',
    icon: 'users-cog'
  },
  {
    id: 'dashboard-schedule',
    title: 'Schedule',
    description: 'View class schedules and timetables',
    keywords: ['schedule', 'timetable', 'calendar', 'classes', 'timing'],
    category: 'page',
    path: '/dashboard/schedule',
    icon: 'calendar'
  },

  // CRM
  {
    id: 'crm-leads',
    title: 'CRM - Leads',
    description: 'Customer relationship management',
    keywords: ['crm', 'leads', 'prospects', 'customers', 'sales', 'pipeline'],
    category: 'page',
    path: '/dashboard/crm',
    icon: 'chart-line'
  },

  // LMS
  {
    id: 'lms-courses',
    title: 'LMS - Courses',
    description: 'Learning management system',
    keywords: ['lms', 'courses', 'learning', 'content', 'lessons', 'modules'],
    category: 'page',
    path: '/dashboard/lms',
    icon: 'book-open'
  },
  {
    id: 'lms-progress',
    title: 'LMS - Student Progress',
    description: 'Track student learning progress',
    keywords: ['progress', 'tracking', 'completion', 'analytics', 'performance'],
    category: 'page',
    path: '/dashboard/lms/progress',
    icon: 'chart-bar'
  },

  // Exams
  {
    id: 'ielts-exams',
    title: 'IELTS Exams',
    description: 'IELTS exam management',
    keywords: ['ielts', 'exams', 'tests', 'assessment', 'english', 'language'],
    category: 'page',
    path: '/dashboard/exams',
    icon: 'file-alt'
  },
  {
    id: 'sat-exams',
    title: 'SAT Exams',
    description: 'SAT exam management',
    keywords: ['sat', 'exams', 'tests', 'college', 'entrance'],
    category: 'page',
    path: '/dashboard/sat/exams',
    icon: 'graduation-cap'
  },
  {
    id: 'sat-attempts',
    title: 'SAT Attempts',
    description: 'View SAT exam attempts and results',
    keywords: ['sat', 'attempts', 'results', 'scores', 'performance'],
    category: 'page',
    path: '/dashboard/sat/attempts',
    icon: 'clipboard-list'
  },

  // Payments & Accounting
  {
    id: 'payments',
    title: 'Payments',
    description: 'View and manage payments',
    keywords: ['payments', 'transactions', 'billing', 'invoices', 'money'],
    category: 'page',
    path: '/dashboard/payments',
    icon: 'credit-card'
  },
  {
    id: 'accounting',
    title: 'Accounting',
    description: 'Financial accounting and reports',
    keywords: ['accounting', 'finance', 'reports', 'revenue', 'expenses', 'balance'],
    category: 'page',
    path: '/dashboard/accounting',
    icon: 'calculator'
  },

  // Messaging
  {
    id: 'messaging',
    title: 'Messaging',
    description: 'Send messages and notifications',
    keywords: ['messages', 'notifications', 'sms', 'email', 'communication'],
    category: 'page',
    path: '/dashboard/messaging',
    icon: 'envelope'
  },
  {
    id: 'inbox',
    title: 'Inbox',
    description: 'View notifications and messages',
    keywords: ['inbox', 'notifications', 'alerts', 'messages'],
    category: 'page',
    path: '/dashboard/inbox',
    icon: 'inbox'
  },

  // Email Marketing
  {
    id: 'email-campaigns',
    title: 'Email Campaigns',
    description: 'Create and manage email campaigns',
    keywords: ['email', 'campaigns', 'marketing', 'newsletter', 'bulk'],
    category: 'page',
    path: '/dashboard/email/campaigns',
    icon: 'mail-bulk'
  },
  {
    id: 'email-templates',
    title: 'Email Templates',
    description: 'Manage email templates',
    keywords: ['email', 'templates', 'designs', 'layouts'],
    category: 'page',
    path: '/dashboard/email/templates',
    icon: 'file-code'
  },
  {
    id: 'email-logs',
    title: 'Email Logs',
    description: 'View email sending history',
    keywords: ['email', 'logs', 'history', 'sent', 'delivered'],
    category: 'page',
    path: '/dashboard/email/logs',
    icon: 'history'
  },

  // Subscriptions
  {
    id: 'subscriptions',
    title: 'Subscriptions',
    description: 'Manage subscription plans',
    keywords: ['subscriptions', 'plans', 'pricing', 'billing', 'membership'],
    category: 'page',
    path: '/dashboard/subscriptions',
    icon: 'star'
  },
  {
    id: 'subscriptions-pricing',
    title: 'Subscription Pricing',
    description: 'View and choose subscription plans',
    keywords: ['pricing', 'plans', 'upgrade', 'premium', 'pro'],
    category: 'page',
    path: '/dashboard/subscriptions/pricing',
    icon: 'tags'
  },

  // Settings
  {
    id: 'settings',
    title: 'Settings',
    description: 'Application settings and preferences',
    keywords: ['settings', 'preferences', 'configuration', 'options'],
    category: 'page',
    path: '/dashboard/settings',
    icon: 'cog'
  },
  {
    id: 'settings-theme',
    title: 'Theme Settings',
    description: 'Change theme and appearance',
    keywords: ['theme', 'dark', 'light', 'appearance', 'colors', 'mode', 'ui'],
    category: 'setting',
    path: '/dashboard/settings',
    icon: 'palette'
  },
  {
    id: 'settings-language',
    title: 'Language Settings',
    description: 'Change application language',
    keywords: ['language', 'locale', 'translation', 'english', 'uzbek', 'russian'],
    category: 'setting',
    path: '/dashboard/settings',
    icon: 'globe'
  },
  {
    id: 'settings-notifications',
    title: 'Notification Settings',
    description: 'Configure notification preferences',
    keywords: ['notifications', 'alerts', 'email', 'push', 'settings'],
    category: 'setting',
    path: '/dashboard/settings',
    icon: 'bell'
  },
  {
    id: 'settings-profile',
    title: 'Profile Settings',
    description: 'Edit your profile information',
    keywords: ['profile', 'account', 'user', 'personal', 'info', 'avatar'],
    category: 'setting',
    path: '/dashboard/settings',
    icon: 'user-circle'
  },

  // Features
  {
    id: 'feature-voice-navigation',
    title: 'Voice Navigation',
    description: 'Navigate using voice commands',
    keywords: ['voice', 'speech', 'audio', 'navigation', 'commands', 'ai'],
    category: 'feature',
    icon: 'microphone'
  },
  {
    id: 'feature-global-search',
    title: 'Global Search',
    description: 'Search across the entire application',
    keywords: ['search', 'find', 'lookup', 'query', 'global'],
    category: 'feature',
    icon: 'search'
  },
  {
    id: 'feature-analytics',
    title: 'Analytics & Reports',
    description: 'View analytics and generate reports',
    keywords: ['analytics', 'reports', 'statistics', 'insights', 'data'],
    category: 'feature',
    icon: 'chart-pie'
  },

  // Actions
  {
    id: 'action-add-student',
    title: 'Add New Student',
    description: 'Create a new student profile',
    keywords: ['add', 'create', 'new', 'student', 'register', 'enroll'],
    category: 'action',
    path: '/dashboard/students',
    icon: 'user-plus'
  },
  {
    id: 'action-add-teacher',
    title: 'Add New Teacher',
    description: 'Create a new teacher profile',
    keywords: ['add', 'create', 'new', 'teacher', 'instructor', 'staff'],
    category: 'action',
    path: '/dashboard/teachers',
    icon: 'user-plus'
  },
  {
    id: 'action-add-group',
    title: 'Create New Group',
    description: 'Create a new student group',
    keywords: ['add', 'create', 'new', 'group', 'class'],
    category: 'action',
    path: '/dashboard/groups',
    icon: 'plus-circle'
  },
  {
    id: 'action-send-message',
    title: 'Send Message',
    description: 'Send SMS or notification',
    keywords: ['send', 'message', 'sms', 'notification', 'communicate'],
    category: 'action',
    path: '/dashboard/messaging',
    icon: 'paper-plane'
  },
  {
    id: 'action-create-campaign',
    title: 'Create Email Campaign',
    description: 'Start a new email campaign',
    keywords: ['create', 'email', 'campaign', 'send', 'bulk'],
    category: 'action',
    path: '/dashboard/email/campaigns',
    icon: 'plus-square'
  },
  {
    id: 'action-generate-report',
    title: 'Generate Report',
    description: 'Generate financial or analytics report',
    keywords: ['generate', 'create', 'report', 'export', 'pdf'],
    category: 'action',
    path: '/dashboard/accounting',
    icon: 'file-download'
  },
  {
    id: 'action-logout',
    title: 'Logout',
    description: 'Sign out of your account',
    keywords: ['logout', 'signout', 'exit', 'leave'],
    category: 'action',
    icon: 'sign-out-alt'
  },

  // Help & Documentation
  {
    id: 'help',
    title: 'Help & Support',
    description: 'Get help and support',
    keywords: ['help', 'support', 'faq', 'docs', 'documentation'],
    category: 'feature',
    icon: 'question-circle'
  },
]

const CATEGORY_SCOPE: Record<SearchAction['category'], IndexSearchScope> = {
  page: 'pages',
  feature: 'features',
  setting: 'settings',
  action: 'actions',
}

const CATEGORY_PRIORITY: Record<SearchAction['category'], number> = {
  page: 4,
  feature: 3,
  setting: 2,
  action: 1,
}

const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)

const normalize = (value: string): string => value.toLowerCase().trim()

const scoreIndexedItem = (item: SearchAction, query: string, tokens: string[]): number => {
  const title = normalize(item.title)
  const description = normalize(item.description || '')
  const keywords = item.keywords.map(normalize)
  const path = normalize(item.path || '')
  const normalizedQuery = normalize(query)
  let score = 0

  if (title === normalizedQuery) score += 300
  if (title.startsWith(normalizedQuery)) score += 180
  if (title.includes(normalizedQuery)) score += 120
  if (description.includes(normalizedQuery)) score += 70
  if (path.includes(normalizedQuery)) score += 45

  tokens.forEach((token) => {
    if (title.includes(token)) score += 35
    if (description.includes(token)) score += 20

    keywords.forEach((keyword) => {
      if (keyword === token) score += 50
      else if (keyword.startsWith(token)) score += 30
      else if (keyword.includes(token)) score += 18
    })
  })

  const tokenMatchCount = tokens.filter((token) => {
    if (title.includes(token) || description.includes(token) || path.includes(token)) {
      return true
    }
    return keywords.some((keyword) => keyword.includes(token))
  }).length

  if (tokens.length > 0) {
    score += Math.round((tokenMatchCount / tokens.length) * 80)
  }

  score += CATEGORY_PRIORITY[item.category] * 10
  return score
}

/**
 * Search the static index with weighted ranking.
 */
export function searchIndex(query: string, options?: SearchIndexOptions): SearchAction[] {
  if (!query || query.trim().length === 0) {
    return []
  }

  const scope = options?.scope || 'all'
  const limit = options?.limit || 24
  const normalizedQuery = normalize(query)
  const tokens = tokenize(query)

  const ranked = SEARCH_INDEX
    .filter((item) => {
      if (scope === 'all') return true
      return CATEGORY_SCOPE[item.category] === scope
    })
    .map((item) => ({
      item,
      score: scoreIndexedItem(item, normalizedQuery, tokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.item.title.localeCompare(b.item.title)
    })
    .slice(0, limit)

  return ranked.map((entry) => entry.item)
}
