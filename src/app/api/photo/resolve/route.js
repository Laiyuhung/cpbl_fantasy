import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function POST(request) {
  try {
    const body = await request.json();
    const candidates = Array.isArray(body?.candidates) ? body.candidates : [];

    const photoDir = path.join(process.cwd(), 'public', 'photo');

    for (let candidate of candidates) {
      // 支援傳入完整路徑 /photo/xxx.png 或純檔名 xxx.png
      if (candidate.startsWith('/photo/')) candidate = candidate.slice('/photo/'.length);
      // 解碼 URL 編碼，避免中文或特殊字元比對失敗
      const filename = decodeURIComponent(candidate);
      const filePath = path.join(photoDir, filename);
      if (fs.existsSync(filePath)) {
        // 回傳經過 URL 編碼的路徑，確保瀏覽器可正常載入
        const encoded = filename.split('/').map(encodeURIComponent).join('/');
        return NextResponse.json({ path: `/photo/${encoded}` });
      }
    }

    return NextResponse.json({ path: '/photo/defaultPlayer.png' });
  } catch (err) {
    // 出錯時回退為預設圖片，避免 404
    return NextResponse.json({ path: '/photo/defaultPlayer.png' });
  }
}
