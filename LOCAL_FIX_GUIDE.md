# Local Setup Issues - Quick Fix Guide

## Problem Summary
You're facing these issues:
1. **Port 5000 already in use** - Backend can't start
2. **Missing UI components** - Components not found by Vite  
3. **Vite configuration issues** - Path aliases not working
4. **Tailwind CSS problems** - Missing configuration

## Quick Fix Steps

### 1. Fix Port 5000 Issue

**Option A: Kill the process using port 5000**
```cmd
# Find what's using port 5000
netstat -ano | findstr :5000

# Kill the process (replace PID_NUMBER with actual PID)
taskkill /PID PID_NUMBER /F
```

**Option B: Use the fix script**
```cmd
# Run the automated fix
fix-port-issue.bat
```

**Option C: Use different port**
Edit `server/index.ts` and change:
```typescript
const PORT = process.env.PORT || 5001; // Changed from 5000 to 5001
```

### 2. Fix Missing Components

I've created the missing UI components. Make sure these files exist in your `client/src/components/ui/` folder:
- `toaster.tsx`
- `tooltip.tsx` 
- `toast.tsx`

### 3. Fix Vite Configuration

I've created `client/vite.config.ts` with proper path aliases. Make sure it exists in your `client/` folder.

### 4. Fix Tailwind Configuration

I've created `client/tailwind.config.js` with proper content paths and theme configuration.

## Step-by-Step Fix Process

### Step 1: Stop all running processes
```cmd
# Press Ctrl+C in any running terminals
# Or close all command prompt windows
```

### Step 2: Clear the port
```cmd
# Run this to see what's using port 5000
netstat -ano | findstr :5000

# Kill the process (replace XXXX with actual PID)
taskkill /PID XXXX /F
```

### Step 3: Install missing dependencies
```cmd
cd your-project-folder
npm install tailwindcss-animate
```

### Step 4: Run the application properly

**Option A: Use separate terminals (recommended)**
```cmd
# Terminal 1 - Backend
cd server  
set NODE_ENV=development && npx tsx index.ts

# Terminal 2 - Frontend
cd client
npx vite
```

**Option B: Use the batch files**
```cmd
start-backend.bat
start-frontend.bat
```

## File Structure Check

Make sure your project has this structure:
```
BizCardScan/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   └── ui/
│   │   │       ├── toaster.tsx ✓
│   │   │       ├── tooltip.tsx ✓ 
│   │   │       └── toast.tsx ✓
│   │   └── [other files]
│   ├── vite.config.ts ✓
│   └── tailwind.config.js ✓
├── server/
│   └── index.ts
├── .env
└── package.json
```

## Expected Results After Fix

### Backend (Port 5000):
```
Server starting on port 5000...
[express] serving on port 5000
```

### Frontend (Port 3000/5173):
```
VITE v5.x.x ready in XXXms
Local:   http://localhost:3000/
```

## If Still Having Issues

### Issue: "Module not found"
```cmd
# Delete node_modules and reinstall
rmdir /s node_modules
del package-lock.json
npm install
```

### Issue: "Tailwind classes not working"
Check that `client/tailwind.config.js` exists with proper content paths.

### Issue: "Components still missing"
Verify all UI component files are in `client/src/components/ui/`.

### Issue: "Port still in use"
```cmd
# Restart your computer to free all ports
# Or use a different port in server/index.ts
```

## Alternative: Different Port Setup

If port 5000 keeps causing issues, change the backend port:

1. **Edit `server/index.ts`**:
   ```typescript
   const PORT = process.env.PORT || 5001;
   ```

2. **Update frontend proxy** in `client/vite.config.ts`:
   ```typescript
   proxy: {
     '/api': 'http://localhost:5001'  // Changed from 5000 to 5001
   }
   ```

## Test Your Setup

1. **Backend test**: Open `http://localhost:5000` (should show API info)
2. **Frontend test**: Open `http://localhost:3000` (should show login page)
3. **Full test**: Try logging in and uploading a business card

The application should now work properly on your Windows 11 system with VS Code!