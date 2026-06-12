# PLAN: Hybrid Security & Functional Synchronization

This plan outlines the steps to secure the multi-tenant architecture, synchronize POS/Inventory logic, and refine the internal courier ecosystem.

## 🛑 User Review Required

> [!IMPORTANT]
> **Courier Ecosystem:** Couriers will see a "Pool" of orders from ALL restaurants they are linked to.
> **Waste Management:** Order cancellations will automatically trigger "Waste" (Fire/Zayi) records in inventory to maintain stock accuracy without manual entry.

---

## Proposed Changes

### 🛡️ Phase 1: Security & Isolation (AuthGuard + RLS)

**Goal:** Ensure 100% tenant isolation and secure the "Courier App".

#### [MODIFY] [AuthGuard.jsx](file:///c:/Users/WIN/Desktop/Whatsapp%20Sipari%C5%9F%20Otomasyonu/frontend/src/components/AuthGuard.jsx)

- **Strict Tenant Check:** For `role='tenant'`, check if the user has a profile linked to the specified `tenant_id` (not just "authenticated").
- **Courier Multi-Link:** Allow couriers to access the dashboard if they have a profile OR are linked in `courier_store_links`.

#### [NEW] [migration_security_hardening.sql](file:///c:/Users/WIN/Desktop/Whatsapp%20Sipari%C5%9F%20Otomasyonu/supabase/migrations/migration_security_hardening.sql)

- **RLS Overhaul:** Update policies for `orders`, `inventory`, and `courier_profiles` to strictly use `tenant_id` context.
- **Secure Pool Function:** Create a RPC function `get_secure_courier_pool(courier_id)` that returns orders ONLY from tenants the courier is linked to.

---

### 📦 Phase 2: Stock Automation (POS-Inventory Bridge)

**Goal:** Guarantee stock accuracy across all payment methods and handle cancellations.

#### [MODIFY] [migration_inventory_v2.sql](file:///c:/Users/WIN/Desktop/Whatsapp%20Sipari%C5%9F%20Otomasyonu/supabase/migrations/migration_inventory_v2.sql)

- **Status Mapping:** Update `deduct_stock_on_order` to trigger on `paid` status (for POS) as well as `delivered`.
- **Cancellation Trigger:** Add logic to detect `status = 'cancelled'`.
  - Instead of returning stock, it will log an `inventory_transaction` with `transaction_type = 'waste'`.
  - Stock stays deducted (since food was likely prepared).

---

### 🛵 Phase 3: Courier Pool Refinement (Internal Ecosystem)

**Goal:** Seamless multi-tenant delivery management.

#### [MODIFY] [UnifiedCourierDashboard.jsx](file:///c:/Users/WIN/Desktop/Whatsapp%20Sipari%C5%9F%20Otomasyonu/frontend/src/components/UnifiedCourierDashboard.jsx)

- **Secure Fetch:** Switch from client-side filtering to using the new `get_secure_courier_pool` RPC.
- **Real-time Filter:** Ensure Realtime subscriptions are scoped to the courier's links.

---

## Verification Plan

### Automated Tests

- `python scripts/verify_rls.py`: Check if any table is still using permissive `true` policies.
- `python scripts/test_inventory_auto_waste.py`: Simulate order -> paid (stock down) -> cancelled (waste entry created).

### Manual Verification

1. **Security:** Log in as Waiter-A and attempt to access Tenant-B's settings URL (expect 403/Redirect).
2. **Inventory:** Create a POS order for "Smash Burger". Observe stock of "Patty" decrease. Cancel order. Observe Stock remains down, but a "Waste" record appears in logs.
3. **Courier:** Link Courier-X to "Shop A" and "Shop B". Verify Courier-X sees orders from both in the Pool.
