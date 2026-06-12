# Implementation Plan: Digital Menu UX/UI Overhaul

## Goal Description

Complete redesign of the digital menu (`SlugMenuPage.jsx`, `ProductDetailModal.jsx`) with focus on:

- **Splash page** with restaurant logo and prominent "View Menu" button
- **Dynamic, appetizing design** with gradient transitions and animations
- **Enhanced product modal** with quantity-based extras, required options, and recommendations
- **Fixed order flow** (Table Order + WhatsApp Order)
- **Improved coupon system** (no duplicate usage, no stacking, discounted item control)

---

## User Review Required

> [!IMPORTANT]
> **Database Schema Changes Required:**
>
> - `menu.modifiers` needs restructuring to support `min_qty`, `max_qty`, `is_required`
> - New `menu_recommendations` table for "pairs well with" suggestions
> - `coupons` table needs `single_use_per_customer` and products need `allow_coupon` flag

> [!WARNING]
> **Breaking Changes:**
>
> - `ProductDetailModal` will be completely rewritten
> - `SlugMenuPage` will have new splash page state

---

## Proposed Changes

### P1: Database Schema Updates

#### [MODIFY] `menu.modifiers` Structure

```json
{
  "extras": [
    { "name": "Ekstra Peynir", "price": 15, "max_qty": 5, "is_required": false },
    { "name": "Sos Seçimi", "price": 0, "options": ["Barbekü", "Ranch"], "is_required": true }
  ],
  "ingredients": [...]
}
```

#### [NEW] `menu_recommendations` Table

```sql
CREATE TABLE menu_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES menu(id),
  recommended_product_id uuid REFERENCES menu(id),
  tenant_id uuid
);
```

#### [MODIFY] `menu` Table

Add column: `allow_coupon boolean DEFAULT true`

---

### P2: Frontend - Splash Page

#### [MODIFY] `SlugMenuPage.jsx`

**New State:**

```jsx
const [showSplash, setShowSplash] = useState(true);
```

**Splash Screen UI:**

- Full-screen gradient background using branding colors
- Centered restaurant logo (large, animated fade-in)
- Restaurant name with elegant typography
- Large "Menüyü Gör" button (gradient, animated pulse)
- Subtle animated background particles/waves

---

### P3: Frontend - Menu Page Redesign

#### [MODIFY] `SlugMenuPage.jsx`

- Animated category tabs with gradient underline
- Product cards with hover lift effect and gradient overlay
- Floating cart button with bounce animation
- Smooth scroll between categories
- Mobile-first responsive design

---

### P4: Frontend - Product Modal Overhaul

#### [REWRITE] `ProductDetailModal.jsx`

**New Features:**

1. **Larger clickable areas** - Full-width option rows
2. **Hover effects** - Color highlight on mouse hover
3. **Quantity-based extras** - +/- buttons for each extra (not toggle)
4. **Required options** - Warning if not selected, block add-to-cart
5. **Recommendations section** - "İyi Gider" products at bottom
6. **Improved layout** - Image & name take ~40%, options take ~50%, footer ~10%

**Structure:**

```
┌─────────────────────────────────┐
│  [X]   Product Image (large)    │  40%
│        Product Name & Desc      │
├─────────────────────────────────┤
│  Malzemeler (toggle)            │
│  ────────────────────────────   │
│  Ekstralar (quantity +/-)       │  50%
│  ────────────────────────────   │
│  Zorunlu Seçimler (required)    │
│  ────────────────────────────   │
│  İyi Gider: [prod1] [prod2]     │
├─────────────────────────────────┤
│  [-] 1 [+]     ₺XX.XX           │  10%
│  [====== SEPETE EKLE ======]    │
└─────────────────────────────────┘
```

---

### P5: Frontend - Cart & Order Flow Fix

#### [MODIFY] `SlugMenuPage.jsx` - Cart Section

- [x] **"Masaya Sipariş Ver"** → Table selection modal (if no table in URL)
- [x] **"WhatsApp ile Tamamla"** → Current WhatsApp flow
- [x] Fix "Sipariş verilemedi" error (check `pos_orders` RLS)

---

### P6: Coupon System Improvements

#### [MODIFY] `SlugMenuPage.jsx`

- [x] Track if coupon already used (localStorage + database)
- [x] Prevent multiple coupon application
- [x] Check `product.allow_coupon` before applying discount

#### [MODIFY] `coupons` Table

```sql
ALTER TABLE coupons ADD COLUMN single_use_per_session boolean DEFAULT true;
```

---

## Verification Plan

### Browser Testing (Manual)

1. Open `http://localhost:3000/m/restoran-5eca8855`
2. **Splash Page:** Verify logo, restaurant name, "Menüyü Gör" button appears
3. **Click "Menüyü Gör"** → Menu should appear with animated transition
4. **Click a product** → Modal opens with:
   - Large image/name area
   - Quantity-based extras (try adding 3x cheese)
   - Hover effects on options
5. **Add to cart** → Cart drawer shows item
6. **Apply coupon "TEST10"** → Discount applies
7. **Try applying same coupon again** → Should be blocked
8. **Click "Masaya Sipariş Ver"** → Should work or show table selection
9. **Click "WhatsApp ile Tamamla"** → WhatsApp opens with order

### Responsive Testing

- Test on mobile (375px, 414px widths)
- Test on tablet (768px)
- Test on desktop (1024px+)
