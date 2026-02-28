import { NextResponse } from 'next/server'
import supabase from '@/lib/supabase'

export async function POST(req) {
  try {
    const body = await req.json()

    // New format: pre-parsed records with table specification
    if (body.records && Array.isArray(body.records)) {
      const { records, table } = body
      const targetTable = table || 'batting_stats_2026'

      // Validate table name to prevent SQL injection
      const allowedTables = ['batting_stats', 'batting_stats_2025', 'batting_stats_2026']
      if (!allowedTables.includes(targetTable)) {
        return NextResponse.json({ error: 'Invalid table name' }, { status: 400 })
      }

      console.log(`🟡 Inserting ${records.length} batting records into ${targetTable}`)

      const { error } = await supabase.from(targetTable).insert(records)

      if (error) {
        console.error('❌ Supabase insert 錯誤:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, count: records.length })
    }

    // Legacy format not supported for this endpoint
    return NextResponse.json({ error: 'Invalid request format. Use records array.' }, { status: 400 })
  } catch (err) {
    console.error('❌ API 例外錯誤:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
