# 🔍 DEBUGGING GUIDE - Page Refresh Logout Issue

## Current Status: INVESTIGATING

I've added comprehensive logging to trace exactly what's happening. Let's debug this together.

---

## 🧪 Step-by-Step Debugging

### Step 1: Check if Tokens Are Stored

1. **Login to admin**
2. **Open browser console** (F12 → Console tab)
3. **Run this command**:
   ```javascript
   console.log('Token:', localStorage.getItem('auth_token'));
   console.log('Refresh:', localStorage.getItem('refresh_token'));
   ```

**Expected Result**: Both should show long JWT strings

**If tokens are missing**: The login process isn't saving tokens correctly

---

### Step 2: Check Network Requests

1. **Open Network tab** in DevTools (F12 → Network)
2. **Filter by "auth"**
3. **Refresh the page**
4. **Look for these requests**:
   - `GET /api/auth/me` - Should be called during rehydration
   - `POST /api/auth/refresh` - Should be called if token is expired

**Check the responses**:
- ✅ 200 OK → Token is valid, should stay logged in
- ⚠️ 401 Unauthorized → Token expired, should trigger refresh
- ❌ 404 Not Found → Endpoint doesn't exist (server issue)

---

### Step 3: Watch Console Logs

After my changes, refresh the page and watch for these messages **in order**:

```
Expected Flow (Success):
1. 🔍 [REHYDRATE] Starting rehydration process...
2. 🔍 [REHYDRATE] Token exists: true
3. 🔍 [REHYDRATE] Refresh token exists: true
4. 🔍 [REHYDRATE] Calling /auth/me to validate token...
5. ✅ [REHYDRATE] Successfully fetched user data: {...}
6. 🔍 [ADMIN LAYOUT] Auth check: { rehydrated: true, hasUser: true, ... }
7. ✅ [ADMIN LAYOUT] User authenticated, allowing access
```

```
Problem Flow (Redirect):
1. 🔍 [REHYDRATE] Starting rehydration process...
2. 🔍 [REHYDRATE] Token exists: true
3. 🔍 [REHYDRATE] Calling /auth/me to validate token...
4. ❌ [REHYDRATE] Error during rehydration: ...
5. 🔍 [ADMIN LAYOUT] Auth check: { rehydrated: true, hasUser: false, ... }
6. 🔒 [ADMIN LAYOUT] No user after rehydration, redirecting to login...
```

**Copy and send me the console output** so I can see what's happening!

---

### Step 4: Check Redux State

1. **Install Redux DevTools** extension (if not installed)
2. **Open Redux DevTools** (F12 → Redux tab)
3. **Look at the auth state**:
   ```
   auth: {
     user: {...} or null
     status: 'idle' | 'loading' | 'authenticated' | 'error'
     rehydrated: true or false
     error: undefined or string
   }
   ```

**Take a screenshot** of the Redux state after refresh

---

## 🎯 Common Issues and Solutions

### Issue 1: Tokens Exist But Still Redirecting

**Possible Causes**:
- `/auth/me` endpoint returning 401 (token invalid)
- `/auth/me` endpoint returning 404 (endpoint doesn't exist)
- Network error preventing request
- CORS issue

**Solution**: Check the Network tab for the `/auth/me` response

---

### Issue 2: Rehydration Returns Null

**Possible Causes**:
- Error in `/auth/me` endpoint
- Token format is invalid
- Server not running
- Wrong API base URL

**Solution**: Check if server is running and `/auth/me` works in Postman/curl

---

### Issue 3: Redirect Happens Before Rehydration

**This should be fixed** with my latest changes. The admin layout now waits for `rehydrated: true`.

**If still happening**: There's a race condition we need to address

---

## 📝 What I Need From You

Please run through the steps above and send me:

1. **Console logs** - Copy all the logs from page refresh
2. **Network tab** - Screenshot of `/auth/me` request/response
3. **Redux state** - Screenshot of auth state after refresh
4. **Token check** - Result of the localStorage commands

This will help me understand exactly what's happening!

---

## 🔧 Manual Test Commands

Run these in the browser console after logging in:

### Check Auth State
```javascript
// Check current auth state
store.getState().auth
```

### Check Tokens
```javascript
// Check if tokens exist
{
  hasToken: !!localStorage.getItem('auth_token'),
  hasRefresh: !!localStorage.getItem('refresh_token'),
  token: localStorage.getItem('auth_token')?.substring(0, 50) + '...',
  refresh: localStorage.getItem('refresh_token')?.substring(0, 50) + '...'
}
```

### Test API Call Manually
```javascript
// Test if /auth/me works
fetch('/api/auth/me', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('auth_token')
  }
}).then(r => r.json()).then(data => console.log('API Response:', data))
```

### Force Rehydration
```javascript
// Manually trigger rehydration
store.dispatch({ type: 'auth/rehydrate/pending' })
```

---

## 🚨 If Still Not Working

If you've done all the above and it's still redirecting, there might be:

1. **A different auth guard** somewhere else intercepting
2. **Server-side redirect** happening
3. **Middleware** in Next.js redirecting
4. **Multiple instances** of the app running
5. **Cached build** - Try `rm -rf .next && npm run dev`

Let me know the results and I'll help you further! 🔍
