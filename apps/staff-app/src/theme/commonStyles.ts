// Common Styles - Matching Web App Design System
import { StyleSheet } from 'react-native'
import colors from './colors'

export const commonStyles = StyleSheet.create({
  // Container Styles
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Card Styles (matching web .card class)
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },

  cardSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },

  // Stat Card (matching web .stat-card)
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },

  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },

  statLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Button Styles (matching web buttons)
  btnPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnPrimaryText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },

  btnSecondary: {
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },

  btnSecondaryText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },

  btnDanger: {
    backgroundColor: `${colors.error}15`,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnDangerText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: '600',
  },

  // Input Styles
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.textPrimary,
    fontSize: 16,
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 8,
  },

  inputError: {
    borderColor: colors.error,
  },

  inputHelper: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // Badge Styles
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },

  badgePrimary: {
    backgroundColor: colors.badge.primary,
  },

  badgeSuccess: {
    backgroundColor: colors.badge.success,
  },

  badgeWarning: {
    backgroundColor: colors.badge.warning,
  },

  badgeError: {
    backgroundColor: colors.badge.error,
  },

  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },

  badgeTextPrimary: {
    color: colors.primary,
  },

  badgeTextSuccess: {
    color: colors.success,
  },

  badgeTextWarning: {
    color: colors.warning,
  },

  badgeTextError: {
    color: colors.error,
  },

  // Text Styles
  h1: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },

  h2: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },

  h3: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },

  body: {
    fontSize: 16,
    color: colors.textPrimary,
  },

  bodySecondary: {
    fontSize: 16,
    color: colors.textSecondary,
  },

  caption: {
    fontSize: 14,
    color: colors.textSecondary,
  },

  small: {
    fontSize: 12,
    color: colors.textMuted,
  },

  // List Styles
  listItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },

  listItemPressed: {
    backgroundColor: colors.surfaceLight,
  },

  // Section Styles
  section: {
    marginBottom: 24,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },

  emptyStateText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },

  // Loading State
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },

  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },

  modalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '90%',
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
  },

  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },

  modalButtonFlex: {
    flex: 1,
  },

  // Shadow (Web uses border, mobile can use shadow)
  shadow: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
})

export default commonStyles
