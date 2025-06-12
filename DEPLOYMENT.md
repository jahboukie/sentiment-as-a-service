# SentimentAsAService - Vercel Deployment Guide

## 🚀 Quick Deployment to Vercel

This guide will help you deploy SentimentAsAService to Vercel for sharing with VCs and stakeholders.

### Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Push your code to GitHub
3. **Vercel CLI** (optional): `npm i -g vercel`

### Method 1: Deploy via Vercel Dashboard (Recommended)

1. **Connect GitHub Repository**
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Project Settings**
   - **Framework Preset**: Other
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `npm run vercel-build`
   - **Output Directory**: `./` (leave default)
   - **Install Command**: `npm install`

3. **Environment Variables** (Optional)
   - Add `NODE_ENV=production`
   - Add `ANTHROPIC_API_KEY=your_key` (if you have Claude AI access)

4. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Get your live URL!

### Method 2: Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from project directory
vercel

# Follow the prompts:
# - Set up and deploy? Y
# - Which scope? (select your account)
# - Link to existing project? N
# - Project name: sentimentasaservice
# - Directory: ./
# - Override settings? N

# Deploy to production
vercel --prod
```

### Method 3: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/jahboukie/sentiment-as-a-service)

### Configuration Files

The following files are already configured for Vercel:

- `vercel.json` - Vercel configuration
- `.vercelignore` - Files to ignore during deployment
- `start-demo.js` - Demo server (works without database)
- `package.json` - Updated with Vercel scripts

### Demo Features Available

✅ **Enterprise Dashboard** - Beautiful UI showcasing platform capabilities
✅ **Live API Demo** - Interactive sentiment analysis with mock Claude AI
✅ **API Explorer** - Complete API documentation with examples
✅ **Security Dashboard** - Military-grade security features showcase
✅ **Analytics Charts** - Real-time data visualization
✅ **Pricing Tiers** - Enterprise pricing display
✅ **Mobile Responsive** - Works on all devices

### Environment Variables (Optional)

For enhanced demo experience, you can add:

```
NODE_ENV=production
ANTHROPIC_API_KEY=your_claude_api_key (for real AI analysis)
```

### Custom Domain (Optional)

1. Go to your Vercel project dashboard
2. Click "Settings" → "Domains"
3. Add your custom domain
4. Configure DNS as instructed

### Sharing with VCs

Once deployed, you'll get a URL like:
`https://sentimentasaservice-xyz.vercel.app`

**Key Demo Points for VCs:**

1. **Homepage** - Shows enterprise platform overview
2. **Live API Demo** - Interactive sentiment analysis
3. **Security Dashboard** - HIPAA compliance and encryption
4. **Analytics** - Cross-app correlation insights
5. **Pricing** - Clear enterprise revenue model
6. **API Explorer** - Technical documentation

### Troubleshooting

**Build Fails?**
- Check that all dependencies are in `package.json`
- Ensure `start-demo.js` is in root directory

**Demo Not Working?**
- Verify `public/` folder is included
- Check browser console for JavaScript errors

**Need Real Claude AI?**
- Add `ANTHROPIC_API_KEY` environment variable
- Update `start-demo.js` to use real API calls

### Performance Optimization

The demo is optimized for:
- ⚡ Fast loading with CDN assets
- 📱 Mobile-responsive design
- 🎨 Professional enterprise appearance
- 🔒 Security-focused messaging
- 💰 Clear business value proposition

### Support

For deployment issues:
- Check Vercel documentation
- Review build logs in Vercel dashboard
- Ensure all files are committed to Git

---

**Ready to impress VCs with your healthcare intelligence platform!** 🚀
