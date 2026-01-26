# CPBL Fantasy 開發待辦事項

## Roster 與交易邏輯 (已完成)
- [x] **MoveModal 強制 Active 人數上限**
    - [x] 若 Active 名單已滿 (BN 也算在內)，阻止 NA -> Active 的直接移動。
    - [x] 當 Active 滿員時，強制顯示 Swap (交換) 介面。
- [x] **嚴格的交換 (Swap) 驗證**
    - [x] 檢查被交換出 Active 名單的球員，是否具備進入 NA 的資格 (Minor/NA)。
    - [x] 後端：即使目標欄位 (如 BN) 未達格數上限，只要前端送出 Swap 指令，強制執行一進一出的交換。
- [x] **放寬 BN 顯示邏輯**
    - [x] 只要 Active **總人數** 未達上限，允許直接新增球員至 BN (顯示 "Add to BN" 而非強制 Swap)，即使 BN 單項設定已滿。
- [x] **市場操作權限控制**
    - [x] 在球員列表頁面，若聯盟狀態非 `in_season` (賽季中) 或 `playoffs` (季後賽)，隱藏 Add/Drop/Trade 等操作按鈕。

## 下階段目標 (待執行)

### 1. Waiver (讓渡) 系統實作
- [ ] **Waiver 處理邏輯**
    - [ ] 建立排程 (Cron Job) 或觸發機制，每日/每週定時結算 Waiver 申請。
    - [ ] 實作優先順序邏輯 (如：戰績倒序 / FAAB 預算制)。
    - [ ] 處理成功案例：自動丟棄 (Drop) 指定球員並加入 (Add) 新球員，需再次驗證 Roster 合法性。
    - [ ] 處理失敗案例：通知使用者申請失敗。

### 2. Trade (交易) 系統實作
- [ ] **接受交易 (Accept Trade)**
    - [ ] 後端 API：處理 "接受" 待定交易的請求。
    - [ ] 再次驗證雙方隊伍的 Roster 上限 (因狀態可能已變動)。
    - [ ] 執行球員交換 (兩邊隊伍所有權轉移)。
    - [ ] 更新交易狀態為 `accepted` / `completed`。
- [ ] **否決 / 總管審查** (選用/未來功能)

### 3. 聯盟首頁 / 儀表板
- [ ] **近期異動紀錄 (Transaction Feed)**
    - [ ] 建立 `transactions` 資料表或 View，記錄所有 Add, Drop, Trade 操作。
    - [ ] 在聯盟首頁顯示最新的異動流水帳。
- [ ] **即時戰況 (Standings)**
    - [ ] 根據對戰結果顯示即時排名。

### 4. 對戰與計分 (核心)
- [ ] **賽程產生 (Matchup Generation)**
    - [ ] 產生例行賽對戰表 (如：Round Robin 循環賽)。
- [ ] **每日計分 (Daily Scoring)**
    - [ ] 抓取球員數據 -> 計算積分/比項 -> 更新對戰比分。
