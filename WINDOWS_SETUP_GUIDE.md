# Windows 11 Local Setup Guide - WhatsApp Business Card Manager

This guide will help you set up and run the WhatsApp Business Digital Visiting Card Manager on Windows 11 using VS Code.

## Prerequisites

### 1. Install Node.js
1. Go to [https://nodejs.org/](https://nodejs.org/)
2. Download the **LTS version** (recommended for most users)
3. Run the installer and follow the setup wizard
4. Accept all default settings
5. Verify installation by opening Command Prompt and running:
   ```bash
   node --version
   npm --version
   ```

### 2. Install Git
1. Go to [https://git-scm.com/download/win](https://git-scm.com/download/win)
2. Download and install Git for Windows
3. During installation, choose "Git from the command line and also from 3rd-party software"
4. Use default settings for other options

### 3. Install VS Code
1. Go to [https://code.visualstudio.com/](https://code.visualstudio.com/)
2. Download and install VS Code for Windows
3. Install recommended extensions:
   - ES7+ React/Redux/React-Native snippets
   - Prettier - Code formatter
   - Auto Rename Tag
   - Bracket Pair Colorizer
   - GitLens

## Project Setup

### 1. Download the Project
Option A: If you have the project as a ZIP file
1. Extract the ZIP file to your desired location (e.g., `C:\Projects\whatsapp-card-manager`)

Option B: If you have a Git repository
1. Open Command Prompt or Git Bash
2. Navigate to your projects folder:
   ```bash
   cd C:\Projects
   ```
3. Clone the repository:
   ```bash
   git clone [YOUR_REPOSITORY_URL]
   cd whatsapp-card-manager
   ```

### 2. Open Project in VS Code
1. Open VS Code
2. Click "File" → "Open Folder"
3. Select your project folder
4. VS Code will open the project

### 3. Install Dependencies
1. Open VS Code terminal: `Ctrl + Shift + `` (backtick)` or View → Terminal
2. Install all project dependencies:
   ```bash
   npm install
   ```
   This will install all packages listed in package.json

### 4. Set Up Environment Variables
1. In the project root, create a file named `.env`
2. Add the following environment variables:
   ```env
   # Firebase Configuration
   VITE_FIREBASE_API_KEY=your_firebase_api_key_here
   VITE_FIREBASE_PROJECT_ID=your_firebase_project_id_here
   VITE_FIREBASE_APP_ID=your_firebase_app_id_here

   # Gemini AI Configuration
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

### 5. Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Click "Add app" and select Web platform (</>)
4. Register your app with a nickname
5. Copy the configuration values to your `.env` file
6. Enable Authentication:
   - Go to Authentication → Sign-in method
   - Enable Email/Password
   - Add `localhost:5000` to Authorized domains
7. Enable Firestore:
   - Go to Firestore Database
   - Create database in test mode
8. Enable Storage:
   - Go to Storage
   - Get started with default rules

### 6. Gemini API Setup
1. Go to [Google AI Studio](https://makersuite.google.com/)
2. Create an API key
3. Copy the API key to your `.env` file

## Running the Application

### 1. Start Development Server

**Option A: Use the provided Windows scripts**
- Double-click `run-local.bat` (Command Prompt version)
- Right-click `run-local.ps1` → "Run with PowerShell" (PowerShell version)

**Option B: Use VS Code terminal**
Open terminal in VS Code (`Ctrl + Shift + ``) and run:

For Windows Command Prompt:
```cmd
set NODE_ENV=development && npx tsx server/index.ts
```

For PowerShell:
```powershell
$env:NODE_ENV = "development"; npx tsx server/index.ts
```

For Git Bash (if installed):
```bash
NODE_ENV=development npx tsx server/index.ts
```

### 2. Access the Application
1. The application will start on `http://localhost:5000`
2. Open your web browser and navigate to this URL
3. You should see the login page

### 3. Testing the Application
1. Create an account using email/password
2. Test the following features:
   - Dashboard statistics
   - Add contacts manually
   - Upload business card images
   - Bulk upload multiple cards
   - Create groups and templates

## Troubleshooting

### Common Issues and Solutions

#### Issue: `npm install` fails
**Solution:**
1. Clear npm cache: `npm cache clean --force`
2. Delete `node_modules` folder and `package-lock.json`
3. Run `npm install` again

#### Issue: "Module not found" errors
**Solution:**
1. Ensure all dependencies are installed: `npm install`
2. Restart VS Code
3. Clear VS Code cache: `Ctrl + Shift + P` → "Developer: Reload Window"

#### Issue: Firebase errors
**Solution:**
1. Check your `.env` file has correct Firebase configuration
2. Ensure Firestore and Authentication are enabled in Firebase Console
3. Verify authorized domains include `localhost:5000`

#### Issue: Port 5000 already in use
**Solution:**
1. Close any other applications using port 5000
2. Or modify the port in `server/index.ts` if needed

#### Issue: Gemini API not working
**Solution:**
1. Verify your Gemini API key is correct in `.env`
2. Check you have billing enabled for Gemini API
3. Ensure the API key has proper permissions

### Windows-Specific Issues

#### Issue: PowerShell execution policy error
**Solution:**
Run PowerShell as Administrator and execute:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### Issue: Git commands not recognized
**Solution:**
1. Restart Command Prompt/VS Code after Git installation
2. Add Git to PATH manually if needed:
   - Search "Environment Variables" in Windows
   - Add `C:\Program Files\Git\bin` to PATH

## File Structure

Your project should look like this:
```
whatsapp-card-manager/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/
│   │   └── utils/
├── server/
├── shared/
├── package.json
├── .env (you create this)
├── README.md
└── WINDOWS_SETUP_GUIDE.md
```

## Development Tips

### VS Code Extensions for Better Development
Install these extensions for better experience:
1. **Thunder Client** - API testing
2. **Firebase Explorer** - Firebase integration
3. **Tailwind CSS IntelliSense** - CSS autocomplete
4. **TypeScript Importer** - Auto import suggestions

### Useful VS Code Shortcuts
- `Ctrl + Shift + P` - Command palette
- `Ctrl + `` ` - Toggle terminal
- `Ctrl + B` - Toggle sidebar
- `F12` - Go to definition
- `Alt + Shift + F` - Format document

### Hot Reload
The application supports hot reload, so changes to your code will automatically refresh the browser.

## Production Build

To create a production build:
```bash
# Build the application
npx vite build && npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Run production server (Command Prompt)
set NODE_ENV=production && node dist/index.js

# Run production server (PowerShell)
$env:NODE_ENV = "production"; node dist/index.js
```

## Need Help?

If you encounter issues:
1. Check the terminal/console for error messages
2. Verify all environment variables are set correctly
3. Ensure Firebase services are properly configured
4. Check that all dependencies are installed

## Next Steps

Once the application is running:
1. Create your first user account
2. Test OCR functionality with business card images
3. Create groups and templates
4. Explore bulk upload features
5. Generate and share digital cards

The application is now ready for local development on Windows 11!