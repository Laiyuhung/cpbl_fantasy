import supabaseAdmin from '@/lib/supabaseAdmin'

const DEFAULT_CONFIG = {
  forceDefaultPlayerPhoto: false,
}

const SETTING_KEY = 'force_default_player_photo'

export async function readPhotoPrivacyConfig() {
  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('value_bool')
      .eq('key', SETTING_KEY)
      .maybeSingle()

    if (error || !data) {
      return DEFAULT_CONFIG
    }

    return {
      ...DEFAULT_CONFIG,
      forceDefaultPlayerPhoto: Boolean(data.value_bool),
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

export async function writePhotoPrivacyConfig(nextConfig) {
  const merged = {
    ...DEFAULT_CONFIG,
    ...nextConfig,
  }

  const { error } = await supabaseAdmin
    .from('system_settings')
    .upsert(
      {
        key: SETTING_KEY,
        value_bool: Boolean(merged.forceDefaultPlayerPhoto),
      },
      { onConflict: 'key' }
    )

  if (error) {
    throw new Error(error.message)
  }

  return merged
}
