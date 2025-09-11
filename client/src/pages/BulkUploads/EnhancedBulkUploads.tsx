import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, addDoc, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { processMultipleBusinessCards, validateImageFile, type MultiCardResult } from "@/utils/multiCardOcr";
import { uploadToStorage } from "@/utils/upload";
import { isDuplicateContact } from "@/utils/duplicate";
import type { ParsedContact } from "@/utils/parse";
import { useUsageLimits } from "@/hooks/useUsageLimits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import CameraCapture from "@/components/CameraCapture";
import UsageLimitModal from "@/components/UsageLimitModal";
import { 
  Upload, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Users, 
  FileText, 
  Camera,
  AlertTriangle,
  Eye,
  Edit,
  Save,
  X,
  Smartphone,
  Sparkles,
  Zap,
  CloudUpload,
  Check,
  Clock,
  Brain,
  FileImage,
  AlertCircle,
  CheckCircle2,
  QrCode,
  ScanLine,
  CameraOff,
  RotateCcw,
  ArrowRight
} from "lucide-react";

interface ProcessedCard extends ParsedContact {
  id: string;
  status: 'success' | 'error' | 'duplicate';
  error?: string;
  saved?: boolean;
  isFromCamera?: boolean;
  captureIndex?: number;
  imageUrl?: string;
}

interface Group {
  id: string;
  name: string;
  ownerId: string;
}

interface UploadResult {
  id: string;
  file: File;
  imageUrl?: string;
  status: "uploading" | "processing" | "completed" | "error";
  error?: string;
  isFromCamera?: boolean;
  captureIndex?: number;
}

// Helper function to add delay between operations
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function EnhancedBulkUploads() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { usage, limits, hasActiveSubscription, canUseAIScan, loading: limitsLoading, refreshUsage } = useUsageLimits();
  
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState<ProcessedCard[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [editingCard, setEditingCard] = useState<ProcessedCard | null>(null);
  const [editData, setEditData] = useState<ParsedContact>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  
  // Enhanced camera and upload states
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
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
    
    // Convert captures to files array
    const captureFiles = pendingCaptures.map(capture => capture.file);
    setFiles(prev => [...prev, ...captureFiles]);
    
    // Start processing
    await processFiles();
    
    setUploading(false);
    setPendingCaptures([]);
    setCaptureCount(0);
    setCameraMode('capture');
    stopCamera();
    
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

  const checkUsageLimit = () => {
    if (!canUseAIScan) {
      setShowLimitModal(true);
      return false;
    }
    return true;
  };

  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    
    const fileArray = Array.from(selectedFiles);
    const validFiles: File[] = [];
    
    fileArray.forEach(file => {
      try {
        validateImageFile(file);
        validFiles.push(file);
      } catch (error: any) {
        toast({
          title: "Invalid File",
          description: `${file.name}: ${error.message}`,
          variant: "destructive",
        });
      }
    });
    
    setFiles(prev => [...prev, ...validFiles]);
  }, [toast]);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processFiles = async () => {
    if (!user || files.length === 0) return;
    
    if (!checkUsageLimit()) {
      return;
    }
    
    setProcessing(true);
    setProgress(0);
    const results: ProcessedCard[] = [];
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setCurrentFile(file.name);
        setProgress((i / files.length) * 100);
        
        try {
          console.log(`Processing file ${i + 1}/${files.length}: ${file.name}`);
          
          // Upload to Firebase Storage first
          const timestamp = Date.now();
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const fileName = `${timestamp}-${sanitizedFileName}`;
          const imageUrl = await uploadToStorage(
            file, 
            `users/${user!.uid}/bulk/${fileName}`
          );

          // Process with multi-card detection
          const result: MultiCardResult = await processMultipleBusinessCards(file);
          
          // Process each detected card
          result.cards.forEach((card, cardIndex) => {
            const processedCard: ProcessedCard = {
              ...card,
              id: `${file.name}_card_${cardIndex + 1}`,
              status: 'success',
              imageUrl,
              isFromCamera: file.name.includes('camera-capture')
            };
            results.push(processedCard);
          });
          
          // Add errors if any
          if (result.errors.length > 0) {
            result.errors.forEach((error, errorIndex) => {
              results.push({
                id: `${file.name}_error_${errorIndex}`,
                status: 'error',
                error: error,
                imageUrl
              });
            });
          }
          
          console.log(`Successfully processed ${result.totalProcessed} cards from ${file.name}`);
          
        } catch (error: any) {
          console.error(`Error processing ${file.name}:`, error);
          results.push({
            id: `${file.name}_failed`,
            status: 'error',
            error: error.message || "Failed to process image"
          });
        }

        // Add delay between files
        if (i < files.length - 1) {
          await delay(1000);
        }
      }
      
      setProgress(100);
      setProcessed(results);
      setShowResults(true);
      
      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'error').length;
      
      toast({
        title: "Processing Complete",
        description: `Successfully processed ${successCount} cards${errorCount > 0 ? `, ${errorCount} errors` : ''}`,
      });
      
    } catch (error: any) {
      console.error("Bulk processing error:", error);
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process files",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      setCurrentFile("");
    }
  };

  const saveContact = async (card: ProcessedCard) => {
    if (!user) return;
    
    setSaving(card.id);
    
    try {
      // Check for duplicates
      if (card.email || card.phones?.length) {
        const isDupe = await isDuplicateContact(
          user.uid, 
          card.email, 
          card.phones || []
        );
        if (isDupe) {
          toast({
            title: "Duplicate Contact",
            description: `${card.name || 'Contact'} already exists`,
            variant: "destructive",
          });
          setSaving(null);
          return;
        }
      }

      await addDoc(collection(db, "contacts"), {
        firstName: card.name?.split(' ')[0] || "",
        lastName: card.name?.split(' ').slice(1).join(' ') || "",
        phone: card.phones?.[0] || card.landlines?.[0] || "",
        email: card.email?.toLowerCase() || "",
        company: card.company || "",
        services: card.services || "",
        address: card.address || "",
        groupIds: selectedGroupIds,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        source: card.isFromCamera ? 'camera' : 'bulk_scan',
        hasQRData: !!(card.qrCodes && card.qrCodes.length > 0),
        qrContent: card.qrCodes?.[0]?.data || null,
      });
      
      setProcessed(prev => 
        prev.map(p => 
          p.id === card.id ? { ...p, saved: true } : p
        )
      );
      
      toast({
        title: "Contact Saved",
        description: `${card.name || 'Contact'} has been saved successfully`,
      });
      
      // Refresh usage after saving
      await refreshUsage();
      
    } catch (error) {
      console.error("Error saving contact:", error);
      toast({
        title: "Save Failed",
        description: "Failed to save contact",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const saveAllContacts = async () => {
    if (!user) return;
    
    const unsavedCards = processed.filter(card => card.status === 'success' && !card.saved);
    
    let savedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (const card of unsavedCards) {
      try {
        // Check for duplicates
        if (card.email || card.phones?.length) {
          const isDupe = await isDuplicateContact(
            user.uid, 
            card.email, 
            card.phones || []
          );
          if (isDupe) {
            duplicateCount++;
            continue;
          }
        }

        await addDoc(collection(db, "contacts"), {
          firstName: card.name?.split(' ')[0] || "",
          lastName: card.name?.split(' ').slice(1).join(' ') || "",
          phone: card.phones?.[0] || card.landlines?.[0] || "",
          email: card.email?.toLowerCase() || "",
          company: card.company || "",
          services: card.services || "",
          address: card.address || "",
          groupIds: selectedGroupIds,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          source: card.isFromCamera ? 'camera' : 'bulk_scan',
          hasQRData: !!(card.qrCodes && card.qrCodes.length > 0),
          qrContent: card.qrCodes?.[0]?.data || null,
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

    // Update saved status
    setProcessed(prev => 
      prev.map(p => 
        p.status === 'success' && !p.saved ? { ...p, saved: true } : p
      )
    );
    
    // Refresh usage after saving all
    await refreshUsage();
  };

  const handleEditCard = (card: ProcessedCard) => {
    setEditingCard(card);
    setEditData({ ...card });
  };

  const saveEditedCard = () => {
    if (!editingCard) return;
    
    setProcessed(prev =>
      prev.map(p =>
        p.id === editingCard.id ? { ...p, ...editData } : p
      )
    );
    
    setEditingCard(null);
    setEditData({});
    
    toast({
      title: "Changes Saved",
      description: "Contact information updated successfully",
    });
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
      case "success":
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "uploading":
      case "processing":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "completed":
      case "success":
        return "bg-green-50 text-green-700 border-green-200";
      case "error":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  if (limitsLoading) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
            <div className="h-64 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Processing Results</h2>
              <p className="text-gray-600">
                Found {processed.filter(p => p.status === 'success').length} business cards
              </p>
            </div>
            <div className="flex space-x-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowResults(false);
                  setProcessed([]);
                  setFiles([]);
                }}
              >
                Process More
              </Button>
              <Button onClick={saveAllContacts}>
                Save All Contacts
              </Button>
            </div>
          </div>

          {/* Group Assignment Section */}
          {!loadingGroups && groups.length > 0 && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  Assign to Groups (Optional)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {groups.map(group => (
                    <div key={group.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`group-${group.id}`}
                        checked={selectedGroupIds.includes(group.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedGroupIds(prev => [...prev, group.id]);
                          } else {
                            setSelectedGroupIds(prev => prev.filter(id => id !== group.id));
                          }
                        }}
                      />
                      <label htmlFor={`group-${group.id}`} className="text-sm cursor-pointer">
                        {group.name}
                      </label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-6">
            {processed.map((card, index) => (
              <Card key={card.id} className={`${
                card.status === 'error' ? 'border-red-200 bg-red-50' : 
                card.saved ? 'border-green-200 bg-green-50' : 'border-gray-200'
              }`}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center text-lg">
                      {card.status === 'error' ? (
                        <XCircle className="h-5 w-5 text-red-500 mr-2" />
                      ) : card.saved ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      ) : (
                        <Camera className="h-5 w-5 text-blue-500 mr-2" />
                      )}
                      {card.status === 'error' ? 'Processing Error' : card.name || 'Unnamed Contact'}
                      {card.isFromCamera && (
                        <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          Camera
                        </span>
                      )}
                      {card.qrCodes && card.qrCodes.length > 0 && (
                        <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                          QR
                        </span>
                      )}
                    </CardTitle>
                    {card.status === 'success' && !card.saved && (
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditCard(card)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => saveContact(card)}
                          disabled={saving === card.id}
                        >
                          {saving === card.id ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-1" />
                          )}
                          Save
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {card.status === 'error' ? (
                    <div className="text-red-600">
                      <AlertTriangle className="h-4 w-4 inline mr-2" />
                      {card.error}
                    </div>
                  ) : (
                    <div className="flex space-x-4">
                      {card.imageUrl && (
                        <div className="flex-shrink-0">
                          <img 
                            src={card.imageUrl} 
                            alt="Business card" 
                            className="w-32 h-20 object-cover rounded-lg shadow-md"
                          />
                        </div>
                      )}
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Company</Label>
                          <p className="mt-1">{card.company || "Not provided"}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Email</Label>
                          <p className="mt-1">{card.email || "Not provided"}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Phone Numbers</Label>
                          <p className="mt-1">
                            {card.phones && card.phones.length > 0 
                              ? card.phones.join(", ") 
                              : "Not provided"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Landlines</Label>
                          <p className="mt-1">
                            {card.landlines && card.landlines.length > 0 
                              ? card.landlines.join(", ") 
                              : "Not provided"}
                          </p>
                        </div>
                        {card.services && (
                          <div className="md:col-span-2">
                            <Label className="text-sm font-medium text-gray-500">Services/Position</Label>
                            <p className="mt-1">{card.services}</p>
                          </div>
                        )}
                        {card.address && (
                          <div className="md:col-span-2">
                            <Label className="text-sm font-medium text-gray-500">Address</Label>
                            <p className="mt-1">{card.address}</p>
                          </div>
                        )}
                        {card.qrCodes && card.qrCodes.length > 0 && (
                          <div className="md:col-span-2">
                            <Label className="text-sm font-medium text-gray-500">QR Code Data</Label>
                            <div className="mt-1 space-y-2">
                              {card.qrCodes.map((qr, idx) => (
                                <div key={idx} className="bg-purple-100 p-2 rounded text-sm">
                                  <span className="font-medium capitalize">{qr.type}:</span> {qr.data}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!editingCard} onOpenChange={() => setEditingCard(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Contact Information</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editData.name || ""}
                  onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-company">Company</Label>
                <Input
                  id="edit-company"
                  value={editData.company || ""}
                  onChange={(e) => setEditData(prev => ({ ...prev, company: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editData.email || ""}
                  onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-phones">Phone Numbers (comma-separated)</Label>
                <Input
                  id="edit-phones"
                  value={editData.phones?.join(", ") || ""}
                  onChange={(e) => setEditData(prev => ({ 
                    ...prev, 
                    phones: e.target.value.split(",").map(p => p.trim()).filter(p => p)
                  }))}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="edit-services">Services/Position</Label>
                <Textarea
                  id="edit-services"
                  value={editData.services || ""}
                  onChange={(e) => setEditData(prev => ({ ...prev, services: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="edit-address">Address</Label>
                <Textarea
                  id="edit-address"
                  value={editData.address || ""}
                  onChange={(e) => setEditData(prev => ({ ...prev, address: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={() => setEditingCard(null)}>
                Cancel
              </Button>
              <Button onClick={saveEditedCard}>
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Sparkles className="text-white h-6 w-6" />
            </div>
            <div>
              <h2 className="text-3xl font-bold leading-7 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent sm:text-4xl sm:truncate">
                AI Business Card Scanner
              </h2>
              <p className="mt-1 text-lg text-gray-600">
                Extract data from multiple business cards with advanced AI detection
              </p>
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
                <h3 className="font-semibold text-green-900">Multi-Card Detection</h3>
                <p className="text-sm text-green-700">Process multiple cards at once</p>
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
          
          {/* Usage Status */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200 mt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Zap className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">
                    {hasActiveSubscription ? 'Premium Plan Active' : 'Free Plan'}
                  </p>
                  <p className="text-sm text-blue-700">
                    {hasActiveSubscription 
                      ? 'Unlimited AI scans available' 
                      : `${usage.aiScansCount}/${limits.aiScans} AI scans used`
                    }
                  </p>
                </div>
              </div>
              {!canUseAIScan && (
                <Button 
                  size="sm" 
                  onClick={() => setShowLimitModal(true)}
                  className="bg-gradient-to-r from-blue-600 to-purple-600"
                >
                  Upgrade Now
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Upload Zone */}
        <Card className="overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-white to-gray-50 mb-8">
          <CardContent className="p-0">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileImage className="h-6 w-6" />
                  <h3 className="text-lg font-semibold">Smart Upload Zone</h3>
                </div>
                <div className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
                  {files.length > 0 ? `${files.length}/10 files` : 'Ready'}
                </div>
              </div>
            </div>
            
            {/* Upload Area */}
            <div 
              className="p-8 border-2 border-dashed border-purple-200 m-6 rounded-2xl hover:border-purple-400 transition-all duration-300 hover:bg-purple-50/50"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (checkUsageLimit()) {
                  handleFileSelect(e.dataTransfer.files);
                }
              }}
            >
              <div className="text-center">
                <div className="mx-auto w-20 h-20 flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl mb-6">
                  <CloudUpload className="text-purple-600 h-10 w-10" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Drop Your Business Cards Here</h3>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Button 
                    onClick={() => {
                      if (checkUsageLimit()) {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.multiple = true;
                        input.accept = 'image/jpeg,image/png,image/gif,image/webp';
                        input.onchange = (e) => {
                          const files = (e.target as HTMLInputElement).files;
                          if (files) handleFileSelect(files);
                        };
                        input.click();
                      }
                    }}
                    disabled={processing}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-md disabled:opacity-50 transition-all duration-200"
                    size="sm"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CloudUpload className="h-4 w-4 mr-2" />
                        Process
                      </>
                    )}
                  </Button>
                  
                  <Dialog open={showCamera} onOpenChange={setShowCamera}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (checkUsageLimit()) {
                            setShowCamera(true);
                            startCamera();
                          }
                        }}
                        disabled={processing}
                        className="border-blue-300 text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg font-medium transition-all duration-200"
                        size="sm"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Camera
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
                </div>
                
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-500">Or drag and drop files</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG, WebP up to 10MB each • Max 10 files</p>
                  <p className="text-xs text-purple-600 mt-1 flex items-center justify-center">
                    <QrCode className="h-3 w-3 mr-1" />
                    QR codes automatically detected
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected Files */}
        {files.length > 0 && (
          <Card className="mb-8 border-0 shadow-xl bg-gradient-to-br from-white to-gray-50">
            <CardContent className="p-0">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-6 w-6" />
                    <h3 className="text-lg font-semibold">Selected Files ({files.length})</h3>
                  </div>
                  <div className="text-sm opacity-90">
                    Ready for processing
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center">
                        <Camera className="h-4 w-4 text-gray-500 mr-2" />
                        <span className="text-sm font-medium">{file.name}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                        {file.name.includes('camera-capture') && (
                          <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            Camera
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        disabled={processing}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6">
                  <Button
                    onClick={processFiles}
                    disabled={processing || files.length === 0}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 text-lg font-semibold"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Processing {currentFile}...
                      </>
                    ) : (
                      <>
                        <Brain className="h-5 w-5 mr-2" />
                        Process {files.length} Image{files.length !== 1 ? 's' : ''} with AI
                      </>
                    )}
                  </Button>
                  
                  {processing && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between text-xs text-blue-700 mb-2">
                        <span className="flex items-center">
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          Processing
                        </span>
                        <span className="font-medium">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="w-full h-2" />
                      {currentFile && (
                        <p className="text-xs text-blue-600 mt-2 truncate">
                          {currentFile}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Features Info */}
        {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md">
            <CardContent className="p-6 text-center">
              <div className="p-3 bg-blue-100 rounded-full w-16 h-16 mx-auto mb-4 group-hover:bg-blue-200 transition-colors">
                <Camera className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="font-semibold mb-2">Multi-Card Detection</h3>
              <p className="text-sm text-gray-600">
                Advanced AI detects and processes multiple business cards in a single image
              </p>
            </CardContent>
          </Card>
          
          <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md">
            <CardContent className="p-6 text-center">
              <div className="p-3 bg-green-100 rounded-full w-16 h-16 mx-auto mb-4 group-hover:bg-green-200 transition-colors">
                <Eye className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="font-semibold mb-2">QR Code & vCard Support</h3>
              <p className="text-sm text-gray-600">
                Extracts contact data from QR codes, vCards, and MeCards automatically
              </p>
            </CardContent>
          </Card>
          
          <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md">
            <CardContent className="p-6 text-center">
              <div className="p-3 bg-purple-100 rounded-full w-16 h-16 mx-auto mb-4 group-hover:bg-purple-200 transition-colors">
                <Users className="h-10 w-10 text-purple-600" />
              </div>
              <h3 className="font-semibold mb-2">Smart Data Organization</h3>
              <p className="text-sm text-gray-600">
                Automatically categorizes mobile numbers, landlines, and contact details
              </p>
            </CardContent>
          </Card>
        </div> */}

        {/* Usage Limit Modal */}
        <UsageLimitModal
          isOpen={showLimitModal}
          onClose={() => setShowLimitModal(false)}
          feature="aiScan"
          currentCount={usage.aiScansCount}
          limit={limits.aiScans}
        />

        {/* Hidden canvas for camera capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}