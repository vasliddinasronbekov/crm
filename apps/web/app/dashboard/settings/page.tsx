'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings, Language, Theme, Currency } from '@/contexts/SettingsContext'
import apiService from '@/lib/api'
import toast from '@/lib/toast'
import {
  User, Mail, Phone, Lock, Shield, Bell, Palette,
  Globe, Download, Trash2, Save, AlertTriangle,
  Eye, EyeOff, Check, X, UserCircle2, DollarSign,
  Sun, Moon, Sparkles
} from 'lucide-react'

export default function SettingsPage() {
  const { user } = useAuth()
  const { language, theme, currency, setLanguage, setTheme, setCurrency, t } = useSettings()
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Profile form state
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  })

  // Password form state
  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  })

  // Password strength indicator
  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, label: '', color: '' }

    let strength = 0
    if (password.length >= 8) strength++
    if (password.length >= 12) strength++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
    if (/\d/.test(password)) strength++
    if (/[^a-zA-Z\d]/.test(password)) strength++

    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong']
    const colors = ['', 'text-error', 'text-warning', 'text-success', 'text-success', 'text-primary']

    return { strength, label: labels[strength], color: colors[strength] }
  }

  const passwordStrength = getPasswordStrength(passwordData.new_password)

  useEffect(() => {
    if (user) {
      setProfileData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
      })
    }
  }, [user])

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      await apiService.updateProfile(profileData)
      toast.success('Profile updated successfully!')
    } catch (error: any) {
      console.error('Failed to update profile:', error)
      toast.error(error.response?.data?.detail || 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.warning('Passwords do not match')
      return
    }

    if (passwordData.new_password.length < 8) {
      toast.warning('Password must be at least 8 characters long')
      return
    }

    setIsSaving(true)

    try {
      await apiService.changePassword({
        old_password: passwordData.old_password,
        new_password: passwordData.new_password,
      })
      toast.success('Password changed successfully!')
      setPasswordData({ old_password: '', new_password: '', confirm_password: '' })
    } catch (error: any) {
      console.error('Failed to change password:', error)
      toast.error(error.response?.data?.detail || 'Failed to change password')
    } finally {
      setIsSaving(false)
    }
  }

  const getInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    }
    return user?.username?.substring(0, 2).toUpperCase() || '??'
  }

  const getRoleBadge = () => {
    if (user?.is_superuser) return { label: 'Administrator', icon: '🛡️', color: 'from-red-500/20 to-orange-500/20 text-red-500 border-red-500/30' }
    if (user?.is_staff) return { label: 'Staff', icon: '⚙️', color: 'from-warning/20 to-orange-500/20 text-warning border-warning/30' }
    if (user?.is_teacher) return { label: 'Teacher', icon: '👨‍🏫', color: 'from-primary/20 to-cyan-500/20 text-primary border-primary/30' }
    return { label: 'User', icon: '👤', color: 'from-gray-500/20 to-gray-600/20 text-gray-500 border-gray-500/30' }
  }

  const roleBadge = getRoleBadge()

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">
          {t('settings.title')} ⚙️
        </h1>
        <p className="text-text-secondary">{t('settings.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Information Card */}
          <div className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all">
            <div className="flex items-center gap-4 mb-6">
              <User className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-bold">{t('settings.profile')}</h2>
            </div>

            {/* Profile Preview */}
            <div className="flex items-center gap-4 p-4 mb-6 bg-gradient-to-br from-primary/10 to-cyan-500/10 rounded-xl border border-primary/20">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-xl border-2 border-primary/30">
                {getInitials()}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg">
                  {user?.first_name && user?.last_name
                    ? `${user.first_name} ${user.last_name}`
                    : user?.username || 'User'}
                </h3>
                <p className="text-sm text-text-secondary">@{user?.username}</p>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold mt-2 bg-gradient-to-r ${roleBadge.color} border`}>
                  <span>{roleBadge.icon}</span>
                  {roleBadge.label}
                </span>
              </div>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                    <UserCircle2 className="h-4 w-4 text-primary" />
                    First Name
                  </label>
                  <input
                    type="text"
                    value={profileData.first_name}
                    onChange={(e) =>
                      setProfileData({ ...profileData, first_name: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                    <UserCircle2 className="h-4 w-4 text-primary" />
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={profileData.last_name}
                    onChange={(e) =>
                      setProfileData({ ...profileData, last_name: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) =>
                    setProfileData({ ...profileData, email: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) =>
                    setProfileData({ ...profileData, phone: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  placeholder="+998901234567"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Role
                </label>
                <input
                  type="text"
                  value={roleBadge.label}
                  disabled
                  className="w-full px-4 py-3 bg-background/50 border border-border rounded-xl opacity-60 cursor-not-allowed"
                />
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full px-6 py-3 bg-gradient-to-r from-primary to-cyan-500 text-white rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
              >
                <Save className="h-5 w-5" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>

          {/* Security Card */}
          <div className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all">
            <div className="flex items-center gap-4 mb-6">
              <Lock className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-bold">{t('settings.security')}</h2>
            </div>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Current Password</label>
                <div className="relative">
                  <input
                    type={showOldPassword ? "text" : "password"}
                    placeholder="Enter current password"
                    value={passwordData.old_password}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, old_password: e.target.value })
                    }
                    required
                    className="w-full px-4 py-3 pr-12 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-primary transition-colors"
                  >
                    {showOldPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter new password (min 8 characters)"
                    value={passwordData.new_password}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, new_password: e.target.value })
                    }
                    required
                    minLength={8}
                    className="w-full px-4 py-3 pr-12 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-primary transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {passwordData.new_password && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-text-secondary">Password Strength:</span>
                      <span className={`text-xs font-semibold ${passwordStrength.color}`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-all ${
                            i < passwordStrength.strength
                              ? 'bg-gradient-to-r from-primary to-cyan-500'
                              : 'bg-border'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={passwordData.confirm_password}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, confirm_password: e.target.value })
                    }
                    required
                    className="w-full px-4 py-3 pr-12 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-primary transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {passwordData.confirm_password && (
                  <div className="mt-2 flex items-center gap-2">
                    {passwordData.new_password === passwordData.confirm_password ? (
                      <>
                        <Check className="h-4 w-4 text-success" />
                        <span className="text-xs text-success font-medium">Passwords match</span>
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4 text-error" />
                        <span className="text-xs text-error font-medium">Passwords do not match</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full px-6 py-3 bg-background border-2 border-primary/50 text-primary rounded-xl hover:bg-primary/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
              >
                <Lock className="h-5 w-5" />
                {isSaving ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>

        {/* Quick Actions Sidebar */}
        <div className="space-y-6">
          {/* Language Settings */}
          <div className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">{t('settings.language')}</h2>
            </div>
            <p className="text-xs text-text-secondary mb-4">{t('settings.language.description')}</p>
            <div className="space-y-2">
              {[
                { value: 'en' as Language, label: 'English', flag: '🇬🇧' },
                { value: 'uz' as Language, label: 'O\'zbekcha', flag: '🇺🇿' },
                { value: 'ru' as Language, label: 'Русский', flag: '🇷🇺' },
              ].map((lang) => (
                <button
                  key={lang.value}
                  onClick={() => {
                    setLanguage(lang.value)
                    toast.success(`Language changed to ${lang.label}`)
                  }}
                  className={`w-full px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${
                    language === lang.value
                      ? 'bg-primary text-white shadow-lg shadow-primary/30'
                      : 'bg-background hover:bg-primary/5 border border-border hover:border-primary/30'
                  }`}
                >
                  <span className="text-2xl">{lang.flag}</span>
                  <span className="font-semibold">{lang.label}</span>
                  {language === lang.value && (
                    <Check className="h-5 w-5 ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Theme Settings */}
          <div className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <Palette className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">{t('settings.theme')}</h2>
            </div>
            <p className="text-xs text-text-secondary mb-4">{t('settings.theme.description')}</p>
            <div className="space-y-2">
              {[
                { value: 'light' as Theme, label: t('theme.light'), icon: Sun, color: 'from-yellow-400 to-orange-500' },
                { value: 'dark' as Theme, label: t('theme.dark'), icon: Moon, color: 'from-blue-600 to-purple-600' },
                { value: 'custom' as Theme, label: t('theme.custom'), icon: Sparkles, color: 'from-purple-500 to-pink-500' },
              ].map((th) => (
                <button
                  key={th.value}
                  onClick={() => {
                    setTheme(th.value)
                    toast.success(`Theme changed to ${th.label}`)
                  }}
                  className={`w-full px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${
                    theme === th.value
                      ? `bg-gradient-to-r ${th.color} text-white shadow-lg`
                      : 'bg-background hover:bg-primary/5 border border-border hover:border-primary/30'
                  }`}
                >
                  <th.icon className="h-5 w-5" />
                  <span className="font-semibold">{th.label}</span>
                  {theme === th.value && (
                    <Check className="h-5 w-5 ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Currency Settings */}
          <div className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">{t('settings.currency')}</h2>
            </div>
            <p className="text-xs text-text-secondary mb-4">{t('settings.currency.description')}</p>
            <div className="space-y-2">
              {[
                { value: 'USD' as Currency, label: t('currency.usd'), symbol: '$' },
                { value: 'UZS' as Currency, label: t('currency.uzs'), symbol: 'so\'m' },
                { value: 'RUB' as Currency, label: t('currency.rub'), symbol: '₽' },
                { value: 'EUR' as Currency, label: t('currency.eur'), symbol: '€' },
              ].map((curr) => (
                <button
                  key={curr.value}
                  onClick={() => {
                    setCurrency(curr.value)
                    toast.success(`Currency changed to ${curr.value}`)
                  }}
                  className={`w-full px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${
                    currency === curr.value
                      ? 'bg-success text-white shadow-lg shadow-success/30'
                      : 'bg-background hover:bg-primary/5 border border-border hover:border-primary/30'
                  }`}
                >
                  <span className="text-xl font-bold">{curr.symbol}</span>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-sm">{curr.value}</p>
                    <p className={`text-xs ${currency === curr.value ? 'text-white/80' : 'text-text-secondary'}`}>
                      {curr.label.split('(')[0].trim()}
                    </p>
                  </div>
                  {currency === curr.value && (
                    <Check className="h-5 w-5" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Danger Zone Card */}
          <div className="bg-surface rounded-2xl border border-error/30 p-6 hover:border-error/50 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-5 w-5 text-error" />
              <h2 className="text-lg font-bold text-error">Danger Zone</h2>
            </div>
            <div className="space-y-3">
              <button className="w-full px-4 py-3 bg-error/10 text-error rounded-xl hover:bg-error/20 transition-all font-semibold text-sm flex items-center justify-center gap-2 group">
                <Download className="h-4 w-4 group-hover:scale-110 transition-transform" />
                Export All Data
              </button>
              <button className="w-full px-4 py-3 bg-error/10 text-error rounded-xl hover:bg-error/20 transition-all font-semibold text-sm flex items-center justify-center gap-2 group">
                <Trash2 className="h-4 w-4 group-hover:scale-110 transition-transform" />
                Delete Account
              </button>
            </div>
            <p className="text-xs text-text-secondary mt-4 text-center">
              These actions are permanent and cannot be undone
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
