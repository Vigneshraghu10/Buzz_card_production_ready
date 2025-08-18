import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadToStorage } from "@/utils/upload";
import { callGeminiAPI } from "@/utils/ocr";
import type { ParsedContact } from "@/utils/parse";
import { isDuplicateContact } from "@/utils/duplicate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CloudUpload, Check, Clock, X, Save, Users, Sparkles, Brain, Zap, FileImage, AlertCircle, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

interface UploadResult {
  id: string;
  file: File;
  imageUrl?: string;
  extractedData?: ParsedContact;
  status: "uploading" | "processing" | "completed" | "error";
  error?: string;
}

interface Group {
  id: string;
  name: string;
  ownerId: string;
}

export default function BulkUploads() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchGroups();
  }, [user]);

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
    } finally {
      setLoadingGroups(false);
    }
  };

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
        let errorMessage = 'Unknown error occurred';
        
        if (error.message?.includes('API key') || error.message?.includes('401')) {
          errorMessage = 'API key issue. Please check your Gemini API configuration.';
        } else if (error.message?.includes('fetch') || error.message?.includes('Network')) {
          errorMessage = 'Network error. Please check your internet connection.';
        } else if (error.message?.includes('Failed to fetch image')) {
          errorMessage = 'Failed to load image. Please try again.';
        } else if (error.message?.includes('Invalid file type')) {
          errorMessage = 'Invalid file type. Please upload an image.';
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        setUploadResults(prev => prev.map(r => 
          r.id === result.id ? { ...r, status: "error", error: errorMessage } : r
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
        });

        savedCount++;
      }

      let successMessage = `Saved ${savedCount} contact${savedCount !== 1 ? 's' : ''}`;
      if (selectedGroupIds.length > 0) {
        const groupNames = groups.filter(g => selectedGroupIds.includes(g.id)).map(g => g.name).join(', ');
        successMessage += ` to group${selectedGroupIds.length > 1 ? 's' : ''}: ${groupNames}`;
      }
      if (duplicateCount > 0) {
        successMessage += `, skipped ${duplicateCount} duplicate${duplicateCount !== 1 ? 's' : ''}`;
      }
      
      toast({
        title: "Success",
        description: successMessage,
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
                <p className="mt-1 text-lg text-gray-600">Powered by Gemini 1.5 Flash • Extract data from multiple business cards instantly</p>
              </div>
            </div>
            
            {/* AI Features Banner */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
                <Brain className="h-8 w-8 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-blue-900">AI-Powered</h3>
                  <p className="text-sm text-blue-700">Advanced text recognition</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
                <Zap className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-900">Lightning Fast</h3>
                  <p className="text-sm text-green-700">Process up to 10 cards</p>
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
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">Our AI will automatically extract contact information from your business card images with incredible accuracy</p>
                  
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
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg"
                    >
                      <CloudUpload className="h-5 w-5 mr-2" />
                      {uploading ? 'Processing...' : 'Choose Files'}
                    </Button>
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Or drag and drop</p>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG, WebP up to 5MB each • Max 10 files</p>
                    </div>
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
                            </div>
                          ) : (
                            <div className="w-28 h-18 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center">
                              <CloudUpload className="h-8 w-8 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold text-gray-900 truncate">{result.file.name}</p>
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
                {/* Group Assignment Section */}
                {!loadingGroups && groups.length > 0 && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-3">Assign to Groups (Optional)</h4>
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
                    {selectedGroupIds.length > 0 && (
                      <span className="block text-xs text-blue-600">
                        Will be assigned to {selectedGroupIds.length} group{selectedGroupIds.length !== 1 ? 's' : ''}
                      </span>
                    )}
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
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
