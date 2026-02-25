import { NextResponse } from 'next/server'
import supabase from '@/lib/supabase'

/**
 * 中文 action → enum_transaction_type 對應表
 */
const ACTION_MAP = {
    '新登錄': 'NEW_REGISTRATION',
    '登錄': 'NEW_REGISTRATION',
    '升一軍': 'PROMOTION',
    '升': 'PROMOTION',
    '降二軍': 'DEMOTION',
    '降': 'DEMOTION',
    '註銷': 'DEREGISTERED',
    '除役': 'DEREGISTERED',
}

const TEAM_VARIANTS = {
    '統一獅': ['統一7-ELEVEn獅', '統一7-eleven獅', '統一7-11獅', '統一獅', '統一'],
    '中信兄弟': ['中信兄弟', '兄弟'],
    '樂天桃猿': ['樂天桃猿', '桃猿', '樂天'],
    '富邦悍將': ['富邦悍將', '悍將', '富邦'],
    '味全龍': ['味全龍', '味全'],
    '台鋼雄鷹': ['台鋼雄鷹', '雄鷹', '台鋼'],
}

function normalizeTeam(rawTeam) {
    if (!rawTeam) return rawTeam
    for (const [canonical, variants] of Object.entries(TEAM_VARIANTS)) {
        for (const variant of variants) {
            if (rawTeam.includes(variant)) return canonical
        }
    }
    return rawTeam
}

function mapAction(rawAction) {
    if (!rawAction) return null
    if (ACTION_MAP[rawAction]) return ACTION_MAP[rawAction]
    for (const [key, val] of Object.entries(ACTION_MAP)) {
        if (rawAction.includes(key)) return val
    }
    const upper = rawAction.toUpperCase()
    const validEnums = ['NEW_REGISTRATION', 'PROMOTION', 'DEMOTION', 'DEREGISTERED']
    if (validEnums.includes(upper)) return upper
    return null
}

/** 轉換日期 2026/3/31 → 2026-03-31 */
function parseDate(raw) {
    if (!raw) return null
    const cleaned = raw.replace(/\//g, '-')
    const parts = cleaned.split('-')
    if (parts.length === 3) {
        const [y, m, d] = parts
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    return cleaned
}

export async function POST(req) {
    try {
        const { text, date: fallbackDate } = await req.json()

        if (!text) {
            return NextResponse.json({ error: '缺少必要欄位 (text)' }, { status: 400 })
        }

        // 保留 tab 結構，只過濾純空行
        const lines = text.split('\n').filter(line => line.trim())

        let lastDate = fallbackDate || null
        const parsed = []
        const warnings = []
        const uniqueDates = new Set()

        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i]

            // 用 tab 分割（保留空欄位以偵測日期合併）
            const rawParts = rawLine.split('\t')

            let dateStr, name, team, action

            if (rawParts.length >= 4) {
                // 4 欄：可能有日期，也可能日期為空（合併儲存格）
                const possibleDate = rawParts[0].trim()
                if (possibleDate && /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(possibleDate)) {
                    lastDate = parseDate(possibleDate)
                }
                dateStr = lastDate
                name = rawParts[1].trim()
                team = rawParts[2].trim()
                action = rawParts[3].trim()
            } else if (rawParts.length === 3) {
                // 3 欄：name, team, action（無日期欄）
                dateStr = lastDate
                name = rawParts[0].trim()
                team = rawParts[1].trim()
                action = rawParts[2].trim()
            } else {
                // 嘗試用空白分隔 fallback
                const spaceParts = rawLine.trim().split(/\s+/)
                if (spaceParts.length >= 3) {
                    // 檢查第一個部分是否為日期
                    if (/\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(spaceParts[0])) {
                        lastDate = parseDate(spaceParts[0])
                        name = spaceParts[1]
                        team = spaceParts[2]
                        action = spaceParts[3] || ''
                    } else {
                        name = spaceParts[0]
                        team = spaceParts[1]
                        action = spaceParts[2]
                    }
                    dateStr = lastDate
                } else {
                    warnings.push(`第 ${i + 1} 行格式不正確：${rawLine.trim()}`)
                    continue
                }
            }

            if (!dateStr) {
                warnings.push(`第 ${i + 1} 行缺少日期且無法繼承：${rawLine.trim()}`)
                continue
            }

            // 清除名字中的特殊符號
            name = (name || '').replace(/[#◎*]/g, '')

            if (!name) {
                warnings.push(`第 ${i + 1} 行缺少球員名稱`)
                continue
            }

            // 正規化球隊名
            team = normalizeTeam(team)

            const transactionType = mapAction(action)
            if (!transactionType) {
                warnings.push(`第 ${i + 1} 行異動類型無法辨識「${action}」：${rawLine.trim()}`)
                continue
            }

            // 查詢 player_id：先用 name + team，找不到再只用 name
            let playerId = null

            const { data: players, error: lookupError } = await supabase
                .from('player_list')
                .select('player_id')
                .eq('name', name)
                .eq('team', team)
                .limit(1)

            if (lookupError) {
                warnings.push(`第 ${i + 1} 行查詢球員失敗「${name}」：${lookupError.message}`)
                continue
            }

            if (players && players.length > 0) {
                playerId = players[0].player_id
            } else {
                // Fallback: 只用名字找（可能球隊不完全匹配）
                const { data: fallbackPlayers } = await supabase
                    .from('player_list')
                    .select('player_id')
                    .eq('name', name)
                    .limit(1)

                if (fallbackPlayers && fallbackPlayers.length > 0) {
                    playerId = fallbackPlayers[0].player_id
                    warnings.push(`第 ${i + 1} 行「${name}」在「${team}」找不到，已改用不限球隊的結果`)
                } else {
                    warnings.push(`第 ${i + 1} 行找不到球員「${name}」`)
                    continue
                }
            }

            uniqueDates.add(dateStr)

            parsed.push({
                player_id: playerId,
                transaction_date: dateStr,
                transaction_type: transactionType,
                notes: `${name} - ${action}`,
            })
        }

        if (parsed.length === 0) {
            return NextResponse.json({
                error: '沒有有效資料可新增',
                warnings,
            }, { status: 400 })
        }

        // ✅ 當日重送覆蓋：刪除所有涉及日期的舊資料
        for (const d of uniqueDates) {
            const { error: deleteError } = await supabase
                .from('real_life_transactions')
                .delete()
                .eq('transaction_date', d)

            if (deleteError) {
                console.error('❌ 刪除舊資料錯誤:', deleteError)
                return NextResponse.json({ error: deleteError.message }, { status: 500 })
            }
        }

        // ✅ 批次插入新資料
        const { error: insertError } = await supabase
            .from('real_life_transactions')
            .insert(parsed)

        if (insertError) {
            console.error('❌ 插入新資料錯誤:', insertError)
            return NextResponse.json({ error: insertError.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            inserted: parsed.length,
            dates: [...uniqueDates],
            warnings,
        })
    } catch (err) {
        console.error('❌ API 例外錯誤:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
