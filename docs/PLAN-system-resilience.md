# PLAN: System Resilience & Performance (Offline-First)

**Goal:** Eliminate the risk of business interruption during internet outages and solve system slowness.

## 🛑 User Review Required

> [!IMPORTANT]
> **Offline Logic:** The POS will switch to "Local Mode" when offline. Orders will be saved to the device and automatically synchronized (uploaded) when the connection returns.
> **Limits:** "Offline Mode" is primarily for **taking orders**. Real-time features like "Kitchen Display" or "Courier Tracking" naturally require internet to update other devices.

---

## 🏗️ Architecture Design

### 1. Offline-First POS Engine (The "Iron Dome")

We will implement a robust **Sync Queue System** using **IndexedDB** (via `idb` or `dexie`) and **Service Workers**.

**Flow:**

1. **Interception:** Every "Create Order" action goes to a `TransactionManager`.
2. **Check:** Is Internet available?
   - **YES:** Send to Supabase directly.
   - **NO:** Save to `PendingOrders` (IndexedDB). Show "Saved Locally" UI.
3. **Recovery:** A background `SyncWorker` listens for `online` events to flush the queue.

### 2. Performance Overhaul (Speed)

Targeting < 1s interactions.

- **Database:** Add composite indexes for common queries (RLS performance).
- **Frontend:** Implement code-splitting (Lazy load heavy components like Maps/Charts).
- **State:** Optimize React re-renders in `POSOrderView`.

---

## 📋 Task Breakdown

### Phase 1: Foundation (Offline Architecture)

**Agent:** `frontend-specialist`

- [ ] Install `idb` (IndexedDB wrapper) & `react-detect-offline`.
- [ ] Create `OfflineOrderService.js` (Save, Load, Delete local orders).
- [ ] Create `SyncManager.js` (The bridge between Local & Cloud).
- [ ] Update `ModernTouchPOS.jsx` to show "Offline/Online" status indicator.

### Phase 2: Implementation (POS Logic)

**Agent:** `frontend-specialist` + `backend-specialist`

- [ ] Refactor `handlePayment` to use `TransactionManager`.
- [ ] Implement "Optimistic UI" (Show success immediately, sync later).
- [ ] **Critical:** Add "Conflict Resolution" (What if Table 5 was taken while I was offline? -> Merge strategy).

### Phase 3: Performance Tuning (Speed)

**Agent:** `database-architect` + `performance-optimizer`

- [ ] **DB Indexing:** Analyze slow queries (Supabase Dashboard) -> Add indices (`CREATE INDEX CONCURRENTLY`).
- [ ] **Bundle Diet:** Analyze `npm run build` stats -> Split vendor chunks.
- [ ] **Render Fixes:** Wrap heavy lists in `React.memo` and virtualize long menus.

### Phase 4: Verification (Stress Test)

**Agent:** `test-engineer`

- [ ] **The "WiFi Pull" Test:** Disconnect internet -> Take 10 orders -> Reconnect -> Verify sync.
- [ ] **Lighthouse Audit:** Verify Core Web Vitals (LCP, FID, CLS).

---

## 🛠️ Orchestration Team

- **Frontend:** Implement Offline Storage & Sync Logic.
- **Backend/DB:** Optimize Indexes & RLS Performance.
- **QA:** Simulate network throttles and outages.

## 📅 Estimated Timeline

- **Planning:** Done
- **Foundation:** 1 Day
- **Implementation:** 2 Days
- **Verification:** 1 Day
