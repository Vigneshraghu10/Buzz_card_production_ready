# Quick Command Reference - Separate Frontend & Backend

## Quick Start Commands

### Option 1: Use the Batch Files (Easiest)
```cmd
# Start backend
start-backend.bat

# Start frontend (in another terminal)
start-frontend.bat

# Start both at once
start-both.bat
```

### Option 2: Manual Commands

**Backend (Terminal 1):**
```cmd
cd server
set NODE_ENV=development && npx tsx index.ts
```

**Frontend (Terminal 2):**
```cmd
npx vite --config vite.dev.config.ts
```

### Option 3: PowerShell
```powershell
# Backend
cd server
$env:NODE_ENV = "development"; npx tsx index.ts

# Frontend  
npx vite --config vite.dev.config.ts
```

## Access URLs
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

## What Each Server Does

### Backend Server (Port 5000)
- Express.js API server
- Handles database operations
- File upload processing
- Authentication endpoints
- OCR processing with Gemini API

### Frontend Server (Port 3000)  
- React application
- Vite development server
- Hot reload for UI changes
- Automatically proxies API calls to backend

## File Structure
```
Project/
├── server/           # Backend code
│   └── index.ts      # Main server file
├── client/           # Frontend code
│   └── src/          # React components
├── vite.dev.config.ts # Frontend dev config
└── start-*.bat       # Convenience scripts
```

## Pro Tips
1. Always start backend first, then frontend
2. Keep both terminals open to see logs
3. Frontend will auto-refresh on code changes
4. Backend will restart on code changes (with tsx)
5. API calls from frontend automatically go to backend