import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadToStorage } from "@/utils/upload";
import { callGeminiAPI } from "@/utils/ocr";
import type { ParsedContact } from "@/utils/parse";
import { isDuplicateContact } from "@/utils/duplicate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CloudUpload, Check, Clock, X, Save, Users } from "lucide-react";

interface UploadResult {
  id: string;
  file: File;
  imageUrl?: string;
  extractedData?: ParsedContact;
  status: "uploading" | "processing" | "completed" | "error";
  error?: string;
}

export default function BulkUploads() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (files: FileList) => {
    if (files.length > 10) {
      toast({
        title: "Too many files",
        description: "Please select up to 10 images",
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

    setUploadResults(newResults);

    // Process files one by one
    for (let i = 0; i < newResults.length; i++) {
      const result = newResults[i];
      
      try {
        // Upload to Firebase Storage
        const imageUrl = await uploadToStorage(
          result.file, 
          `users/${user!.uid}/bulk/${Date.now()}-${result.file.name}`
        );

        setUploadResults(prev => prev.map(r => 
          r.id === result.id ? { ...r, imageUrl, status: "processing" } : r
        ));

        // Call Gemini API for enhanced data extraction
        const extractedData = await callGeminiAPI(imageUrl);

        setUploadResults(prev => prev.map(r => 
          r.id === result.id ? { ...r, extractedData, status: "completed" } : r
        ));

      } catch (error: any) {
        console.error("Error processing file:", error);
        setUploadResults(prev => prev.map(r => 
          r.id === result.id ? { ...r, status: "error", error: error.message } : r
        ));
      }
    }

    setUploading(false);
  };

  const handleRemoveItem = (id: string) => {
    setUploadResults(prev => prev.filter(r => r.id !== id));
  };

  const handleSaveAllContacts = async () => {
    const completedResults = uploadResults.filter(r => r.status === "completed" && r.extractedData);
    
    try {
      let savedCount = 0;
      let duplicateCount = 0;

      for (const result of completedResults) {
        const data = result.extractedData!;
        
        // Check for duplicates
        const isDupe = await isDuplicateContact(user!.uid, data.email, data.phone);
        if (isDupe) {
          duplicateCount++;
          continue;
        }

        // Create contact
        await addDoc(collection(db, "contacts"), {
          firstName: data.name?.split(' ')[0] || "",
          lastName: data.name?.split(' ').slice(1).join(' ') || "",
          phone: data.phone || "",
          email: data.email?.toLowerCase() || "",
          company: data.company || "",
          services: data.services || "",
          address: data.address || "",
          groupIds: [],
          ownerId: user!.uid,
          createdAt: serverTimestamp(),
        });

        savedCount++;
      }

      toast({
        title: "Success",
        description: `Saved ${savedCount} contacts${duplicateCount > 0 ? `, skipped ${duplicateCount} duplicates` : ''}`,
      });

      // Clear results after saving
      setUploadResults([]);
    } catch (error) {
      console.error("Error saving contacts:", error);
      toast({
        title: "Error",
        description: "Failed to save contacts",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "uploading":
      case "processing":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "completed":
        return <Check className="h-4 w-4 text-green-600" />;
      case "error":
        return <X className="h-4 w-4 text-red-600" />;
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
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "error":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">Bulk Upload</h2>
            <p className="mt-1 text-sm text-gray-500">Upload multiple business card images for OCR processing</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Upload Zone */}
        <div className="mt-6">
          <Card>
            <CardContent className="p-6">
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-primary transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const files = e.dataTransfer.files;
                  if (files.length > 0) handleFileSelect(files);
                }}
              >
                <div className="mx-auto w-16 h-16 flex items-center justify-center bg-gray-100 rounded-full mb-4">
                  <CloudUpload className="text-2xl text-gray-400 h-8 w-8" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Business Cards</h3>
                <p className="text-gray-500 mb-4">Drag and drop up to 10 images, or click to browse</p>
                <Button 
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.multiple = true;
                    input.accept = 'image/*';
                    input.onchange = (e) => {
                      const files = (e.target as HTMLInputElement).files;
                      if (files) handleFileSelect(files);
                    };
                    input.click();
                  }}
                  disabled={uploading}
                  variant="outline"
                  className="text-primary border-primary hover:bg-primary/10"
                >
                  <CloudUpload className="h-4 w-4 mr-2" />
                  Select Files
                </Button>
                <p className="mt-2 text-xs text-gray-500">PNG, JPG up to 5MB each</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Processing Results */}
        {uploadResults.length > 0 && (
          <div className="mt-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">Processing Results</h3>
                
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {uploadResults.map((result) => (
                    <div key={result.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          {result.imageUrl ? (
                            <img 
                              src={result.imageUrl} 
                              alt="Business card" 
                              className="w-24 h-16 object-cover rounded"
                            />
                          ) : (
                            <div className="w-24 h-16 bg-gray-200 rounded flex items-center justify-center">
                              <CloudUpload className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-900">{result.file.name}</p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}>
                              {getStatusIcon(result.status)}
                              <span className="ml-1">{getStatusText(result.status)}</span>
                            </span>
                          </div>
                          
                          {result.status === "completed" && result.extractedData && (
                            <div className="space-y-1 text-sm text-gray-600">
                              <p><strong>Name:</strong> {result.extractedData.name || "Not found"}</p>
                              <p><strong>Company:</strong> {result.extractedData.company || "Not found"}</p>
                              <p><strong>Email:</strong> {result.extractedData.email || "Not found"}</p>
                              <p><strong>Phone:</strong> {result.extractedData.phone || "Not found"}</p>
                            </div>
                          )}

                          {result.status === "error" && (
                            <div className="text-sm text-red-600">
                              <p>Error: {result.error}</p>
                            </div>
                          )}
                          
                          <div className="mt-3 flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(result.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    <span>
                      {uploadResults.filter(r => r.status === "completed").length} of {uploadResults.length} cards processed
                    </span>
                  </div>
                  <div className="flex space-x-3">
                    <Button
                      onClick={handleSaveAllContacts}
                      disabled={uploadResults.filter(r => r.status === "completed").length === 0}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save All Contacts
                    </Button>
                    <Button variant="outline">
                      <Users className="h-4 w-4 mr-2" />
                      Assign to Group
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
