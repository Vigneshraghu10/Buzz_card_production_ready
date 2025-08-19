# Quick Start Guide for Windows 11

## 🚀 Super Quick Setup (5 minutes)

### Step 1: Install Prerequisites
1. **Install Node.js**: Download from [nodejs.org](https://nodejs.org/) (choose LTS version)
2. **Install VS Code**: Download from [code.visualstudio.com](https://code.visualstudio.com/)

### Step 2: Setup Project
1. **Extract/Download** the project to a folder (e.g., `C:\Projects\whatsapp-card-manager`)
2. **Open VS Code** and open the project folder
3. **Open Terminal** in VS Code (`Ctrl + Shift + ``)
4. **Install dependencies**:
   ```bash
   npm install
   ```

### Step 3: Configure Environment
1. **Copy `.env.example`** to `.env`
2. **Get Firebase keys**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create project → Add web app
   - Copy configuration values to `.env`
3. **Get Gemini API key**:
   - Go to [Google AI Studio](https://makersuite.google.com/)
   - Create API key
   - Add to `.env`

### Step 4: Run the Application

**Option A: Use the Windows batch file**
Double-click `run-local.bat`

**Option B: Use PowerShell**
Right-click `run-local.ps1` → "Run with PowerShell"

**Option C: Use VS Code Terminal**
```bash
# For Windows Command Prompt
set NODE_ENV=development && npx tsx server/index.ts

# For PowerShell
$env:NODE_ENV = "development"; npx tsx server/index.ts

# For Git Bash (if installed)
NODE_ENV=development npx tsx server/index.ts
```

### Step 5: Access Application
Open browser and go to: `http://localhost:5000`

## ✅ Verification Checklist

- [ ] Node.js installed (check: `node --version`)
- [ ] Dependencies installed (check: `node_modules` folder exists)
- [ ] `.env` file created with valid API keys
- [ ] Application starts without errors
- [ ] Can access `http://localhost:5000`
- [ ] Can create an account and login

## 🛠 Troubleshooting

**"npm install" fails?**
```bash
npm cache clean --force
rmdir /s node_modules
del package-lock.json
npm install
```

**Port 5000 in use?**
- Close other applications using port 5000
- Or kill the process: `netstat -ano | findstr :5000` then `taskkill /PID [PID] /F`

**PowerShell execution policy error?**
Run as Administrator:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Firebase/Gemini errors?**
- Verify API keys in `.env` file
- Check Firebase console for correct configuration
- Ensure billing is enabled for Gemini API

## 📁 Required Files Structure
```
your-project-folder/
├── .env (you create this)
├── .env.example (template)
├── run-local.bat (Windows script)
├── run-local.ps1 (PowerShell script)
├── WINDOWS_SETUP_GUIDE.md (detailed guide)
└── [rest of project files]
```

Need detailed setup instructions? See `WINDOWS_SETUP_GUIDE.md`