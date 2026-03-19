# Maintenance Mode System Documentation

## Overview
维護模式系統可以在進行系統維護時，快速禁止所有非管理員用戶訪問，並立即停止所有數據輪詢請求（特別是選秀頁面）。

## Features

✅ **快速啟用/禁用** - Admin 可以一鍵開啟或關閉維護模式
✅ **自動重定向** - 非 Admin 用戶自動重定向到維護頁面
✅ **立即停止數據抓取** - 所有輪詢請求在維護模式開啟時立即停止
✅ **Admin 訪問** - Admin 用戶可以在維護模式下正常訪問所有頁面
✅ **自動恢復** - 用戶每 30 秒檢查一次維護狀態，維護完成後自動返回
✅ **選秀保護** - Draft 頁面優先支持維護模式檢查

## How to Enable/Disable Maintenance Mode

### 1. Access Admin Panel
作為 Admin 用戶，進入以下頁面：
```
/admin/maintenance
```

### 2. Toggle Maintenance Mode
點擊按鈕啟用或禁用維護模式

### Via API (Advanced)
```bash
# Enable maintenance mode
curl -X POST http://localhost:3000/api/system-settings/maintenance \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -H "x-user-role: admin" \
  -d '{"underMaintenance": true}'

# Disable maintenance mode
curl -X POST http://localhost:3000/api/system-settings/maintenance \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -H "x-user-role: admin" \
  -d '{"underMaintenance": false}'

# Check current status
curl http://localhost:3000/api/system-settings/maintenance
```

## Database Setup

### 1. Create Table
執行以下 SQL 語句：
```sql
-- 創建系統設置表
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text NOT NULL,
  value_bool boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT system_settings_pkey PRIMARY KEY (key),
  CONSTRAINT system_settings_key_check CHECK ((char_length(key) > 0))
) TABLESPACE pg_default;

-- 創建觸發器函數
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 創建觸發器
DROP TRIGGER IF EXISTS trg_system_settings_updated_at ON system_settings;
CREATE TRIGGER trg_system_settings_updated_at
BEFORE UPDATE ON system_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 插入默認設置
INSERT INTO system_settings (key, value_bool) VALUES ('under_maintenance', false)
ON CONFLICT (key) DO NOTHING;

-- 創建索引以提高查詢速度
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
```

### 2. Run Migration
```bash
# SQL 文件位置：
# database/migrations/create_system_settings.sql
```

## How It Works

### 1. Global Check (guard.js)
- 每 30 秒檢查一次維護狀態
- 非 Admin 用戶在維護模式下自動重定向到 `/maintenance`
- Admin 用戶可以正常訪問所有頁面

### 2. Draft Page Protection (draft/page.js)
- 導入 `useMaintenanceStatus` hook
- 立即停止所有以下輪詢：
  - League Status (每 5 秒)
  - Draft State (每 2 秒)
  - Other API calls

### 3. Maintenance Page (/maintenance/page.js)
- 顯示友好的維護信息
- 每 10 秒自動檢查維護狀態
- 維護完成後自動返回到 `/home`
- Admin 用戶有快速訪問 Admin Panel 的按鈕

## File Structure

```
src/
├── app/
│   ├── maintenance/
│   │   └── page.js                 # 維護頁面
│   ├── admin/
│   │   └── maintenance/
│   │       └── page.js             # Admin 維護設置管理頁面
│   ├── api/
│   │   ├── system-settings/
│   │   │   └── maintenance/
│   │   │       └── route.js        # 維護狀態 API
│   │   └── admin/
│   │       └── check/
│   │           └── route.js        # Admin 檢查 API（已更新）
│   ├── guard.js                    # 全局守衛（已更新）
│   └── league/[leagueId]/
│       └── draft/
│           └── page.js             # Draft 頁面（已更新）
└── lib/
    └── useMaintenanceStatus.js     # 維護狀態 Hook
database/
└── migrations/
    └── create_system_settings.sql  # 數據庫遷移
```

## Testing

### Manual Test

1. **Enable Maintenance Mode:**
   - 以 Admin 身份登入
   - 進入 `/admin/maintenance`
   - 點擊「Enable Maintenance Mode」按鈕

2. **Test Non-Admin User:**
   - 使用另一個非 Admin 用戶賬號或隐私模式
   - 嘗試訪問任何頁面
   - 應該被重定向到 `/maintenance`

3. **Test Draft Page:**
   - 在維護模式開啟前進入 Draft 頁面
   - 觀察網絡請求（應該有輪詢）
   - 開啟維護模式
   - 網絡請求應該立即停止

4. **Disable Maintenance Mode:**
   - 以 Admin 身份進入 `/admin/maintenance`
   - 點擊「Disable Maintenance Mode」按鈕
   - 非 Admin 用戶應該自動返回到之前的頁面或 `/home`

## Key Components

### API Endpoints

#### GET /api/system-settings/maintenance
獲取維護狀態

**Response:**
```json
{
  "success": true,
  "underMaintenance": false,
  "updatedAt": "2024-03-20T10:30:00Z"
}
```

#### POST /api/system-settings/maintenance
更新維護狀態（需要 Admin 權限）

**Headers:**
```
x-user-id: {userId}
x-user-role: admin
```

**Body:**
```json
{
  "underMaintenance": true
}
```

**Response:**
```json
{
  "success": true,
  "underMaintenance": true,
  "message": "Maintenance mode enabled"
}
```

### Hooks

#### useMaintenanceStatus
```javascript
import { useMaintenanceStatus } from '@/lib/useMaintenanceStatus';

const { isUnderMaintenance, loading, error } = useMaintenanceStatus(true);

// 在組件中使用
if (isUnderMaintenance) {
  // Stop polling
  return;
}
```

## Performance Impact

- **輪詢間隔:** 30 秒全局檢查（可在需要時減少）
- **API 調用:** 維護狀態檢查 API 設計輕量級
- **減少:** 在維護模式下停止所有數據抓取，大大減少伺服器負擔

## Future Enhancements

- [ ] 計劃維護窗口（定時自動開启/关闭）
- [ ] 維護原因信息（給用戶顯示具體原因）
- [ ] VIP/Whitelist 支持（允許特定用戶在維護模式訪問）
- [ ] 維護進度顯示（估計完成時間）
- [ ] 郵件通知系統（通知用戶維護狀態）

## Troubleshooting

### 維護模式無法啟用
- 檢查用戶是否為 Admin
- 檢查 `system_settings` 表是否存在
- 查看伺服器日誌中的錯誤信息

### 用戶無法返回（馬上被重定向）
- 檢查用戶的 Admin 狀態是否正確設置
- 檢查 `/api/admin/check` 路由是否工作正常
- 清除瀏覽器 cookies 重新登入

### Draft 頁面未停止輪詢
- 確認 `useMaintenanceStatus` 已正確導入
- 檢查 `isUnderMaintenance` 依賴は在 useEffect 中
- 檢查 `/api/system-settings/maintenance` 是否返回正確狀態

## Support

如有問題，請檢查：
1. 數據庫表是否正確創建
2. Admin 用戶權限是否正確設置
3. API 路由是否被正確註冊
4. 瀏覽器控制台是否有錯誤信息
