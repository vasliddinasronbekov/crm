/**
 * Quick test to verify searchIndex is working
 * Run with: node test-search.js
 */

// Mock searchIndex.ts functionality for Node.js testing
const SEARCH_INDEX = [
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
    id: 'dashboard-students',
    title: 'Students',
    description: 'View and manage students',
    keywords: ['students', 'pupils', 'learners', 'users', 'list'],
    category: 'page',
    path: '/dashboard/students',
    icon: 'users'
  },
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
    id: 'email-campaigns',
    title: 'Email Campaigns',
    description: 'Create and manage email campaigns',
    keywords: ['email', 'campaigns', 'marketing', 'newsletter', 'bulk'],
    category: 'page',
    path: '/dashboard/email/campaigns',
    icon: 'mail-bulk'
  }
]

function searchIndex(query) {
  if (!query || query.trim().length === 0) {
    return []
  }

  const lowerQuery = query.toLowerCase().trim()
  const queryWords = lowerQuery.split(' ').filter(w => w.length > 0)

  return SEARCH_INDEX.filter(item => {
    // Check title
    const titleMatch = item.title.toLowerCase().includes(lowerQuery)

    // Check description
    const descriptionMatch = item.description?.toLowerCase().includes(lowerQuery)

    // Check keywords - must match ALL query words
    const keywordMatch = queryWords.every(word =>
      item.keywords.some(keyword => keyword.includes(word))
    )

    // Check if title or description contains all words
    const multiWordMatch = queryWords.every(word =>
      item.title.toLowerCase().includes(word) ||
      item.description?.toLowerCase().includes(word)
    )

    return titleMatch || descriptionMatch || keywordMatch || multiWordMatch
  }).sort((a, b) => {
    // Prioritize exact title matches
    const aExactTitle = a.title.toLowerCase() === lowerQuery
    const bExactTitle = b.title.toLowerCase() === lowerQuery
    if (aExactTitle && !bExactTitle) return -1
    if (!aExactTitle && bExactTitle) return 1

    // Prioritize title starts with query
    const aTitleStarts = a.title.toLowerCase().startsWith(lowerQuery)
    const bTitleStarts = b.title.toLowerCase().startsWith(lowerQuery)
    if (aTitleStarts && !bTitleStarts) return -1
    if (!aTitleStarts && bTitleStarts) return 1

    // Prioritize by category order: page > feature > setting > action
    const categoryOrder = { page: 0, feature: 1, setting: 2, action: 3 }
    return categoryOrder[a.category] - categoryOrder[b.category]
  })
}

// Run tests
console.log('🔍 Testing Search Index Functionality\n')

// Test 1: Search for "dark"
console.log('Test 1: Search for "dark"')
const darkResults = searchIndex('dark')
console.log(`Results: ${darkResults.length}`)
darkResults.forEach(r => console.log(`  ✓ ${r.title} (${r.category})`))
console.log(darkResults.length > 0 ? '✅ PASS' : '❌ FAIL')
console.log()

// Test 2: Search for "student"
console.log('Test 2: Search for "student"')
const studentResults = searchIndex('student')
console.log(`Results: ${studentResults.length}`)
studentResults.forEach(r => console.log(`  ✓ ${r.title} (${r.category})`))
console.log(studentResults.length > 0 ? '✅ PASS' : '❌ FAIL')
console.log()

// Test 3: Search for "email"
console.log('Test 3: Search for "email"')
const emailResults = searchIndex('email')
console.log(`Results: ${emailResults.length}`)
emailResults.forEach(r => console.log(`  ✓ ${r.title} (${r.category})`))
console.log(emailResults.length > 0 ? '✅ PASS' : '❌ FAIL')
console.log()

// Test 4: Empty search
console.log('Test 4: Empty search')
const emptyResults = searchIndex('')
console.log(`Results: ${emptyResults.length}`)
console.log(emptyResults.length === 0 ? '✅ PASS' : '❌ FAIL')
console.log()

// Test 5: Multi-word search
console.log('Test 5: Multi-word search "add student"')
const multiResults = searchIndex('add student')
console.log(`Results: ${multiResults.length}`)
multiResults.forEach(r => console.log(`  ✓ ${r.title} (${r.category})`))
console.log(multiResults.length > 0 ? '✅ PASS' : '❌ FAIL')
console.log()

console.log('🎉 All tests completed!')
