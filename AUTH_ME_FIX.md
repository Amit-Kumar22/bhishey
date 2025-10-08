# Fix for /api/auth/me 500 Error

## 🔍 Root Cause Analysis

The 500 Internal Server Error was caused by **two main issues**:

### 1. **SSL Certificate Issue (Primary)**
- The Aiven PostgreSQL database uses a self-signed SSL certificate
- Node.js was rejecting the certificate during TLS handshake
- The `NODE_TLS_REJECT_UNAUTHORIZED="0"` in `.env` wasn't being applied to the Next.js process

### 2. **Database Column Name Mismatch (Secondary)**
- The SQL query used snake_case: `created_at`, `updated_at`
- The actual database columns use camelCase: `createdAt`, `updatedAt`
- PostgreSQL error: `column "created_at" does not exist`

## ✅ Fixes Applied

### Fix 1: SSL Certificate Handling
**Updated `package.json`:**
```json
"scripts": {
  "dev": "NODE_TLS_REJECT_UNAUTHORIZED=0 next dev --turbopack",
  // ... other scripts
}
```

**Updated `.env`:**
- Changed `JWT_ACCESS_SECRET` → `JWT_SECRET` (to match `lib/jwt.ts`)
- Kept `DB_ALLOW_SELF_SIGNED="true"`
- Kept `NODE_TLS_REJECT_UNAUTHORIZED="0"`

### Fix 2: SQL Column Names
**Updated `src/app/api/auth/me/route.ts`:**
```typescript
// Before:
const result = await query(
  'SELECT id, email, roles, active, created_at, updated_at FROM users WHERE id = $1',
  [tokenPayload.sub]
);

// After:
const result = await query(
  'SELECT id, email, roles, active, "createdAt", "updatedAt" FROM users WHERE id = $1',
  [tokenPayload.sub]
);
```

And updated the response mapping:
```typescript
// Before:
createdAt: user.created_at,
updatedAt: user.updated_at

// After:
createdAt: user.createdAt,
updatedAt: user.updatedAt
```

## 🚀 How to Test

1. **Restart the dev server** (if not already running):
   ```bash
   npm run dev
   ```

2. **The server should start successfully** with this warning (which is expected in dev):
   ```
   Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' 
   makes TLS connections and HTTPS requests insecure by disabling certificate verification.
   ```

3. **Test the endpoint**:
   - Login at `/admin/login`
   - The app will automatically call `/api/auth/me` during rehydration
   - Check browser console - the error should be gone!

## ⚠️ Important Notes

### For Development
- `NODE_TLS_REJECT_UNAUTHORIZED=0` is acceptable for local development
- This allows connecting to Aiven without needing the CA certificate

### For Production
You have **two options** for production:

#### Option A: Add the Aiven CA Certificate (Recommended)
1. Download the Aiven CA certificate
2. Save it to `backend/certs/aiven-ca.crt`
3. Update `.env.production`:
   ```
   DB_SSL_CA_PATH="backend/certs/aiven-ca.crt"
   DB_ALLOW_SELF_SIGNED="false"
   NODE_TLS_REJECT_UNAUTHORIZED="1"  # or remove this line
   ```

#### Option B: Keep Self-Signed for Production (Not Recommended)
- Only if you control the network and trust the connection
- Keep current settings but understand the security implications

## 📝 Related Files Changed
- ✅ `package.json` - Added `NODE_TLS_REJECT_UNAUTHORIZED=0` to dev script
- ✅ `.env` - Changed `JWT_ACCESS_SECRET` to `JWT_SECRET`
- ✅ `src/app/api/auth/me/route.ts` - Fixed column names from snake_case to camelCase

## 🔄 Future Improvements

1. **Add Aiven CA Certificate** for production security
2. **Consistent Naming Convention**: Consider using a query builder or ORM like Prisma to avoid manual column name mapping
3. **Better Error Handling**: Add more specific error messages for SSL vs database query failures
4. **Health Check Endpoint**: Add `/api/health` that tests DB connection on startup
