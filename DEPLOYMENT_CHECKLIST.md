# Vercel Deployment Checklist ✅

## Current Status: ⚠️ **ALMOST READY** - Need to Configure Environment Variables

---

## ✅ What's Working

### Build Configuration
- ✅ **Next.js 15** properly configured
- ✅ **Build passes successfully** (no errors)
- ✅ `vercel.json` configured with proper routes and headers
- ✅ `next.config.mjs` has serverless packages configured
- ✅ API routes properly structured for Vercel serverless functions

### Backend Architecture
- ✅ **PostgreSQL database** with Prisma ORM
- ✅ **JWT Authentication** implemented (login, logout, refresh, me endpoints)
- ✅ **API Routes** for:
  - `/api/auth/*` - Authentication endpoints
  - `/api/blogs/*` - Blog CRUD operations
  - `/api/case-studies/*` - Case studies CRUD
  - `/api/health` - Health check endpoint
- ✅ **Rate limiting** implemented
- ✅ **Database connection pooling** optimized for serverless
- ✅ **CORS headers** configured in vercel.json

### Code Quality
- ✅ TypeScript properly configured
- ✅ No build errors or warnings
- ✅ Prisma client generated
- ✅ `.gitignore` created (do not commit `.env` files)

---

## ⚠️ Critical: Before Deploying to Vercel

### 1. **Set Up PostgreSQL Database**

You need a production PostgreSQL database. Choose one:

**Option A: Vercel Postgres (Recommended - Easy Integration)**
```bash
# In your Vercel dashboard:
1. Go to your project
2. Click "Storage" tab
3. Click "Create Database" → Select "Postgres"
4. Copy the connection string provided
```

**Option B: External Providers**
- [Neon](https://neon.tech) (Free tier, great for serverless)
- [Supabase](https://supabase.com) (Free tier with extras)
- [Railway](https://railway.app) (Pay as you go)
- [DigitalOcean Managed Postgres](https://www.digitalocean.com/products/managed-databases)

### 2. **Configure Environment Variables in Vercel**

Go to your Vercel project → Settings → Environment Variables and add:

```bash
# Required Environment Variables
DATABASE_URL=postgresql://username:password@host:5432/database?sslmode=require

# JWT Secrets (Generate strong random strings)
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-characters-different

# Optional (usually auto-detected)
NODE_ENV=production
```

**Generate Strong Secrets:**
```bash
# Run these commands to generate secure secrets:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. **Run Database Migrations**

After setting up your database, run Prisma migrations:

```bash
# If deploying from local machine:
DATABASE_URL="your-production-db-url" npx prisma db push

# Or in Vercel build settings, add to Build Command:
npx prisma generate && npx prisma db push && next build
```

**Update `package.json` build script** to include Prisma:
```json
{
  "scripts": {
    "build": "prisma generate && prisma db push && next build",
    "vercel-build": "prisma generate && prisma db push && next build"
  }
}
```

### 4. **Create Admin User**

After database is set up, create your first admin:

```bash
# Option 1: Run locally with production DATABASE_URL
DATABASE_URL="your-production-url" npm run ensure:admin -- --email admin@yourdomain.com --password YourStrongPassword123!

# Option 2: Use Vercel CLI after deployment
vercel env pull .env.local
npm run ensure:admin -- --email admin@yourdomain.com --password YourStrongPassword123!
```

---

## 🚀 Deployment Steps

### Method 1: Deploy via Vercel Dashboard (Easiest)

1. **Connect Repository**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your Git repository (GitHub/GitLab/Bitbucket)
   
2. **Configure Project**
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: `./` (leave default)
   - Build Command: `npm run build` (or the Prisma version above)
   - Install Command: `npm install`

3. **Add Environment Variables**
   - Add all variables from checklist above
   - Make sure to add them for **Production**, **Preview**, and **Development**

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete (~2-5 minutes)

### Method 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

---

## 🧪 Post-Deployment Testing

### 1. Test Health Endpoint
```bash
curl https://your-app.vercel.app/api/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "database": { "connected": true }
  }
}
```

### 2. Test Authentication
```bash
# Login
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourdomain.com","password":"YourPassword123!"}'
```

Expected response with `accessToken` and `refreshToken`.

### 3. Test Protected Endpoint
```bash
# Get current user (use token from login)
curl https://your-app.vercel.app/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 4. Test Blog Creation
```bash
curl -X POST https://your-app.vercel.app/api/blogs \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Blog",
    "slug": "test-blog",
    "excerpt": "Test excerpt",
    "content": "Test content body"
  }'
```

---

## 🔍 Troubleshooting Common Issues

### Issue: "Database connection failed"
**Solution:** 
- Verify `DATABASE_URL` is correct in Vercel environment variables
- Ensure database allows connections from Vercel IPs (0.0.0.0/0 for most cloud providers)
- Check if SSL is required: add `?sslmode=require` to connection string

### Issue: "JWT_SECRET is not defined"
**Solution:**
- Add `JWT_SECRET` and `JWT_REFRESH_SECRET` to Vercel environment variables
- Redeploy after adding variables

### Issue: "Prisma Client not found"
**Solution:**
- Update build command to: `prisma generate && next build`
- Check that `@prisma/client` and `prisma` are in `dependencies`, not `devDependencies`

### Issue: "Too many database connections"
**Solution:**
- Database connection pooling is already configured
- Consider upgrading database plan if hitting connection limits
- For Vercel Postgres: connections auto-scale

### Issue: "CORS errors from frontend"
**Solution:**
- Check `vercel.json` has CORS headers configured (✅ already done)
- Verify frontend is calling correct API endpoints

---

## 📝 Quick Reference

### Required Environment Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `JWT_SECRET` | Access token secret | `32+ character random string` |
| `JWT_REFRESH_SECRET` | Refresh token secret | `32+ character random string` |

### API Endpoints
- `GET /api/health` - Health check
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Current user
- `GET/POST /api/blogs` - Blogs CRUD
- `GET/POST /api/case-studies` - Case studies CRUD

### Useful Commands
```bash
# Generate Prisma client locally
npx prisma generate

# Push schema to production DB
DATABASE_URL="prod-url" npx prisma db push

# View production logs
vercel logs

# Check environment variables
vercel env ls
```

---

## ✅ Final Checklist Before Going Live

- [ ] PostgreSQL database provisioned and accessible
- [ ] All environment variables set in Vercel dashboard
- [ ] Database schema migrated (`prisma db push`)
- [ ] Admin user created
- [ ] Build completes successfully on Vercel
- [ ] `/api/health` endpoint returns healthy status
- [ ] Can login with admin credentials
- [ ] Can create/read blogs and case studies
- [ ] Frontend pages load correctly
- [ ] Admin dashboard accessible at `/admin`
- [ ] SSL certificate active (automatic with Vercel)
- [ ] Custom domain configured (optional)

---

## 🎉 Ready to Deploy!

Your application is **architecturally ready** for Vercel deployment. The main steps remaining are:

1. Set up a PostgreSQL database (5 minutes)
2. Add environment variables to Vercel (2 minutes)
3. Run database migrations (1 minute)
4. Create admin user (1 minute)
5. Deploy! 🚀

**Estimated time to production: 10-15 minutes**

Need help? Check the [Next.js Vercel Deployment docs](https://nextjs.org/docs/deployment) or [Vercel support](https://vercel.com/support).
