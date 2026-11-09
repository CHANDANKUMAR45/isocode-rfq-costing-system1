import React, { useState } from 'react';
import { AlertCircle, Building2, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 flex items-center justify-center">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl">
        <header className="text-center space-y-2 mb-7">
          <div className="mx-auto w-12 h-12 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-md">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            Isocode RFQ-to-Quote Costing
          </h1>
          <p className="text-xs text-slate-500">
            Manufacturing quotation workflow
          </p>
        </header>

        <div className="mb-5">
          <h2 className="text-base font-semibold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">
            Sign in with an account configured for this application.
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1.5">
              Work email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="name@example.invalid"
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
};
