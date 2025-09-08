import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { processMultipleBusinessCards, validateImageFile, type MultiCardResult } from "@/utils/multiCardOcr";
import type { ParsedContact } from "@/utils/parse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
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
  Lock
} from "lucide-react";
import PricingSection from "@/components/PricingSection";

interface ProcessedCard extends ParsedContact {
  id: string;
  status: 'success' | 'error' | 'duplicate';
  error?: string;
  saved?: boolean;
}

export default function EnhancedBulkUploads() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState<ProcessedCard[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [editingCard, setEditingCard] = useState<ProcessedCard | null>(null);
  const [editData, setEditData] = useState<ParsedContact>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check subscription status
  useState(() => {
    const checkSubscription = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const subscription = userData.subscription;
          const isActive = subscription && 
            subscription.status === 'active' && 
            new Date() < new Date(subscription.expiryDate?.toDate?.() || subscription.expiryDate);
          setHasActiveSubscription(!!isActive);
        }
      } catch (error) {
        console.error("Error checking subscription:", error);
      } finally {
        setLoading(false);
      }
    };
    
    checkSubscription();
  });

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
          const result: MultiCardResult = await processMultipleBusinessCards(file);
          
          // Process each detected card
          result.cards.forEach((card, cardIndex) => {
            const processedCard: ProcessedCard = {
              ...card,
              id: `${file.name}_card_${cardIndex + 1}`,
              status: 'success'
            };
            results.push(processedCard);
          });
          
          // Add errors if any
          if (result.errors.length > 0) {
            result.errors.forEach((error, errorIndex) => {
              results.push({
                id: `${file.name}_error_${errorIndex}`,
                status: 'error',
                error: error
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
      await addDoc(collection(db, "contacts"), {
        ...card,
        ownerId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
        source: "bulk_scan"
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
    
    for (const card of unsavedCards) {
      await saveContact(card);
    }
    
    toast({
      title: "All Contacts Saved",
      description: `Successfully saved ${unsavedCards.length} contacts`,
    });
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

  if (loading) {
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

  // Temporarily enable for testing - remove subscription check
  // if (!hasActiveSubscription) {
  //   return (
  //     <div className="py-6">
  //       <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
  //         <div className="text-center mb-8">
  //           <Lock className="mx-auto h-16 w-16 text-gray-400 mb-4" />
  //           <h2 className="text-2xl font-bold text-gray-900 mb-4">Subscription Required</h2>
  //           <p className="text-gray-600 mb-8">
  //             Bulk upload and AI-powered business card processing requires an active subscription.
  //           </p>
  //         </div>
  //         <PricingSection />
  //       </div>
  //     </div>
  //   );
  // }

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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                              <div key={idx} className="bg-gray-100 p-2 rounded text-sm">
                                <span className="font-medium capitalize">{qr.type}:</span> {qr.data}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">AI-Powered Bulk Business Card Processing</h2>
          <p className="text-gray-600">
            Upload images containing multiple business cards. Our AI will detect each card individually and extract contact information, including QR codes.
          </p>
        </div>

        {/* File Upload Area */}
        <Card className="mb-8">
          <CardContent className="p-8">
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFileSelect(e.dataTransfer.files);
              }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.accept = 'image/*';
                input.onchange = (e) => {
                  const target = e.target as HTMLInputElement;
                  handleFileSelect(target.files);
                };
                input.click();
              }}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Upload Business Card Images
              </h3>
              <p className="text-gray-600 mb-4">
                Drag and drop images here, or click to browse
              </p>
              <p className="text-sm text-gray-500">
                Supports JPG, PNG, GIF, WebP up to 10MB each. Can detect multiple cards per image.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Selected Files */}
        {files.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Selected Files ({files.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <Camera className="h-4 w-4 text-gray-500 mr-2" />
                      <span className="text-sm font-medium">{file.name}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      disabled={processing}
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
                  className="w-full"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing {currentFile}...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      Process {files.length} Image{files.length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
                {processing && (
                  <div className="mt-4">
                    <Progress value={progress} className="w-full" />
                    <p className="text-sm text-gray-600 mt-2 text-center">
                      {Math.round(progress)}% complete
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Features Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6 text-center">
              <Camera className="h-8 w-8 text-blue-500 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Multi-Card Detection</h3>
              <p className="text-sm text-gray-600">
                Automatically detects and processes multiple business cards in a single image
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <Eye className="h-8 w-8 text-green-500 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">QR Code Recognition</h3>
              <p className="text-sm text-gray-600">
                Extracts contact information and URLs from QR codes on business cards
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <Users className="h-8 w-8 text-purple-500 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Smart Data Separation</h3>
              <p className="text-sm text-gray-600">
                Automatically separates mobile numbers from landlines for better organization
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}