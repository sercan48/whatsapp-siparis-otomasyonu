# POS Logic & State Integrity (PSI) Rule

> **Status:** MANDATORY
> **Context:** This rule was established after a deep recovery session (2026-01-16) to solve table occupancy and payment synchronization failures.

---

## 1. Dual-Enum Awareness

The system uses multiple terms for an active state due to POS and WhatsApp integration differences.

- **Rule:** When checking for occupied tables, ALWAYS check for both `active` AND `open` statuses.
- **Code Pattern:**

  ```javascript
  const session = table.pos_sessions?.find(s => s.status === 'active' || s.status === 'open');
  ```

## 2. Aggressive Housekeeping

Closing a single session ID is insufficient if duplicate sessions exist for a table.

- **Rule:** When closing or paying for a table, the system must clear ALL active/open sessions associated with that `table_id`.
- **Code Pattern:**

  ```javascript
  await supabase
    .from('pos_sessions')
    .update({ status: 'paid', closed_at: new Date() })
    .eq('table_id', table.id)
    .in('status', ['active', 'open']);
  ```

## 3. Linkage Invariants

Updating `restaurant_tables.status` to `empty` is not enough if `current_session_id` is still populated.

- **Rule:** ALWAYS clear the `current_session_id` column when a table is emptied. This column acts as a primary lock for the UI.
- **Code Pattern:**

  ```javascript
  await supabase
    .from('restaurant_tables')
    .update({ status: 'empty', current_session_id: null })
    .eq('id', table.id);
  ```

## 4. UI Flow Synchronization

- **Rule:** Any full payment or table closure MUST trigger a complete UI state refresh (e.g., calling `onBack()` to return to the dashboard) rather than just closing the current modal. This prevents users from interacting with stale session data.

---

*Keep this rule in mind during any modification to `ModernTouchPOS.jsx`, `POSOrderView.jsx`, or `TouchPaymentModal.jsx`.*
