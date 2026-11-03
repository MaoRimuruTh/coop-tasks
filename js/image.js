// Shrinks a photo on the phone before upload, so each one stays well under
// Firestore's 1 MiB document limit (no Cloud Storage bucket needed).
export async function compressImage(file, maxSide = 1600, quality = 0.72) {
  if (!file.type.startsWith('image/')) throw new Error('แนบได้เฉพาะไฟล์รูปภาพ (ไฟล์อื่นให้แปะลิงก์ Google Drive)');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('เปิดรูปนี้ไม่ได้ ลองถ่ายใหม่หรือเลือกรูปอื่น'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    let q = quality;
    let data = canvas.toDataURL('image/jpeg', q);
    while (data.length > 900000 && q > 0.35) {
      q -= 0.1;
      data = canvas.toDataURL('image/jpeg', q);
    }
    const base = (file.name || 'photo').replace(/\.[^.]+$/, '');
    return { name: `${base}.jpg`, type: 'image/jpeg', data, size: Math.round(data.length * 0.75) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
