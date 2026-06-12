# Production Deployment Guide

## Pre-Deployment Checklist

### 1. Database Setup (Supabase)

Run SQL files in this exact order:

```bash
1. migration_resellers.sql
2. migration_tier_security.sql
3. migration_autopromote.sql
4. migration_security.sql
5. migration_finance.sql (if exists)
6. migration_add_city.sql
7. migration_indexes.sql (NEW - for performance)
```

### 2. Environment Variables

Create `.env.production` in `/frontend`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
VITE_APP_ENV=production
```

### 3. Frontend Build & Deploy

```bash
cd frontend
npm run build
# Deploy dist/ folder to Vercel/Netlify/Cloudflare Pages
```

### 4. Code Changes Required

**CRITICAL:** Replace placeholders before production:

#### In Every Component

Find: `tenantId = 'DEFAULT_TENANT_ID_HERE'`
Replace with: `tenantId` from auth context

#### Example Auth Context (to create)

```javascript
// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tenantId, setTenantId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setTenantId(session?.user?.user_metadata?.tenant_id ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setTenantId(session?.user?.user_metadata?.tenant_id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, tenantId, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

### 5. n8n Configuration

1. Import `n8n_advanced_flows.json`
2. Add credentials:
   - Supabase (URL + Service Role Key)
   - WhatsApp Business API (Token)
   - Iyzico (API Key + Secret Key)
3. Update webhook URLs to production domains
4. Test each workflow manually

### 6. Security Hardening

- [ ] Enable RLS policies on ALL tables
- [ ] Set up Cloudflare WAF
- [ ] Add rate limiting (10 req/sec per IP)
- [ ] Configure CORS to allow only your domain
- [ ] Enable Supabase email confirmations
- [ ] Set up 2FA for admin accounts

### 7. Monitoring Setup

**Recommended Tools:**

- **Errors:** Sentry (sentry.io)
- **Analytics:** Vercel Analytics or Plausible
- **Uptime:** UptimeRobot
- **Database:** Supabase built-in monitoring

### 8. Performance Optimization

```bash
# Enable gzip compression
# Add to vercel.json or netlify.toml:
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### 9. DNS & SSL

- Point custom domain to hosting provider
- Enable HTTPS (auto via Vercel/Netlify)
- Set up subdomain for API if needed (api.yourdomain.com)

### 10. Testing Checklist

- [ ] Admin can create tenants and resellers
- [ ] Reseller can view their merchants
- [ ] Restaurant can manage menu
- [ ] Orders flow works end-to-end
- [ ] KVKK consent capture works
- [ ] Commission calculations are correct
- [ ] Contract modals display properly
- [ ] Mobile responsiveness verified

## Launch Day Steps

1. ✅ Verify all migrations applied
2. ✅ Test critical paths
3. ✅ Configure monitoring alerts
4. ✅ Create first production tenant
5. ✅ Send launch announcement
6. 🚀 GO LIVE!

## Post-Launch Monitoring

**Week 1:**

- Monitor error logs daily
- Check database performance
- Gather user feedback
- Fix critical bugs immediately

**Week 2-4:**

- Optimize slow queries
- Add missing features from feedback
- Document common issues
- Train support team

## Rollback Plan

If critical issues occur:

1. Revert to previous deploy (instant on Vercel/Netlify)
2. Notify users via dashboard banner
3. Fix in staging
4. Redeploy after testing

---

## 11. Backup & Disaster Recovery (NEW)

### Prerequisites

1. Run `migration_backup_infrastructure.sql` in Supabase
2. Create `backups` storage bucket in Supabase Dashboard
3. Deploy the `backup-database` Edge Function

### Setup Automated Backups

**Option A: GitHub Actions (Recommended)**

1. Add secrets to repository:
   - `SUPABASE_URL`: Your Supabase URL
   - `SUPABASE_PROJECT_REF`: Your project reference
   - `BACKUP_SECRET_KEY`: A strong secret key (generate with `openssl rand -hex 32`)
2. Workflow runs automatically every 6 hours

**Option B: n8n Workflow**

1. Import `n8n_backup_workflow.json`
2. Create HTTP Header Auth credential with `BACKUP_SECRET_KEY`
3. Activate the workflow

### Restore Procedure

If disaster strikes:

1. Download latest backup from Supabase Storage > `backups` bucket
2. Parse JSON file to get table data
3. Use Supabase Dashboard or psql to restore:

   ```sql
   -- Example: Restore customers table
   INSERT INTO customers SELECT * FROM json_populate_recordset(null::customers, 
     '{"data": [...]}'::json->'data'->'customers');
   ```

### SLA Targets (Defined)

- **RPO (Max Data Loss):** 6 hours
- **RTO (Max Downtime):** 4 hours

---
**Support:** For help, create issue in project repository or contact dev team.
