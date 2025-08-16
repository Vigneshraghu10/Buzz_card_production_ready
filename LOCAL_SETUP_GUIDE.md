# WhatsApp Business Digital Visiting Card Manager - Local Setup Guide

## Overview
This guide will help you download and run the WhatsApp Business Digital Visiting Card Manager on your local desktop/laptop.

## Prerequisites
Before you begin, ensure you have the following installed on your system:

- **Node.js 18 or higher** - [Download from nodejs.org](https://nodejs.org/)
- **Git** (optional) - [Download from git-scm.com](https://git-scm.com/)
- **Text Editor/IDE** - VS Code, WebStorm, or any preferred editor

## Step 1: Download the Code

### Option A: Download as ZIP (Easiest)
1. Go to your Replit project
2. Click the three dots menu (⋮) in the files panel
3. Select "Download as ZIP"
4. Extract the ZIP file to your desired location

### Option B: Clone with Git
```bash
# If your project is connected to GitHub
git clone <your-repository-url>
cd your-project-folder
```

## Step 2: Install Dependencies

Open a terminal/command prompt in your project folder and run:

```bash
# Install all required packages
npm install
```

This will install all the necessary dependencies including:
- React, TypeScript, Vite
- Firebase SDK
- UI components (Radix UI, Tailwind CSS)
- And many more packages

## Step 3: Firebase Setup

### Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or use an existing one
3. Follow the setup wizard

### Enable Required Services
1. **Authentication**
   - Go to Authentication > Sign-in method
   - Enable "Email/Password" provider
   - Save changes

2. **Firestore Database**
   - Go to Firestore Database
   - Click "Create database"
   - Choose "Start in test mode" (for development)
   - Select a location near you

3. **Storage**
   - Go to Storage
   - Click "Get started"
   - Choose "Start in test mode"

### Get Firebase Configuration
1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps"
3. Click "Add app" > Web app (</>) 
4. Enter app nickname
5. Copy the configuration object

## Step 4: Get Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

## Step 5: Environment Variables

Create a `.env` file in the root directory of your project:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Gemini API
VITE_GEMINI_API_KEY=your_gemini_api_key

# App Configuration
VITE_APP_PUBLIC_BASE_URL=http://localhost:5000
```

**Important:** 
- Replace all `your_*` values with your actual Firebase configuration
- Never commit the `.env` file to version control (it's already in `.gitignore`)

## Step 6: Firebase Security Rules

### Firestore Rules
Go to Firestore Database > Rules and update:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /{collection}/{document} {
      allow read, write: if request.auth != null && 
        (resource == null || resource.data.ownerId == request.auth.uid);
    }
    
    // Allow public read access to digitalCards for sharing
    match /digitalCards/{cardId} {
      allow read: if true;
      allow write: if request.auth != null && 
        (resource == null || resource.data.ownerId == request.auth.uid);
    }
  }
}
```

### Storage Rules
Go to Storage > Rules and update:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Users can only access their own files
    match /users/{uid}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

## Step 7: Run the Application

Start the development server:

```bash
npm run dev
```

The application will start on `http://localhost:5000`

## Step 8: Test the Application

1. **Sign Up/Login**: Create a new account or sign in
2. **Digital Card**: Create your digital business card
3. **Upload Photo**: Test photo upload functionality
4. **Add Contacts**: Manually add contacts
5. **Create Groups**: Set up contact groups
6. **Bulk Upload**: Test OCR with business card images
7. **Assign to Groups**: Test group assignment features

## Troubleshooting

### Common Issues

#### Port Already in Use
If port 5000 is already in use:
```bash
# Kill the process using port 5000
npx kill-port 5000

# Or modify vite.config.ts to use a different port
```

#### Firebase Authentication Error
- Verify your Firebase configuration is correct
- Check that Authentication is enabled in Firebase Console
- Ensure your domain is added to authorized domains

#### Gemini API Errors
- Verify your API key is correct
- Check you have Gemini API access enabled
- Ensure you have sufficient quota

#### File Upload Issues
- Check Firebase Storage rules
- Verify Storage is enabled in Firebase Console
- Check browser console for detailed errors

### Development Tips

1. **Hot Reload**: The app automatically reloads when you make changes
2. **Browser Console**: Use F12 to open developer tools for debugging
3. **Network Tab**: Monitor API calls and responses
4. **Firebase Console**: Monitor data in real-time

## Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Application pages
│   │   ├── utils/          # Utility functions
│   │   ├── contexts/       # React contexts
│   │   └── lib/            # Libraries and configurations
├── server/                 # Backend Express server (minimal)
├── package.json           # Dependencies and scripts
└── vite.config.ts        # Vite configuration
```

## Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check
```

## Building for Production

When ready to deploy:

```bash
# Build the application
npm run build

# The built files will be in the 'dist' folder
```

## Support

If you encounter any issues:

1. Check the browser console for error messages
2. Verify all environment variables are set correctly
3. Ensure Firebase services are properly configured
4. Check network connectivity

## Security Notes

- Never share your `.env` file or API keys
- Use Firebase Security Rules to protect your data
- Keep your dependencies updated
- Consider using Firebase App Check for additional security

---

**Happy coding!** You now have a fully functional WhatsApp Business Digital Visiting Card Manager running locally on your machine.