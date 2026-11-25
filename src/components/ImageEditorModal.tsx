import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  Sun,
  Contrast,
  Crop,
  PenTool,
  Type,
  Check,
  X,
  Undo2,
  RotateCcw as ResetIcon,
  Sparkles,
  Palette,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Sliders,
} from 'lucide-react';

interface ImageEditorModalProps {
  initialImageDataUrl: string;
  itemTitle?: string;
  onSave: (editedDataUrl: string) => void;
  onClose: () => void;
}

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
  initialImageDataUrl,
  itemTitle = 'Articolo / Collo',
  onSave,
  onClose,
}) => {
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [flipH, setFlipH] = useState<boolean>(false);
  const [brightness, setBrightness] = useState<number>(100); // 50 to 150 %
  const [contrast, setContrast] = useState<number>(100); // 50 to 150 %
  const [grayscale, setGrayscale] = useState<boolean>(false);

  // Drawing state
  const [activeTool, setActiveTool] = useState<'none' | 'draw' | 'stamp'>('none');
  const [brushColor, setBrushColor] = useState<string>('#ef4444'); // Red default
  const [brushSize, setBrushSize] = useState<number>(4);
  const [stampText, setStampText] = useState<string>('VERIFICATO ✓');

  // Drawing strokes: array of { points: {x,y}[], color: string, size: number }
  const [strokes, setStrokes] = useState<
    { points: { x: number; y: number }[]; color: string; size: number }[]
  >([]);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[] | null>(null);

  // Stamps: { x: number, y: number, text: string, color: string }
  const [stamps, setStamps] = useState<
    { x: number; y: number; text: string; color: string }[]
  >([]);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  // Load image object
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImageObj(img);
    };
    img.src = initialImageDataUrl;
  }, [initialImageDataUrl]);

  // Render canvas with all transformations and drawings
  const renderCanvas = useCallback(() => {
    if (!imageObj || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate dimensions based on 90 / 270 deg rotations
    const isSideways = rotation === 90 || rotation === 270;
    const width = isSideways ? imageObj.height : imageObj.width;
    const height = isSideways ? imageObj.width : imageObj.height;

    // Scale canvas to reasonable max dimensions to maintain fast performance and good storage size (max 1280x1280)
    const maxDim = 1280;
    let scale = 1;
    if (width > maxDim || height > maxDim) {
      scale = Math.min(maxDim / width, maxDim / height);
    }

    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    ctx.save();

    // Filters: Brightness, Contrast, Grayscale
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)${
      grayscale ? ' grayscale(100%)' : ''
    }`;

    // Translate to center and rotate/flip
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale((flipH ? -1 : 1) * scale, 1 * scale);

    // Draw the image centered
    ctx.drawImage(
      imageObj,
      -imageObj.width / 2,
      -imageObj.height / 2,
      imageObj.width,
      imageObj.height
    );

    ctx.restore();

    // Draw annotations and strokes
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.moveTo(stroke.points[0].x * canvas.width, stroke.points[0].y * canvas.height);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * canvas.width, stroke.points[i].y * canvas.height);
      }
      ctx.stroke();
    }

    // Draw current active stroke
    if (currentStroke && currentStroke.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(currentStroke[0].x * canvas.width, currentStroke[0].y * canvas.height);
      for (let i = 1; i < currentStroke.length; i++) {
        ctx.lineTo(currentStroke[i].x * canvas.width, currentStroke[i].y * canvas.height);
      }
      ctx.stroke();
    }

    // Draw stamps / text annotations
    for (const stamp of stamps) {
      const px = stamp.x * canvas.width;
      const py = stamp.y * canvas.height;

      ctx.save();
      ctx.font = 'bold 20px -apple-system, sans-serif';
      const textMetrics = ctx.measureText(stamp.text);
      const padding = 6;

      // Tag background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(
        px - padding,
        py - 18 - padding,
        textMetrics.width + padding * 2,
        24 + padding * 2
      );

      // Border
      ctx.strokeStyle = stamp.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        px - padding,
        py - 18 - padding,
        textMetrics.width + padding * 2,
        24 + padding * 2
      );

      // Text
      ctx.fillStyle = stamp.color;
      ctx.fillText(stamp.text, px, py);
      ctx.restore();
    }
  }, [
    imageObj,
    rotation,
    flipH,
    brightness,
    contrast,
    grayscale,
    strokes,
    currentStroke,
    stamps,
    brushColor,
    brushSize,
  ]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Pointer / Touch drawing handlers
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (activeTool === 'draw') {
      const coord = getCanvasCoords(e);
      setCurrentStroke([coord]);
    } else if (activeTool === 'stamp') {
      const coord = getCanvasCoords(e);
      setStamps((prev) => [...prev, { ...coord, text: stampText, color: brushColor }]);
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (activeTool === 'draw' && currentStroke) {
      const coord = getCanvasCoords(e);
      setCurrentStroke((prev) => (prev ? [...prev, coord] : [coord]));
    }
  };

  const handlePointerUp = () => {
    if (activeTool === 'draw' && currentStroke) {
      if (currentStroke.length > 1) {
        setStrokes((prev) => [
          ...prev,
          { points: currentStroke, color: brushColor, size: brushSize },
        ]);
      }
      setCurrentStroke(null);
    }
  };

  const handleRotateRight = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleRotateLeft = () => {
    setRotation((prev) => (prev + 270) % 360);
  };

  const handleToggleFlip = () => {
    setFlipH((prev) => !prev);
  };

  const handleReset = () => {
    setRotation(0);
    setFlipH(false);
    setBrightness(100);
    setContrast(100);
    setGrayscale(false);
    setStrokes([]);
    setStamps([]);
    setActiveTool('none');
  };

  const handleSave = () => {
    if (!canvasRef.current) return;
    // Export compressed JPEG at 0.85 quality for good clarity and low localStorage weight
    const editedUrl = canvasRef.current.toDataURL('image/jpeg', 0.85);
    onSave(editedUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-900">
        {/* Top Header */}
        <div className="border-b border-slate-200 bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold flex items-center gap-2">
                Editor &amp; Ritocco Foto Colli
              </h2>
              <p className="text-xs text-slate-300">
                Ruota, migliora visibilità, cerchia dettagli o applica timbri per:{' '}
                <strong className="text-blue-300">{itemTitle}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
          {/* Quick Actions (Rotate & Flip) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleRotateLeft}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1 shadow-2xs cursor-pointer"
              title="Ruota di 90° a sinistra"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              -90°
            </button>
            <button
              type="button"
              onClick={handleRotateRight}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1 shadow-2xs cursor-pointer"
              title="Ruota di 90° a destra"
            >
              <RotateCw className="w-3.5 h-3.5" />
              +90°
            </button>
            <button
              type="button"
              onClick={handleToggleFlip}
              className={`px-2.5 py-1.5 border rounded-lg font-bold flex items-center gap-1 shadow-2xs cursor-pointer ${
                flipH
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
              title="Specchia orizzontalmente"
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
              Specchia
            </button>
            <button
              type="button"
              onClick={() => setGrayscale((prev) => !prev)}
              className={`px-2.5 py-1.5 border rounded-lg font-bold flex items-center gap-1 shadow-2xs cursor-pointer ${
                grayscale
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
              title="Modalità Bianco e Nero (ideale per etichette e codici a barre)"
            >
              <Sliders className="w-3.5 h-3.5" />
              B/N Etichette
            </button>
          </div>

          {/* Tools: Draw & Stamp */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTool(activeTool === 'draw' ? 'none' : 'draw')}
              className={`px-3 py-1 font-bold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === 'draw'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
              title="Disegna a mano libera per cerchiare difetti, etichette o frecce"
            >
              <PenTool className="w-3.5 h-3.5" />
              Evidenzia / Cerchia
            </button>

            <button
              type="button"
              onClick={() => setActiveTool(activeTool === 'stamp' ? 'none' : 'stamp')}
              className={`px-3 py-1 font-bold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === 'stamp'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
              title="Applica un timbro di testo (es. VERIFICATO, COLLO 1, FRAGILE)"
            >
              <Type className="w-3.5 h-3.5" />
              Timbro Testo
            </button>

            {(strokes.length > 0 || stamps.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setStrokes((prev) => prev.slice(0, -1));
                  setStamps((prev) => prev.slice(0, -1));
                }}
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 cursor-pointer"
                title="Annulla ultima annotazione"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Reset All */}
          <button
            type="button"
            onClick={handleReset}
            className="px-2.5 py-1.5 text-slate-600 hover:text-rose-600 font-bold flex items-center gap-1 cursor-pointer"
            title="Ripristina foto originale"
          >
            <ResetIcon className="w-3.5 h-3.5" />
            Ripristina
          </button>
        </div>

        {/* Sub-toolbar for active tool (Draw color or Stamp choice) */}
        {activeTool === 'draw' && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-bold text-rose-950 flex items-center gap-1.5">
              <PenTool className="w-3.5 h-3.5 text-rose-600" />
              Trascina sulla foto per disegnare:
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-600">Colore:</span>
              {[
                { hex: '#ef4444', label: 'Rosso' },
                { hex: '#eab308', label: 'Giallo' },
                { hex: '#3b82f6', label: 'Blu' },
                { hex: '#22c55e', label: 'Verde' },
                { hex: '#ffffff', label: 'Bianco' },
              ].map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setBrushColor(c.hex)}
                  style={{ backgroundColor: c.hex }}
                  className={`w-5 h-5 rounded-full border-2 cursor-pointer ${
                    brushColor === c.hex ? 'border-slate-900 scale-110' : 'border-slate-300'
                  }`}
                  title={c.label}
                />
              ))}
              <div className="h-4 w-px bg-slate-300 mx-1" />
              <span className="text-[11px] text-slate-600">Tratto:</span>
              {[3, 6, 10].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setBrushSize(sz)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                    brushSize === sz
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {sz === 3 ? 'Fine' : sz === 6 ? 'Medio' : 'Spesso'}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTool === 'stamp' && (
          <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-bold text-indigo-950 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-indigo-600" />
              Clicca sulla foto dove vuoi posizionare il timbro:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                'VERIFICATO ✓',
                'COLLO 1',
                'COLLO 2',
                'FRAGILE ⚠️',
                'DANNEGGIATO ✕',
                'CONFORME',
              ].map((txt) => (
                <button
                  key={txt}
                  type="button"
                  onClick={() => setStampText(txt)}
                  className={`px-2.5 py-1 rounded text-xs font-bold border cursor-pointer ${
                    stampText === txt
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-indigo-100'
                  }`}
                >
                  {txt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sliders for Brightness & Contrast */}
        <div className="bg-slate-100/70 border-b border-slate-200 px-5 py-2 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1 text-slate-700 font-semibold w-24">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Luce: {brightness}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="160"
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="w-32 accent-blue-600 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1 text-slate-700 font-semibold w-28">
              <Contrast className="w-3.5 h-3.5 text-indigo-500" />
              <span>Contrasto: {contrast}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="160"
              value={contrast}
              onChange={(e) => setContrast(Number(e.target.value))}
              className="w-32 accent-blue-600 cursor-pointer"
            />
          </div>

          <span className="text-[11px] text-slate-500 hidden md:inline">
            Rotazione attuale: <strong>{rotation}°</strong> {flipH && '(Specchiato)'}
          </span>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-900/95 relative min-h-[350px]">
          <canvas
            ref={canvasRef}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            className={`max-w-full max-h-[58vh] object-contain rounded-lg shadow-2xl border border-slate-700/60 ${
              activeTool === 'draw'
                ? 'cursor-crosshair'
                : activeTool === 'stamp'
                ? 'cursor-pointer'
                : 'cursor-default'
            }`}
          />
        </div>

        {/* Bottom Actions Footer */}
        <div className="border-t border-slate-200 bg-slate-50 p-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-600">
            {strokes.length > 0 || stamps.length > 0 || rotation !== 0 || brightness !== 100 ? (
              <span className="text-blue-700 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Modifiche applicate pronte al salvataggio
              </span>
            ) : (
              <span>Nessuna modifica ancora effettuata</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 cursor-pointer transition-colors"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
            >
              <Check className="w-4 h-4" />
              Salva Foto Modificata
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
