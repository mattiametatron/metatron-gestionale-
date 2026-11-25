import React, { useRef, useState, useEffect } from 'react';
import { PenTool, RotateCcw, Check, X, ShieldCheck } from 'lucide-react';
import { ElectronicSignature } from '../types/warehouse';

interface SignaturePadModalProps {
  role: 'operatore' | 'responsabile' | 'autista';
  existingSignature?: ElectronicSignature;
  onSaveSignature: (sig: ElectronicSignature) => void;
  onClose: () => void;
}

const ROLE_INFO = {
  operatore: {
    title: 'Firma Operatore di Magazzino',
    subtitle: 'Preparazione materiale, conteggio e spunta check-list',
    defaultCompany: 'Reparto Magazzino',
    placeholder: 'es. Mario Rossi (Matricola 104)',
  },
  responsabile: {
    title: 'Firma Responsabile Spedizioni',
    subtitle: 'Controllo conformità bancali, pesatura e autorizzazione',
    defaultCompany: 'Ufficio Logistica',
    placeholder: 'es. Laura Bianchi (Logistica)',
  },
  autista: {
    title: 'Firma Autista / Vettore',
    subtitle: 'Presa in carico merce alla ribalta di carico',
    defaultCompany: 'Vettore Esterno',
    placeholder: 'es. Giuseppe Verdi (Targa Mezzo)',
  },
};

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  role,
  existingSignature,
  onSaveSignature,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(!!existingSignature?.signatureDataUrl);
  const [signerName, setSignerName] = useState(existingSignature?.signerName || '');
  const [companyOrBadge, setCompanyOrBadge] = useState(
    existingSignature?.companyOrBadge || ROLE_INFO[role].defaultCompany
  );

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#020617'; // Rich dark obsidian ink

    if (existingSignature?.signatureDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = existingSignature.signatureDataUrl;
    }
  };

  useEffect(() => {
    initCanvas();
  }, []);

  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !signerName.trim() || !hasDrawn) return;

    const signatureDataUrl = canvas.toDataURL('image/png');
    const newSignature: ElectronicSignature = {
      id: `sig-${role}-${Date.now()}`,
      role,
      roleLabel: ROLE_INFO[role].title,
      signerName: signerName.trim(),
      companyOrBadge: companyOrBadge.trim(),
      signatureDataUrl,
      signedAt: new Date().toISOString(),
    };

    onSaveSignature(newSignature);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {ROLE_INFO[role].title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {ROLE_INFO[role].subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nome e Cognome Collaboratore *
              </label>
              <input
                type="text"
                required
                placeholder={ROLE_INFO[role].placeholder}
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 text-xs transition-colors"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Reparto / Badge / Azienda
              </label>
              <input
                type="text"
                value={companyOrBadge}
                onChange={(e) => setCompanyOrBadge(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 text-xs transition-colors"
              />
            </div>
          </div>

          {/* Interactive Pad */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Firma con il mouse o con il dito:
              </span>
              <button
                type="button"
                onClick={clearCanvas}
                className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Cancella e Rifai
              </button>
            </div>

            <div className="border-2 border-slate-300 dark:border-slate-700 rounded-xl p-1 bg-white relative shadow-inner overflow-hidden">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-40 bg-white rounded-lg cursor-crosshair touch-none"
              />
              <div className="pointer-events-none absolute bottom-3 left-4 right-4 border-b border-dashed border-slate-300 text-[10px] text-slate-400 font-mono text-right pb-0.5">
                X .............................................................. (Traccia firma qui)
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-start gap-2.5 text-[11px] text-blue-800 dark:text-blue-300">
            <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
            <span>
              La firma viene apposta istantaneamente con data e ora certificate e stampata automaticamente sulla packing list e sui cartelli di spedizione.
            </span>
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={!signerName.trim() || !hasDrawn}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Conferma e Salva Firma
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
