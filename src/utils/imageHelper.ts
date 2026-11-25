/**
 * Compresses an uploaded image File into a lightweight Data URL (max 320x320 JPEG)
 * so item photos load instantaneously, print crisply, and fit comfortably in localStorage & JSON project files.
 */
export function compressImageToDataUrl(file: File, maxDim = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Errore lettura immagine'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato immagine non valido'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
