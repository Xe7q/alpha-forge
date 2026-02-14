# Alpha Forge Dashboard - Vercel Deployment Guide

## Step 1: Create Vercel Account (2 minutes)

1. Go to https://vercel.com
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"** (easiest) or use your email
4. Complete signup

## Step 2: Install Vercel CLI (if not already done)

In your terminal/command prompt:
```bash
npm install -g vercel
```

## Step 3: Login to Vercel

```bash
cd hedge-fund-dashboard
npx vercel login
```
- Follow the prompts (opens browser to authenticate)
- Or copy-paste the code shown

## Step 4: Deploy

```bash
npx vercel --prod
```

When asked:
- **Set up and deploy?** → Type `Y`
- **Which scope?** → Press Enter (your account)
- **Link to existing project?** → Type `N`
- **What's your project name?** → Type `alpha-forge` (or any name)
- **Which directory?** → Press Enter (current)

## Step 5: Get Your URL

After deploy completes, you'll see:
```
✅  Production: https://alpha-forge.vercel.app
```

That's your permanent URL! Bookmark it.

## Step 6: (Optional) Auto-Deploy on Changes

To update your dashboard:
```bash
cd hedge-fund-dashboard
npx vercel --prod
```

Or set up GitHub auto-deploy (I can help with this).

---

## Expected Result

Your dashboard will be live at:
`https://alpha-forge.vercel.app`

- Always online
- Free forever
- HTTPS secured
- Fast global CDN
- Works on phone, tablet, any browser

---

## Need Help?

If you get stuck at any step, send me the error message and I'll fix it.