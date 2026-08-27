import { useState } from 'react';
import { 
  Building2, 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Check, 
  ShieldCheck, 
  X,
  Sparkles,
  PhoneCall,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { registerBusiness, loginBusiness } from '../lib/authService';
import type { Shop, Item, Bill } from '../types';
import sanoBillLogo from '../assets/sano-bill-logo.png';

interface AuthScreenProps {
  initialMode?: 'login' | 'register';
  onClose?: () => void;
  onSuccess?: (authData: { 
    mode: 'login' | 'register'; 
    data: Record<string, string>; 
    user?: any;
    shop?: Shop; 
    items?: Item[]; 
    bills?: Bill[];
  }) => void;
}

export default function AuthScreen({ initialMode = 'login', onClose, onSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  
  // Login Form State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Register Form State
  const [businessName, setBusinessName] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [registerIdentifier, setRegisterIdentifier] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  // Status & Error state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isLoginValid = loginIdentifier.trim().length > 0 && loginPassword.length > 0;
  const isPanValid = /^\d{9}$/.test(panNumber);
  const isRegisterValid = 
    businessName.trim().length > 0 && 
    isPanValid && 
    ownerName.trim().length > 0 && 
    registerIdentifier.trim().length > 0 && 
    registerPassword.length >= 6;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoginValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setNotice(null);

    const result = await loginBusiness({
      identifier: loginIdentifier.trim(),
      password: loginPassword
    });

    setIsSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.message || 'Login failed. Please check your credentials.');
      return;
    }

    setNotice('Logged in successfully!');
    setTimeout(() => {
      if (onSuccess) {
        onSuccess({
          mode: 'login',
          data: {
            identifier: loginIdentifier.trim(),
            password: loginPassword,
            rememberMe: String(rememberMe)
          },
          user: result.user,
          shop: result.shop,
          items: result.items,
          bills: result.bills
        });
      }
    }, 400);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isRegisterValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setNotice(null);

    const result = await registerBusiness({
      businessName: businessName.trim(),
      panNumber: panNumber.trim(),
      ownerName: ownerName.trim(),
      identifier: registerIdentifier.trim(),
      password: registerPassword
    });

    setIsSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.message || 'Registration failed. Please check your details.');
      return;
    }

    setNotice('Business registered and linked to Supabase Auth successfully!');
    setTimeout(() => {
      if (onSuccess) {
        onSuccess({
          mode: 'register',
          data: {
            businessName: businessName.trim(),
            panNumber: panNumber.trim(),
            ownerName: ownerName.trim(),
            identifier: registerIdentifier.trim(),
            password: registerPassword
          },
          user: result.user,
          shop: result.shop,
          items: result.items,
          bills: result.bills
        });
      }
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#f2f2f2] flex justify-center font-[Inter,system-ui,sans-serif]">
      <div className="w-full max-w-[430px] md:max-w-[480px] bg-[#fcfcfc] min-h-screen relative flex flex-col shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_20px_60px_rgba(0,0,0,0.12)] overflow-hidden transition-all duration-200">
        
        {/* Top bar with optional close button */}
        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-100 border border-zinc-200/60 text-[11px] font-medium text-zinc-700">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-900" />
            <span>Sano Bill Cloud</span>
          </div>

          {onClose && (
            <button 
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center active:scale-95 transition"
              aria-label="Close"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          )}
        </div>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto overscroll-y-contain px-5 pt-3 pb-16 sm:pb-20">
          
          {/* Header Brand */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto rounded-[18px] overflow-hidden flex items-center justify-center shadow-sm">
              <img 
                src={sanoBillLogo} 
                alt="Sano Bill" 
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="serif text-[32px] mt-3.5 tracking-tight text-zinc-900 leading-tight">
              {mode === 'login' ? 'Sano Bill' : 'Register Business'}
            </h1>
            <p className="text-[13px] text-zinc-500 mt-1">
              {mode === 'login' 
                ? 'Sign in to access your shop & cloud sync' 
                : 'Create your Sano Bill account to start billing'}
            </p>
          </div>

          {/* Segmented Mode Switcher */}
          <div className="bg-zinc-100/90 p-1 rounded-[16px] grid grid-cols-2 gap-1 mb-6 border border-zinc-200/50">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => { setMode('login'); setNotice(null); setErrorMessage(null); }}
              className={`py-2.5 rounded-[12px] text-[13px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                mode === 'login'
                  ? 'bg-white text-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => { setMode('register'); setNotice(null); setErrorMessage(null); }}
              className={`py-2.5 rounded-[12px] text-[13px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                mode === 'register'
                  ? 'bg-white text-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Register Business
            </button>
          </div>

          {/* Error Message Banner */}
          {errorMessage && (
            <div className="mb-5 rounded-[14px] bg-red-50 border border-red-200 text-red-700 p-3.5 text-[12.5px] flex items-start gap-2.5 shadow-sm animate-slideUp">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
              <button 
                type="button" 
                onClick={() => setErrorMessage(null)}
                className="text-red-400 hover:text-red-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Success Notice Feedback Banner */}
          {notice && (
            <div className="mb-5 rounded-[14px] bg-zinc-900 text-white p-3.5 text-[12px] flex items-start gap-2.5 shadow-sm animate-slideUp">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{notice}</div>
              <button 
                type="button" 
                onClick={() => setNotice(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="rounded-[24px] bg-white border border-zinc-100 shadow-[0_12px_40px_rgba(0,0,0,0.06)] p-6 space-y-4">
                
                {/* Email / Phone Field */}
                <div>
                  <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500 block mb-1.5">
                    Email or Phone *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="e.g. 9801234567 or shop@example.com"
                      autoComplete="username"
                      disabled={isSubmitting}
                      required
                      className="w-full h-12 rounded-[14px] bg-zinc-50 border border-zinc-100 pl-11 pr-4 text-[14px] text-zinc-900 placeholder:text-zinc-400 outline-none focus:bg-white focus:border-zinc-300 focus:ring-2 focus:ring-zinc-900/5 transition disabled:opacity-60"
                    />
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                      <Mail className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500">
                      Password *
                    </label>
                    <button 
                      type="button"
                      onClick={() => setNotice('For password reset, please contact your Supabase administrator.')}
                      className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 transition"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      disabled={isSubmitting}
                      required
                      className="w-full h-12 rounded-[14px] bg-zinc-50 border border-zinc-100 pl-11 pr-11 text-[14px] text-zinc-900 placeholder:text-zinc-400 outline-none focus:bg-white focus:border-zinc-300 focus:ring-2 focus:ring-zinc-900/5 transition disabled:opacity-60"
                    />
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                      <Lock className="w-4 h-4" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] w-11 h-11 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 active:scale-95 transition"
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    >
                      {showLoginPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Checkbox */}
                <div className="pt-1 flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none text-[13px] text-zinc-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 accent-zinc-900"
                    />
                    <span>Remember this device</span>
                  </label>
                </div>

              </div>

              {/* Login Action Button */}
              <button
                type="submit"
                disabled={!isLoginValid || isSubmitting}
                className="w-full h-[52px] rounded-[14px] bg-black text-white font-semibold text-[14px] tracking-wide disabled:opacity-30 disabled:pointer-events-none active:scale-[0.99] transition flex items-center justify-center gap-2 shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Log In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Bottom Switch Prompt */}
              <div className="pt-2 text-center space-y-2">
                <p className="text-[12px] text-zinc-500">
                  Don't have a business account?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setNotice(null); setErrorMessage(null); }}
                    className="font-semibold text-zinc-900 underline underline-offset-4 decoration-zinc-300 hover:decoration-zinc-900 ml-1"
                  >
                    Register Business
                  </button>
                </p>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onSuccess) {
                        onSuccess({
                          mode: 'login',
                          data: { identifier: 'Guest / Demo', password: '', rememberMe: 'false' }
                        });
                      }
                    }}
                    className="text-[11.5px] font-medium text-zinc-400 hover:text-zinc-700 underline underline-offset-2 decoration-zinc-200 transition"
                  >
                    Skip & Continue Offline
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* REGISTER BUSINESS FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="rounded-[24px] bg-white border border-zinc-100 shadow-[0_12px_40px_rgba(0,0,0,0.06)] p-6 space-y-4">
                
                {/* 1. Business Name */}
                <div>
                  <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500 block mb-1.5">
                    Business Name *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Shrestha Kirana Pasal"
                      disabled={isSubmitting}
                      required
                      className="w-full h-12 rounded-[14px] bg-zinc-50 border border-zinc-100 pl-11 pr-4 text-[14px] text-zinc-900 placeholder:text-zinc-400 outline-none focus:bg-white focus:border-zinc-300 focus:ring-2 focus:ring-zinc-900/5 transition disabled:opacity-60"
                    />
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                      <Building2 className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* 2. PAN Number */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500">
                      PAN Number (9 digits) *
                    </label>
                    <span className={`text-[11px] font-medium transition ${
                      panNumber.length === 9 ? 'text-emerald-600 font-semibold flex items-center gap-1' : 'text-zinc-400'
                    }`}>
                      {panNumber.length === 9 ? (
                        <>
                          <Check className="w-3 h-3" /> 9/9 valid
                        </>
                      ) : (
                        `${panNumber.length}/9 digits`
                      )}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={panNumber}
                      onChange={(e) => setPanNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      placeholder="123456789"
                      maxLength={9}
                      disabled={isSubmitting}
                      required
                      className="w-full h-12 rounded-[14px] bg-zinc-50 border border-zinc-100 px-4 text-[15px] tracking-widest font-medium text-zinc-900 placeholder:tracking-normal placeholder:font-normal placeholder:text-zinc-400 outline-none focus:bg-white focus:border-zinc-300 focus:ring-2 focus:ring-zinc-900/5 transition disabled:opacity-60"
                    />
                  </div>
                  <p className="mt-1 text-[10.5px] text-zinc-400">
                    Required for official IRD lottery QR code billing.
                  </p>
                </div>

                {/* 3. Owner Name */}
                <div>
                  <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500 block mb-1.5">
                    Owner Name *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="e.g. Ram Bahadur Shrestha"
                      disabled={isSubmitting}
                      required
                      className="w-full h-12 rounded-[14px] bg-zinc-50 border border-zinc-100 pl-11 pr-4 text-[14px] text-zinc-900 placeholder:text-zinc-400 outline-none focus:bg-white focus:border-zinc-300 focus:ring-2 focus:ring-zinc-900/5 transition disabled:opacity-60"
                    />
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                      <User className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* 4. Email / Phone */}
                <div>
                  <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500 block mb-1.5">
                    Email or Phone *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={registerIdentifier}
                      onChange={(e) => setRegisterIdentifier(e.target.value)}
                      placeholder="e.g. 9801234567 or owner@example.com"
                      autoComplete="username"
                      disabled={isSubmitting}
                      required
                      className="w-full h-12 rounded-[14px] bg-zinc-50 border border-zinc-100 pl-11 pr-4 text-[14px] text-zinc-900 placeholder:text-zinc-400 outline-none focus:bg-white focus:border-zinc-300 focus:ring-2 focus:ring-zinc-900/5 transition disabled:opacity-60"
                    />
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none flex items-center gap-1">
                      <PhoneCall className="w-3.5 h-3.5 opacity-60" />
                      <span className="text-[10px] text-zinc-300">/</span>
                      <Mail className="w-3.5 h-3.5 opacity-60" />
                    </div>
                  </div>
                </div>

                {/* 5. Password */}
                <div>
                  <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500 block mb-1.5">
                    Password (min 6 characters) *
                  </label>
                  <div className="relative">
                    <input
                      type={showRegisterPassword ? 'text' : 'password'}
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      placeholder="Create a secure password"
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      required
                      minLength={6}
                      className="w-full h-12 rounded-[14px] bg-zinc-50 border border-zinc-100 pl-11 pr-11 text-[14px] text-zinc-900 placeholder:text-zinc-400 outline-none focus:bg-white focus:border-zinc-300 focus:ring-2 focus:ring-zinc-900/5 transition disabled:opacity-60"
                    />
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                      <Lock className="w-4 h-4" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] w-11 h-11 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 active:scale-95 transition"
                      aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegisterPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </div>

              </div>

              {/* Register Action Button */}
              <button
                type="submit"
                disabled={!isRegisterValid || isSubmitting}
                className="w-full h-[52px] rounded-[14px] bg-black text-white font-semibold text-[14px] tracking-wide disabled:opacity-30 disabled:pointer-events-none active:scale-[0.99] transition flex items-center justify-center gap-2 shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Registering Business...</span>
                  </>
                ) : (
                  <>
                    <span>Register Business</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Bottom Switch Prompt */}
              <div className="pt-2 text-center">
                <p className="text-[12px] text-zinc-500">
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setNotice(null); setErrorMessage(null); }}
                    className="font-semibold text-zinc-900 underline underline-offset-4 decoration-zinc-300 hover:decoration-zinc-900 ml-1"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* Footer Note */}
          <div className="mt-8 text-center space-y-1">
            <p className="text-[11px] text-zinc-400">
              Local-first • Works offline • Synced with Supabase Auth & Cloud Database
            </p>
            <p className="text-[10.5px] text-zinc-400/80">
              Compliant with IRD billing guidelines
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
