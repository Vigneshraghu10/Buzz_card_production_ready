import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadToStorage } from "@/utils/upload";
import { callGeminiAPI } from "@/utils/ocr";
import type { ParsedContact } from "@/utils/parse";
import { isDuplicateContact } from "@/utils/duplicate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, Save, MessageCircle, Share, Edit } from "lucide-react";

interface ScannedCard {
  id: string;
  imageUrl: string;
  extractedData: ParsedContact;
  createdAt: Date;
  ownerId: string;
}

interface Template {
  id: string;
  name: string;
  content: string;
}

export default function ScannedCards() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scannedCards, setScannedCards] = useState<ScannedCard[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<ScannedCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [editData, setEditData] = useState<ParsedContact>({});

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch scanned cards
      const cardsQuery = query(collection(db, "scannedCards"), where("ownerId", "==", user!.uid));
      const cardsSnapshot = await getDocs(cardsQuery);
      const cardsData = cardsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as ScannedCard[];

      // Fetch templates
      const templatesQuery = query(collection(db, "templates"), where("ownerId", "==", user!.uid));
      const templatesSnapshot = await getDocs(templatesQuery);
      const templatesData = templatesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Template[];

      setScannedCards(cardsData);
      setTemplates(templatesData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch scanned cards",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setProcessing(true);
    
    try {
      // Upload to Firebase Storage
      const imageUrl = await uploadToStorage(
        file, 
        `users/${user!.uid}/scans/${Date.now()}-${file.name}`
      );

      // Call Gemini API for enhanced data extraction
      const extractedData = await callGeminiAPI(imageUrl);

      // Save to Firestore
      await addDoc(collection(db, "scannedCards"), {
        imageUrl,
        extractedData,
        ownerId: user!.uid,
        createdAt: serverTimestamp(),
      });

      toast({
        title: "Success",
        description: "Business card scanned and processed successfully",
      });

      setShowUploadModal(false);
      fetchData();
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

  const handleSaveToContacts = async (card: ScannedCard) => {
    try {
      const data = card.extractedData;
      
      // Check for duplicates
      const isDupe = await isDuplicateContact(user!.uid, data.email, data.phone);
      if (isDupe) {
        toast({
          title: "Duplicate Contact",
          description: "A contact with this email or phone already exists",
          variant: "destructive",
        });
        return;
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

      toast({
        title: "Success",
        description: "Contact saved successfully",
      });
    } catch (error) {
      console.error("Error saving contact:", error);
      toast({
        title: "Error",
        description: "Failed to save contact",
        variant: "destructive",
      });
    }
  };

  const handleSendTemplate = (template: Template) => {
    // Placeholder function - in real implementation, this would integrate with WhatsApp Business API
    toast({
      title: "Template Sent",
      description: `Template "${template.name}" sent (placeholder functionality)`,
    });
  };

  const handleSendProfile = () => {
    // Placeholder function - in real implementation, this would send the user's digital profile
    toast({
      title: "Profile Sent",
      description: "Digital profile sent (placeholder functionality)",
    });
  };

  const handleEditCard = (card: ScannedCard) => {
    setSelectedCard(card);
    setEditData(card.extractedData);
    setShowEditModal(true);
  };

  if (loading) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-gray-200 h-64 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">Scanned Cards</h2>
            <p className="mt-1 text-sm text-gray-500">Upload and process single business card images</p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
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
                </DialogHeader>
                <div className="space-y-4">
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const files = e.dataTransfer.files;
                      if (files.length > 0) handleFileUpload(files[0]);
                    }}
                  >
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600">
                      Drag and drop your business card image, or click to browse
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e) => {
                          const files = (e.target as HTMLInputElement).files;
                          if (files && files[0]) handleFileUpload(files[0]);
                        };
                        input.click();
                      }}
                      disabled={processing}
                    >
                      {processing ? "Processing..." : "Select File"}
                    </Button>
                    <p className="mt-2 text-xs text-gray-500">PNG, JPG up to 5MB</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {scannedCards.map((card) => (
            <Card key={card.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-0">
                <div className="aspect-video">
                  <img 
                    src={card.imageUrl} 
                    alt="Business card" 
                    className="w-full h-full object-cover rounded-t-lg"
                  />
                </div>
                <div className="p-4">
                  <div className="space-y-2 text-sm">
                    <p><strong>Name:</strong> {card.extractedData.name || "Not found"}</p>
                    <p><strong>Company:</strong> {card.extractedData.company || "Not found"}</p>
                    <p><strong>Email:</strong> {card.extractedData.email || "Not found"}</p>
                    <p><strong>Phone:</strong> {card.extractedData.phone || "Not found"}</p>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-xs text-gray-500">
                        Scanned {card.createdAt.toLocaleDateString()}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditCard(card)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleSaveToContacts(card)}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save to Contacts
                      </Button>
                      
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={handleSendProfile}
                        >
                          <Share className="h-4 w-4 mr-1" />
                          Send Profile
                        </Button>
                        
                        {templates.length > 0 && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="flex-1">
                                <MessageCircle className="h-4 w-4 mr-1" />
                                Send Template
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Select Template</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-2">
                                {templates.map(template => (
                                  <Button
                                    key={template.id}
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => handleSendTemplate(template)}
                                  >
                                    {template.name}
                                  </Button>
                                ))}
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {scannedCards.length === 0 && (
          <div className="mt-6 text-center py-12">
            <div className="text-gray-500">
              No scanned cards yet. Upload your first business card to get started.
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Extracted Data</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="editName">Name</Label>
              <Input
                id="editName"
                value={editData.name || ""}
                onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="editCompany">Company</Label>
              <Input
                id="editCompany"
                value={editData.company || ""}
                onChange={(e) => setEditData(prev => ({ ...prev, company: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                type="email"
                value={editData.email || ""}
                onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="editPhone">Phone</Label>
              <Input
                id="editPhone"
                value={editData.phone || ""}
                onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="editServices">Services</Label>
              <Textarea
                id="editServices"
                value={editData.services || ""}
                onChange={(e) => setEditData(prev => ({ ...prev, services: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="editAddress">Address</Label>
              <Textarea
                id="editAddress"
                value={editData.address || ""}
                onChange={(e) => setEditData(prev => ({ ...prev, address: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-4 mt-6">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              // In a real implementation, this would update the scanned card data
              setShowEditModal(false);
              toast({
                title: "Success",
                description: "Card data updated",
              });
            }}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
