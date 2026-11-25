import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Box,
  Layers,
  ChevronDown,
  ChevronUp,
  Ruler,
  Package,
  StepForward,
  StepBack,
  Eye,
} from 'lucide-react';
import {
  CargoBox,
  CargoLoad,
  CargoPallet,
  ChecklistItem,
} from '../types/warehouse';
import { LoadSummary, PalletSummary, BoxSummary } from '../utils/calculations';

interface Pallet3DVisualizerProps {
  load: CargoLoad;
  summary: LoadSummary;
  initialPalletId?: string | 'all';
}

export interface PackedCargoPlacement {
  id: string;
  kind: 'box' | 'loose_item';
  boxSummary?: BoxSummary;
  looseItem?: ChecklistItem;
  pallet: CargoPallet;
  palletIndex: number;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  rotated90: boolean;
  // Position in cm relative to the pallet center (X: length/left-right, Y: bottom from ground, Z: depth/front-back)
  localXCm: number;
  bottomYCm: number;
  localZCm: number;
  layerNumber: number;
  stepOrder: number;
  positionLabel: string;
}

export interface Hovered3DTarget {
  type: 'box' | 'loose_item' | 'pallet';
  pallet: CargoPallet;
  palletSummary: PalletSummary;
  placement?: PackedCargoPlacement;
  screenX: number;
  screenY: number;
}

export function parseDimensionsCm(
  dimStr: string | undefined,
  fallback: [number, number, number]
): [number, number, number] {
  if (!dimStr) return fallback;
  const nums = dimStr
    .replace(/cm/gi, '')
    .split(/[x×*]/i)
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n) && n > 0);
  if (nums.length >= 3) {
    return [nums[0], nums[1], nums[2]];
  }
  if (nums.length === 2) {
    return [nums[0], nums[1], fallback[2]];
  }
  return fallback;
}

interface FreeRect2D {
  x: number; // from -palletLength/2 to +palletLength/2
  z: number; // from -palletDepth/2 to +palletDepth/2
  w: number;
  d: number;
}

/**
 * Smart 2D Guillotine / Free-Rectangle Layer Packer for Warehouse Palletizing.
 * Fills the ENTIRE pallet base (e.g. 120x80 cm) first before starting a new layer above,
 * auto-rotating boxes 90° when needed so modular sizes (60x40, 40x30, 80x60) sit flat side-by-side
 * instead of creating an unstable single tall stack.
 * Also places loose items ("Materiale Fuori Scatola") directly on the pallet.
 */
export function computePalletBoxPlacements(
  ps: PalletSummary,
  palletIndex: number,
  respectManualStackLevel = false
): PackedCargoPlacement[] {
  const [palW, palD] = parseDimensionsCm(ps.pallet.dimensionsCm, [120, 80, 15]);
  const palletLengthCm = Math.max(palW, palD); // X axis (e.g. 120 cm)
  const palletDepthCm = Math.min(palW, palD); // Z axis (e.g. 80 cm)
  const palletBaseHeightCm = 14.4;

  // Build unified list of physical units sitting directly on the pallet:
  // 1. Top-level boxes (boxes not nested inside another box)
  // 2. Loose items assigned directly to the pallet ("Materiale Fuori Scatola")
  interface PackableUnit {
    id: string;
    kind: 'box' | 'loose_item';
    boxSummary?: BoxSummary;
    looseItem?: ChecklistItem;
    rawL: number;
    rawD: number;
    rawH: number;
    weightKg: number;
    fragile: boolean;
    manualLayer: number;
  }

  const units: PackableUnit[] = [];

  const topBoxes = ps.topLevelBoxes || ps.boxes.filter((b) => !b.box.parentBoxId);
  topBoxes.forEach((bs) => {
    const [rawL, rawD, rawH] = parseDimensionsCm(
      bs.box.dimensionsCm,
      [60, 40, 40]
    );
    units.push({
      id: bs.box.id,
      kind: 'box',
      boxSummary: bs,
      rawL: Math.min(palletLengthCm, Math.max(15, rawL)),
      rawD: Math.min(palletDepthCm, Math.max(15, rawD)),
      rawH: Math.max(12, rawH),
      weightKg: bs.grossWeightKg,
      fragile: bs.box.fragile,
      manualLayer: bs.box.stackLevel || 1,
    });
  });

  ps.looseItems.forEach((item) => {
    const [rawL, rawD, rawH] = parseDimensionsCm(
      item.dimensionsCm,
      [45, 35, 30]
    );
    units.push({
      id: item.id,
      kind: 'loose_item',
      looseItem: item,
      rawL: Math.min(palletLengthCm, Math.max(15, rawL)),
      rawD: Math.min(palletDepthCm, Math.max(15, rawD)),
      rawH: Math.max(12, rawH),
      weightKg: item.quantity * item.unitWeightKg,
      fragile: item.fragile,
      manualLayer: item.fragile ? 2 : 1,
    });
  });

  // Sort for optimal stability:
  // Non-fragile first, heaviest & largest footprint at the bottom
  units.sort((a, b) => {
    if (respectManualStackLevel && a.manualLayer !== b.manualLayer) {
      return a.manualLayer - b.manualLayer;
    }
    if (a.fragile !== b.fragile) {
      return a.fragile ? 1 : -1;
    }
    const areaA = a.rawL * a.rawD;
    const areaB = b.rawL * b.rawD;
    if (Math.abs(areaB - areaA) > 200) {
      return areaB - areaA;
    }
    return b.weightKg - a.weightKg;
  });

  interface LayerState {
    layerNumber: number;
    baseYCm: number;
    maxHeightCm: number;
    freeRects: FreeRect2D[];
  }

  const createFreshLayer = (layerNum: number, baseY: number): LayerState => ({
    layerNumber: layerNum,
    baseYCm: baseY,
    maxHeightCm: 0,
    freeRects: [
      {
        x: -palletLengthCm / 2,
        z: -palletDepthCm / 2,
        w: palletLengthCm,
        d: palletDepthCm,
      },
    ],
  });

  const layers: LayerState[] = [createFreshLayer(1, palletBaseHeightCm)];
  const placements: PackedCargoPlacement[] = [];
  const EPS = 0.25; // Tolerance so 60+60=120 and 40+40=80 always fit cleanly

  const tryPlaceInLayer = (
    layer: LayerState,
    unit: PackableUnit
  ): {
    x: number;
    z: number;
    w: number;
    d: number;
    rotated90: boolean;
  } | null => {
    // Evaluate both orientations: normal (rawL x rawD) and rotated 90° (rawD x rawL)
    // Prefer orientation that divides the pallet dimension evenly (e.g. 60x80 on 120x80!)
    const orientations: Array<{ w: number; d: number; rotated90: boolean }> = [
      { w: unit.rawL, d: unit.rawD, rotated90: false },
      { w: unit.rawD, d: unit.rawL, rotated90: true },
    ];

    // If 80x60 on 120x80 pallet, 60 along X (120) and 80 along Z (80) fits 2 boxes side-by-side!
    orientations.sort((o1, o2) => {
      const rem1 = (palletLengthCm % o1.w) + (palletDepthCm % o1.d);
      const rem2 = (palletLengthCm % o2.w) + (palletDepthCm % o2.d);
      return rem1 - rem2;
    });

    let bestRectIdx = -1;
    let bestOrientation = orientations[0];
    let bestScore = Infinity;

    for (let rIdx = 0; rIdx < layer.freeRects.length; rIdx++) {
      const rect = layer.freeRects[rIdx];
      for (const orient of orientations) {
        if (orient.w <= rect.w + EPS && orient.d <= rect.d + EPS) {
          // Score: prefer back-left (smallest z, smallest x) so pallet builds methodically
          const score = (rect.z + palletDepthCm) * 1000 + (rect.x + palletLengthCm);
          if (score < bestScore) {
            bestScore = score;
            bestRectIdx = rIdx;
            bestOrientation = orient;
          }
        }
      }
    }

    if (bestRectIdx === -1) return null;

    const chosenRect = layer.freeRects[bestRectIdx];
    const placedW = Math.min(chosenRect.w, bestOrientation.w);
    const placedD = Math.min(chosenRect.d, bestOrientation.d);
    const placedX = chosenRect.x;
    const placedZ = chosenRect.z;

    // Split chosen free rectangle into up to 2 remaining guillotine rectangles
    layer.freeRects.splice(bestRectIdx, 1);

    const remW = chosenRect.w - placedW;
    const remD = chosenRect.d - placedD;

    // Split along the axis that leaves the largest usable contiguous area
    if (remW * chosenRect.d > remD * chosenRect.w) {
      if (remW > 8) {
        layer.freeRects.push({
          x: chosenRect.x + placedW,
          z: chosenRect.z,
          w: remW,
          d: chosenRect.d,
        });
      }
      if (remD > 8) {
        layer.freeRects.push({
          x: chosenRect.x,
          z: chosenRect.z + placedD,
          w: placedW,
          d: remD,
        });
      }
    } else {
      if (remD > 8) {
        layer.freeRects.push({
          x: chosenRect.x,
          z: chosenRect.z + placedD,
          w: chosenRect.w,
          d: remD,
        });
      }
      if (remW > 8) {
        layer.freeRects.push({
          x: chosenRect.x + placedW,
          z: chosenRect.z,
          w: remW,
          d: placedD,
        });
      }
    }

    return {
      x: placedX,
      z: placedZ,
      w: placedW,
      d: placedD,
      rotated90: bestOrientation.rotated90,
    };
  };

  units.forEach((unit) => {
    let placedResult: {
      layer: LayerState;
      x: number;
      z: number;
      w: number;
      d: number;
      rotated90: boolean;
    } | null = null;

    const minTargetLayer = respectManualStackLevel ? unit.manualLayer : 1;

    // Try existing layers starting from minTargetLayer
    for (const layer of layers) {
      if (layer.layerNumber < minTargetLayer) continue;
      const fit = tryPlaceInLayer(layer, unit);
      if (fit) {
        placedResult = { layer, ...fit };
        break;
      }
    }

    // If it didn't fit on any existing layer, create a new layer on top
    while (!placedResult) {
      const prevLayer = layers[layers.length - 1];
      const nextBaseY =
        prevLayer.baseYCm +
        (prevLayer.maxHeightCm > 0 ? prevLayer.maxHeightCm : unit.rawH);
      const newLayer = createFreshLayer(prevLayer.layerNumber + 1, nextBaseY);
      layers.push(newLayer);
      if (newLayer.layerNumber >= minTargetLayer) {
        const fit = tryPlaceInLayer(newLayer, unit);
        if (fit) {
          placedResult = { layer: newLayer, ...fit };
          break;
        }
      }
    }

    placedResult.layer.maxHeightCm = Math.max(
      placedResult.layer.maxHeightCm,
      unit.rawH
    );

    const centerX = placedResult.x + placedResult.w / 2;
    const centerZ = placedResult.z + placedResult.d / 2;

    const sideX =
      centerX < -8 ? 'Sinistra' : centerX > 8 ? 'Destra' : 'Centro';
    const sideZ =
      centerZ < -8 ? 'Retro' : centerZ > 8 ? 'Fronte' : 'Centro';

    placements.push({
      id: unit.id,
      kind: unit.kind,
      boxSummary: unit.boxSummary,
      looseItem: unit.looseItem,
      pallet: ps.pallet,
      palletIndex,
      widthCm: placedResult.w,
      depthCm: placedResult.d,
      heightCm: unit.rawH,
      rotated90: placedResult.rotated90,
      localXCm: centerX,
      bottomYCm: placedResult.layer.baseYCm,
      localZCm: centerZ,
      layerNumber: placedResult.layer.layerNumber,
      stepOrder: placements.length + 1,
      positionLabel: `Piano ${placedResult.layer.layerNumber} (${sideZ}-${sideX})`,
    });
  });

  return placements;
}

/**
 * Generates a high-contrast procedural shipping label + cardboard texture for a 3D box
 */
function createBoxCanvasTexture(
  box: CargoBox,
  palletCode: string,
  grossWeightKg: number,
  stepOrder: number,
  childBoxCount: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Kraft corrugated cardboard base (or wood if CASSA_LEGNO)
  ctx.fillStyle =
    box.boxType === 'CASSA_LEGNO'
      ? '#b8864b'
      : box.fragile
      ? '#d99b66'
      : '#cfa06e';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle fiber grain lines
  ctx.strokeStyle = 'rgba(120, 75, 30, 0.14)';
  ctx.lineWidth = 2;
  for (let y = 0; y < 512; y += 8) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Outer box seam border
  ctx.strokeStyle = '#7c5329';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 502);

  // White shipping label sticker
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(32, 36, 448, 310);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 4;
  ctx.strokeRect(32, 36, 448, 310);

  // Top header bar inside label with Step Number
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(32, 36, 448, 58);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 26px "JetBrains Mono", monospace';
  ctx.fillText(`#${stepOrder}`, 48, 74);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px "JetBrains Mono", monospace';
  ctx.fillText(`${palletCode} ▸ ${box.code}`, 105, 74);

  // Weight badge on header right
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 25px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${grossWeightKg.toFixed(1)} kg`, 462, 74);
  ctx.textAlign = 'left';

  // Box Title
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 32px "Plus Jakarta Sans", sans-serif';
  const truncatedLabel =
    box.label.length > 21 ? box.label.slice(0, 21) + '…' : box.label;
  ctx.fillText(truncatedLabel || 'Scatola', 48, 140);

  // Dimensions
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 25px "JetBrains Mono", monospace';
  ctx.fillText(`MISURE: ${box.dimensionsCm}`, 48, 190);

  if (childBoxCount > 0) {
    ctx.fillStyle = '#4f46e5';
    ctx.font = 'bold 23px "JetBrains Mono", monospace';
    ctx.fillText(`CONTIENE ${childBoxCount} SOTTO-SCATOLE`, 48, 232);
  } else {
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 23px "JetBrains Mono", monospace';
    ctx.fillText(
      `${box.sealed ? '✓ SIGILLATA' : 'APERTA'}${box.kitName ? ` · ${box.kitName}` : ''}`,
      48,
      232
    );
  }

  // Simulated Barcode
  ctx.fillStyle = '#0f172a';
  for (let x = 48; x < 310; x += 9) {
    const w = x % 18 === 0 ? 5 : 2;
    ctx.fillRect(x, 265, w, 55);
  }

  // Fragile red badge if fragile
  if (box.fragile) {
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(32, 365, 220, 52);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 25px sans-serif';
    ctx.fillText('⚠ FRAGILE', 52, 400);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Generates a procedural texture for Loose Items ("Materiale Fuori Scatola") placed directly on a pallet
 */
function createLooseItemCanvasTexture(
  item: ChecklistItem,
  palletCode: string,
  stepOrder: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Industrial protective slate-teal base
  ctx.fillStyle = '#1e3a5f';
  ctx.fillRect(0, 0, 512, 512);

  // Diagonal industrial stripes on border
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.25)';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 492);

  // High-contrast label plaque
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(32, 40, 448, 300);

  // Header bar: FUORI SCATOLA
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(32, 40, 448, 60);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px "JetBrains Mono", monospace';
  ctx.fillText(`#${stepOrder} · FUORI SCATOLA (${palletCode})`, 48, 78);

  // SKU & Quantity
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 28px "JetBrains Mono", monospace';
  ctx.fillText(
    `${item.sku} · Q.TÀ: ${item.quantity} PZ`,
    48,
    142
  );

  // Item Name
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 32px "Plus Jakarta Sans", sans-serif';
  const lbl =
    item.name.length > 20 ? item.name.slice(0, 20) + '…' : item.name;
  ctx.fillText(lbl || 'Materiale Sciolto', 48, 195);

  // Dimensions & Total Weight
  const totKg = (item.quantity * item.unitWeightKg).toFixed(1);
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 24px "JetBrains Mono", monospace';
  ctx.fillText(
    `MISURE: ${item.dimensionsCm || '45×35×30 cm'}`,
    48,
    248
  );
  ctx.fillStyle = '#0369a1';
  ctx.fillText(`PESO TOTALE: ${totKg} kg`, 48, 295);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Generates a floor ruler / pallet plaque canvas texture
 */
function createPalletFloorPlaqueTexture(
  pallet: CargoPallet,
  grossWeightKg: number,
  boxCount: number,
  looseCount: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 506, 154);

  ctx.fillStyle = '#60a5fa';
  ctx.font = 'bold 26px "JetBrains Mono", monospace';
  ctx.fillText(`${pallet.code} — ${pallet.dimensionsCm}`, 24, 46);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
  const lbl =
    pallet.label.length > 24 ? pallet.label.slice(0, 24) + '…' : pallet.label;
  ctx.fillText(lbl || 'Bancale', 24, 90);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 20px "JetBrains Mono", monospace';
  ctx.fillText(
    `${boxCount} Scatole · ${looseCount} Fuori Scatola · ${grossWeightKg.toFixed(1)} kg`,
    24,
    134
  );

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

// Pre-allocated math helpers outside render loop
const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();

export const Pallet3DVisualizer: React.FC<Pallet3DVisualizerProps> = ({
  load,
  summary,
  initialPalletId = 'all',
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  const [selectedPalletId, setSelectedPalletId] = useState<string | 'all'>(
    initialPalletId
  );
  const [explodeFactor, setExplodeFactor] = useState<number>(0); // 0 to 1
  const [maxVisibleLayer, setMaxVisibleLayer] = useState<number>(99);
  const [showDimensionCage, setShowDimensionCage] = useState<boolean>(true);
  const [showNestedXRay, setShowNestedXRay] = useState<boolean>(false);
  const [respectManualLevels, setRespectManualLevels] =
    useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [hoveredTarget, setHoveredTarget] = useState<Hovered3DTarget | null>(
    null
  );
  const [pinnedTarget, setPinnedTarget] = useState<Hovered3DTarget | null>(
    null
  );

  const visiblePalletSummaries = useMemo(() => {
    if (selectedPalletId === 'all') return summary.palletSummaries;
    return summary.palletSummaries.filter(
      (ps) => ps.pallet.id === selectedPalletId
    );
  }, [summary.palletSummaries, selectedPalletId]);

  const allPlacements = useMemo(() => {
    return visiblePalletSummaries.flatMap((ps, idx) =>
      computePalletBoxPlacements(ps, idx, respectManualLevels)
    );
  }, [visiblePalletSummaries, respectManualLevels]);

  const totalSteps = allPlacements.length;
  const [currentStepLimit, setCurrentStepLimit] = useState<number>(999);

  useEffect(() => {
    setCurrentStepLimit(Math.max(1, allPlacements.length));
  }, [allPlacements.length, selectedPalletId]);

  // Refs for bridging React state into the persistent Three.js scene
  const explodeFactorRef = useRef(explodeFactor);
  explodeFactorRef.current = explodeFactor;

  const maxVisibleLayerRef = useRef(maxVisibleLayer);
  maxVisibleLayerRef.current = maxVisibleLayer;

  const currentStepLimitRef = useRef(currentStepLimit);
  currentStepLimitRef.current = currentStepLimit;

  const showDimensionCageRef = useRef(showDimensionCage);
  showDimensionCageRef.current = showDimensionCage;

  const requestRenderRef = useRef<(() => void) | null>(null);
  const cameraPresetRef = useRef<{
    active: boolean;
    pos: THREE.Vector3;
    target: THREE.Vector3;
  }>({
    active: false,
    pos: new THREE.Vector3(2.2, 1.9, 2.5),
    target: new THREE.Vector3(0, 0.55, 0),
  });

  const triggerCameraPreset = (preset: 'iso' | 'front' | 'side' | 'top') => {
    const count = Math.max(1, visiblePalletSummaries.length);
    const spanX = (count - 1) * 1.65;
    const centerX = spanX / 2;
    const dist = Math.max(2.2, count * 1.35);

    cameraPresetRef.current.target.set(centerX, 0.5, 0);
    if (preset === 'iso') {
      cameraPresetRef.current.pos.set(
        centerX + dist * 0.85,
        dist * 0.78,
        dist
      );
    } else if (preset === 'front') {
      cameraPresetRef.current.pos.set(centerX, 0.7, dist * 1.25);
    } else if (preset === 'side') {
      cameraPresetRef.current.pos.set(centerX + dist * 1.35, 0.7, 0.05);
    } else if (preset === 'top') {
      cameraPresetRef.current.pos.set(centerX, dist * 1.55, 0.01);
    }
    cameraPresetRef.current.active = true;
    requestRenderRef.current?.();
  };

  useEffect(() => {
    requestRenderRef.current?.();
  }, [explodeFactor, maxVisibleLayer, showDimensionCage, currentStepLimit]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software WebGL detection
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe2e8f0);
    scene.fog = new THREE.FogExp2(0xe2e8f0, 0.065);

    // 2. Studio Environment Map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    // 3. Camera & OrbitControls
    const palletCount = Math.max(1, visiblePalletSummaries.length);
    const totalSpanX = (palletCount - 1) * 1.65;
    const centerX = totalSpanX / 2;
    const initialDist = Math.max(2.2, palletCount * 1.3);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.05, 60);
    camera.position.set(
      centerX + initialDist * 0.8,
      initialDist * 0.75,
      initialDist
    );

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(centerX, 0.48, 0);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 0.7;
    controls.maxDistance = 18;
    controls.update();

    // 4. Three-Point Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x94a3b8, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.65);
    keyLight.position.set(centerX + 4, 7, 5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 25;
    const d = Math.max(4, palletCount * 2.2);
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.65);
    rimLight.position.set(centerX - 4, 4, -5);
    scene.add(rimLight);

    // Warehouse Floor Plane + Grid
    const floorGeo = new THREE.PlaneGeometry(40, 40);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.88,
      metalness: 0.05,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.002;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const gridHelper = new THREE.GridHelper(24, 48, 0x64748b, 0x94a3b8);
    gridHelper.position.set(centerX, 0.001, 0);
    scene.add(gridHelper);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // Shared Materials
    const woodDarkMat = new THREE.MeshStandardMaterial({
      color: 0x8c5828,
      roughness: 0.85,
      metalness: 0.05,
    });
    const woodMidMat = new THREE.MeshStandardMaterial({
      color: 0xb57c43,
      roughness: 0.78,
      metalness: 0.05,
    });
    const woodTopMat = new THREE.MeshStandardMaterial({
      color: 0xd49b5c,
      roughness: 0.72,
      metalness: 0.04,
    });
    const strapMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.35,
      metalness: 0.25,
    });

    const interactiveMeshes: THREE.Object3D[] = [];
    const animatedBoxNodes: Array<{
      group: THREE.Group;
      baseY: number;
      layerNumber: number;
      stepOrder: number;
    }> = [];
    const dimensionCages: THREE.Object3D[] = [];
    const disposableTextures: THREE.Texture[] = [];
    const disposableGeometries: THREE.BufferGeometry[] = [];
    const disposableMaterials: THREE.Material[] = [
      floorMat,
      woodDarkMat,
      woodMidMat,
      woodTopMat,
      strapMat,
    ];
    disposableGeometries.push(floorGeo);

    let globalStepCounter = 0;

    // 5. Build Procedural Models for each Pallet, its Boxes, Nested Sub-Boxes, and Loose Items
    visiblePalletSummaries.forEach((ps, pIdx) => {
      const palletXOffset = pIdx * 1.65;
      const [rawW, rawD] = parseDimensionsCm(ps.pallet.dimensionsCm, [
        120, 80, 15,
      ]);
      const palLengthM = Math.max(rawW, rawD) / 100; // 1.20m
      const palDepthM = Math.min(rawW, rawD) / 100; // 0.80m
      const maxHeightM = (ps.pallet.heightCm || 140) / 100;

      const palletGroup = new THREE.Group();
      palletGroup.position.set(palletXOffset, 0, 0);
      scene.add(palletGroup);

      // Contact Shadow Plane beneath pallet
      const shadowGeo = new THREE.PlaneGeometry(
        palLengthM + 0.16,
        palDepthM + 0.16
      );
      const shadowMat = new THREE.MeshBasicMaterial({
        color: 0x0f172a,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      });
      const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.y = 0.002;
      palletGroup.add(shadowPlane);
      disposableGeometries.push(shadowGeo);
      disposableMaterials.push(shadowMat);

      // Part 1: 3 Bottom Wooden Skids
      const skidGeo = new THREE.BoxGeometry(palLengthM, 0.022, 0.1);
      disposableGeometries.push(skidGeo);
      [-palDepthM / 2 + 0.05, 0, palDepthM / 2 - 0.05].forEach((zPos) => {
        const skid = new THREE.Mesh(skidGeo, woodDarkMat);
        skid.position.set(0, 0.011, zPos);
        skid.castShadow = true;
        skid.receiveShadow = true;
        skid.userData = {
          type: 'pallet',
          pallet: ps.pallet,
          palletSummary: ps,
        };
        palletGroup.add(skid);
        interactiveMeshes.push(skid);
      });

      // Part 2: 9 Spacer Blocks
      const blockGeo = new THREE.BoxGeometry(0.14, 0.098, 0.1);
      disposableGeometries.push(blockGeo);
      [-palLengthM / 2 + 0.07, 0, palLengthM / 2 - 0.07].forEach((xPos) => {
        [-palDepthM / 2 + 0.05, 0, palDepthM / 2 - 0.05].forEach((zPos) => {
          const block = new THREE.Mesh(blockGeo, woodMidMat);
          block.position.set(xPos, 0.022 + 0.049, zPos);
          block.castShadow = true;
          block.receiveShadow = true;
          block.userData = {
            type: 'pallet',
            pallet: ps.pallet,
            palletSummary: ps,
          };
          palletGroup.add(block);
          interactiveMeshes.push(block);
        });
      });

      // Part 3: 5 Top Deck Wooden Planks
      const plankGeo = new THREE.BoxGeometry(
        palLengthM,
        0.024,
        (palDepthM - 0.08) / 5
      );
      disposableGeometries.push(plankGeo);
      for (let i = 0; i < 5; i++) {
        const zPos = -palDepthM / 2 + 0.08 + i * ((palDepthM - 0.16) / 4);
        const plank = new THREE.Mesh(plankGeo, woodTopMat);
        plank.position.set(0, 0.12 + 0.012, zPos);
        plank.castShadow = true;
        plank.receiveShadow = true;
        plank.userData = {
          type: 'pallet',
          pallet: ps.pallet,
          palletSummary: ps,
        };
        palletGroup.add(plank);
        interactiveMeshes.push(plank);
      }

      // Part 4: Floor Identification Plaque
      const plaqueTex = createPalletFloorPlaqueTexture(
        ps.pallet,
        ps.grossWeightKg,
        ps.totalBoxes,
        ps.looseItems.length,
        maxAnisotropy
      );
      disposableTextures.push(plaqueTex);
      const plaqueGeo = new THREE.PlaneGeometry(0.98, 0.3);
      const plaqueMat = new THREE.MeshBasicMaterial({
        map: plaqueTex,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const plaqueMesh = new THREE.Mesh(plaqueGeo, plaqueMat);
      plaqueMesh.rotation.x = -Math.PI / 2;
      plaqueMesh.position.set(0, 0.004, palDepthM / 2 + 0.24);
      palletGroup.add(plaqueMesh);
      disposableGeometries.push(plaqueGeo);
      disposableMaterials.push(plaqueMat);

      // Part 5: Dimension Wireframe Volume Cage
      const cageGeo = new THREE.BoxGeometry(
        palLengthM,
        maxHeightM,
        palDepthM
      );
      const cageEdges = new THREE.EdgesGeometry(cageGeo);
      const cageMat = new THREE.LineBasicMaterial({
        color: 0x2563eb,
        transparent: true,
        opacity: 0.45,
      });
      const cageLines = new THREE.LineSegments(cageEdges, cageMat);
      cageLines.position.set(0, maxHeightM / 2, 0);
      cageLines.visible = showDimensionCageRef.current;
      palletGroup.add(cageLines);
      dimensionCages.push(cageLines);
      disposableGeometries.push(cageGeo, cageEdges);
      disposableMaterials.push(cageMat);

      // Part 6: Stacked 3D Cargo Boxes & Loose Items on this Pallet
      const placements = computePalletBoxPlacements(
        ps,
        pIdx,
        respectManualLevels
      );

      placements.forEach((pl) => {
        globalStepCounter += 1;
        pl.stepOrder = globalStepCounter;

        // Render with 98.5% visual scale so modular boxes (60+60=120) have a clean 8mm visual seam
        const wM = (pl.widthCm / 100) * 0.985;
        const dM = (pl.depthCm / 100) * 0.985;
        const hM = (pl.heightCm / 100) * 0.99;
        const baseYM = pl.bottomYCm / 100 + hM / 2;

        const unitGroup = new THREE.Group();
        unitGroup.position.set(pl.localXCm / 100, baseYM, pl.localZCm / 100);
        palletGroup.add(unitGroup);

        if (pl.kind === 'box' && pl.boxSummary) {
          const hasChildren =
            pl.boxSummary.childBoxes && pl.boxSummary.childBoxes.length > 0;
          const isXRayActive = showNestedXRay && hasChildren;

          const boxTex = createBoxCanvasTexture(
            pl.boxSummary.box,
            ps.pallet.code,
            pl.boxSummary.grossWeightKg,
            pl.stepOrder,
            pl.boxSummary.childBoxes?.length || 0,
            maxAnisotropy
          );
          disposableTextures.push(boxTex);

          const boxGeo = new THREE.BoxGeometry(wM, hM, dM);
          const boxMat = new THREE.MeshStandardMaterial({
            map: boxTex,
            roughness: 0.52,
            metalness: 0.06,
            transparent: isXRayActive,
            opacity: isXRayActive ? 0.28 : 1.0,
          });
          const boxMesh = new THREE.Mesh(boxGeo, boxMat);
          boxMesh.castShadow = !isXRayActive;
          boxMesh.receiveShadow = true;
          boxMesh.userData = {
            type: 'box',
            pallet: ps.pallet,
            palletSummary: ps,
            placement: pl,
          };
          unitGroup.add(boxMesh);
          interactiveMeshes.push(boxMesh);
          disposableGeometries.push(boxGeo);
          disposableMaterials.push(boxMat);

          // Crisp Edge Outline
          const edgeGeo = new THREE.EdgesGeometry(boxGeo);
          const edgeMat = new THREE.LineBasicMaterial({
            color: hasChildren ? 0x4f46e5 : 0x475569,
          });
          const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
          unitGroup.add(edgeLines);
          disposableGeometries.push(edgeGeo);
          disposableMaterials.push(edgeMat);

          // Top Sealing Tape Strip
          const tapeGeo = new THREE.BoxGeometry(wM * 0.96, 0.004, 0.055);
          const tapeMat = new THREE.MeshStandardMaterial({
            color: pl.boxSummary.box.sealed ? 0x059669 : 0xd97706,
            roughness: 0.3,
            metalness: 0.1,
          });
          const tapeMesh = new THREE.Mesh(tapeGeo, tapeMat);
          tapeMesh.position.set(0, hM / 2 + 0.002, 0);
          unitGroup.add(tapeMesh);
          disposableGeometries.push(tapeGeo);
          disposableMaterials.push(tapeMat);

          // If X-Ray mode is active and this box has nested childBoxes, render the inner sub-boxes inside!
          if (isXRayActive && pl.boxSummary.childBoxes) {
            const count = pl.boxSummary.childBoxes.length;
            const innerCols = Math.min(count, 2);
            const innerRows = Math.ceil(count / innerCols);
            const subW = (wM * 0.84) / innerCols;
            const subD = (dM * 0.84) / innerRows;
            const subH = hM * 0.72;

            pl.boxSummary.childBoxes.forEach((childBs, cIdx) => {
              const col = cIdx % innerCols;
              const row = Math.floor(cIdx / innerCols);
              const cx =
                -wM * 0.42 + subW / 2 + col * subW;
              const cz =
                -dM * 0.42 + subD / 2 + row * subD;

              const subGeo = new THREE.BoxGeometry(
                subW * 0.92,
                subH,
                subD * 0.92
              );
              const subMat = new THREE.MeshStandardMaterial({
                color: 0xf59e0b,
                roughness: 0.45,
                metalness: 0.1,
              });
              const subMesh = new THREE.Mesh(subGeo, subMat);
              subMesh.position.set(cx, -hM * 0.08, cz);
              unitGroup.add(subMesh);
              disposableGeometries.push(subGeo);
              disposableMaterials.push(subMat);
            });
          }
        } else if (pl.kind === 'loose_item' && pl.looseItem) {
          // Render Loose Item ("Materiale Fuori Scatola") with industrial crate/bundle + yellow securing straps
          const looseTex = createLooseItemCanvasTexture(
            pl.looseItem,
            ps.pallet.code,
            pl.stepOrder,
            maxAnisotropy
          );
          disposableTextures.push(looseTex);

          const looseGeo = new THREE.BoxGeometry(wM, hM, dM);
          const looseMat = new THREE.MeshStandardMaterial({
            map: looseTex,
            roughness: 0.42,
            metalness: 0.18,
          });
          const looseMesh = new THREE.Mesh(looseGeo, looseMat);
          looseMesh.castShadow = true;
          looseMesh.receiveShadow = true;
          looseMesh.userData = {
            type: 'loose_item',
            pallet: ps.pallet,
            palletSummary: ps,
            placement: pl,
          };
          unitGroup.add(looseMesh);
          interactiveMeshes.push(looseMesh);
          disposableGeometries.push(looseGeo);
          disposableMaterials.push(looseMat);

          // Industrial Securing Straps around Loose Item
          const strap1Geo = new THREE.BoxGeometry(0.025, hM + 0.006, dM + 0.006);
          const strap2Geo = new THREE.BoxGeometry(0.025, hM + 0.006, dM + 0.006);
          const strap1 = new THREE.Mesh(strap1Geo, strapMat);
          const strap2 = new THREE.Mesh(strap2Geo, strapMat);
          strap1.position.set(-wM * 0.28, 0, 0);
          strap2.position.set(wM * 0.28, 0, 0);
          unitGroup.add(strap1, strap2);
          disposableGeometries.push(strap1Geo, strap2Geo);
        }

        animatedBoxNodes.push({
          group: unitGroup,
          baseY: baseYM,
          layerNumber: pl.layerNumber,
          stepOrder: pl.stepOrder,
        });
      });

      // Part 7: Translucent Stretch-Wrap Film
      if (ps.pallet.wrapped && placements.length > 0) {
        const maxTopCm = Math.max(
          ...placements.map((p) => p.bottomYCm + p.heightCm)
        );
        const wrapHeightM = Math.max(0.3, (maxTopCm - 10) / 100);
        const wrapGeo = new THREE.BoxGeometry(
          palLengthM + 0.025,
          wrapHeightM,
          palDepthM + 0.025
        );
        const wrapMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.15,
          roughness: 0.15,
          metalness: 0.1,
          depthWrite: false,
        });
        const wrapMesh = new THREE.Mesh(wrapGeo, wrapMat);
        wrapMesh.position.set(0, 0.12 + wrapHeightM / 2, 0);
        wrapMesh.renderOrder = 10;
        palletGroup.add(wrapMesh);
        disposableGeometries.push(wrapGeo);
        disposableMaterials.push(wrapMat);
      }
    });

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 6. Raycasting & Hover Highlighting
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hoveredMesh: THREE.Mesh | null = null;
    let lastRaycastTime = 0;

    const clearHoverHighlight = () => {
      if (hoveredMesh) {
        const mat = hoveredMesh.material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive) {
          mat.emissive.setHex(0x000000);
        }
        hoveredMesh = null;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastRaycastTime < 32) return;
      lastRaycastTime = now;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interactiveMeshes, false);

      const visibleHits = hits.filter((h) => h.object.parent?.visible !== false);

      if (visibleHits.length > 0) {
        const hitObj = visibleHits[0].object as THREE.Mesh;
        if (hoveredMesh !== hitObj) {
          clearHoverHighlight();
          hoveredMesh = hitObj;
          const mat = hoveredMesh.material as THREE.MeshStandardMaterial;
          if (mat && mat.emissive) {
            mat.emissive.setHex(0x1e40af);
          }
          requestRender();
        }
        renderer.domElement.style.cursor = 'pointer';
        const ud = hitObj.userData;
        setHoveredTarget({
          type: ud.type,
          pallet: ud.pallet,
          palletSummary: ud.palletSummary,
          placement: ud.placement,
          screenX: e.clientX - rect.left,
          screenY: e.clientY - rect.top,
        });
      } else {
        if (hoveredMesh) {
          clearHoverHighlight();
          requestRender();
        }
        renderer.domElement.style.cursor = 'grab';
        setHoveredTarget(null);
      }
    };

    const handlePointerClick = () => {
      if (hoveredMesh) {
        const ud = hoveredMesh.userData;
        setPinnedTarget({
          type: ud.type,
          pallet: ud.pallet,
          palletSummary: ud.palletSummary,
          placement: ud.placement,
          screenX: 0,
          screenY: 0,
        });
      } else {
        setPinnedTarget(null);
      }
    };

    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('click', handlePointerClick);

    // 7. On-Demand Coalesced Render Loop
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame((now) => {
        renderDirty = false;
        const dt = Math.min(0.1, (now - lastTime) / 1000 || 0.016);
        lastTime = now;

        let needsMoreFrames = false;

        animatedBoxNodes.forEach((node) => {
          node.group.visible =
            node.layerNumber <= maxVisibleLayerRef.current &&
            node.stepOrder <= currentStepLimitRef.current;

          const targetY =
            node.baseY +
            (node.layerNumber - 1) * explodeFactorRef.current * 0.36;
          if (Math.abs(node.group.position.y - targetY) > 0.001) {
            node.group.position.y = THREE.MathUtils.damp(
              node.group.position.y,
              targetY,
              10,
              dt
            );
            needsMoreFrames = true;
          } else {
            node.group.position.y = targetY;
          }
        });

        dimensionCages.forEach((c) => {
          c.visible = showDimensionCageRef.current;
        });

        if (cameraPresetRef.current.active) {
          _camTargetPos.copy(cameraPresetRef.current.pos);
          _camLookAt.copy(cameraPresetRef.current.target);
          camera.position.lerp(_camTargetPos, 1 - Math.exp(-8 * dt));
          controls.target.lerp(_camLookAt, 1 - Math.exp(-8 * dt));
          if (
            camera.position.distanceTo(_camTargetPos) < 0.02 &&
            controls.target.distanceTo(_camLookAt) < 0.02
          ) {
            cameraPresetRef.current.active = false;
          } else {
            needsMoreFrames = true;
          }
        }

        if (controls.update()) {
          needsMoreFrames = true;
        }

        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty || needsMoreFrames) {
            requestRender();
          }
        };

        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    requestRenderRef.current = requestRender;

    const onControlsStart = () => {
      cameraPresetRef.current.active = false;
    };
    const onControlsChange = () => {
      requestRender();
    };
    controls.addEventListener('start', onControlsStart);
    controls.addEventListener('change', onControlsChange);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', handleResize);

    requestRender();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('start', onControlsStart);
      controls.removeEventListener('change', onControlsChange);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('click', handlePointerClick);
      controls.dispose();
      disposableGeometries.forEach((g) => g.dispose());
      disposableMaterials.forEach((m) => m.dispose());
      disposableTextures.forEach((t) => t.dispose());
      renderer.dispose();
    };
  }, [visiblePalletSummaries, showNestedXRay, respectManualLevels]);

  const activeInspect = hoveredTarget || pinnedTarget;

  return (
    <div className="h-full w-full relative rounded-xl overflow-hidden border border-slate-300 bg-slate-200 flex flex-col select-none">
      {/* =========================================================================
          ISOLATED 3D WEBGL CANVAS CONTAINER
      ========================================================================= */}
      <div ref={canvasMountRef} className="w-full h-full flex-1" />

      {/* =========================================================================
          TOP-LEFT SPEC BADGE & TOP-RIGHT HOVER INSPECTOR
      ========================================================================= */}
      <div className="absolute top-3 left-3 right-3 pointer-events-none flex flex-wrap items-start justify-between gap-3 z-10">
        {/* Spec & Step-by-Step Preparation Guide Badge */}
        <div className="pointer-events-auto bg-slate-900/95 text-white px-4 py-2.5 rounded-xl border border-slate-700 shadow-lg max-w-md space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-xs font-extrabold uppercase tracking-wider">
                CAD 3D Stivaggio Ottimizzato a Strati
              </span>
            </div>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-blue-600 text-white font-bold">
              Passo {Math.min(currentStepLimit, totalSteps)}/{totalSteps}
            </span>
          </div>

          <p className="text-[11px] text-slate-300">
            Il CAD riempie prima tutta la base del bancale (ruotando i colli se necessario) prima di salire di livello. Usa i pulsanti qui sotto per seguire la preparazione passo dopo passo.
          </p>

          {totalSteps > 0 && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
              <button
                type="button"
                onClick={() =>
                  setCurrentStepLimit((prev) => Math.max(1, prev - 1))
                }
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                title="Collo precedente"
              >
                <StepBack className="w-3 h-3 text-blue-400" />
                Indietro
              </button>
              <input
                type="range"
                min={1}
                max={Math.max(1, totalSteps)}
                value={Math.min(currentStepLimit, Math.max(1, totalSteps))}
                onChange={(e) => setCurrentStepLimit(Number(e.target.value))}
                className="flex-1 accent-blue-500 cursor-pointer"
              />
              <button
                type="button"
                onClick={() =>
                  setCurrentStepLimit((prev) =>
                    Math.min(totalSteps, prev + 1)
                  )
                }
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                title="Collo successivo"
              >
                Avanti
                <StepForward className="w-3 h-3 text-blue-400" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentStepLimit(totalSteps)}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-[11px] font-bold cursor-pointer"
              >
                Tutti
              </button>
            </div>
          )}
        </div>

        {/* Live Hover / Pinned Inspection Card */}
        {activeInspect ? (
          <div className="pointer-events-auto bg-slate-900/95 text-white px-4 py-3 rounded-xl border-2 border-blue-500 shadow-xl w-full sm:w-96 space-y-2">
            {activeInspect.type === 'box' &&
            activeInspect.placement?.boxSummary ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-amber-500 text-slate-950 shrink-0">
                      #{activeInspect.placement.stepOrder} ·{' '}
                      {activeInspect.placement.boxSummary.box.code}
                    </span>
                    <span className="text-sm font-extrabold text-white truncate">
                      {activeInspect.placement.boxSummary.box.label}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-blue-400 shrink-0">
                    Su {activeInspect.pallet.code}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-800 px-2.5 py-1.5 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">
                      MISURE SCATOLA
                    </span>
                    <strong className="text-white">
                      {activeInspect.placement.boxSummary.box.dimensionsCm}
                      {activeInspect.placement.rotated90 ? ' (Ruotata 90°)' : ''}
                    </strong>
                  </div>
                  <div className="bg-slate-800 px-2.5 py-1.5 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">
                      POSIZIONE SUL BANCALE
                    </span>
                    <strong className="text-emerald-400">
                      {activeInspect.placement.positionLabel}
                    </strong>
                  </div>
                  <div className="bg-slate-800 px-2.5 py-1.5 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">
                      QUOTA DA TERRA
                    </span>
                    <strong className="text-white">
                      {activeInspect.placement.bottomYCm.toFixed(0)} ▸{' '}
                      {(
                        activeInspect.placement.bottomYCm +
                        activeInspect.placement.heightCm
                      ).toFixed(0)}{' '}
                      cm
                    </strong>
                  </div>
                  <div className="bg-slate-800 px-2.5 py-1.5 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">
                      PESO LORDO SCATOLA
                    </span>
                    <strong className="text-amber-300">
                      {activeInspect.placement.boxSummary.grossWeightKg.toFixed(
                        1
                      )}{' '}
                      kg
                    </strong>
                  </div>
                </div>

                {/* Nested Child Boxes inside this Box */}
                {activeInspect.placement.boxSummary.childBoxes &&
                  activeInspect.placement.boxSummary.childBoxes.length > 0 && (
                    <div className="text-[11px] text-indigo-200 pt-1">
                      <span className="font-bold text-indigo-300 uppercase block mb-1">
                        Sotto-Scatole contenute dentro questo scatolone (
                        {activeInspect.placement.boxSummary.childBoxes.length}):
                      </span>
                      <div className="space-y-1 font-mono bg-indigo-950/80 p-2 rounded-lg border border-indigo-700/60 max-h-20 overflow-y-auto">
                        {activeInspect.placement.boxSummary.childBoxes.map(
                          (cb) => (
                            <div
                              key={cb.box.id}
                              className="flex justify-between text-[11px]"
                            >
                              <span className="truncate pr-2">
                                📦 {cb.box.code} — {cb.box.label} (
                                {cb.box.dimensionsCm})
                              </span>
                              <span className="text-amber-300 font-bold shrink-0">
                                {cb.grossWeightKg.toFixed(1)} kg
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {/* Direct Items inside this Box */}
                <div className="text-[11px] text-slate-300 pt-1">
                  <span className="font-bold text-slate-400 uppercase block mb-1">
                    Articoli nella scatola (
                    {activeInspect.placement.boxSummary.items.length}):
                  </span>
                  {activeInspect.placement.boxSummary.items.length > 0 ? (
                    <div className="max-h-28 overflow-y-auto space-y-1.5 font-mono bg-slate-950 p-2 rounded-lg border border-slate-800">
                      {activeInspect.placement.boxSummary.items.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center justify-between gap-2 text-[11px]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {it.photoDataUrl && (
                              <img
                                src={it.photoDataUrl}
                                alt={it.name}
                                className="w-6 h-6 rounded object-cover border border-slate-700 shrink-0"
                              />
                            )}
                            <span className="truncate text-slate-200">
                              {it.sku} · {it.name}
                            </span>
                          </div>
                          <span className="text-amber-400 font-bold shrink-0">
                            {it.quantity} pz
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="italic text-slate-400">
                      Nessun articolo diretto
                    </span>
                  )}
                </div>
              </>
            ) : activeInspect.type === 'loose_item' &&
              activeInspect.placement?.looseItem ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-sky-500 text-slate-950 shrink-0">
                      #{activeInspect.placement.stepOrder} · FUORI SCATOLA
                    </span>
                    <span className="text-sm font-extrabold text-white truncate">
                      {activeInspect.placement.looseItem.name}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-sky-400 shrink-0">
                    Su {activeInspect.pallet.code}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {activeInspect.placement.looseItem.photoDataUrl && (
                    <img
                      src={activeInspect.placement.looseItem.photoDataUrl}
                      alt={activeInspect.placement.looseItem.name}
                      className="w-14 h-14 rounded-lg object-cover border border-slate-700 shrink-0"
                    />
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono flex-1">
                    <div className="bg-slate-800 px-2.5 py-1.5 rounded-lg">
                      <span className="text-[10px] text-slate-400 block">
                        MISURE INGOMBRO
                      </span>
                      <strong className="text-white">
                        {activeInspect.placement.looseItem.dimensionsCm ||
                          '45×35×30 cm'}
                      </strong>
                    </div>
                    <div className="bg-slate-800 px-2.5 py-1.5 rounded-lg">
                      <span className="text-[10px] text-slate-400 block">
                        POSIZIONE SUL BANCALE
                      </span>
                      <strong className="text-emerald-400">
                        {activeInspect.placement.positionLabel}
                      </strong>
                    </div>
                    <div className="bg-slate-800 px-2.5 py-1.5 rounded-lg">
                      <span className="text-[10px] text-slate-400 block">
                        QUANTITÀ & SKU
                      </span>
                      <strong className="text-white">
                        {activeInspect.placement.looseItem.sku} ·{' '}
                        {activeInspect.placement.looseItem.quantity} pz
                      </strong>
                    </div>
                    <div className="bg-slate-800 px-2.5 py-1.5 rounded-lg">
                      <span className="text-[10px] text-slate-400 block">
                        PESO TOTALE
                      </span>
                      <strong className="text-sky-300">
                        {(
                          activeInspect.placement.looseItem.quantity *
                          activeInspect.placement.looseItem.unitWeightKg
                        ).toFixed(1)}{' '}
                        kg
                      </strong>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-indigo-500 text-white">
                      {activeInspect.pallet.code}
                    </span>
                    <span className="text-sm font-extrabold text-white truncate">
                      {activeInspect.pallet.label}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-emerald-400 font-bold">
                    {activeInspect.palletSummary.grossWeightKg.toFixed(1)} kg
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-800 px-2.5 py-1.5 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">
                      MISURE PEDANA
                    </span>
                    <strong className="text-white">
                      {activeInspect.pallet.dimensionsCm}
                    </strong>
                  </div>
                  <div className="bg-slate-800 px-2.5 py-1.5 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">
                      COLLI SUL BANCALE
                    </span>
                    <strong className="text-white">
                      {activeInspect.palletSummary.totalBoxes} scatole ·{' '}
                      {activeInspect.palletSummary.looseItems.length} fuori
                      scatola
                    </strong>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="pointer-events-auto bg-white/95 text-slate-700 px-3.5 py-2 rounded-xl border border-slate-300 shadow-sm text-xs font-semibold flex items-center gap-2">
            <Ruler className="w-4 h-4 text-blue-600" />
            <span>
              Punta il mouse su una scatola o collo fuori scatola per vedere misure, foto e posizione
            </span>
          </div>
        )}
      </div>

      {/* Empty State Helper */}
      {summary.totalPallets === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="pointer-events-auto bg-white border border-slate-300 rounded-2xl p-6 shadow-xl max-w-md text-center space-y-3">
            <Layers className="w-10 h-10 text-blue-600 mx-auto" />
            <h3 className="text-sm font-extrabold text-slate-900 uppercase">
              Nessun Bancale o Scatola da Visualizzare in 3D
            </h3>
            <p className="text-xs text-slate-600">
              Crea almeno un bancale e aggiungi scatole o materiale fuori scatola nella sezione &quot;Bancali & Scatole&quot; per vedere qui la disposizione tridimensionale ottimizzata.
            </p>
          </div>
        </div>
      )}

      {/* =========================================================================
          UNIFIED COLLAPSIBLE BOTTOM CONTROL DOCK
      ========================================================================= */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[min(1020px,96%)] transition-transform duration-200"
        style={{
          transform: dockCollapsed
            ? 'translateY(calc(100% - 28px))'
            : 'translateY(0)',
        }}
      >
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="px-4 py-1 bg-slate-900 text-white text-[11px] font-bold rounded-t-xl border border-b-0 border-slate-700 flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-blue-400" />
                Mostra Controlli CAD 3D
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-blue-400" />
                Nascondi Controlli
              </>
            )}
          </button>
        </div>

        <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl border border-slate-700 shadow-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* 1. Selettore Bancale */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase">
              Bancale:
            </span>
            <select
              value={selectedPalletId}
              onChange={(e) => setSelectedPalletId(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white font-mono text-xs cursor-pointer"
            >
              <option value="all">
                Tutti i Bancali ({summary.totalPallets})
              </option>
              {summary.palletSummaries.map((ps) => (
                <option key={ps.pallet.id} value={ps.pallet.id}>
                  {ps.pallet.code} — {ps.pallet.label} ({ps.totalBoxes} scat ·{' '}
                  {ps.looseItems.length} sciolti)
                </option>
              ))}
            </select>
          </div>

          {/* 2. Algoritmo Stivaggio + Raggi X Sotto-Scatole */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRespectManualLevels((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
                !respectManualLevels
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
              title="Ottimizza riempiendo tutta la base del bancale prima di salire in altezza"
            >
              {!respectManualLevels
                ? '✓ Ottimizzato Base Piena'
                : 'Piani Manuali'}
            </button>

            <button
              type="button"
              onClick={() => setShowNestedXRay((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                showNestedXRay
                  ? 'bg-indigo-600 border-indigo-400 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Rende trasparenti gli scatoloni madre per vedere le sotto-scatole interne"
            >
              <Eye className="w-3.5 h-3.5" />
              Raggi X Sotto-Scatole
            </button>
          </div>

          {/* 3. Esplodi Piani Verticalmente */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase">
              Esplodi Piani:
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={explodeFactor}
              onChange={(e) => setExplodeFactor(Number(e.target.value))}
              className="w-20 accent-blue-500 cursor-pointer"
            />
          </div>

          {/* 4. Filtro Piani Visibili */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
            {[
              { label: 'Tutti', val: 99 },
              { label: 'Piano 1', val: 1 },
              { label: 'P. 1-2', val: 2 },
              { label: 'P. 1-3', val: 3 },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setMaxVisibleLayer(opt.val)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  maxVisibleLayer === opt.val
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 5. Inquadrature Telecamera + Gabbia Misure */}
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'iso', label: '3D Iso' },
                { id: 'front', label: 'Fronte' },
                { id: 'side', label: 'Lato' },
                { id: 'top', label: "Dall'Alto" },
              ] as const
            ).map((cam) => (
              <button
                key={cam.id}
                type="button"
                onClick={() => triggerCameraPreset(cam.id)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] font-bold text-slate-200 cursor-pointer"
              >
                {cam.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowDimensionCage((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                showDimensionCage
                  ? 'bg-blue-950 border-blue-500 text-blue-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title="Mostra/Nascondi gabbia volume massimo"
            >
              <Ruler className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
