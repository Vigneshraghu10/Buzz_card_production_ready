import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { callGeminiAPI } from "@/utils/ocr";
import type { ParsedContact } from "@/utils/parse";
import { isDuplicateContact } from "@/utils/duplicate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, MessageCircle, ArrowLeft, Edit, Save, UserPlus, Send, Loader2 } from "lucide-react";

interface ExtractedData {
  data: ParsedContact;
  timestamp: Date;
}

interface Template {
  id: string;
  name: string;
  content: string;
}

export default function ScannedCards() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [editData, setEditData] = useState<ParsedContact>({});
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [savingContact, setSavingContact] = useState(false);

  useEffect(() => {
    const initializeComponent = async () => {
      try {
        setLoading(true);
        if (user) {
          await fetchTemplates();
        }
      } catch (error) {
        console.error("Error initializing component:", error);
        toast({
          title: "Error",
          description: "Failed to initialize component",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    initializeComponent();
  }, [user]);

  const fetchTemplates = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const templatesQuery = query(
        collection(db, "templates"), 
        where("ownerId", "==", user.uid)
      );
      const templatesSnapshot = await getDocs(templatesQuery);
      const templatesData = templatesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Template[];

      setTemplates(templatesData);
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast({
        title: "Error",
        description: "Failed to fetch templates",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) {
      toast({
        title: "Error",
        description: "Please select a file",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size should be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    
    try {
      // Call Gemini API for data extraction
      const data = await callGeminiAPI(file);

      // Set extracted data for full-page view
      setExtractedData({
        data,
        timestamp: new Date()
      });

      setEditData(data);
      setShowUploadModal(false);
      
      toast({
        title: "Success",
        description: "Business card processed successfully",
      });
    } catch (error: any) {
      console.error("Error processing card:", error);
      let errorMessage = "Failed to process business card";
      
      if (error.message?.includes('API key') || error.message?.includes('401')) {
        errorMessage = 'API key issue. Please check your Gemini API configuration.';
      } else if (error.message?.includes('Network') || error.message?.includes('fetch')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleSendTemplate = (template: Template) => {
    const contactData = isEditing ? editData : extractedData?.data;
    
    if (!contactData) {
      toast({
        title: "Error", 
        description: "No contact data available",
        variant: "destructive",
      });
      return;
    }

    try {
      // Replace template variables with actual contact data
      let message = template.content;
      message = message.replace(/\{\{name\}\}/g, contactData.name || 'there');
      message = message.replace(/\{\{company\}\}/g, contactData.company || '');
      message = message.replace(/\{\{email\}\}/g, contactData.email || '');
      message = message.replace(/\{\{phone\}\}/g, contactData.phones?.[0] || '');

      // Create WhatsApp URL
      const phoneNumber = contactData.phones?.[0]?.replace(/\D/g, '') || '';
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = phoneNumber 
        ? `https://wa.me/${phoneNumber}?text=${encodedMessage}`
        : `https://wa.me/?text=${encodedMessage}`;

      // Open WhatsApp
      window.open(whatsappUrl, '_blank');
      
      setShowTemplateModal(false);
      
      toast({
        title: "Success",
        description: "Redirected to WhatsApp",
      });
    } catch (error) {
      console.error("Error sending template:", error);
      toast({
        title: "Error",
        description: "Failed to send template",
        variant: "destructive",
      });
    }
  };

  const handleSaveToContacts = async () => {
    const contactData = isEditing ? editData : extractedData?.data;
    
    if (!contactData || !user) {
      toast({
        title: "Error",
        description: "No contact data available or user not authenticated",
        variant: "destructive",
      });
      return;
    }

    setSavingContact(true);
    
    try {
      // Build phones array for duplicate checking  
      const phones = contactData.phones || [];
      
      // Check for duplicates
      if (contactData.email || phones.length) {
        const isDupe = await isDuplicateContact(
          user.uid, 
          contactData.email, 
          phones
        );
        if (isDupe) {
          toast({
            title: "Duplicate Contact",
            description: `${contactData.name || 'Contact'} already exists`,
            variant: "destructive",
          });
          setSavingContact(false);
          return;
        }
      }

      // Extract QR code URL if available
      const qrCodeUrl = contactData.qrCodes?.find(qr => qr.type === 'url')?.data || "";
      const extractedWebsite = contactData.website || qrCodeUrl || "";

      // Save contact to Firestore with proper field mapping
      await addDoc(collection(db, "contacts"), {
        firstName: contactData.name?.split(' ')[0] || "",
        lastName: contactData.name?.split(' ').slice(1).join(' ') || "",
        phone: contactData.phones?.[0] || "",
        phones: contactData.phones || [],
        email: contactData.email?.toLowerCase() || "",
        company: contactData.company || "",
        services: contactData.services || "",
        address: contactData.address || "",
        website: extractedWebsite,
        qrCodeUrl: qrCodeUrl,
        groupIds: [],
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        source: "business_card_scan",
        hasQRData: !!(contactData.qrCodes && contactData.qrCodes.length > 0),
        qrContent: contactData.qrCodes?.[0]?.data || null,
      });

      toast({
        title: "Contact Saved",
        description: `${contactData.name || 'Contact'} has been saved successfully`,
      });
    } catch (error) {
      console.error("Error saving contact:", error);
      toast({
        title: "Save Failed",
        description: "Failed to save contact",
        variant: "destructive",
      });
    } finally {
      setSavingContact(false);
    }
  };

  const handleSaveChanges = () => {
    if (extractedData) {
      setExtractedData({
        ...extractedData,
        data: editData
      });
    }
    setIsEditing(false);
    
    toast({
      title: "Success",
      description: "Changes saved successfully",
    });
  };

  const handleBackToScan = () => {
    setExtractedData(null);
    setEditData({});
    setIsEditing(false);
  };

  const handleWhatsAppMessage = () => {
    const contactData = isEditing ? editData : extractedData?.data;
    if (!contactData?.phones?.[0]) {
      toast({
        title: "Error",
        description: "No phone number available",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const phoneNumber = contactData.phones?.[0]?.replace(/\D/g, '') || '';
      const whatsappUrl = `https://wa.me/${phoneNumber}`;
      window.open(whatsappUrl, '_blank');
      
      toast({
        title: "Success",
        description: "Opened WhatsApp chat",
      });
    } catch (error) {
      console.error("Error opening WhatsApp:", error);
      toast({
        title: "Error",
        description: "Failed to open WhatsApp",
        variant: "destructive",
      });
    }
  };

  const FileUploadDialog = () => (
    <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
      <DialogTrigger asChild>
        <Button>
          <Camera className="h-4 w-4 mr-2" />
          Scan New Card
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Business Card</DialogTitle>
          <DialogDescription>
            Upload an image of a business card to extract contact information automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const files = e.dataTransfer.files;
              if (files.length > 0) handleFileUpload(files[0]);
            }}
            onClick={() => {
              if (processing) return;
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = (e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files && files[0]) handleFileUpload(files[0]);
              };
              input.click();
            }}
          >
            {processing ? (
              <Loader2 className="mx-auto h-12 w-12 text-gray-400 animate-spin" />
            ) : (
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
            )}
            <p className="mt-2 text-sm text-gray-600">
              {processing 
                ? "Processing your business card..." 
                : "Drag and drop your business card image, or click to browse"
              }
            </p>
            <Button 
              variant="outline" 
              className="mt-4"
              disabled={processing}
            >
              {processing ? "Processing..." : "Select File"}
            </Button>
            <p className="mt-2 text-xs text-gray-500">PNG, JPG up to 5MB</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Handle authentication check
  if (!user) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
            <p className="text-gray-600">Please log in to access the business card scanner.</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
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

  // Full-page view for extracted data
  if (extractedData) {
    return (
      <div className="min-h-screen bg-gray-50 py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 pb-20">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center">
              <Button
                variant="ghost"
                onClick={handleBackToScan}
                className="mr-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Scan
              </Button>
              <h2 className="text-2xl font-bold text-gray-900">Extracted Contact Information</h2>
            </div>
            <div className="flex space-x-2">
              {!isEditing ? (
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <Button
                  onClick={handleSaveChanges}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              )}
            </div>
          </div>

          <Card className="w-full mb-6">
            <CardContent className="p-8">
              <div className="text-sm text-gray-500 mb-6">
                Processed on {extractedData.timestamp.toLocaleDateString()} at {extractedData.timestamp.toLocaleTimeString()}
              </div>
              
              {isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={editData.name || ""}
                      onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={editData.company || ""}
                      onChange={(e) => setEditData(prev => ({ ...prev, company: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={editData.email || ""}
                      onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={editData.phone || ""}
                      onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="services">Services/Position</Label>
                    <Textarea
                      id="services"
                      value={editData.services || ""}
                      onChange={(e) => setEditData(prev => ({ ...prev, services: e.target.value }))}
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={editData.address || ""}
                      onChange={(e) => setEditData(prev => ({ ...prev, address: e.target.value }))}
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Full Name</Label>
                    <p className="mt-1 text-lg">{extractedData.data.name || "Not provided"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Company</Label>
                    <p className="mt-1 text-lg">{extractedData.data.company || "Not provided"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Email Address</Label>
                    <p className="mt-1 text-lg">{extractedData.data.email || "Not provided"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Phone Number</Label>
                    <p className="mt-1 text-lg">{extractedData.data.phone || "Not provided"}</p>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium text-gray-500">Services/Position</Label>
                    <p className="mt-1 text-lg">{extractedData.data.services || "Not provided"}</p>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium text-gray-500">Address</Label>
                    <p className="mt-1 text-lg">{extractedData.data.address || "Not provided"}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fixed Bottom Action Buttons */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-50">
            <div className="max-w-4xl mx-auto">
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {/* Send Template Button */}
                <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
                  <DialogTrigger asChild>
                    <Button 
                      className="flex-1 sm:flex-none sm:min-w-[150px]"
                      variant="outline"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Select Template to Send</DialogTitle>
                      <DialogDescription>
                        Choose a message template to send via WhatsApp to this contact.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {templates.length > 0 ? (
                        templates.map(template => (
                          <div key={template.id} className="border rounded-lg p-4 hover:bg-gray-50">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium">{template.name}</h4>
                            </div>
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{template.content}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => handleSendTemplate(template)}
                            >
                              Send This Template
                            </Button>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          No templates available. Create templates first.
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Save to Contacts Button */}
                <Button
                  className="flex-1 sm:flex-none sm:min-w-[150px]"
                  onClick={handleSaveToContacts}
                  disabled={savingContact}
                >
                  {savingContact ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  {savingContact ? "Saving..." : "Save to Contacts"}
                </Button>

                {/* Send WhatsApp Message Button */}
                <Button
                  className="flex-1 sm:flex-none sm:min-w-[150px] bg-green-600 hover:bg-green-700"
                  onClick={handleWhatsAppMessage}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main scan interface
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Business Card Scanner
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Upload and extract contact information from business cards
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <FileUploadDialog />
          </div>
        </div>

        <div className="mt-12 text-center">
          <div className="text-gray-500">
            <Camera className="mx-auto h-24 w-24 text-gray-300 mb-4" />
            <p className="text-lg">Ready to scan your first business card?</p>
            <p className="text-sm mt-2">Click "Scan New Card" to get started with contact extraction.</p>
          </div>
        </div>
      </div>
    </div>
  );
}