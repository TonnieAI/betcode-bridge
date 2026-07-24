import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { ArrowLeftRight, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    setLoading(true);
    const { error } = await requestPasswordReset(email.trim());
    setLoading(false);

    if (error) {
      setError(error);
      return;
    }

    setSuccess('Password reset link sent. Check your inbox and spam folder.');
  }

  return (
    <div className="pt-16 min-h-screen flex items-center justify-center px-4">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#d4af37]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="card p-8 w-full max-w-md relative">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <div className="w-10 h-10 rounded-lg gold-gradient flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-[#0a0e1a]" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold">Bet<span className="gold-text">Code</span> Bridge</span>
        </Link>

        <h1 className="text-2xl font-bold text-center mb-1">Reset your password</h1>
        <p className="text-sm text-gray-400 text-center mb-6">Enter your account email to receive a reset link.</p>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm text-green-300 mb-4">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="input-field pl-10"
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Sending link...' : 'Send reset link'}
          </button>
        </form>

        <p className="text-sm text-gray-400 text-center mt-6">
          Remembered your password?{' '}
          <Link to="/login" className="gold-text hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
