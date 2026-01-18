# Head-to-Head Fantasy Points 權重功能實作說明

## 功能概述
當聯盟選擇 "Head-to-Head Fantasy Points" 計分模式時，Commissioner 可以為每個選中的統計類別設定權重值。

## 資料庫修改

### 新建表格：stat_category_weights
```sql
CREATE TABLE public.stat_category_weights (
    id SERIAL PRIMARY KEY,
    league_id UUID NOT NULL REFERENCES public.league_settings(league_id) ON DELETE CASCADE,
    category_type VARCHAR(10) NOT NULL CHECK (category_type IN ('batter', 'pitcher')),
    category_name VARCHAR(100) NOT NULL,
    weight DECIMAL(5, 2) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(league_id, category_type, category_name)
) TABLESPACE pg_default;
```

**欄位說明：**
- `league_id`: 聯盟 ID（UUID 類型，外鍵參照 league_settings.league_id，級聯刪除）
- `category_type`: 類別類型（'batter' 或 'pitcher'）
- `category_name`: 統計類別名稱（例如："Runs (R)"、"Wins (W)"）
- `weight`: 權重值（預設 1.0，範圍 0.1 ~ 10.0）
- `created_at`: 創建時間（UTC 時區）
- `updated_at`: 更新時間（UTC 時區，透過觸發器自動更新）

## 前端修改

### 1. create_league/page.js
**新增狀態：**
```javascript
const [categoryWeights, setCategoryWeights] = useState({ batter: {}, pitcher: {} });
```

**新增函數：**
```javascript
const handleWeightChange = (categoryType, categoryName, weight) => {
  const numWeight = parseFloat(weight) || 1.0;
  setCategoryWeights(prev => ({
    ...prev,
    [categoryType]: {
      ...prev[categoryType],
      [categoryName]: numWeight,
    },
  }));
};
```

**修改保存邏輯：**
- 在 POST 請求中添加 `categoryWeights` 參數
- 只有當 Scoring Type 為 "Head-to-Head Fantasy Points" 時才傳送權重

**UI 變更：**
- 當選擇 "Head-to-Head Fantasy Points" 時，每個已勾選的統計類別旁會出現權重輸入框
- 權重範圍：0.1 ~ 10.0，步進 0.1，預設值 1.0
- 取消勾選時自動清除該類別的權重

### 2. edit_league_settings/page.js
**類似 create_league 的修改：**
- 新增 `categoryWeights` 狀態
- 新增 `handleWeightChange` 函數
- 修改 `handleMultiSelectChange` 以處理權重清除
- 在 useEffect 中載入現有權重
- 修改保存邏輯以更新權重

**權限控制：**
- 只有在 `Status: pre-draft` 時可以修改權重
- 其他狀態（post-draft & pre-season, in-season）時權重輸入框會被禁用

## 後端 API 修改

### 1. /api/league-settings/route.js

**POST（創建聯盟）：**
- 接收 `categoryWeights` 參數
- 如果 Scoring Type 為 "Head-to-Head Fantasy Points"，插入權重記錄

**PUT（更新聯盟設定）：**
- 檢查 Scoring Type 是否改變
- 如果從 "Head-to-Head Fantasy Points" 改為其他模式，刪除所有權重記錄
- 如果是 "Head-to-Head Fantasy Points" 模式：
  1. 刪除舊的權重記錄
  2. 插入新的權重記錄

### 2. /api/league-settings/weights/route.js（新建）

**GET：**
- 查詢指定聯盟的所有權重
- 返回格式：`{ success: true, data: [...] }`

**POST：**
- 保存權重（先刪除舊記錄，再插入新記錄）
- 支援批量插入

**DELETE：**
- 刪除指定聯盟的所有權重
- 用於 Scoring Type 變更時清理

## 業務邏輯

### 權重的生命週期
1. **創建**：在創建聯盟時，如果選擇 "Head-to-Head Fantasy Points"，保存權重
2. **讀取**：編輯聯盟設定時，如果是 "Head-to-Head Fantasy Points"，載入現有權重
3. **更新**：更新聯盟設定時，重新保存權重（先刪除後插入）
4. **刪除**：
   - 當 Scoring Type 從 "Head-to-Head Fantasy Points" 改為其他模式時自動刪除
   - 當聯盟被刪除時級聯刪除（資料庫外鍵約束）

### 權限限制
- 只有 Commissioner 和 Co-Commissioner 可以編輯聯盟設定
- 權重只能在 `Status: pre-draft` 時修改
- 一旦聯盟進入 `post-draft & pre-season` 或 `in-season`，權重無法修改

### 資料驗證
- 權重值必須在 0.1 ~ 10.0 之間
- 每個已勾選的統計類別都應該有對應的權重（預設 1.0）
- 取消勾選類別時，對應的權重會被清除

## 使用流程

### 創建聯盟時設定權重
1. 選擇 "Scoring Type" 為 "Head-to-Head Fantasy Points"
2. 在 "Batter Stat Categories" 和 "Pitcher Stat Categories" 中勾選需要的統計類別
3. 每個已勾選的類別旁會出現權重輸入框
4. 設定每個類別的權重（預設 1.0）
5. 保存聯盟設定

### 編輯現有聯盟的權重
1. 進入 "Edit League Settings" 頁面
2. 如果 Scoring Type 為 "Head-to-Head Fantasy Points"，會自動載入現有權重
3. 可以修改權重值（僅在 pre-draft 狀態）
4. 保存更新

### 變更 Scoring Type
- 如果從 "Head-to-Head Fantasy Points" 改為其他模式，所有權重記錄會被自動刪除
- 如果從其他模式改為 "Head-to-Head Fantasy Points"，需要重新設定權重

## 檔案清單

### 新建檔案
1. `stat_category_weights.sql` - 資料庫表格建立腳本
2. `src/app/api/league-settings/weights/route.js` - 權重管理 API

### 修改檔案
1. `src/app/create_league/page.js` - 創建聯盟頁面
2. `src/app/league/[leagueId]/edit_league_settings/page.js` - 編輯設定頁面
3. `src/app/api/league-settings/route.js` - 聯盟設定 API

## 注意事項

1. **資料一致性**：權重記錄與統計類別選擇應保持同步
2. **效能考量**：每次保存時使用「先刪除後插入」策略，避免更新邏輯複雜化
3. **預設值**：所有權重的預設值為 1.0
4. **前端驗證**：權重輸入框限制範圍和步進，防止無效輸入
5. **後端驗證**：API 中進行額外的數值驗證和類型檢查

## 測試建議

1. **功能測試**
   - 創建 Head-to-Head Fantasy Points 聯盟並設定權重
   - 編輯現有聯盟的權重
   - 變更 Scoring Type 並驗證權重是否被正確刪除
   - 測試權限控制（non-Commissioner 無法編輯）

2. **邊界測試**
   - 權重最小值（0.1）和最大值（10.0）
   - 取消勾選類別時權重清除
   - 沒有勾選任何類別的情況

3. **狀態測試**
   - pre-draft：可以修改權重
   - post-draft & pre-season：無法修改權重（輸入框禁用）
   - in-season：無法修改權重（輸入框禁用）
