import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

// 批次解析多位球員的照片路徑，一次請求處理所有球員
export async function POST(request) {
  try {
    const body = await request.json();
    // 支援兩種格式：
    // 1. 批次: { players: [ { id, candidates: [...] }, ... ] }
    // 2. 單一: { candidates: [...] }
    const photoDir = path.join(process.cwd(), 'public', 'photo');

    // 批次模式
    if (Array.isArray(body?.players)) {
      const results = {};
      for (const player of body.players) {
        const { id, candidates } = player;
        let resolved = '/photo/defaultPlayer.png';
        if (Array.isArray(candidates)) {
          for (let candidate of candidates) {
            if (candidate.startsWith('/photo/')) candidate = candidate.slice('/photo/'.length);
            const filename = decodeURIComponent(candidate);
            const filePath = path.join(photoDir, filename);
            if (fs.existsSync(filePath)) {
              const encoded = filename.split('/').map(encodeURIComponent).join('/');
              resolved = `/photo/${encoded}`;
              break;
            }
          }
        }
        results[id] = resolved;
      }
      return NextResponse.json({ results });
    }

    // 單一模式（向下相容）
    const candidates = Array.isArray(body?.candidates) ? body.candidates : [];
    for (let candidate of candidates) {
      if (candidate.startsWith('/photo/')) candidate = candidate.slice('/photo/'.length);
      const filename = decodeURIComponent(candidate);
      const filePath = path.join(photoDir, filename);
      if (fs.existsSync(filePath)) {
        const encoded = filename.split('/').map(encodeURIComponent).join('/');
        return NextResponse.json({ path: `/photo/${encoded}` });
      }
    }

    return NextResponse.json({ path: '/photo/defaultPlayer.png' });
  } catch (err) {
    return NextResponse.json({ path: '/photo/defaultPlayer.png' });
  }
}
