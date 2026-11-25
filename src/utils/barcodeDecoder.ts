import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HTMLCanvasElementLuminanceSource,
  HybridBinarizer,
  MultiFormatReader,
} from '@zxing/library';

export function createUniversalBarcodeReader(): MultiFormatReader {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.ITF,
    BarcodeFormat.CODABAR,
    BarcodeFormat.QR_CODE,
    BarcodeFormat.DATA_MATRIX,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new MultiFormatReader();
  reader.setHints(hints);
  return reader;
}

export function decodeBarcodeFromCanvas(
  reader: MultiFormatReader,
  canvas: HTMLCanvasElement
): string | null {
  try {
    const source = new HTMLCanvasElementLuminanceSource(canvas, false);
    try {
      const res = reader.decodeWithState(
        new BinaryBitmap(new HybridBinarizer(source))
      );
      const txt = res?.getText()?.trim();
      if (txt) return txt;
    } catch {
      // try alternative binarizer below
    }
    try {
      const res = reader.decodeWithState(
        new BinaryBitmap(new GlobalHistogramBinarizer(source))
      );
      const txt = res?.getText()?.trim();
      if (txt) return txt;
    } catch {
      // no barcode found in this frame
    }
  } catch {
    // ignore luminance conversion errors
  } finally {
    try {
      reader.reset();
    } catch {
      // ignore
    }
  }
  return null;
}

export function decodeBarcodeFromVideoFrame(
  reader: MultiFormatReader,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  scanFullFrame: boolean
): string | null {
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    return null;
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const maxWidth = 900;
  const scale = Math.min(1, maxWidth / vw);
  const drawW = Math.max(1, Math.round(vw * scale));

  if (scanFullFrame) {
    const drawH = Math.max(1, Math.round(vh * scale));
    canvas.width = drawW;
    canvas.height = drawH;
    ctx.drawImage(video, 0, 0, vw, vh, 0, 0, drawW, drawH);
  } else {
    const cropY = Math.round(vh * 0.22);
    const cropH = Math.max(1, Math.round(vh * 0.56));
    const drawH = Math.max(1, Math.round(cropH * scale));
    canvas.width = drawW;
    canvas.height = drawH;
    ctx.drawImage(video, 0, cropY, vw, cropH, 0, 0, drawW, drawH);
  }

  return decodeBarcodeFromCanvas(reader, canvas);
}
