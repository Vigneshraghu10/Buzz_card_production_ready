# WhatsApp Business Digital Visiting Card Manager

A comprehensive React application for managing WhatsApp Business digital visiting cards with Firebase backend, OCR processing, and vCard/QR generation.

## Features

### 🔐 Authentication
- Firebase Authentication with email/password
- Protected routing with automatic redirects
- User profile management

### 📇 Contact Management
- Full CRUD operations for contacts
- Grid and table view modes
- Advanced search and filtering
- Group organization
- Duplicate contact detection

### 🏷️ Group Management
- Create and manage contact groups
- Assign contacts to multiple groups
- Visual group indicators

### 📝 Template Management
- Create reusable message templates
- WhatsApp Business integration ready
- Template selection for bulk messaging

### 📤 Bulk Upload & OCR
- Upload up to 10 business card images
- Google Cloud Vision API integration
- Automatic text extraction and parsing
- Batch contact creation

### 📸 Single Card Scanning
- Individual business card processing
- OCR text extraction
- Edit extracted data before saving
- Direct contact creation

### 💳 Digital Card Builder
- Interactive card designer
- Live preview updates
- Avatar image upload
- vCard generation
- QR code creation
- Public sharing links

### ⚙️ Settings Management
- User profile configuration
- WhatsApp Business API settings
- Timezone and language preferences

### 🔗 Public Sharing
- Public digital card pages
- vCard download functionality
- Mobile-optimized design

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **React Router (wouter)** for navigation
- **React Context API** for state management
- **shadcn/ui** component library

### Backend & Services
- **Firebase Authentication** for user management
- **Firebase Firestore** for data persistence
- **Firebase Storage** for file uploads
- **Google Cloud Vision API** for OCR processing

### Additional Libraries
- **qrcode** for QR code generation
- **React Hook Form** for form handling
- **TanStack Query** for data fetching
- **Lucide React** for icons

## Setup Instructions

### Prerequisites
- Node.js 18+ 
- Firebase project
- Google Cloud Vision API key

### Firebase Configuration

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Create a new Firebase project
3. Enable Authentication with Email/Password provider
4. Create a Firestore database
5. Enable Firebase Storage
6. Get your Firebase configuration values

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

VITE_GCLOUD_VISION_API_KEY=your_google_cloud_vision_api_key
VITE_APP_PUBLIC_BASE_URL=https://your-domain.com
