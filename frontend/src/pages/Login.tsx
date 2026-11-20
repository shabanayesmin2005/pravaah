import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err.response?.status === 429) {
        setErrorMsg('Too many login attempts. Please wait a moment and try again.');
      } else if (err.response?.status === 401) {
        setErrorMsg('Invalid email or password. Please verify credentials.');
      } else {
        setErrorMsg(err.response?.data?.error || 'Failed to authenticate. Check server status.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background radial gradient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-950/20 rounded-full blur-[140px] pointer-events-none" />

      {/* Main card */}
      <div className="max-w-md w-full bg-[#111827] border border-gray-800 rounded-3xl p-8 shadow-2xl shadow-black/80 relative z-10">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-emerald-500 items-center justify-center text-white font-black text-2xl shadow-lg shadow-cyan-900/50 mb-4">
            प्र
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-wider">PRAVAAH</h1>
            <span className="text-sm font-bold text-cyan-400">प्रवाह</span>
          </div>
          <p className="text-[11px] font-semibold text-gray-400 mt-1 uppercase tracking-widest">
            City-Wide ANPR & Traffic Intelligence
          </p>
          <div className="mt-3 px-3 py-1.5 rounded-lg bg-gray-900/80 border border-gray-800 text-[11px] text-gray-300 font-medium">
            हर वाहन | हर मार्ग | एक दृष्टि | स्मार्ट शहर की गति
          </div>
        </div>

        {/* Error notification banner */}
        {errorMsg && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-950/70 border border-red-700/60 text-red-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@pravaah.local"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-900 border border-gray-700 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Secure Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-900 border border-gray-700 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-semibold text-sm shadow-lg shadow-cyan-950/60 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Verifying Authorization...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Access Command Center</span>
              </>
            )}
          </button>
        </form>

        {/* Security badge footer */}
        <div className="mt-8 pt-4 border-t border-gray-800 text-center">
          <p className="text-[11px] text-gray-500">
            PRAVAAH v1.0 • Encrypted Role-Based Session Architecture
          </p>
        </div>
      </div>
    </div>
  );
};
