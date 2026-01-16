# CPBL Player Transactions 異動系統

## 資料庫設置

### 1. 執行 SQL 建立新表格
在 Supabase 中執行 `sql/trans_cpbl.sql` 來建立新的 `trans_cpbl` 表格。

此操作會：
- 刪除舊的 `player_movements` 表格
- 建立新的 `trans_cpbl` 表格，包含：
  - `trans_id`: 異動記錄 ID (主鍵)
  - `player_id`: 球員 ID (外鍵關聯 player_list)
  - `name`: 球員姓名
  - `team`: 球隊
  - `action`: 異動原因
  - `move_date`: 異動日期
  - `created_at`: 資料建立時間

### 2. 表格結構

```sql
CREATE TABLE public.trans_cpbl (
  trans_id SERIAL NOT NULL,
  player_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  team TEXT NOT NULL,
  action TEXT NOT NULL,
  move_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT trans_cpbl_pkey PRIMARY KEY (trans_id),
  CONSTRAINT fk_player FOREIGN KEY (player_id) REFERENCES public.player_list(player_id)
);
```

## 功能說明

### API 端點: `/api/cpbl-trans`

**參數:**
- `month`: 月份 (1-12)
- `year`: 年份
- `save`: 是否儲存到資料庫 (true/false)

**功能:**
1. 爬取 CPBL 官網的球員異動資料
2. 處理合併儲存格的日期問題
3. 透過姓名 + 球隊 match player_list 取得 player_id
4. 儲存異動資料到 trans_cpbl 表格
5. 先刪除該月舊資料，再插入新資料（確保資料最新）

### 前端頁面: `/admin/trans`

**功能:**
1. **自動載入當月資料**: 頁面開啟時自動爬取並儲存當月異動
2. **選擇月份查詢**: 可選擇特定年月查看異動
3. **Refresh & Save**: 重新爬取並更新資料庫
4. **Fetch & Save All Months**: 一次爬取全年12個月並儲存
5. **即時顯示**: 顯示爬取的異動資料和儲存筆數

## 資料匹配邏輯

系統會依照以下邏輯 match player_id:
1. 從爬取的資料取得球員姓名和球隊
2. 在 player_list 中查詢 `name = 球員姓名` AND `team = 球隊`
3. 若找到匹配，使用該 player_id
4. 若找不到，跳過該筆異動（不儲存）

## 使用流程

1. 訪問 `/admin/trans` 頁面
2. 系統自動爬取當月資料並儲存
3. 可切換月份查看其他月份的異動
4. 點擊 "Fetch & Save All Months" 爬取全年資料
5. 綠色提示會顯示成功儲存的筆數

## 注意事項

- 每次爬取該月資料時，會先刪除該月的舊資料，確保資料是最新的
- 只有能在 player_list 中找到匹配的球員才會被儲存
- 使用 500ms 延遲避免請求過快
- 支援 CPBL 官網的合併儲存格格式
