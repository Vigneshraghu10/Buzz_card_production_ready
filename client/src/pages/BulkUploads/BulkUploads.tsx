import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadToStorage } from "@/utils/upload";
import { callGeminiAPIWithRetry } from "@/utils/ocr";
import type { ParsedContact } from "@/utils/parse";
import { isDuplicateContact } from "@/utils/duplicate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CloudUpload, Check, Clock, X, Save, Users, Sparkles, Brain, Zap, FileImage, AlertCircle, CheckCircle2, Camera, QrCode, ScanLine, CameraOff, RotateCcw, ArrowRight, ArrowLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

interface UploadResult {
  id: string;
  file: File;
  imageUrl?: string;
  extractedData?: ParsedContact;
  qrData?: any;
  status: "uploading" | "processing" | "completed" | "error";
  error?: string;
  isFromCamera?: boolean;
  captureIndex?: number;
}

interface Group {
  id: string;
  name: string;
  ownerId: string;
}

// Helper function to add delay between operations
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to validate image file
const validateImageFile = (file: File): boolean => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 20 * 1024 * 1024; // 20MB
  
  if (!validTypes.includes(file.type)) {
    throw new Error(`Invalid file type: ${file.type}. Please upload JPG, PNG, GIF, or WebP images.`);
  }
  
  if (file.size > maxSize) {
    throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 20MB.`);
  }
  
  return true;
};

// Enhanced QR Code detection utility using Canvas
const detectQRCode = async (imageFile: File): Promise<any> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      try {
        const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
        
        if (imageData) {
          // Simple QR pattern detection
          const qrData = detectQRPattern(imageData, img.src);
          resolve(qrData);
        } else {
          resolve(null);
        }
      } catch (error) {
        console.error('QR detection error:', error);
        resolve(null);
      }
    };
    
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(imageFile);
  });
};

// Enhanced QR pattern detection (simplified implementation)
const detectQRPattern = (imageData: ImageData, imageSrc: string) => {
  const { data, width, height } = imageData;
  
  // Look for QR code corner patterns (simplified detection)
  const corners = findQRCorners(data, width, height);
  
  if (corners.length >= 3) {
    // If we found corner patterns, try to decode
    // This is a simplified version - in production, use jsQR library
    return {
      data: generateSampleVCard(), // For demo - replace with actual QR decoding
      location: corners[0]
    };
  }
  
  return null;
};

// Find QR corner detection markers
const findQRCorners = (data: Uint8ClampedArray, width: number, height: number) => {
  const corners = [];
  const threshold = 128;
  
  // Simplified corner detection - look for square patterns
  for (let y = 0; y < height - 20; y += 10) {
    for (let x = 0; x < width - 20; x += 10) {
      if (isQRCornerPattern(data, x, y, width, threshold)) {
        corners.push({ x, y });
      }
    }
  }
  
  return corners;
};

// Check if area contains QR corner pattern
const isQRCornerPattern = (data: Uint8ClampedArray, startX: number, startY: number, width: number, threshold: number) => {
  const patternSize = 7;
  const pattern = [
    [1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1]
  ];
  
  let matches = 0;
  let total = 0;
  
  for (let y = 0; y < patternSize && startY + y < data.length / width / 4; y++) {
    for (let x = 0; x < patternSize && startX + x < width; x++) {
      const pixelIndex = ((startY + y) * width + (startX + x)) * 4;
      if (pixelIndex < data.length) {
        const brightness = (data[pixelIndex] + data[pixelIndex + 1] + data[pixelIndex + 2]) / 3;
        const isBlack = brightness < threshold;
        const expectedBlack = pattern[y][x] === 1;
        
        if (isBlack === expectedBlack) matches++;
        total++;
      }
    }
  }
  
  return matches / total > 0.7; // 70% match threshold
};

// Generate sample vCard for demo (replace with actual QR decoding)
// const generateSampleVCard = () => {
//   return `BEGIN:VCARD
// VERSION:3.0
// FN:John Doe
// ORG:V-KEY Solutions
// TEL:+91 94896 22222
// EMAIL:john@v-key.in
// URL:https://www.v-key.in
// ADR:;;733, Dr. Radhakrishna Road;Tatabad;Coimbatore;641012;India
// END:VCARD`;
// };

// Enhanced vCard/MeCard parsing
const parseVCardData = (qrText: string): Partial<ParsedContact> => {
  const contact: Partial<ParsedContact> = {};
  
  if (qrText.includes('BEGIN:VCARD')) {
    // vCard format
    const lines = qrText.split('\n').map(line => line.trim()).filter(line => line);
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const colonIndex = line.indexOf(':');
        const key = line.substring(0, colonIndex).split(';')[0]; // Handle parameters
        const value = line.substring(colonIndex + 1).trim();
        
        switch (key.toUpperCase()) {
          case 'FN':
          case 'N':
            if (!contact.name && value) {
              contact.name = value.replace(/;/g, ' ').trim();
            }
            break;
          case 'ORG':
            contact.company = value;
            break;
          case 'EMAIL':
            contact.email = value;
            break;
          case 'TEL':
            // Clean phone number
            contact.phone = value.replace(/[^\d+\-\s]/g, '');
            break;
          case 'ADR':
            // Parse address components: PO Box;Extended;Street;City;State;Postal;Country
            const addressParts = value.split(';').filter(part => part.trim());
            contact.address = addressParts.join(', ').replace(/,\s*,/g, ',').trim();
            break;
          case 'URL':
            if (!contact.services) contact.services = '';
            contact.services += (contact.services ? ', ' : '') + `Website: ${value}`;
            break;
          case 'TITLE':
            if (!contact.services) contact.services = '';
            contact.services += (contact.services ? ', ' : '') + `Title: ${value}`;
            break;
        }
      }
    });
  } else if (qrText.startsWith('MECARD:')) {
    // MeCard format
    const data = qrText.substring(7, qrText.length - (qrText.endsWith(';;') ? 2 : 0));
    const fields = data.split(';').filter(field => field.includes(':'));
    
    fields.forEach(field => {
      const [key, ...valueParts] = field.split(':');
      const value = valueParts.join(':').trim();
      
      switch (key.toUpperCase()) {
        case 'N':
          contact.name = value;
          break;
        case 'ORG':
          contact.company = value;
          break;
        case 'EMAIL':
          contact.email = value;
          break;
        case 'TEL':
          contact.phone = value.replace(/[^\d+\-\s]/g, '');
          break;
        case 'ADR':
          contact.address = value.replace(/,/g, ', ');
          break;
        case 'URL':
          if (!contact.services) contact.services = '';
          contact.services += (contact.services ? ', ' : '') + `Website: ${value}`;
          break;
      }
    });
  } else if (qrText.includes('http') || qrText.includes('www')) {
    // Plain URL
    contact.services = `Website: ${qrText}`;
  }
  
  return contact;
};

export default function BulkUploads() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  
  // Enhanced camera states
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [captureCount, setCaptureCount] = useState(0);
  const [cameraMode, setCameraMode] = useState<'capture' | 'processing'>('capture');
  const [pendingCaptures, setPendingCaptures] = useState<UploadResult[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!user) return;
    fetchGroups();
  }, [user]);

  // Cleanup camera stream on component unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const fetchGroups = async () => {
    try {
      const groupsQuery = query(collection(db, "groups"), where("ownerId", "==", user!.uid));
      const groupsSnapshot = await getDocs(groupsQuery);
      const groupsData = groupsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Group[];
      setGroups(groupsData);
    } catch (error) {
      console.error("Error fetching groups:", error);
      toast({
        title: "Warning",
        description: "Could not load groups. You can still process cards.",
        variant: "destructive",
      });
    } finally {
      setLoadingGroups(false);
    }
  };

  const startCamera = async () => {
    try {
      setCameraError(null);
      
      // Stop existing stream if any
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      setCameraStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error: any) {
      console.error('Camera error:', error);
      let errorMessage = 'Failed to access camera';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Camera not supported on this device.';
      }
      
      setCameraError(errorMessage);
      toast({
        title: "Camera Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
    setCameraError(null);
    setCaptureCount(0);
    setCameraMode('capture');
    setPendingCaptures([]);
  };

  const switchCamera = async () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    await startCamera();
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Set canvas size to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob
    canvas.toBlob(async (blob) => {
      if (!blob) return;

      const newCaptureCount = captureCount + 1;
      setCaptureCount(newCaptureCount);
      
      const timestamp = Date.now();
      const file = new File([blob], `camera-capture-${newCaptureCount}-${timestamp}.jpg`, {
        type: 'image/jpeg',
      });

      // Add to pending captures
      const newResult: UploadResult = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        status: "uploading",
        isFromCamera: true,
        captureIndex: newCaptureCount,
      };

      setPendingCaptures(prev => [...prev, newResult]);
      
      toast({
        title: `Photo ${newCaptureCount} Captured`,
        description: "Ready to capture more or process all captures",
      });
    }, 'image/jpeg', 0.9);
  };

  const processAllCaptures = async () => {
    if (pendingCaptures.length === 0) return;
    
    setCameraMode('processing');
    setUploading(true);
    
    // Add all pending captures to upload results
    setUploadResults(prev => [...prev, ...pendingCaptures]);
    
    // Process each capture
    for (let i = 0; i < pendingCaptures.length; i++) {
      const result = pendingCaptures[i];
      
      if (i > 0) {
        await delay(1000); // Delay between processing
      }
      
      await processFile(result);
    }
    
    setUploading(false);
    setPendingCaptures([]);
    setCaptureCount(0);
    setCameraMode('capture');
    
    toast({
      title: "Processing Complete",
      description: `Successfully processed ${pendingCaptures.length} captured images`,
    });
  };

  const clearCaptures = () => {
    setPendingCaptures([]);
    setCaptureCount(0);
    toast({
      title: "Captures Cleared",
      description: "Ready to capture new photos",
    });
  };

  const processFile = async (result: UploadResult) => {
    let imageUrl: string | null = null;
    
    try {
      console.log(`Starting processing for file: ${result.file.name}`);
      
      // Validate file
      validateImageFile(result.file);

      // Update status to uploading
      setUploadResults(prev => prev.map(r => 
        r.id === result.id ? { ...r, status: "uploading" } : r
      ));

      // Upload to Firebase Storage with timestamp to avoid conflicts
      const timestamp = Date.now();
      const sanitizedFileName = result.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}-${sanitizedFileName}`;
      
      console.log(`Uploading image to storage: ${fileName}`);
      imageUrl = await uploadToStorage(
        result.file, 
        `users/${user!.uid}/bulk/${fileName}`
      );

      console.log(`Image uploaded successfully: ${imageUrl.substring(0, 50)}...`);

      // Update status to processing with image URL
      setUploadResults(prev => prev.map(r => 
        r.id === result.id ? { ...r, imageUrl, status: "processing" } : r
      ));

      // Wait for image to be fully accessible
      await delay(1000);

      // Enhanced QR code detection
      console.log(`Checking for QR codes in ${result.file.name}`);
      const qrData = await detectQRCode(result.file);
      
      let extractedData: ParsedContact;
      
      if (qrData && qrData.data) {
        console.log(`QR code detected: ${qrData.data.substring(0, 100)}...`);
        
        // Parse vCard/MeCard data
        const qrContact = parseVCardData(qrData.data);
        
        // Still run OCR to get additional visible information
        try {
          const ocrData = await callGeminiAPIWithRetry(result.file, 3);
          
          // Merge QR data with OCR data (QR data takes precedence for structured fields)
          extractedData = {
            name: qrContact.name || ocrData.name || "",
            company: qrContact.company || ocrData.company || "",
            email: qrContact.email || ocrData.email || "",
            phone: qrContact.phone || ocrData.phone || "",
            address: qrContact.address || ocrData.address || "",
            services: [qrContact.services, ocrData.services].filter(Boolean).join(', ') || "",
          };
        } catch (ocrError) {
          console.warn('OCR failed, using QR data only:', ocrError);
          extractedData = {
            name: qrContact.name || "",
            company: qrContact.company || "",
            email: qrContact.email || "",
            phone: qrContact.phone || "",
            address: qrContact.address || "",
            services: qrContact.services || "",
          };
        }
        
        console.log(`Combined QR and OCR data for ${result.file.name}:`, extractedData);
      } else {
        console.log(`No QR code found, using OCR for ${result.file.name}`);
        extractedData = await callGeminiAPIWithRetry(result.file, 3);
      }

      console.log(`Data extracted successfully for ${result.file.name}:`, extractedData);

      // Update status to completed
      setUploadResults(prev => prev.map(r => 
        r.id === result.id ? { ...r, extractedData, qrData, status: "completed" } : r
      ));

    } catch (error: any) {
      console.error(`Error processing file ${result.file.name}:`, error);
      
      let errorMessage = 'Unknown error occurred';
      
      // Enhanced error handling
      if (error.message?.includes('Failed to read file')) {
        errorMessage = 'Could not read the image file. Please try a different image.';
      } else if (error.message?.includes('API key') || error.message?.includes('401')) {
        errorMessage = 'API key issue. Please check your Gemini API configuration.';
      } else if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        errorMessage = 'API rate limit exceeded. Please try again in a few minutes.';
      } else if (error.message?.includes('403')) {
        errorMessage = 'API access forbidden. Please check your API key permissions.';
      } else if (error.message?.includes('timeout') || error.message?.includes('AbortError')) {
        errorMessage = 'Request timeout. Please try again with a smaller image.';
      } else if (error.message?.includes('fetch') || error.message?.includes('Network')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message?.includes('Invalid file type')) {
        errorMessage = error.message;
      } else if (error.message?.includes('File too large')) {
        errorMessage = error.message;
      } else if (error.message?.includes('storage')) {
        errorMessage = 'Storage error. Please check your Firebase configuration.';
      } else if (error.message?.includes('parse') || error.message?.includes('JSON')) {
        errorMessage = 'Could not extract data from image. Please try a clearer image.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setUploadResults(prev => prev.map(r => 
        r.id === result.id ? { ...r, status: "error", error: errorMessage } : r
      ));
    }
  };

  const handleFileSelect = async (files: FileList) => {
    if (files.length > 10) {
      toast({
        title: "Too many files",
        description: "Please select up to 10 images to avoid rate limits and ensure better performance",
        variant: "destructive",
      });
      return;
    }

    // Validate all files first
    try {
      Array.from(files).forEach(file => validateImageFile(file));
    } catch (error: any) {
      toast({
        title: "Invalid file",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    const newResults: UploadResult[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: "uploading",
    }));

    setUploadResults(prev => [...prev, ...newResults]);

    // Process files sequentially with delays to respect rate limits
    for (let i = 0; i < newResults.length; i++) {
      const result = newResults[i];
      
      // Add delay between files (except for the first one)
      if (i > 0) {
        console.log(`Waiting 2 seconds before processing next file...`);
        await delay(2000);
      }

      await processFile(result);
    }

    setUploading(false);
    
    // Show completion toast
    const completedCount = newResults.filter(r => r.status === 'completed').length;
    
    toast({
      title: "Processing Complete",
      description: `Successfully processed ${completedCount} out of ${newResults.length} files`,
    });
  };

  const handleRemoveItem = (id: string) => {
    setUploadResults(prev => prev.filter(r => r.id !== id));
  };

  const handleSaveAllContacts = async () => {
    const completedResults = uploadResults.filter(r => r.status === "completed" && r.extractedData);
    
    if (completedResults.length === 0) {
      toast({
        title: "No contacts to save",
        description: "Please wait for processing to complete",
        variant: "destructive",
      });
      return;
    }
    
    try {
      let savedCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;

      for (const result of completedResults) {
        try {
          const data = result.extractedData!;
          
          // Check for duplicates only if email or phone is available
          if (data.email || data.phone) {
            const isDupe = await isDuplicateContact(user!.uid, data.email, data.phone);
            if (isDupe) {
              duplicateCount++;
              continue;
            }
          }

          // Create contact with selected groups
          await addDoc(collection(db, "contacts"), {
            firstName: data.name?.split(' ')[0] || "",
            lastName: data.name?.split(' ').slice(1).join(' ') || "",
            phone: data.phone || "",
            email: data.email?.toLowerCase() || "",
            company: data.company || "",
            services: data.services || "",
            address: data.address || "",
            groupIds: selectedGroupIds,
            ownerId: user!.uid,
            createdAt: serverTimestamp(),
            // Add metadata for tracking
            source: result.isFromCamera ? 'camera' : 'upload',
            hasQRData: !!result.qrData,
            qrContent: result.qrData?.data || null,
          });

          savedCount++;
        } catch (contactError) {
          console.error('Error saving individual contact:', contactError);
          errorCount++;
        }
      }

      let successMessage = `Saved ${savedCount} contact${savedCount !== 1 ? 's' : ''}`;
      if (selectedGroupIds.length > 0) {
        const groupNames = groups.filter(g => selectedGroupIds.includes(g.id)).map(g => g.name).join(', ');
        successMessage += ` to group${selectedGroupIds.length > 1 ? 's' : ''}: ${groupNames}`;
      }
      if (duplicateCount > 0) {
        successMessage += `, skipped ${duplicateCount} duplicate${duplicateCount !== 1 ? 's' : ''}`;
      }
      if (errorCount > 0) {
        successMessage += `, ${errorCount} error${errorCount !== 1 ? 's' : ''}`;
      }
      
      toast({
        title: "Success",
        description: successMessage,
      });

      // Clear results after saving
      setUploadResults([]);
      setSelectedGroupIds([]);
      
    } catch (error) {
      console.error("Error saving contacts:", error);
      toast({
        title: "Error",
        description: "Failed to save contacts. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "uploading":
      case "processing":
        return (
          <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
            <Clock className="h-3 w-3 text-yellow-600 animate-spin" />
          </div>
        );
      case "completed":
        return (
          <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
            <Check className="h-3 w-3 text-green-600" />
          </div>
        );
      case "error":
        return (
          <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="h-3 w-3 text-red-600" />
          </div>
        );
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "uploading":
        return "Uploading...";
      case "processing":
        return "Processing...";
      case "completed":
        return "Processed";
      case "error":
        return "Error";
      default:
        return "";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "uploading":
      case "processing":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "completed":
        return "bg-green-50 text-green-700 border-green-200";
      case "error":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Sparkles className="text-white h-6 w-6" />
              </div>
              <div>
                <h2 className="text-3xl font-bold leading-7 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent sm:text-4xl sm:truncate">
                  AI Card Scanner
                </h2>
                <p className="mt-1 text-lg text-gray-600">Extract data from multiple business cards instantly</p>
              </div>
            </div>
            
            {/* AI Features Banner */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-3 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
                <Brain className="h-8 w-8 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-blue-900">AI-Powered</h3>
                  <p className="text-sm text-blue-700">Advanced text recognition</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
                <Camera className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-900">Camera Ready</h3>
                  <p className="text-sm text-green-700">Multiple capture support</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 bg-gradient-to-r from-purple-50 to-violet-50 p-4 rounded-xl border border-purple-200">
                <QrCode className="h-8 w-8 text-purple-600" />
                <div>
                  <h3 className="font-semibold text-purple-900">QR Support</h3>
                  <p className="text-sm text-purple-700">vCard & MeCard detection</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-xl border border-amber-200">
                <CheckCircle2 className="h-8 w-8 text-amber-600" />
                <div>
                  <h3 className="font-semibold text-amber-900">Smart Detection</h3>
                  <p className="text-sm text-amber-700">Automatic duplicate check</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Upload Zone */}
        <div className="mt-8">
          <Card className="overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-white to-gray-50">
            <CardContent className="p-0">
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileImage className="h-6 w-6" />
                    <h3 className="text-lg font-semibold">Smart Upload Zone</h3>
                  </div>
                  <div className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
                    {uploadResults.length > 0 ? `${uploadResults.length}/10 files` : 'Ready'}
                  </div>
                </div>
              </div>
              
              {/* Upload Area */}
              <div 
                className="p-8 border-2 border-dashed border-purple-200 m-6 rounded-2xl hover:border-purple-400 transition-all duration-300 hover:bg-purple-50/50"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const files = e.dataTransfer.files;
                  if (files.length > 0) handleFileSelect(files);
                }}
              >
                <div className="text-center">
                  <div className="mx-auto w-20 h-20 flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl mb-6">
                    <CloudUpload className="text-purple-600 h-10 w-10" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Drop Your Business Cards Here</h3>
                 <p className="text-sm text-gray-500">drag and drop or Use camera</p>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG, WebP up to 20MB each • Max 10 files</p>
                      <p className="text-xs text-purple-600 mt-1 flex items-center justify-center">
                        {/* <QrCode className="h-3 w-3 mr-1" />
                        QR codes automatically detected */}
                      </p>
                      <p className="text-xs text-purple-600 mt-1 flex items-center justify-center">
                        {/* <QrCode className="h-3 w-3 mr-1" />
                        QR codes automatically detected */}
                      </p>
                      <p className="text-xs text-purple-600 mt-1 flex items-center justify-center">
                        {/* <QrCode className="h-3 w-3 mr-1" />
                        QR codes automatically detected */}
                      </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <Button 
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.multiple = true;
                        input.accept = 'image/jpeg,image/png,image/gif,image/webp';
                        input.onchange = (e) => {
                          const files = (e.target as HTMLInputElement).files;
                          if (files) handleFileSelect(files);
                        };
                        input.click();
                      }}
                      disabled={uploading}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg disabled:opacity-50"
                    >
                      <CloudUpload className="h-5 w-5 mr-2" />
                      {uploading ? 'Processing...' : 'Choose Files'}
                    </Button>
                    
                    <Dialog open={showCamera} onOpenChange={setShowCamera}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowCamera(true);
                            startCamera();
                          }}
                          disabled={uploading}
                          className="border-purple-300 text-purple-600 hover:bg-purple-50 px-8 py-3 rounded-xl font-semibold"
                        >
                          <Camera className="h-5 w-5 mr-2" />
                          Use Camera
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[900px] max-h-[90vh]">
                        <DialogHeader>
                          <DialogTitle className="flex items-center space-x-2">
                            <Camera className="h-5 w-5" />
                            <span>Capture Business Cards</span>
                            {pendingCaptures.length > 0 && (
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                                {pendingCaptures.length} captured
                              </span>
                            )}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          {cameraError ? (
                            <div className="text-center py-12">
                              <CameraOff className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                              <p className="text-red-600 mb-4">{cameraError}</p>
                              <Button onClick={startCamera} variant="outline">
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Try Again
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="relative bg-black rounded-lg overflow-hidden">
                                <video
                                  ref={videoRef}
                                  autoPlay
                                  playsInline
                                  muted
                                  className="w-full h-96 object-cover"
                                />
                                {/* Camera overlay */}
                                <div className="absolute inset-0 pointer-events-none">
                                  <div className="absolute inset-4 border-2 border-white/50 rounded-lg">
                                    <ScanLine className="absolute top-2 left-2 h-6 w-6 text-white/75" />
                                    <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-white/75 text-sm font-medium">
                                      Position card within frame ({captureCount}/10)
                                    </div>
                                    {pendingCaptures.length > 0 && (
                                      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-white/75 text-xs">
                                        {pendingCaptures.length} card{pendingCaptures.length > 1 ? 's' : ''} ready to process
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Pending captures preview */}
                              {pendingCaptures.length > 0 && (
                                <div className="bg-gray-50 rounded-lg p-4">
                                  <h4 className="text-sm font-medium text-gray-900 mb-3">Captured Photos ({pendingCaptures.length})</h4>
                                  <div className="flex space-x-2 overflow-x-auto">
                                    {pendingCaptures.map((capture, index) => (
                                      <div key={capture.id} className="flex-shrink-0 relative">
                                        <div className="w-16 h-10 bg-gray-200 rounded border-2 border-green-300 flex items-center justify-center">
                                          <Camera className="h-4 w-4 text-green-600" />
                                        </div>
                                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                          {index + 1}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {cameraMode === 'capture' ? (
                                <div className="flex justify-center space-x-4">
                                  <Button
                                    onClick={switchCamera}
                                    variant="outline"
                                    size="sm"
                                  >
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Switch Camera
                                  </Button>
                                  <Button
                                    onClick={capturePhoto}
                                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 px-8"
                                    disabled={!cameraStream || captureCount >= 10}
                                  >
                                    <Camera className="h-4 w-4 mr-2" />
                                    Capture ({captureCount}/10)
                                  </Button>
                                  {pendingCaptures.length > 0 && (
                                    <>
                                      <Button
                                        onClick={processAllCaptures}
                                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-6"
                                      >
                                        <ArrowRight className="h-4 w-4 mr-2" />
                                        Process All ({pendingCaptures.length})
                                      </Button>
                                      <Button
                                        onClick={clearCaptures}
                                        variant="outline"
                                        size="sm"
                                      >
                                        Clear
                                      </Button>
                                    </>
                                  )}
                                  <Button
                                    onClick={stopCamera}
                                    variant="outline"
                                    size="sm"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <div className="text-center py-8">
                                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing Captures</h3>
                                  <p className="text-gray-600">Please wait while we extract contact information...</p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                    
                    {/* <div className="text-center">
                      <p className="text-sm text-gray-500">Or drag and drop • Use camera</p>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG, WebP up to 20MB each • Max 10 files</p>
                      <p className="text-xs text-purple-600 mt-1 flex items-center justify-center">
                        <QrCode className="h-3 w-3 mr-1" />
                        QR codes automatically detected
                      </p>
                    </div> */}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Processing Results */}
        {uploadResults.length > 0 && (
          <div className="mt-8">
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50">
              <CardContent className="p-0">
                {/* Results Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Brain className="h-6 w-6" />
                      <h3 className="text-lg font-semibold">AI Processing Results</h3>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-sm">
                        <span className="font-medium">{uploadResults.filter(r => r.status === 'completed').length}</span>
                        <span className="opacity-75"> / {uploadResults.length} completed</span>
                      </div>
                      <Progress 
                        value={(uploadResults.filter(r => r.status === 'completed').length / uploadResults.length) * 100}
                        className="w-24 h-2"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  {uploadResults.map((result) => (
                    <div key={result.id} className="bg-white border-2 border-gray-100 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          {result.imageUrl ? (
                            <div className="relative">
                              <img 
                                src={result.imageUrl} 
                                alt="Business card" 
                                className="w-28 h-18 object-cover rounded-xl shadow-md"
                              />
                              <div className="absolute -top-2 -right-2">
                                {getStatusIcon(result.status)}
                              </div>
                              {result.isFromCamera && (
                                <div className="absolute -top-2 -left-2 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                                  <Camera className="h-3 w-3 text-green-600" />
                                </div>
                              )}
                              {result.qrData && (
                                <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                                  <QrCode className="h-3 w-3 text-purple-600" />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="w-28 h-18 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center relative">
                              <CloudUpload className="h-8 w-8 text-gray-400" />
                              <div className="absolute -top-2 -right-2">
                                {getStatusIcon(result.status)}
                              </div>
                              {result.isFromCamera && (
                                <div className="absolute -top-2 -left-2 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                                  <Camera className="h-3 w-3 text-green-600" />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {result.file.name}
                              {result.isFromCamera && result.captureIndex && (
                                <span className="text-green-600 ml-1 text-xs">(#{result.captureIndex})</span>
                              )}
                              {result.qrData && <span className="text-purple-600 ml-1">QR</span>}
                            </p>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(result.status)}`}>
                              <span className="ml-1">{getStatusText(result.status)}</span>
                            </span>
                          </div>
                          
                          {result.status === "completed" && result.extractedData && (
                            <div className="space-y-1 text-sm text-gray-600">
                              <p><strong>Name:</strong> {result.extractedData.name || "Not found"}</p>
                              <p><strong>Company:</strong> {result.extractedData.company || "Not found"}</p>
                              <p><strong>Email:</strong> {result.extractedData.email || "Not found"}</p>
                              <p><strong>Phone:</strong> {result.extractedData.phone || "Not found"}</p>
                              {result.extractedData.address && (
                                <p><strong>Address:</strong> {result.extractedData.address}</p>
                              )}
                              {result.extractedData.services && (
                                <p><strong>Services:</strong> {result.extractedData.services}</p>
                              )}
                              {result.qrData && (
                                <div className="mt-2 p-2 bg-purple-50 rounded-lg">
                                  <p className="text-xs text-purple-600 font-medium flex items-center">
                                    <QrCode className="h-3 w-3 mr-1" />
                                    QR Code Data Detected & Parsed
                                  </p>
                                  <p className="text-xs text-purple-500 mt-1 truncate">
                                    {result.qrData.data.substring(0, 80)}...
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {result.status === "error" && (
                            <div className="text-sm text-red-600">
                              <p><strong>Error:</strong> {result.error}</p>
                            </div>
                          )}
                          
                          <div className="mt-3 flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(result.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Group Assignment Section */}
                {!loadingGroups && groups.length > 0 && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      Assign to Groups (Optional)
                    </h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {groups.map(group => (
                        <div key={group.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`bulk-group-${group.id}`}
                            checked={selectedGroupIds.includes(group.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedGroupIds(prev => [...prev, group.id]);
                              } else {
                                setSelectedGroupIds(prev => prev.filter(id => id !== group.id));
                              }
                            }}
                          />
                          <label htmlFor={`bulk-group-${group.id}`} className="text-sm cursor-pointer">
                            {group.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    <span>
                      {uploadResults.filter(r => r.status === "completed").length} of {uploadResults.length} cards processed
                    </span>
                    {uploadResults.some(r => r.qrData) && (
                      <span className="block text-xs text-purple-600 flex items-center mt-1">
                        <QrCode className="h-3 w-3 mr-1" />
                        {uploadResults.filter(r => r.qrData).length} with QR code data
                      </span>
                    )}
                    {uploadResults.some(r => r.isFromCamera) && (
                      <span className="block text-xs text-green-600 flex items-center mt-1">
                        <Camera className="h-3 w-3 mr-1" />
                        {uploadResults.filter(r => r.isFromCamera).length} from camera
                      </span>
                    )}
                    {selectedGroupIds.length > 0 && (
                      <span className="block text-xs text-blue-600">
                        Will be assigned to {selectedGroupIds.length} group{selectedGroupIds.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-3">
                    <Button
                      onClick={() => {
                        setUploadResults([]);
                        setSelectedGroupIds([]);
                      }}
                      variant="outline"
                      disabled={uploadResults.length === 0}
                    >
                      Clear All
                    </Button>
                    <Button
                      onClick={handleSaveAllContacts}
                      disabled={uploadResults.filter(r => r.status === "completed").length === 0}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save All Contacts ({uploadResults.filter(r => r.status === "completed").length})
                    </Button>
                  </div>
                </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Hidden canvas for camera capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}