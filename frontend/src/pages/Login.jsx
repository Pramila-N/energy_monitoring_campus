import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ZapOff, Lock, Mail, Eye, EyeOff, Activity, BrainCircuit, Leaf } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Spinner } from '../components/Feedback.jsx';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async (values) => {
    try {
      await login(values.email, values.password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Invalid credentials');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-ai/20 blur-3xl" />
      </div>

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-pop lg:grid-cols-2">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-brand-700 via-brand-600 to-ai p-10 text-white lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30">
              <ZapOff size={22} />
            </div>
            <div>
              <p className="text-lg font-extrabold">Smart Energy AI</p>
              <p className="text-xs text-white/70">Energy Monitoring & Optimization</p>
            </div>
          </div>

          <div className="space-y-6">
            <h1 className="text-3xl font-extrabold leading-tight">AI-powered energy intelligence for campus buildings.</h1>
            <ul className="space-y-3 text-sm text-white/85">
              <li className="flex items-center gap-3">
                <BrainCircuit size={18} className="shrink-0" />
                ML models forecast energy consumption per classroom
              </li>
              <li className="flex items-center gap-3">
                <Activity size={18} className="shrink-0" />
                Real-time anomaly detection with automatic alerts
              </li>
              <li className="flex items-center gap-3">
                <Leaf size={18} className="shrink-0" />
                Actionable optimization recommendations & energy savings
              </li>
            </ul>
          </div>

          <p className="text-xs text-white/50">© 2026 Campus Operations & Facilities</p>
        </div>

        <div className="p-8 sm:p-12">
          <div className="mb-8 lg:hidden">
            <p className="text-lg font-extrabold text-slate-800">Smart Energy AI</p>
            <p className="text-xs text-slate-500">Campus Monitoring Suite</p>
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Admin sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Access the live campus energy dashboard.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  placeholder="admin@smartcampus.local"
                  className="input pl-9"
                  {...register('email', { required: 'Email is required' })}
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input pl-9 pr-10"
                  {...register('password', { required: 'Password is required' })}
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-2.5 text-base">
              {isSubmitting ? <Spinner size={16} className="text-white" /> : 'Sign in'}
            </button>
          </form>

          <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-500">
            <p className="font-semibold text-slate-600">Demo credentials</p>
            <p className="mt-1">
              admin@smartcampus.local / Admin@123
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}