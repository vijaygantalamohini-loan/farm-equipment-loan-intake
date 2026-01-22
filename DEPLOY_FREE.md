# 🎉 FREE Azure Deployment Guide

Deploy your loan intake app for **$0/month** using Azure Static Web Apps + Functions.

---

## 📋 What You Get (100% FREE)

✅ Frontend hosting (Azure Static Web Apps)  
✅ Backend API (Azure Functions)  
✅ SQLite database (stored in Azure Storage)  
✅ Azure AD B2C authentication (50K users free)  
✅ HTTPS with custom domain  
✅ 100GB bandwidth/month  
✅ Global CDN  

**Total Cost: $0.00/month** (or $0.02/month for database backups)

---

## 🚀 Quick Deployment (5 minutes)

### Prerequisites

```bash
# Install Azure Static Web Apps CLI
npm install -g @azure/static-web-apps-cli

# Install Azure Functions Core Tools
npm install -g azure-functions-core-tools@4 --unsafe-perm true

# Install Azure CLI (if not already installed)
# Windows: Download from https://aka.ms/installazurecliwindows
```

### Step 1: Test Locally

```bash
# Terminal 1: Start Azure Functions (backend)
cd loan-intake-backend
pip install -r requirements-functions.txt
func start

# Backend will run on http://localhost:7071

# Terminal 2: Start frontend
cd loan-intake-frontend
npm start

# Frontend will run on http://localhost:3000
```

### Step 2: Update Frontend API URLs

Edit `loan-intake-frontend/src/components/LoanApplicationWizard.js`:

```javascript
// Change this line:
const API_URL = 'http://localhost:8000';

// To this:
const API_URL = process.env.NODE_ENV === 'production' 
  ? '/api'  // Azure Static Web Apps proxies /api to your functions
  : 'http://localhost:7071/api';
```

### Step 3: Deploy to Azure

```bash
# Login to Azure
az login

# Create resource group
az group create \
  --name loan-intake-rg \
  --location eastus

# Create Static Web App (completely FREE)
az staticwebapp create \
  --name loan-intake-app \
  --resource-group loan-intake-rg \
  --location eastus2 \
  --source https://github.com/YOUR-USERNAME/loan-intake-frontend \
  --branch main \
  --app-location "/" \
  --api-location "loan-intake-backend" \
  --output-location "build"

# Get deployment token
az staticwebapp secrets list \
  --name loan-intake-app \
  --resource-group loan-intake-rg \
  --query "properties.apiKey" -o tsv
```

### Step 4: GitHub Actions (Auto-Deploy)

Azure Static Web Apps automatically creates a GitHub Actions workflow.

Create `.github/workflows/azure-static-web-apps.yml`:

```yaml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches:
      - main
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches:
      - main

jobs:
  build_and_deploy_job:
    runs-on: ubuntu-latest
    name: Build and Deploy Job
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: true
      
      - name: Build And Deploy
        id: builddeploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/loan-intake-frontend"
          api_location: "/loan-intake-backend"
          output_location: "build"
```

### Step 5: Configure Environment Variables

In Azure Portal:
1. Go to your Static Web App
2. Click "Configuration"
3. Add application settings:

```
AZURE_AD_TENANT_NAME=yourcompany
AZURE_AD_B2C_TENANT_ID=your-tenant-id-guid
AZURE_AD_CLIENT_ID=your-client-id-guid
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_POLICY_NAME=B2C_1_signupsignin
FRONTEND_URL=https://your-app.azurestaticapps.net
BACKEND_URL=https://your-app.azurestaticapps.net/api
DATABASE_URL=sqlite:///./loans.db
```

### Step 6: Update Azure AD B2C Redirect URI

In Azure Portal → Azure AD B2C → App Registrations:
- Add redirect URI: `https://your-app.azurestaticapps.net/api/auth/callback`

---

## 🗄️ Database Storage (SQLite)

Your SQLite database lives in Azure Storage (persistent across deployments).

**Option A: Azure Storage (Recommended)**

```bash
# Create storage account (FREE tier)
az storage account create \
  --name loanintakestorage \
  --resource-group loan-intake-rg \
  --location eastus \
  --sku Standard_LRS

# Upload initial database
az storage blob upload \
  --account-name loanintakestorage \
  --container-name database \
  --name loans.db \
  --file loans.db
```

**Option B: Azure Files (Even Simpler)**

Mount Azure Files share to your Functions app:
```bash
az storage share create \
  --name loandata \
  --account-name loanintakestorage
```

---

## 📱 Progressive Web App (PWA)

Your React app already has `manifest.json`. To make it installable on phones:

1. Add service worker to `loan-intake-frontend/public/service-worker.js`:

```javascript
self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

2. Register service worker in `loan-intake-frontend/src/index.js`:

```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then((registration) => {
      console.log('Service Worker registered:', registration);
    });
}
```

**Now users can "Add to Home Screen" on their phones!**

---

## 🔧 Local Development

```bash
# Install Azure Static Web Apps CLI
npm install -g @azure/static-web-apps-cli

# Run everything locally (simulates Azure environment)
cd loan-intake-backend
swa start ../loan-intake-frontend/build --api-location . --port 4280

# Or run separately:
# Terminal 1: Functions
cd loan-intake-backend
func start

# Terminal 2: React
cd loan-intake-frontend
npm start
```

---

## 📊 Monitoring (FREE)

Azure Static Web Apps includes:
- ✅ Request logs
- ✅ Error tracking
- ✅ Performance metrics
- ✅ Custom domain SSL

View in Azure Portal → Static Web App → "Metrics"

---

## 🎯 Cost Breakdown

| Service | Free Tier | Your Usage | Cost |
|---------|-----------|------------|------|
| Static Web Apps | 100GB bandwidth | ~5GB/month | **$0** |
| Azure Functions | 1M requests | ~10K/month | **$0** |
| Azure AD B2C | 50K users | 30 users | **$0** |
| Azure Storage | 5GB | 0.1GB | **$0.002** |
| **TOTAL** | | | **$0/month** |

---

## 🚀 Deployment Commands (Quick Reference)

```bash
# Deploy frontend + backend
cd loan-intake-frontend
npm run build
swa deploy --app-location . --api-location ../loan-intake-backend

# Or use GitHub Actions (automatic on git push)
git add .
git commit -m "Deploy to Azure"
git push origin main
```

---

## 📱 Custom Domain (Optional, FREE)

Add your own domain for FREE:
1. Azure Portal → Static Web App → "Custom domains"
2. Add CNAME record: `www.yourfarm.com` → `your-app.azurestaticapps.net`
3. SSL certificate automatically provisioned (FREE)

---

## 🔄 Scaling (When You Grow)

**Stay on FREE tier until:**
- ❌ 100GB bandwidth exceeded (~50K page views/month)
- ❌ 1M function executions exceeded (~30K loans/month)
- ❌ 50K active users exceeded

**Then upgrade to Standard tier:** $9/month (still very cheap!)

---

## ✅ Verification Checklist

After deployment:
- [ ] Frontend loads at `https://your-app.azurestaticapps.net`
- [ ] Login redirects to Azure AD B2C
- [ ] Login redirects back successfully
- [ ] Can submit loan application
- [ ] Can view applications
- [ ] Works on mobile phone browser
- [ ] Can "Add to Home Screen" on phone

---

## 🆘 Troubleshooting

**"Functions not working"**
- Check `staticwebapp.config.json` exists
- Verify API routes start with `/api/`
- Check function logs in Azure Portal

**"Database not persisting"**
- Mount Azure Storage to Functions app
- Check `DATABASE_URL` environment variable

**"CORS errors"**
- Azure Static Web Apps handles CORS automatically
- Check API calls use relative URLs (`/api/...`)

---

## 📚 Next Steps

1. ✅ **Test locally** with `func start`
2. ✅ **Deploy to Azure** with `swa deploy`
3. ✅ **Configure Azure AD B2C** redirect URI
4. ✅ **Test on phone** (add to home screen)
5. ✅ **Show to salespeople** and get feedback!

**You now have a production-ready app for $0/month!** 🎉
