import { promises as fs } from 'fs'
import path from 'path'

const RUNTIME_DIR = path.join(process.cwd(), '.runtime')
const CONFIG_PATH = path.join(RUNTIME_DIR, 'photo-privacy.json')

const DEFAULT_CONFIG = {
  forceDefaultPlayerPhoto: false,
}

export async function readPhotoPrivacyConfig() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

export async function writePhotoPrivacyConfig(nextConfig) {
  await fs.mkdir(RUNTIME_DIR, { recursive: true })
  const merged = {
    ...DEFAULT_CONFIG,
    ...nextConfig,
  }
  await fs.writeFile(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf8')
  return merged
}
