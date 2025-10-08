# 🚀 Quick Vercel Deployment Guide

## Step 1: Get PostgreSQL Database (Choose One)

### Option A: Vercel Postgres (Recommended)
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Create/Select your project
3. Go to **Storage** tab → **Create Database** → Select **Postgres**
4. Copy the `DATABASE_URL` provided

### Option B: Neon (Free Serverless Postgres)
1. Sign up at [neon.tech](https://neon.tech)
2. Create new project
3. Copy connection string (add `?sslmode=require` at the end)

### Option C: Supabase (Free with extras)
1. Sign up at [supabase.com](https://supabase.com)
2. Create new project
3. Go to Settings → Database → Connection string (use "Connection pooling" for serverless)

---

## Step 2: Generate JWT Secrets

```bash
# Run these commands to generate secure random secrets:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy both outputs - you'll need them in the next step.

---

## Step 3: Deploy to Vercel

### Via Dashboard:
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your Git repository
3. **Before clicking Deploy**, add these environment variables:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
JWT_SECRET=<paste-first-random-string>
JWT_REFRESH_SECRET=<paste-second-random-string>
NODE_ENV=production
```

4. Click **Deploy**
5. Wait 2-5 minutes for build to complete ✅

### Via CLI:
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (first time - will ask for settings)
vercel

# You'll be prompted to add environment variables
# After deployment, deploy to production:
vercel --prod
```

---

## Step 4: Set Up Database Schema

```bash
# Option A: From your local machine
DATABASE_URL="your-production-database-url" npx prisma db push

# Option B: Via Vercel CLI (after deployment)
vercel env pull .env.local
npx prisma db push
```

---

## Step 5: Create Admin User

```bash
# Method 1: Local with production DB
DATABASE_URL="your-prod-url" npm run ensure:admin -- --email admin@yourdomain.com --password YourStrongPass123!

# Method 2: After pulling Vercel environment
vercel env pull .env.local
npm run ensure:admin -- --email admin@yourdomain.com --password YourStrongPass123!

# Method 3: Direct SQL query (copy from output of gen:hash script)
npm run gen:hash -- "YourPassword123!"
# Then manually insert into database using provided SQL
```

---

## Step 6: Test Your Deployment

```bash
# Replace YOUR_DOMAIN with your actual Vercel domain (e.g., your-app.vercel.app)

# 1. Test health
curl https://YOUR_DOMAIN/api/health

# 2. Test login
curl -X POST https://YOUR_DOMAIN/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourdomain.com","password":"YourPassword123!"}'

# 3. Copy the accessToken from response, then test protected endpoint
curl https://YOUR_DOMAIN/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 4. Test blog creation
curl -X POST https://YOUR_DOMAIN/api/blogs \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"First Blog","slug":"first-blog","excerpt":"My first blog post","content":"Welcome to our blog!"}'
```

---

## 🎉 You're Live!

Visit your deployed site:
- **Frontend**: `https://your-domain.vercel.app`
- **Admin Panel**: `https://your-domain.vercel.app/admin`
- **API Health**: `https://your-domain.vercel.app/api/health`

---

## Common Issues & Fixes

### "Database connection failed"
- Check `DATABASE_URL` format: `postgresql://user:pass@host:5432/db?sslmode=require`
- Ensure database allows connections from anywhere (0.0.0.0/0)

### "Prisma Client not found"
- Already fixed in `package.json` ✅
- Vercel will auto-generate Prisma client during build

### "JWT_SECRET is not defined"
- Add environment variables in Vercel dashboard
- Redeploy after adding variables

### Check Logs
```bash
# View deployment logs
vercel logs

# View specific deployment
vercel logs <deployment-url>
```

---

## Quick Commands Reference

```bash
# View environment variables
vercel env ls

# Add environment variable
vercel env add

# Pull production env to local
vercel env pull .env.local

# Redeploy
vercel --prod

# View domains
vercel domains ls

# Add custom domain
vercel domains add yourdomain.com
```

---

## Estimated Time: **10-15 minutes total** ⚡

Questions? Check:
- [Vercel Docs](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prisma Vercel Guide](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)
