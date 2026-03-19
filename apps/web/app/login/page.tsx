'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(username, password);
      router.push('/dashboard');
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail ||
        err.message ||
        'Login failed. Please check your credentials.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 -left-16 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute right-0 top-1/4 h-72 w-72 rounded-full bg-success/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-warning/20 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="glass-panel-strong rounded-3xl p-8 sm:p-10">
          <div className="mb-8 text-center">
            <div className="mb-4 flex items-center justify-center gap-2">
              <span className="text-4xl">✨</span>
              <h1 className="text-3xl font-bold text-primary">EDUOS</h1>
            </div>
            <p className="text-text-secondary">Sign in to your administrator account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-medium">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-3 focus:outline-none"
                placeholder="Enter your username"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-3 focus:outline-none"
                placeholder="Enter your password"
                required
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-text-secondary">
              Forgot your password?{' '}
              <button className="font-medium text-primary hover:underline">
                Contact administrator
              </button>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-text-secondary">
          <p>EduVoice Platform © 2025</p>
          <p className="mt-2">Version 1.0.0</p>
        </div>
      </div>
    </div>
  );
}
