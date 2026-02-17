import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    // Warn but don't crash immediately if env var is missing during build, 
    // but runtime will need it.
    console.warn('Supabase Service Role Key is missing. Admin operations will fail.')
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || 'placeholder')

export default supabaseAdmin
