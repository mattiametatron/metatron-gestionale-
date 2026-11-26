import React, { useEffect, useState } from 'react';
import {
  Lock,
  Mail,
  User,
  Building2,
  ArrowRight,
  AlertCircle,
  Loader2,
  ShieldCheck,
  KeyRound,
  Briefcase,
  HardHat,
  Eye,
  EyeOff,
  Package,
  QrCode,
  FileSpreadsheet,
  Truck,
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
  const [role, setRole] = useState<UserRole>('worker');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [employerCode, setEmployerCode] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [employerCodeRequired, setEmployerCodeRequired] = useState(false);

  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/auth/status');
        if (res.ok) {
          const data = await res.json();
          if (active) {
            if (!data.hasUsers) {
              setMode('register');
            }
            setEmployerCodeRequired(Boolean(data.employerCodeRequired));
          }
        }
      } catch {
        // fallback silenzioso
      } finally {
        if (active) setStatusLoading(false);
      }
    };
    checkStatus();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Inserisci email e password per continuare.');
      return;
    }
    if (mode === 'register' && !name.trim()) {
      setError('Inserisci il tuo nome e cognome.');
      return;
    }
    if (mode === 'register' && password.length < 6) {
      setError('La password deve avere almeno 6 caratteri.');
      return;
    }

    setLoading(true);
    try {
      const endpoint =
        mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload =
        mode === 'register'
          ? {
              name: name.trim(),
              company: company.trim(),
              email: email.trim(),
              password,
              role,
              rememberMe,
              employerCode: role === 'employer' ? employerCode.trim() : undefined,
            }
          : {
              email: email.trim(),
              password,
              rememberMe,
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Errore durante l’autenticazione.');
        setLoading(false);
        return;
      }

      onAuthenticated(
        data.user,
        data.token,
        Boolean(data.migratedLegacy),
        mode
      );
    } catch {
      setError('Server non raggiungibile. Riprova tra qualche secondo.');
    } finally {
      setLoading(false);
    }
  };

  const pillars = [
    {
      icon: Truck,
      title: 'Bancali, Scatole & Camion',
      desc: 'Carico e scarico rapido con pistola barcode, controllo pesi e distinta uscita Excel/PDF.',
    },
    {
      icon: QrCode,
      title: 'Etichette QR & TiMini 57mm',
      desc: 'Stampa immediata di targhette termiche e fogli A4 con tracciabilità data e ora.',
    },
    {
      icon: FileSpreadsheet,
      title: 'Check-List & Unione Excel',
      desc: 'Confronto automatico di più file Excel per creare un’unica distinta completa senza doppioni.',
    },
    {
      icon: Package,
      title: 'Magazzino Personale Isolato',
      desc: 'Archivio privato con categorie personalizzabili, giacenze e scambio file con il team.',
    },
  ];

  return (
    <div className="min-h-screen w-full relative overflow-x-hidden flex items-center justify-center p-4 sm:p-6 lg:p-10 font-sans text-white">
      {/* Sfondo fotografico unico Dolomiti al Tramonto */}
      <AuroraSilkWallpaper />

      {/* Velatura direzionale per contrasto editoriale */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'linear-gradient(115deg, rgba(6, 10, 22, 0.72) 0%, rgba(9, 14, 28, 0.44) 48%, rgba(8, 12, 24, 0.74) 100%)',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-[980px] grid grid-cols-1 lg:grid-cols-[1.06fr_1fr] items-stretch rounded-[28px] overflow-hidden border border-white/[0.16] shadow-[0_36px_96px_-18px_rgba(0,0,0,0.78)] bg-[#070c18]/50 backdrop-blur-2xl">
        {/* ================================================================
            COLONNA SINISTRA: IDENTITÀ & ARCHITETTURA DI LAVORO
        ================================================================ */}
        <section className="relative flex flex-col justify-between p-7 sm:p-9 lg:p-11 border-b lg:border-b-0 lg:border-r border-white/[0.10] bg-gradient-to-br from-[#0a1224]/70 via-[#0d162a]/45 to-[#1a1520]/55">
          <div>
            {/* Marchio */}
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-500 to-orange-600 p-[1px] shadow-[0_8px_24px_-6px_rgba(245,158,11,0.55)] shrink-0">
                <div className="w-full h-full rounded-[15px] bg-[#0b1120]/90 flex items-center justify-center">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5 text-amber-300"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2L3 7l9 5 9-5-9-5z" />
                    <path d="M3 12l9 5 9-5" />
                    <path d="M3 17l9 5 9-5" />
                  </svg>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300/90">
                  METATRON OS
                </div>
                <div className="text-lg font-semibold tracking-tight text-white leading-tight">
                  CaricoStudio
                </div>
              </div>
            </div>

            {/* Titolo editoriale */}
            <div className="mt-8 lg:mt-10">
              <h1 className="text-2xl sm:text-[32px] font-semibold tracking-[-0.025em] leading-[1.14] text-white">
                Logistica, bancali e magazzino in un unico spazio.
              </h1>
              <p className="mt-3 text-[13.5px] leading-relaxed text-slate-300/90 max-w-md">
                Organizza commesse, spara i barcode di scatole e bancali, stampa etichette termiche e genera distinte ufficiali in pochi secondi.
              </p>
            </div>

            {/* Lista pilastri con linee sottili (zero pill / zero decorazioni artificiali) */}
            <div className="mt-8 divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {pillars.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="py-3.5 flex items-start gap-3.5"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.10] flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-amber-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-white/95 leading-snug">
                        {item.title}
                      </div>
                      <p className="text-[12px] text-slate-300/80 leading-relaxed mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-7 pt-2 flex items-center gap-2 text-[11.5px] text-slate-300/75">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Sessione protetta · Dati privati sincronizzati sul tuo profilo
            </span>
          </div>
        </section>

        {/* ================================================================
            COLONNA DESTRA: MODULO ACCEDI / REGISTRAZIONE
        ================================================================ */}
        <section className="flex flex-col justify-center p-7 sm:p-9 lg:p-11 bg-[#0a101e]/88">
          <div className="w-full max-w-[390px] mx-auto">
            {/* Switch Accedi / Crea Account */}
            <div
              role="tablist"
              aria-label="Modalità autenticazione"
              className="grid grid-cols-2 p-1 rounded-xl bg-white/[0.05] border border-white/[0.10] mb-7"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`py-2.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Accedi
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`py-2.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Crea Account
              </button>
            </div>

            <div className="mb-6">
              <h2 className="text-[21px] font-semibold tracking-tight text-white">
                {mode === 'login' ? 'Bentornato' : 'Crea il tuo profilo'}
              </h2>
              <p className="text-[13px] text-slate-400 mt-1">
                {mode === 'login'
                  ? 'Inserisci le tue credenziali per aprire la scrivania.'
                  : 'Configura il tuo accesso operativo o di direzione.'}
              </p>
            </div>

            {statusLoading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-300">
                <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                <span className="text-xs font-medium text-slate-400">
                  Verifica servizio di accesso...
                </span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <>
                    {/* Selezione Ruolo */}
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-2">
                        Tipo di Profilo
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setRole('worker')}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            role === 'worker'
                              ? 'bg-amber-400/12 border-amber-400/60 text-white'
                              : 'bg-white/[0.03] border-white/[0.10] text-slate-300 hover:border-white/25 hover:bg-white/[0.06]'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-semibold text-[13px]">
                            <HardHat
                              className={`w-4 h-4 ${
                                role === 'worker' ? 'text-amber-300' : 'text-slate-400'
                              }`}
                            />
                            <span>Operatore</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                            Bancali, scanner e magazzino
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRole('employer')}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            role === 'employer'
                              ? 'bg-amber-400/12 border-amber-400/60 text-white'
                              : 'bg-white/[0.03] border-white/[0.10] text-slate-300 hover:border-white/25 hover:bg-white/[0.06]'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-semibold text-[13px]">
                            <Briefcase
                              className={`w-4 h-4 ${
                                role === 'employer'
                                  ? 'text-amber-300'
                                  : 'text-slate-400'
                              }`}
                            />
                            <span>Direzione</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                            Supervisione team e commesse
                          </p>
                        </button>
                      </div>
                    </div>

                    {role === 'employer' && employerCodeRequired && (
                      <div>
                        <label
                          htmlFor="auth-employer-code"
                          className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-300 mb-1.5"
                        >
                          Codice Aziendale Direzione *
                        </label>
                        <div className="relative">
                          <KeyRound className="w-4 h-4 text-amber-300/80 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            id="auth-employer-code"
                            type="password"
                            required
                            value={employerCode}
                            onChange={(e) => setEmployerCode(e.target.value)}
                            placeholder="Inserisci il codice riservato"
                            className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white/[0.05] border border-amber-400/40 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="auth-name"
                          className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1.5"
                        >
                          Nome e Cognome *
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            id="auth-name"
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Es. Marco Rossi"
                            className="w-full h-11 pl-10 pr-3 rounded-xl bg-white/[0.05] border border-white/[0.12] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400/80 focus:ring-2 focus:ring-amber-400/20 transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="auth-company"
                          className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1.5"
                        >
                          Azienda / Reparto
                        </label>
                        <div className="relative">
                          <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            id="auth-company"
                            type="text"
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            placeholder="Opzionale"
                            className="w-full h-11 pl-10 pr-3 rounded-xl bg-white/[0.05] border border-white/[0.12] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400/80 focus:ring-2 focus:ring-amber-400/20 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Email */}
                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1.5"
                  >
                    Email *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="auth-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nome@azienda.it"
                      className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white/[0.05] border border-white/[0.12] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400/80 focus:ring-2 focus:ring-amber-400/20 transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1.5"
                  >
                    Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete={
                        mode === 'register' ? 'new-password' : 'current-password'
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        mode === 'register'
                          ? 'Minimo 6 caratteri'
                          : 'Inserisci password'
                      }
                      className="w-full h-11 pl-10 pr-11 rounded-xl bg-white/[0.05] border border-white/[0.12] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400/80 focus:ring-2 focus:ring-amber-400/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                      aria-label={
                        showPassword ? 'Nascondi password' : 'Mostra password'
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Ricordami */}
                <label className="flex items-center justify-between pt-0.5 cursor-pointer select-none">
                  <span className="flex items-center gap-2.5 text-[12.5px] text-slate-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-white/25 bg-white/10 accent-amber-400 cursor-pointer"
                    />
                    Resta connesso su questo dispositivo
                  </span>
                </label>

                {/* Messaggio errore */}
                {error && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/35 text-rose-200 text-xs flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-300" />
                    <span className="leading-relaxed">{error}</span>
                  </div>
                )}

                {/* Pulsante principale */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 mt-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:via-amber-400 hover:to-orange-400 disabled:opacity-60 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_14px_30px_-10px_rgba(245,158,11,0.65)] transition-all cursor-pointer active:scale-[0.99]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Accesso in corso...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {mode === 'login'
                          ? 'Entra in CaricoStudio'
                          : role === 'employer'
                          ? 'Crea Account Direzione'
                          : 'Crea Account Operatore'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
