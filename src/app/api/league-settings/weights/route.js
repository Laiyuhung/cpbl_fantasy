import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET: 獲取聯盟的統計類別權重
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('league_id');

    if (!leagueId) {
      return Response.json(
        { success: false, error: 'Missing league_id' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('league_stat_category_weights')
      .select('*')
      .eq('league_id', leagueId)
      .order('category_type', { ascending: true })
      .order('category_name', { ascending: true });

    if (error) {
      console.error('Error fetching weights:', error);
      return Response.json(
        { success: false, error: 'Failed to fetch weights' },
        { status: 500 }
      );
    }

    return Response.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('GET weights error:', err);
    return Response.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// POST/PUT: 保存統計類別權重
export async function POST(request) {
  try {
    const body = await request.json();
    const { league_id, categoryWeights } = body;

    if (!league_id) {
      return Response.json(
        { success: false, error: 'Missing league_id' },
        { status: 400 }
      );
    }

    if (!categoryWeights || typeof categoryWeights !== 'object') {
      return Response.json(
        { success: false, error: 'Invalid categoryWeights' },
        { status: 400 }
      );
    }

    // 首先刪除該聯盟的所有舊權重記錄
    const { error: deleteError } = await supabase
      .from('league_stat_category_weights')
      .delete()
      .eq('league_id', league_id);

    if (deleteError) {
      console.error('Error deleting old weights:', deleteError);
      return Response.json(
        { success: false, error: 'Failed to delete old weights' },
        { status: 500 }
      );
    }

    // 準備新的權重記錄
    const weightsToInsert = [];

    // 處理 batter 權重
    if (categoryWeights.batter && typeof categoryWeights.batter === 'object') {
      Object.entries(categoryWeights.batter).forEach(([categoryName, weight]) => {
        weightsToInsert.push({
          league_id: league_id,
          category_type: 'batter',
          category_name: categoryName,
          weight: parseFloat(weight) || 1.0,
        });
      });
    }

    // 處理 pitcher 權重
    if (categoryWeights.pitcher && typeof categoryWeights.pitcher === 'object') {
      Object.entries(categoryWeights.pitcher).forEach(([categoryName, weight]) => {
        weightsToInsert.push({
          league_id: league_id,
          category_type: 'pitcher',
          category_name: categoryName,
          weight: parseFloat(weight) || 1.0,
        });
      });
    }

    // 如果有權重需要插入，則插入
    if (weightsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('league_stat_category_weights')
        .insert(weightsToInsert);

      if (insertError) {
        console.error('Error inserting weights:', insertError);
        return Response.json(
          { success: false, error: 'Failed to insert weights' },
          { status: 500 }
        );
      }
    }

    return Response.json({ 
      success: true, 
      message: 'Weights saved successfully',
      count: weightsToInsert.length 
    });
  } catch (err) {
    console.error('POST weights error:', err);
    return Response.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// DELETE: 刪除聯盟的所有權重（當 Scoring Type 改變時）
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('league_id');

    if (!leagueId) {
      return Response.json(
        { success: false, error: 'Missing league_id' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('league_stat_category_weights')
      .delete()
      .eq('league_id', leagueId);

    if (error) {
      console.error('Error deleting weights:', error);
      return Response.json(
        { success: false, error: 'Failed to delete weights' },
        { status: 500 }
      );
    }

    return Response.json({ 
      success: true, 
      message: 'Weights deleted successfully' 
    });
  } catch (err) {
    console.error('DELETE weights error:', err);
    return Response.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
