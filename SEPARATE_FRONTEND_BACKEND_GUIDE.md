# Frontend & Backend Separate Setup Guide - Windows 11

This guide shows you how to run the frontend (React) and backend (Express) servers separately for better development control.

## Why Run Separately?

- **Better debugging**: See frontend and backend logs separately
- **Independent development**: Work on frontend without restarting backend
- **Port flexibility**: Use different ports for each service
- **Production-like setup**: Mirrors real deployment architecture

## Prerequisites

1. **Node.js** (LTS version from [nodejs.org](https://nodejs.org/))
2. **VS Code** ([code.visualstudio.com](https://code.visualstudio.com/))
3. **Git** (optional, for cloning)

## Project Structure Overview

```
whatsapp-card-manager/
├── client/           # React frontend
├── server/           # Express backend
├── shared/           # Shared types/schemas
├── package.json      # Root dependencies
└── vite.config.ts    # Frontend build config
```

## Setup Instructions

### 1. Initial Setup

1. **Extract/download** the project to your computer
2. **Open VS Code** and open the project folder
3. **Copy environment file**:
   ```cmd
   copy .env.example .env
   ```
4. **Edit `.env`** with your Firebase and Gemini API keys

### 2. Install Dependencies

Open VS Code terminal (`Ctrl + Shift + ``) and run:
```cmd
npm install
```

This installs all dependencies for both frontend and backend.

## Running Frontend and Backend Separately

### Method 1: Two VS Code Terminals (Recommended)

1. **Open VS Code terminal** (`Ctrl + Shift + ``)
2. **Split terminal** (click the split icon or `Ctrl + Shift + 5`)

**Terminal 1 - Backend:**
```cmd
cd server
set NODE_ENV=development && npx tsx index.ts
```

**Terminal 2 - Frontend:**
```cmd
npx vite --config vite.dev.config.ts
```

### Method 2: Separate Command Prompts

**Command Prompt 1 - Backend:**
```cmd
cd your-project-folder
cd server
set NODE_ENV=development && npx tsx index.ts
```

**Command Prompt 2 - Frontend:**
```cmd
cd your-project-folder
npx vite --config vite.dev.config.ts
```

### Method 3: PowerShell Windows

**PowerShell 1 - Backend:**
```powershell
cd server
$env:NODE_ENV = "development"; npx tsx index.ts
```

**PowerShell 2 - Frontend:**
```powershell
npx vite --config vite.dev.config.ts
```

## Server Configuration

### Backend Server (Express)
- **Port**: 5000
- **URL**: `http://localhost:5000`
- **Purpose**: API endpoints, database operations, file uploads

### Frontend Server (Vite)
- **Port**: 3000
- **URL**: `http://localhost:3000`
- **Purpose**: React application, user interface

## Access Your Application

1. **Frontend**: Open `http://localhost:3000` in your browser
2. **Backend API**: Available at `http://localhost:5000/api/*`

The frontend will automatically proxy API requests to the backend.

## Convenience Scripts

I'll create some batch files to make this easier:

### `start-backend.bat`
```cmd
@echo off
echo Starting Backend Server (Express)...
cd server
set NODE_ENV=development && npx tsx index.ts
```

### `start-frontend.bat`
```cmd
@echo off
echo Starting Frontend Server (Vite)...
npx vite --host 0.0.0.0 --port 3000
```

### `start-both.bat`
```cmd
@echo off
echo Starting both Frontend and Backend...
start "Backend" start-backend.bat
timeout /t 3
start "Frontend" start-frontend.bat
```

## Development Workflow

### Typical Development Process:
1. **Start backend first** (it provides the API)
2. **Start frontend** (it connects to the backend)
3. **Make changes** to either frontend or backend
4. **Hot reload** will automatically refresh changes

### File Watching:
- **Frontend**: Vite provides instant hot reload
- **Backend**: Uses tsx with file watching for auto-restart

## Port Configuration

### Default Ports:
- Frontend: `3000`
- Backend: `5000`

### Changing Ports:

**Frontend Port:**
```cmd
npx vite --port 4000
```

**Backend Port:**
Edit `server/index.ts` and change:
```typescript
const PORT = process.env.PORT || 5000; // Change 5000 to your preferred port
```

## Environment Variables

Your `.env` file should contain:
```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_APP_ID=your_firebase_app_id

# Gemini AI Configuration  
VITE_GEMINI_API_KEY=your_gemini_api_key

# Development URLs (optional)
VITE_API_URL=http://localhost:5000
```

## Troubleshooting

### Backend Issues:

**Port 5000 in use:**
```cmd
netstat -ano | findstr :5000
taskkill /PID [PID_NUMBER] /F
```

**Database connection errors:**
- Check Firebase configuration in `.env`
- Verify internet connection
- Check Firebase console for project status

### Frontend Issues:

**Port 3000 in use:**
```cmd
npx vite --port 3001
```

**API connection errors:**
- Ensure backend is running on port 5000
- Check browser network tab for failed requests
- Verify CORS settings

### Common Solutions:

**"Module not found" errors:**
```cmd
rmdir /s node_modules
del package-lock.json
npm install
```

**Environment variables not loading:**
```cmd
# Restart both servers after changing .env
# Make sure .env is in the root directory
```

## Production Build

### Build Frontend:
```cmd
npx vite build
```

### Build Backend:
```cmd
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
```

### Run Production:
```cmd
# Backend
set NODE_ENV=production && node dist/index.js

# Frontend (serve built files)
npx serve dist
```

## VS Code Extensions for Better Development

Recommended extensions:
- **Thunder Client** - API testing
- **ES7+ React/Redux snippets** - React shortcuts
- **Prettier** - Code formatting
- **GitLens** - Git integration
- **Auto Rename Tag** - HTML/JSX tag sync

## Debugging

### Backend Debugging:
1. Add breakpoints in VS Code
2. Use `console.log()` statements
3. Check terminal output for errors

### Frontend Debugging:
1. Use browser Developer Tools (`F12`)
2. Check Console tab for JavaScript errors
3. Use React Developer Tools extension

## File Structure When Running Separately

```
Running Processes:
├── Terminal 1: Backend (server/index.ts) → Port 5000
├── Terminal 2: Frontend (vite dev server) → Port 3000
└── Browser: http://localhost:3000 (automatically proxies to backend)
```

This setup gives you maximum flexibility for development while keeping frontend and backend concerns separated!