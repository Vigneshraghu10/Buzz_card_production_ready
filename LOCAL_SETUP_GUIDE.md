# Local Setup Guide - Windows 11 & VS Code

Complete guide to run the WhatsApp Business Card Manager locally with separate frontend and backend servers.

## Prerequisites

1. **Node.js** (LTS version) - Download from [nodejs.org](https://nodejs.org/)
2. **VS Code** - Download from [code.visualstudio.com](https://code.visualstudio.com/)

## Quick Setup

### 1. Project Setup
```cmd
# Navigate to your project folder
cd C:\Path\To\Your\Project

# Install dependencies
npm install

# Copy environment template
copy .env.example .env
```

### 2. Configure Environment Variables
Edit `.env` file with your API keys:
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### 3. Get API Keys

**Firebase Setup:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project or select existing
3. Add web app and copy configuration values
4. Enable Authentication (Email/Password)
5. Enable Firestore Database
6. Enable Storage

**Gemini API:**
1. Go to [Google AI Studio](https://makersuite.google.com/)
2. Create API key
3. Copy to `.env` file

## Running Separately

### Method 1: VS Code Terminals (Recommended)

1. **Open VS Code** in your project folder
2. **Open Terminal** (`Ctrl + Shift + ``)
3. **Split Terminal** (`Ctrl + Shift + 5`)

**Terminal 1 - Backend:**
```cmd
cd server
set NODE_ENV=development && npx tsx index.ts
```

**Terminal 2 - Frontend:**
```cmd
cd client
npx vite
```

### Method 2: Command Prompt Windows

**Window 1 - Backend:**
```cmd
cd your-project-folder\server
set NODE_ENV=development && npx tsx index.ts
```

**Window 2 - Frontend:**
```cmd
cd your-project-folder\client
npx vite
```

### Method 3: PowerShell

**PowerShell 1 - Backend:**
```powershell
cd server
$env:NODE_ENV = "development"; npx tsx index.ts
```

**PowerShell 2 - Frontend:**
```powershell
cd client
npx vite
```

## Access URLs

- **Frontend Application**: http://localhost:3000
- **Backend API**: http://localhost:5000

## What Each Server Does

**Backend (Port 5000):**
- Express.js API server
- Firebase integration
- OCR processing with Gemini
- File upload handling
- Database operations

**Frontend (Port 3000):**
- React application
- Vite development server
- Hot reload for UI changes
- Automatic API proxy to backend

## Troubleshooting

### Port 5000 Already in Use
```cmd
# Find process using port 5000
netstat -ano | findstr :5000

# Kill the process (replace XXXX with PID)
taskkill /PID XXXX /F
```

### Module Resolution Errors
```cmd
# Clear and reinstall dependencies
rmdir /s node_modules
del package-lock.json
npm install
```

### Environment Variables Not Loading
- Ensure `.env` file is in project root
- Restart both servers after changing `.env`
- Verify no extra spaces in variable names

### Vite Build Errors
- Check that all files exist in `client/src/components/ui/`
- Verify `client/vite.config.ts` and `client/tailwind.config.js` exist

## Development Workflow

1. **Start backend first** (provides API)
2. **Start frontend** (connects to backend)
3. **Make changes** to either codebase
4. **Frontend auto-reloads** on file changes
5. **Backend restarts** automatically with tsx

## File Structure

```
Project/
├── client/               # Frontend React app
│   ├── src/
│   ├── vite.config.ts   # Frontend dev config
│   └── tailwind.config.js
├── server/               # Backend Express API
│   └── index.ts         # Main server file
├── .env                 # Environment variables
└── package.json         # Dependencies
```

## Testing Your Setup

1. **Backend Test**: Open http://localhost:5000 (should show API status)
2. **Frontend Test**: Open http://localhost:3000 (should show login page)
3. **Full Test**: Create account and upload a business card

## Production Build

```cmd
# Build frontend
cd client
npx vite build

# Build backend
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Run production
set NODE_ENV=production && node dist/index.js
```

The application is now ready for local development with separate frontend and backend servers!