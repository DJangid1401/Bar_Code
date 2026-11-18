import { useState } from 'react';
import { useStore } from '../store';
import { Lock, User, Eye, EyeOff, LogIn, Package, AlertCircle } from 'lucide-react';

export default function Login() {
  const { login, isSyncing } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = await login(username, password);
    if (!res.success) {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 space-y-6">
        {/* Branding Header */}
        <div className="text-center space-y-2">
          <div className="bg-blue-600 text-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            <Package size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Swati Entreprise</h1>
          <p className="text-sm text-slate-500">
            Sign in with your Login ID and Password to manage stock.
          </p>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-sm text-red-700 flex items-center gap-2.5">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Login ID
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your Login ID"
                autoComplete="username"
                className="w-full pl-11 pr-4 py-3 border-2 border-slate-200 rounded-xl text-base focus:border-blue-600 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full pl-11 pr-11 py-3 border-2 border-slate-200 rounded-xl text-base focus:border-blue-600 focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSyncing}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer mt-2"
          >
            <LogIn size={20} />
            <span>{isSyncing ? 'Signing in...' : 'Sign In'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
