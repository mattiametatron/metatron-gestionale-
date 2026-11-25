import React, { useEffect, useState } from 'react';
import {
  Lock,
  Mail,
  User,
  Building2,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  ShieldCheck,
  AlertCircle,
  LayoutGrid,
  Crown,
  KeyRound,
} from 'lucide-react';
import { AuthUser, UserRole } from '../types/warehouse';
import { AuroraSilkWallpaper } from './AuroraSilkWallpaper';

interface AuthScreenProps {
  onAuthenticated: (
    user: AuthUser,
    token: string,
    migratedLegacy?: boolean,
    authMode?: 'login' | 'register'
  ) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [hasUsersOnServer, setHasUsersOnServer] = useState<boolean | null>(null);
  const [employerCodeRequired, setEmployerCodeRequired] = useState<boolean>(false);

  const [role, setRole] = useState<UserRole>('worker');
  const [employerCode, setEmployerCode] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const hasUsers = Boolean(data.hasUsers);
        setHasUsersOnServer(hasUsers);
        setEmployerCodeRequired(Boolean(data.employerCodeRequired));
        if (!hasUsers) {
          setMode('register');
        }
      })
      .catch(() => {
        if (!cancelled) setHasUsersOnServer(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('Inserisci il tuo indirizzo email.');
      return;
    }

    if (mode === 'register') {
      if (name.trim().length < 2) {
        setErrorMsg('Inserisci il tuo nome (almeno 2 caratteri).');
        return;
      }
      if (role === 'employer' && employerCode.trim().length < 6) {
        setErrorMsg(
          employerCodeRequired
            ? 'Inserisci il Codice Accesso Direzione fornito dal titolare.'
            : 'Imposta un Codice Segreto Direzione di almeno 6 caratteri.'
        );
        return;
      }
      if (password.length < 8) {
        setErrorMsg('La password deve avere almeno 8 caratteri.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Le due password non coincidono.');
        return;
      }
    } else if (!password) {
      setErrorMsg('Inserisci la password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload =
        mode === 'register'
          ? {
              name: name.trim(),
              company: company.trim() || undefined,
              email: cleanEmail,
              password,
              role,
              employerCode: role === 'employer' ? employerCode.trim() : undefined,
              rememberMe,
            }
          : {
              email: cleanEmail,
              password,
              rememberMe,
            };

      const resp = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.ok || !data?.token || !data?.user) {
        setErrorMsg(
          data?.error ||
            (mode === 'register'
              ? 'Registrazione non riuscita. Verifica i dati inseriti.'
              : 'Credenziali non valide.')
        );
        return;
      }

      onAuthenticated(data.user, data.token, Boolean(data.migratedLegacy), mode);
    } catch {
      setErrorMsg('Server non raggiungibile. Riprova tra qualche secondo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#090b16] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <AuroraSilkWallpaper theme="aurora_silk" />

      <div className="relative z-10 w-full max-w-[420px] bg-[#0d101c]/88 backdrop-blur-2xl border border-white/12 rounded-2xl shadow-[0_30px_90px_rgba(0,0,0,0.7)] overflow-hidden text-white">
        {/* Header Compatto */}
        <div className="px-6 pt-6 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-[13px] bg-gradient-to-b from-[#7b5cff] to-[#5737eb] flex items-center justify-center shrink-0 shadow-lg ring-1 ring-inset ring-white/25">
              <LayoutGrid className="w-5 h-5 text-white stroke-[1.9]" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">
                CaricoStudio
              </h1>
              <p className="text-xs text-white/55">
                Gestionale personale con archivio privato e isolato
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Switch Accedi / Registrati */}
          <div className="grid grid-cols-2 p-1 bg-white/[0.05] rounded-xl border border-white/[0.08]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                mode === 'login'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Accedi</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                mode === 'register'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Crea Account</span>
            </button>
          </div>

          {hasUsersOnServer === false && mode === 'register' && (
            <div className="p-3 rounded-xl bg-indigo-500/15 border border-indigo-400/25 text-xs text-indigo-100 leading-relaxed">
              <strong>Primo accesso:</strong> registra il tuo account principale. Eventuali commesse, movimenti, foto e file già presenti verranno associati in modo esclusivo al tuo account.
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/30 text-xs font-medium text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-white/75 mb-1.5">
                    Tipo di Profilo *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRole('worker');
                        setErrorMsg(null);
                      }}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        role === 'worker'
                          ? 'bg-indigo-600/25 border-indigo-400 text-white shadow-xs'
                          : 'bg-white/[0.04] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Operatore</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRole('employer');
                        setErrorMsg(null);
                      }}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        role === 'employer'
                          ? 'bg-amber-500/25 border-amber-400 text-amber-100 shadow-xs'
                          : 'bg-white/[0.04] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                      <span>Datore di Lavoro</span>
                    </button>
                  </div>
                </div>

                {role === 'employer' && (
                  <div className="p-3 rounded-xl bg-amber-500/12 border border-amber-400/30 space-y-2">
                    <label className="block text-xs font-semibold text-amber-200">
                      {employerCodeRequired
                        ? 'Codice Accesso Direzione *'
                        : 'Imposta Codice Segreto Direzione (min. 6 caratteri) *'}
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-amber-300/70 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={employerCode}
                        onChange={(e) => setEmployerCode(e.target.value)}
                        placeholder={
                          employerCodeRequired
                            ? 'Inserisci il codice Direzione'
                            : 'Crea codice segreto per la Direzione'
                        }
                        className="w-full pl-9 pr-3 py-2 text-sm bg-black/30 border border-amber-400/35 rounded-lg text-white placeholder:text-white/35 focus:outline-none focus:border-amber-300 transition-colors"
                      />
                    </div>
                    <p className="text-[11px] text-amber-100/75 leading-snug">
                      {employerCodeRequired
                        ? 'Richiesto per accedere all\'interfaccia Direzione con visione completa di tutti i profili.'
                        : 'Primo account Direzione: scegli un codice segreto per proteggere future registrazioni come Datore di Lavoro.'}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-white/75 mb-1">
                    {role === 'employer' ? 'Nome Titolare / Direzione *' : 'Nome Operatore *'}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Es. Marco Rossi"
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-white/[0.06] border border-white/12 rounded-xl text-white placeholder:text-white/30 focus:bg-white/[0.09] focus:outline-none focus:border-indigo-400 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/75 mb-1">
                    Azienda / Reparto (opzionale)
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Es. Officina Meccanica Srl"
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-white/[0.06] border border-white/12 rounded-xl text-white placeholder:text-white/30 focus:bg-white/[0.09] focus:outline-none focus:border-indigo-400 transition-colors"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-white/75 mb-1">
                Email *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@azienda.it"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-white/[0.06] border border-white/12 rounded-xl text-white placeholder:text-white/30 focus:bg-white/[0.09] focus:outline-none focus:border-indigo-400 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/75 mb-1">
                Password {mode === 'register' ? '(min. 8 caratteri) *' : '*'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  minLength={mode === 'register' ? 8 : 1}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Almeno 8 caratteri' : 'La tua password'}
                  className="w-full pl-9 pr-10 py-2.5 text-sm bg-white/[0.06] border border-white/12 rounded-xl text-white placeholder:text-white/30 focus:bg-white/[0.09] focus:outline-none focus:border-indigo-400 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-white/45 hover:text-white cursor-pointer"
                  aria-label="Mostra o nascondi password"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-white/75 mb-1">
                  Conferma Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirm-password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ripeti la password"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-white/[0.06] border border-white/12 rounded-xl text-white placeholder:text-white/30 focus:bg-white/[0.09] focus:outline-none focus:border-indigo-400 transition-colors"
                  />
                </div>
              </div>
            )}

            <label className="flex items-center gap-2.5 pt-0.5 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-white/25 bg-white/10 accent-indigo-500 cursor-pointer"
              />
              <span className="text-xs text-white/75 group-hover:text-white transition-colors">
                Ricorda l&apos;accesso su questo dispositivo
              </span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-2.5 px-4 disabled:opacity-60 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg ${
                mode === 'register' && role === 'employer'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold'
                  : 'bg-gradient-to-r from-[#6c52f5] to-[#563ce8] hover:from-[#7c64ff] hover:to-[#634bf2]'
              }`}
            >
              {mode === 'register' ? (
                <>
                  {role === 'employer' ? (
                    <Crown className="w-4 h-4" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  <span>
                    {isSubmitting
                      ? 'Creazione account...'
                      : role === 'employer'
                      ? 'Registra Account Direzione'
                      : 'Registrati ed Entra'}
                  </span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>{isSubmitting ? 'Accesso in corso...' : 'Accedi al tuo Archivio'}</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-white/[0.08] flex items-start gap-2 text-[11px] text-white/50 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Ogni operatore ha un archivio privato e può scambiare foto e file con i colleghi tramite Scambio Team. Il Datore di Lavoro accede a un&apos;interfaccia Direzione dedicata con controllo completo.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
