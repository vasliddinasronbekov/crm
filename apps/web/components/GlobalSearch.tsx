'use client'

import { Fragment, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BookOpen,
  Clock,
  DollarSign,
  FileText,
  GraduationCap,
  HelpCircle,
  History,
  Loader2,
  Megaphone,
  MessageCircle,
  Receipt,
  Search,
  Send,
  Settings,
  ShoppingCart,
  Star,
  Tag,
  Trophy,
  Users,
  X,
  Award,
  Calendar,
  LogOut,
} from 'lucide-react'
import apiService from '@/lib/api'
import { SEARCH_INDEX, SearchAction, searchIndex, IndexSearchScope } from '@/lib/searchIndex'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { useSettings } from '@/contexts/SettingsContext'
import { useAuth } from '@/contexts/AuthContext'
import { canAccessPage, isDashboardRoute, usePermissions } from '@/lib/permissions'

type SearchSectionKey =
  | 'recent'
  | 'students'
  | 'teachers'
  | 'groups'
  | 'courses'
  | 'pages'
  | 'features'
  | 'settings'
  | 'actions'

type SearchScope = 'all' | Exclude<SearchSectionKey, 'recent'>

type SearchCategory = 'recent' | 'entity' | 'page' | 'feature' | 'setting' | 'action'

type SearchSource = 'recent' | 'backend' | 'fallback' | 'index'

interface SearchResult {
  key: string
  id: string | number
  title: string
  subtitle: string
  type: string
  url: string
  metadata?: string
  score: number
  category: SearchCategory
  section: SearchSectionKey
  source: SearchSource
}

type SearchSections = Record<SearchSectionKey, SearchResult[]>

interface ParsedSearchInput {
  raw: string
  query: string
  scope: SearchScope
  tokens: string[]
}

interface RecentSearchItem {
  id: string | number
  title: string
  subtitle: string
  type: string
  url: string
  section: SearchSectionKey
  query: string
  timestamp: number
}

const SEARCH_DEBOUNCE_MS = 260
const MAX_RESULTS_PER_SECTION = 8
const MAX_RECENT_ITEMS = 6
const SEARCH_HISTORY_STORAGE_KEY = 'global_search_recent_v2'

const SECTION_ORDER: SearchSectionKey[] = [
  'recent',
  'students',
  'teachers',
  'groups',
  'courses',
  'pages',
  'features',
  'settings',
  'actions',
]

const ENTITY_SECTIONS: Array<SearchSectionKey> = ['students', 'teachers', 'groups', 'courses']

const FRONTEND_SECTIONS: Array<SearchSectionKey> = ['pages', 'features', 'settings', 'actions']

const SECTION_LABELS: Record<SearchSectionKey, string> = {
  recent: 'Recent',
  students: 'Students',
  teachers: 'Teachers',
  groups: 'Groups',
  courses: 'Courses',
  pages: 'Pages',
  features: 'Features',
  settings: 'Settings',
  actions: 'Actions',
}

const SCOPE_ALIASES: Record<string, SearchScope> = {
  all: 'all',
  student: 'students',
  students: 'students',
  teacher: 'teachers',
  teachers: 'teachers',
  group: 'groups',
  groups: 'groups',
  course: 'courses',
  courses: 'courses',
  page: 'pages',
  pages: 'pages',
  feature: 'features',
  features: 'features',
  setting: 'settings',
  settings: 'settings',
  action: 'actions',
  actions: 'actions',
}

const createEmptySections = (): SearchSections => ({
  recent: [],
  students: [],
  teachers: [],
  groups: [],
  courses: [],
  pages: [],
  features: [],
  settings: [],
  actions: [],
})

const toArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[]
  return []
}

const normalizeText = (value: string): string => value.toLowerCase().trim()

const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)

const parseSearchInput = (rawInput: string): ParsedSearchInput => {
  const raw = rawInput || ''
  const trimmed = raw.trim()
  if (trimmed.startsWith('/')) {
    const query = trimmed.slice(1).trim()
    return {
      raw,
      query,
      scope: 'pages',
      tokens: tokenize(query),
    }
  }

  if (trimmed.startsWith('>')) {
    const query = trimmed.slice(1).trim()
    return {
      raw,
      query,
      scope: 'actions',
      tokens: tokenize(query),
    }
  }

  if (trimmed.startsWith('@')) {
    const query = trimmed.slice(1).trim()
    return {
      raw,
      query,
      scope: 'students',
      tokens: tokenize(query),
    }
  }

  const scopedPattern = /^(?:in|scope|type):([a-z-]+)\s*(.*)$/i
  const scopedMatch = trimmed.match(scopedPattern)

  if (!scopedMatch) {
    return {
      raw,
      query: trimmed,
      scope: 'all',
      tokens: tokenize(trimmed),
    }
  }

  const scopeToken = scopedMatch[1]?.toLowerCase()
  const scope = SCOPE_ALIASES[scopeToken] || 'all'
  const query = (scopedMatch[2] || '').trim()

  return {
    raw,
    query,
    scope,
    tokens: tokenize(query),
  }
}

const isSectionAllowed = (section: SearchSectionKey, scope: SearchScope): boolean => {
  if (section === 'recent') return scope === 'all'
  if (scope === 'all') return true
  return section === scope
}

const toIndexScope = (scope: SearchScope): IndexSearchScope => {
  if (scope === 'all') return 'all'
  if (scope === 'pages') return 'pages'
  if (scope === 'features') return 'features'
  if (scope === 'settings') return 'settings'
  if (scope === 'actions') return 'actions'
  return 'all'
}

const buildResultKey = (
  section: SearchSectionKey,
  id: string | number,
  url: string,
  _source?: SearchSource,
): string => `${section}:${id}:${url}`

const scoreMatch = (
  queryTokens: string[],
  value: string,
  extraKeywords: string[] = [],
): number => {
  const normalizedValue = normalizeText(value)
  const normalizedKeywords = extraKeywords.map(normalizeText)
  const phrase = queryTokens.join(' ')
  let score = 0

  if (!normalizedValue) return score

  if (phrase && normalizedValue === phrase) score += 280
  if (phrase && normalizedValue.startsWith(phrase)) score += 180
  if (phrase && normalizedValue.includes(phrase)) score += 120

  queryTokens.forEach((token) => {
    if (normalizedValue.includes(token)) score += 28

    normalizedKeywords.forEach((keyword) => {
      if (keyword === token) score += 45
      else if (keyword.startsWith(token)) score += 28
      else if (keyword.includes(token)) score += 16
    })
  })

  return score
}

const categorySectionFromIndex = (category: SearchAction['category']): SearchSectionKey => {
  if (category === 'page') return 'pages'
  if (category === 'feature') return 'features'
  if (category === 'setting') return 'settings'
  return 'actions'
}

const normalizeIndexResults = (
  indexMatches: SearchAction[],
  scope: SearchScope,
  queryTokens: string[],
): SearchSections => {
  const sections = createEmptySections()

  indexMatches.forEach((item) => {
    const section = categorySectionFromIndex(item.category)
    if (!isSectionAllowed(section, scope)) return

    const title = item.title || 'Untitled'
    const subtitle = item.description || ''
    const metadata = item.path || ''
    const score =
      scoreMatch(queryTokens, title, item.keywords) +
      scoreMatch(queryTokens, subtitle, item.keywords) +
      scoreMatch(queryTokens, metadata)

    sections[section].push({
      key: buildResultKey(section, item.id, item.path || '#', 'index'),
      id: item.id,
      title,
      subtitle,
      type: item.category,
      url: item.path || '#',
      metadata,
      score,
      section,
      category: item.category,
      source: 'index',
    })
  })

  return sections
}

const getSectionDefaultUrl = (section: SearchSectionKey, id: string | number): string => {
  if (section === 'students') return `/dashboard/students/${id}`
  if (section === 'teachers') return '/dashboard/teachers'
  if (section === 'groups') return `/dashboard/groups/${id}`
  if (section === 'courses') return '/dashboard/courses'
  if (section === 'pages') return '/dashboard'
  if (section === 'features') return '/dashboard'
  if (section === 'settings') return '/dashboard/settings'
  if (section === 'actions') return '#'
  return '#'
}

const getEntityResultTitle = (item: any): string => {
  if (item.title) return item.title
  if (item.name) return item.name
  if (item.full_name) return item.full_name

  const combinedName = [item.first_name, item.last_name].filter(Boolean).join(' ').trim()
  if (combinedName) return combinedName
  if (item.username) return item.username
  return 'Unnamed'
}

const normalizeEntityResult = (
  section: SearchSectionKey,
  item: any,
  queryTokens: string[],
  source: SearchSource,
): SearchResult | null => {
  const id = item?.id
  if (id === undefined || id === null) return null

  const title = getEntityResultTitle(item)
  let subtitle = ''
  let metadata = ''
  let type = section.slice(0, -1)

  if (section === 'students' || section === 'teachers') {
    subtitle = [item.subtitle, item.email, item.phone].filter(Boolean).join(' • ')
    metadata = item.username || ''
    type = section === 'students' ? 'student' : 'teacher'
  } else if (section === 'groups') {
    const courseName = typeof item.course === 'string' ? item.course : item.course?.name
    const teacherName =
      item.teacher ||
      [item.main_teacher?.first_name, item.main_teacher?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim()
    subtitle = [courseName, teacherName].filter(Boolean).join(' • ')
    metadata = item.days || ''
    type = 'group'
  } else if (section === 'courses') {
    subtitle = item.description || ''
    metadata = item.cefr_level?.name || item.cefr_level || ''
    type = 'course'
  }

  if (!subtitle) {
    subtitle =
      section === 'students'
        ? 'Student'
        : section === 'teachers'
          ? 'Teacher'
          : section === 'groups'
            ? 'Group'
            : 'Course'
  }

  const url = item.url || getSectionDefaultUrl(section, id)
  const score =
    scoreMatch(queryTokens, title) +
    scoreMatch(queryTokens, subtitle) +
    scoreMatch(queryTokens, metadata)

  return {
    key: buildResultKey(section, id, url, source),
    id,
    title,
    subtitle,
    type,
    url,
    metadata,
    score,
    section,
    category: 'entity',
    source,
  }
}

const normalizeBackendSearchPayload = (
  payload: any,
  scope: SearchScope,
  queryTokens: string[],
  source: SearchSource,
): SearchSections => {
  const sections = createEmptySections()
  if (!payload) return sections

  ENTITY_SECTIONS.forEach((section) => {
    if (!isSectionAllowed(section, scope)) return

    const normalizedItems = toArray<any>(payload[section])
      .map((item) => normalizeEntityResult(section, item, queryTokens, source))
      .filter((item): item is SearchResult => Boolean(item))

    sections[section] = normalizedItems
  })

  return sections
}

const mergeSections = (...sectionSets: SearchSections[]): SearchSections => {
  const merged = createEmptySections()

  SECTION_ORDER.forEach((section) => {
    const bucket = new Map<string, SearchResult>()

    sectionSets.forEach((set) => {
      set[section].forEach((item) => {
        const existing = bucket.get(item.key)
        if (!existing || item.score > existing.score) {
          bucket.set(item.key, item)
        }
      })
    })

    const sortedItems = Array.from(bucket.values()).sort((a, b) => {
      if (section === 'recent') return b.score - a.score
      if (b.score !== a.score) return b.score - a.score
      return a.title.localeCompare(b.title)
    })

    merged[section] = sortedItems.slice(0, MAX_RESULTS_PER_SECTION)
  })

  return merged
}

const serializeRecentSearches = (items: RecentSearchItem[]) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(items))
}

const loadRecentSearches = (): RecentSearchItem[] => {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item) => item?.title && item?.url && item?.query)
      .slice(0, MAX_RECENT_ITEMS) as RecentSearchItem[]
  } catch {
    return []
  }
}

const recentItemsToSection = (items: RecentSearchItem[], queryTokens: string[]): SearchSections => {
  const sections = createEmptySections()

  sections.recent = items
    .map<SearchResult>((item) => {
      const score =
        (item.timestamp || 0) +
        scoreMatch(queryTokens, item.title) +
        scoreMatch(queryTokens, item.subtitle) +
        scoreMatch(queryTokens, item.query)

      return {
        key: buildResultKey('recent', item.id, item.url, 'recent'),
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        type: item.type || 'recent',
        url: item.url,
        metadata: item.query,
        score,
        section: 'recent',
        category: 'recent',
        source: 'recent',
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECENT_ITEMS)

  return sections
}

const suggestedItemsToSection = (): SearchSections => {
  const sections = createEmptySections()

  const suggested = SEARCH_INDEX.filter((item) => item.category === 'page' || item.category === 'action').slice(
    0,
    MAX_RESULTS_PER_SECTION,
  )

  suggested.forEach((item) => {
    const section = categorySectionFromIndex(item.category)
    sections[section].push({
      key: buildResultKey(section, item.id, item.path || '#', 'index'),
      id: item.id,
      title: item.title,
      subtitle: item.description || '',
      type: item.category,
      url: item.path || '#',
      metadata: item.path || '',
      score: 1,
      section,
      category: item.category,
      source: 'index',
    })
  })

  return sections
}

const shouldSearchEntities = (scope: SearchScope): boolean => scope === 'all' || ENTITY_SECTIONS.includes(scope)

const shouldSearchFrontendIndex = (scope: SearchScope): boolean =>
  scope === 'all' || FRONTEND_SECTIONS.includes(scope)

const filterSectionsByRouteAccess = (
  sections: SearchSections,
  canAccessUrl: (url: string) => boolean,
): SearchSections => {
  const filtered = createEmptySections()

  SECTION_ORDER.forEach((section) => {
    filtered[section] = sections[section].filter((item) => {
      if (!item.url || item.url === '#') return true
      return canAccessUrl(item.url)
    })
  })

  return filtered
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const highlightMatches = (text: string, tokens: string[]): ReactNode => {
  if (!text || tokens.length === 0) return text

  const uniqueTokens = Array.from(new Set(tokens.map((token) => token.trim()).filter(Boolean)))
  if (uniqueTokens.length === 0) return text

  const pattern = new RegExp(`(${uniqueTokens.map(escapeRegExp).join('|')})`, 'gi')
  const parts = text.split(pattern)

  return parts.map((part, index) => {
    const isMatch = uniqueTokens.some((token) => token.toLowerCase() === part.toLowerCase())
    if (isMatch) {
      return (
        <mark key={`${part}-${index}`} className="bg-primary/20 text-primary rounded px-1">
          {part}
        </mark>
      )
    }
    return <Fragment key={`${part}-${index}`}>{part}</Fragment>
  })
}

const getResultIcon = (type: string, category: SearchCategory) => {
  const normalizedType = (type || '').toLowerCase()

  if (category === 'recent') return History
  if (normalizedType === 'student') return Users
  if (normalizedType === 'teacher') return GraduationCap
  if (normalizedType === 'group' || normalizedType === 'course') return BookOpen
  if (normalizedType === 'event') return Calendar
  if (normalizedType === 'product') return ShoppingCart
  if (normalizedType === 'ticket') return MessageCircle
  if (normalizedType === 'announcement') return Megaphone
  if (normalizedType === 'expense') return Receipt
  if (normalizedType === 'certificate') return Award
  if (normalizedType === 'payment') return DollarSign
  if (normalizedType === 'setting') return Settings
  if (normalizedType === 'feature') return Star
  if (normalizedType === 'action') return Send
  if (normalizedType === 'page') return FileText
  if (normalizedType === 'help') return HelpCircle
  if (normalizedType === 'logout') return LogOut
  if (normalizedType === 'leaderboard') return Trophy

  return Tag
}

const fetchFallbackEntityResults = async (
  query: string,
  scope: SearchScope,
  queryTokens: string[],
): Promise<SearchSections> => {
  const sections = createEmptySections()
  if (!shouldSearchEntities(scope)) return sections

  const calls: Array<Promise<void>> = []

  if (isSectionAllowed('students', scope)) {
    calls.push(
      apiService
        .getStudents({ page: 1, limit: MAX_RESULTS_PER_SECTION, search: query })
        .then((response) => {
          const students = toArray<any>(response?.results || response)
          sections.students = students
            .map((item) => normalizeEntityResult('students', item, queryTokens, 'fallback'))
            .filter((item): item is SearchResult => Boolean(item))
        })
        .catch(() => {}),
    )
  }

  if (isSectionAllowed('teachers', scope)) {
    calls.push(
      apiService
        .getTeachers({ page: 1, limit: MAX_RESULTS_PER_SECTION, search: query })
        .then((response) => {
          const teachers = toArray<any>(response?.results || response)
          sections.teachers = teachers
            .map((item) => normalizeEntityResult('teachers', item, queryTokens, 'fallback'))
            .filter((item): item is SearchResult => Boolean(item))
        })
        .catch(() => {}),
    )
  }

  if (isSectionAllowed('groups', scope)) {
    calls.push(
      apiService
        .getGroups({ page: 1, limit: MAX_RESULTS_PER_SECTION, search: query })
        .then((response) => {
          const groups = toArray<any>(response?.results || response)
          sections.groups = groups
            .map((item) => normalizeEntityResult('groups', item, queryTokens, 'fallback'))
            .filter((item): item is SearchResult => Boolean(item))
        })
        .catch(() => {}),
    )
  }

  if (isSectionAllowed('courses', scope)) {
    calls.push(
      apiService
        .getCourses({ page: 1, limit: MAX_RESULTS_PER_SECTION, search: query })
        .then((response) => {
          const courses = toArray<any>(response?.results || response)
          sections.courses = courses
            .map((item) => normalizeEntityResult('courses', item, queryTokens, 'fallback'))
            .filter((item): item is SearchResult => Boolean(item))
        })
        .catch(() => {}),
    )
  }

  await Promise.all(calls)
  return sections
}

export default function GlobalSearch() {
  const router = useRouter()
  const { logout, user } = useAuth()
  const permissions = usePermissions(user)
  const { translateText } = useSettings()

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [sections, setSections] = useState<SearchSections>(createEmptySections())
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const searchRequestRef = useRef(0)
  const resultCacheRef = useRef<Map<string, SearchSections>>(new Map())

  const parsedInput = useMemo(() => parseSearchInput(query), [query])
  const debouncedSearchTerm = useDebouncedValue(parsedInput.query, SEARCH_DEBOUNCE_MS)
  const displayTokens = useMemo(() => tokenize(parsedInput.query), [parsedInput.query])
  const debouncedTokens = useMemo(() => tokenize(debouncedSearchTerm), [debouncedSearchTerm])

  const openSearch = useCallback(() => {
    setIsOpen(true)
  }, [])

  const closeSearch = useCallback(() => {
    // Invalidate any in-flight async result before clearing local state.
    searchRequestRef.current += 1
    setIsOpen(false)
    setQuery('')
    setSections(createEmptySections())
    setSelectedIndex(0)
    setIsSearching(false)
  }, [])

  useEffect(() => {
    const stored = loadRecentSearches()
    setRecentSearches(stored)
  }, [])

  // Open with Ctrl+K / Cmd+K
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIsOpen(true)
      }
      if (event.key === 'Escape') {
        closeSearch()
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => {
      window.removeEventListener('keydown', handleShortcut)
    }
  }, [closeSearch])

  useEffect(() => {
    if (!isOpen) return
    inputRef.current?.focus()
  }, [isOpen])

  const runSearch = useCallback(async (searchTerm: string, scope: SearchScope) => {
    const requestId = ++searchRequestRef.current
    const cacheKey = `${scope}::${searchTerm.toLowerCase()}`
    const cached = resultCacheRef.current.get(cacheKey)
    if (cached) {
      setSections(cached)
      setSelectedIndex(0)
      setIsSearching(false)
      return
    }

    setIsSearching(true)

    try {
      const [globalPayload, fallbackSections, indexMatches] = await Promise.all([
        shouldSearchEntities(scope) ? apiService.globalSearch(searchTerm) : Promise.resolve(null),
        shouldSearchEntities(scope)
          ? fetchFallbackEntityResults(searchTerm, scope, debouncedTokens)
          : Promise.resolve(createEmptySections()),
        shouldSearchFrontendIndex(scope)
          ? Promise.resolve(searchIndex(searchTerm, { scope: toIndexScope(scope), limit: 32 }))
          : Promise.resolve([]),
      ])

      if (searchRequestRef.current !== requestId) return

      const backendSections = normalizeBackendSearchPayload(globalPayload, scope, debouncedTokens, 'backend')
      const indexSections = normalizeIndexResults(indexMatches, scope, debouncedTokens)
      const mergedSections = mergeSections(backendSections, fallbackSections, indexSections)

      resultCacheRef.current.set(cacheKey, mergedSections)
      setSections(mergedSections)
      setSelectedIndex(0)
    } catch (error) {
      if (searchRequestRef.current !== requestId) return
      console.error('Global search failed:', error)
      setSections(createEmptySections())
    } finally {
      if (searchRequestRef.current === requestId) {
        setIsSearching(false)
      }
    }
  }, [debouncedTokens])

  useEffect(() => {
    if (!isOpen) return

    const trimmedTerm = debouncedSearchTerm.trim()
    if (!trimmedTerm) {
      // Cancel any in-flight response so stale data cannot repopulate results.
      searchRequestRef.current += 1
      setIsSearching(false)
      setSections(createEmptySections())
      setSelectedIndex(0)
      return
    }

    runSearch(trimmedTerm, parsedInput.scope)
  }, [debouncedSearchTerm, isOpen, parsedInput.scope, runSearch])

  const suggestionSections = useMemo(() => {
    if (parsedInput.query.trim()) return createEmptySections()
    const recentSection = recentItemsToSection(recentSearches, displayTokens)
    const suggestedSection = suggestedItemsToSection()
    return mergeSections(recentSection, suggestedSection)
  }, [parsedInput.query, recentSearches, displayTokens])

  const activeSections = useMemo(
    () => (parsedInput.query.trim() ? sections : suggestionSections),
    [parsedInput.query, sections, suggestionSections],
  )

  const canAccessResultUrl = useCallback(
    (url: string) => {
      if (!isDashboardRoute(url)) return true
      return canAccessPage(permissions.role, url)
    },
    [permissions.role],
  )

  const visibleSections = useMemo(
    () => filterSectionsByRouteAccess(activeSections, canAccessResultUrl),
    [activeSections, canAccessResultUrl],
  )

  const flatResults = useMemo(() => {
    const flattened: SearchResult[] = []
    SECTION_ORDER.forEach((section) => {
      visibleSections[section].forEach((item) => {
        flattened.push(item)
      })
    })
    return flattened
  }, [visibleSections])

  useEffect(() => {
    if (selectedIndex < 0) {
      setSelectedIndex(0)
      return
    }
    if (flatResults.length > 0 && selectedIndex >= flatResults.length) {
      setSelectedIndex(0)
    }
  }, [flatResults.length, selectedIndex])

  const pushRecentResult = useCallback((result: SearchResult, searchTerm: string) => {
    if (result.section === 'recent') return
    if (!result.url || result.url === '#') return
    if (!searchTerm.trim()) return

    setRecentSearches((previous) => {
      const updated: RecentSearchItem[] = [
        {
          id: result.id,
          title: result.title,
          subtitle: result.subtitle,
          type: result.type,
          url: result.url,
          section: result.section,
          query: searchTerm,
          timestamp: Date.now(),
        },
        ...previous.filter((item) => !(item.url === result.url && item.title === result.title)),
      ].slice(0, MAX_RECENT_ITEMS)

      serializeRecentSearches(updated)
      return updated
    })
  }, [])

  const handleResultClick = useCallback(async (result: SearchResult) => {
    if (result.id === 'action-logout') {
      await logout()
      router.push('/login')
      closeSearch()
      return
    }

    if (result.url && result.url !== '#' && !canAccessResultUrl(result.url)) {
      return
    }

    const searchTerm = parsedInput.query.trim()
    if (searchTerm) {
      pushRecentResult(result, searchTerm)
    }

    if (result.url && result.url !== '#') {
      router.push(result.url)
    }

    closeSearch()
  }, [canAccessResultUrl, closeSearch, logout, parsedInput.query, pushRecentResult, router])

  useEffect(() => {
    const handleKeyboardNavigation = (event: KeyboardEvent) => {
      if (!isOpen) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (!flatResults.length) return
        setSelectedIndex((previous) => (previous + 1) % flatResults.length)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        if (!flatResults.length) return
        setSelectedIndex((previous) => (previous - 1 + flatResults.length) % flatResults.length)
        return
      }

      if (event.key === 'Enter') {
        if (!flatResults.length) return
        event.preventDefault()
        void handleResultClick(flatResults[selectedIndex])
      }
    }

    window.addEventListener('keydown', handleKeyboardNavigation)
    return () => {
      window.removeEventListener('keydown', handleKeyboardNavigation)
    }
  }, [flatResults, handleResultClick, isOpen, selectedIndex])

  useEffect(() => {
    if (!isOpen || selectedIndex < 0 || !flatResults.length) return
    const selectedElement = document.querySelector<HTMLElement>(`[data-search-item-index="${selectedIndex}"]`)
    selectedElement?.scrollIntoView({ block: 'nearest' })
  }, [flatResults.length, isOpen, selectedIndex])

  const setScope = (scope: SearchScope) => {
    const term = parsedInput.query
    if (scope === 'all') {
      setQuery(term)
    } else {
      setQuery(`in:${scope} ${term}`.trim())
    }
    setSelectedIndex(0)
    inputRef.current?.focus()
  }

  const clearRecentSearches = () => {
    setRecentSearches([])
    serializeRecentSearches([])
  }

  const hasResults = flatResults.length > 0
  const hasActiveSearch = parsedInput.query.trim().length > 0

  let visualIndex = -1

  return (
    <>
      <button
        onClick={openSearch}
        className="glass-chip group flex items-center gap-2 px-4 py-2 rounded-xl border border-border/70 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200"
      >
        <Search className="h-5 w-5 text-text-secondary group-hover:text-primary transition-colors" />
        <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">{translateText('Search...')}</span>
        <kbd className="hidden md:inline-flex items-center gap-1 px-2 py-1 bg-background border border-border rounded text-xs font-mono">
          Ctrl/⌘ K
        </kbd>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center pt-12 px-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeSearch} />

          <div className="glass-panel-strong relative w-full max-w-3xl border border-border/70 rounded-2xl shadow-2xl overflow-hidden">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!flatResults.length) return
                void handleResultClick(flatResults[selectedIndex])
              }}
              className="relative"
            >
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search everything... try in:students ali, /settings, >logout, @john"
                className="w-full pl-12 pr-20 py-4 bg-transparent border-b border-border focus:outline-none text-lg"
              />

              {parsedInput.scope !== 'all' && (
                <span className="absolute right-14 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-medium rounded-md bg-primary/10 text-primary border border-primary/30">
                  in:{parsedInput.scope}
                </span>
              )}

              {isSearching ? (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary animate-spin" />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setSections(createEmptySections())
                    inputRef.current?.focus()
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-background rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-text-secondary" />
                </button>
              )}
            </form>

            <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border bg-background/40">
              {(
                ['all', 'students', 'teachers', 'groups', 'courses', 'pages', 'features', 'settings', 'actions'] as SearchScope[]
              ).map((scope) => {
                const isActive = parsedInput.scope === scope || (scope === 'all' && parsedInput.scope === 'all')
                return (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setScope(scope)}
                    className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                      isActive
                        ? 'bg-primary/15 border-primary/40 text-primary'
                        : 'bg-surface border-border text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {scope}
                  </button>
                )
              })}
            </div>

            <div className="px-4 py-2 border-b border-border text-xs text-text-secondary flex items-center justify-between">
              <span>
                {isSearching
                  ? 'Searching...'
                  : `${flatResults.length} ${flatResults.length === 1 ? 'result' : 'results'}`}
              </span>
                <span className="hidden sm:inline-flex items-center gap-2">
                <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Debounced search</span>
                <span>•</span>
                <span>Use in:scope, /pages, {'>'}actions, @students</span>
              </span>
            </div>

            {hasResults && (
              <div className="max-h-[480px] overflow-y-auto">
                {SECTION_ORDER.map((section) => {
                  const items = visibleSections[section]
                  if (!items.length) return null

                  return (
                    <div key={section}>
                      <h3 className="px-4 pt-4 pb-2 text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center justify-between">
                        <span>{translateText(SECTION_LABELS[section])}</span>
                        <span>{items.length}</span>
                      </h3>

                      {items.map((result) => {
                        visualIndex += 1
                        const currentIndex = visualIndex
                        const Icon = getResultIcon(result.type, result.category)
                        const isSelected = currentIndex === selectedIndex

                        return (
                          <button
                            key={result.key}
                            data-search-item-index={currentIndex}
                            onClick={() => {
                              void handleResultClick(result)
                            }}
                            className={`w-full flex items-center gap-4 p-4 hover:bg-background transition-colors text-left ${
                              isSelected ? 'bg-background border-l-2 border-primary' : ''
                            }`}
                          >
                            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{highlightMatches(result.title, displayTokens)}</p>
                              <p className="text-sm text-text-secondary truncate">
                                {highlightMatches(result.subtitle, displayTokens)}
                              </p>
                              {result.metadata && (
                                <p className="text-xs text-text-secondary/80 truncate mt-0.5">
                                  {highlightMatches(result.metadata, displayTokens)}
                                </p>
                              )}
                            </div>

                            <ArrowRight className="h-4 w-4 text-text-secondary" />
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}

            {hasActiveSearch && !isSearching && !hasResults && (
              <div className="p-8 text-center">
                <Search className="h-12 w-12 text-text-secondary/50 mx-auto mb-4" />
                <p className="text-text-secondary">
                  No results found for &quot;{parsedInput.query}&quot;
                </p>
                <p className="text-sm text-text-secondary/70 mt-2">
                  Try another term or use a scope like <code>in:students</code>.
                </p>
              </div>
            )}

            {!hasActiveSearch && !hasResults && (
              <div className="p-6 text-center text-text-secondary">
                <p>Start typing to search across data, pages, settings, and actions.</p>
              </div>
            )}

            <div className="p-3 border-t border-border bg-background/40 text-xs text-text-secondary flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-background border border-border rounded">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-background border border-border rounded">Enter</kbd>
                  Open
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-background border border-border rounded">Esc</kbd>
                  Close
                </span>
              </div>

              <button
                type="button"
                onClick={clearRecentSearches}
                className="text-text-secondary hover:text-text-primary inline-flex items-center gap-1"
              >
                <History className="h-3.5 w-3.5" />
                Clear recent
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
