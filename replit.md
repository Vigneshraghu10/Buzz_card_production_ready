# Overview

This is a comprehensive WhatsApp Business Digital Visiting Card Manager built with React and Firebase. The application allows users to manage contacts, create digital business cards, and process business card images using OCR technology. It provides a full-featured contact management system with group organization, template management, bulk uploads, and digital card generation capabilities.

# User Preferences

Preferred communication style: Simple, everyday language.
Platform: Windows 11 with VS Code IDE for local development.
Setup: Prefers running frontend and backend servers separately for better development control.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: Radix UI primitives with Tailwind CSS styling following the shadcn/ui design system
- **State Management**: React Context API for authentication state, TanStack Query for server state management
- **Forms**: React Hook Form with Zod validation

## Backend Architecture
- **Database**: Firebase Firestore for real-time document-based data storage
- **Authentication**: Firebase Authentication with email/password
- **File Storage**: Firebase Cloud Storage for images and avatars
- **Server**: Express.js server with Drizzle ORM (configured for PostgreSQL as fallback)
- **API Integration**: Google Cloud Vision API for OCR processing

## Data Storage Solutions
- **Primary Database**: Firebase Firestore with collections for users, contacts, groups, templates, and digital cards
- **File Storage**: Firebase Cloud Storage for business card images, avatars, and generated QR codes
- **Session Management**: Firebase Authentication handles user sessions and tokens
- **Backup Schema**: Drizzle ORM with PostgreSQL support (Neon Database) as a secondary option

## Authentication and Authorization
- **Provider**: Firebase Authentication
- **Methods**: Email/password authentication
- **Protection**: Route-based authentication with private route wrapper
- **User Management**: User profiles stored in Firestore with additional metadata

## External Service Integrations
- **Google Cloud Vision API**: OCR text extraction from business card images
- **QR Code Generation**: Client-side QR code creation for vCard sharing
- **vCard Standard**: Contact information export in industry-standard vCard format
- **WhatsApp Business**: Template system designed for WhatsApp Business API integration

## Key Architectural Decisions

### Firebase-First Approach
- **Problem**: Need for real-time data sync and scalable authentication
- **Solution**: Firebase ecosystem provides authentication, database, and storage in one platform
- **Benefits**: Real-time updates, automatic scaling, built-in security rules
- **Trade-offs**: Vendor lock-in, limited complex querying capabilities

### OCR Integration Pattern
- **Problem**: Extract structured data from business card images
- **Solution**: Google Cloud Vision API with custom parsing logic
- **Implementation**: Upload to storage → OCR processing → structured data extraction → user review
- **Benefits**: High accuracy text extraction, handles multiple languages

### Component Architecture
- **Problem**: Maintain consistent UI across complex application
- **Solution**: shadcn/ui component system with Radix UI primitives
- **Benefits**: Accessible components, consistent design, TypeScript support
- **Structure**: Atomic design with reusable UI components

### Bulk Processing Strategy
- **Problem**: Handle multiple business card uploads efficiently
- **Solution**: Sequential processing with progress tracking and error handling
- **Implementation**: File upload → OCR → parsing → duplicate detection → batch save
- **Benefits**: User feedback, error recovery, duplicate prevention