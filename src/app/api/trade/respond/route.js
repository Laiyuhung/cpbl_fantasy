import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
    try {
        const { trade_id, action, manager_id } = await request.json();

        if (!trade_id || !action || !manager_id) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Fetch trade details
        const { data: trade, error: fetchError } = await supabase
            .from('pending_trade')
            .select('*')
            .eq('id', trade_id)
            .single();

        if (fetchError || !trade) {
            return NextResponse.json({ success: false, error: 'Trade not found' }, { status: 404 });
        }

        if (trade.status !== 'pending') {
            return NextResponse.json({ success: false, error: 'Trade is already resolved' }, { status: 400 });
        }

        // 2. Auth check
        const isInitiator = trade.initiator_manager_id === manager_id;
        const isRecipient = trade.recipient_manager_id === manager_id;

        if (action === 'cancel') {
            if (!isInitiator) return NextResponse.json({ success: false, error: 'Only initiator can cancel' }, { status: 403 });

            const { error: updateError } = await supabase
                .from('pending_trade')
                .update({ status: 'cancelled', updated_at: new Date() })
                .eq('id', trade_id);

            if (updateError) throw updateError;
            return NextResponse.json({ success: true, status: 'cancelled' });
        }

        if (action === 'reject') {
            if (!isRecipient) return NextResponse.json({ success: false, error: 'Only recipient can reject' }, { status: 403 });

            const { error: updateError } = await supabase
                .from('pending_trade')
                .update({ status: 'rejected', updated_at: new Date() })
                .eq('id', trade_id);

            if (updateError) throw updateError;
            return NextResponse.json({ success: true, status: 'rejected' });
        }

        if (action === 'accept') {
            if (!isRecipient) return NextResponse.json({ success: false, error: 'Only recipient can accept' }, { status: 403 });

            // Fetch league settings to determine review process
            const { data: leagueSettings, error: settingsError } = await supabase
                .from('league_settings')
                .select('*')
                .eq('league_id', trade.league_id)
                .single();

            if (settingsError || !leagueSettings) {
                console.error('Settings error:', settingsError);
                return NextResponse.json({ success: false, error: 'League settings not found' }, { status: 404 });
            }

            const tradeReview = leagueSettings.trade_review || 'League votes';
            const tradeRejectTimeStr = leagueSettings.trade_reject_time; // e.g. "1 day", "2 days"
            const tradeRejectPercentage = leagueSettings.trade_reject_percentage || '50%';

            // Calculate process_at time
            let processAt = new Date();

            // "抓league_settings.trade_reject_time傳換成小時加上去當作process_at (null視為0)"
            let additionalHours = 0;
            if (tradeRejectTimeStr) {
                const daysMatch = tradeRejectTimeStr.match(/(\d+)\s*days?/);
                if (daysMatch) {
                    additionalHours = parseInt(daysMatch[1]) * 24;
                }
            }

            processAt.setHours(processAt.getHours() + additionalHours);

            // Update pending_trade
            // "然後不用trade_reject_time" -> We exclude trade_reject_time column update
            // "status改成accepted & pending votes" -> status: 'accepted'
            const { error: updateError } = await supabase
                .from('pending_trade')
                .update({
                    status: 'accepted',
                    updated_at: new Date(),
                    accepted_at: new Date(),
                    process_at: processAt,
                    trade_review: tradeReview,
                    trade_reject_percentage: tradeRejectPercentage
                })
                .eq('id', trade_id);

            if (updateError) {
                console.error('Update pending_trade error:', updateError);
                throw updateError;
            }

            return NextResponse.json({ success: true, status: 'accepted', message: 'Trade accepted and is pending review' });
        }

        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Error responding to trade:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
