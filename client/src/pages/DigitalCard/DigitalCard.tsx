import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadToStorage } from "@/utils/upload";
import { buildVCard } from "@/utils/vcard";
import { generateQrFromText } from "@/utils/qr";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Save, Download, Link as LinkIcon, QrCode, Camera } from "lucide-react";

interface DigitalCard {
  id?: string;
  ownerId: string;
  publicId: string;
  avatarUrl?: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  services: string;
  testimonials: string;
  isPublic: boolean;
  updatedAt: Date;
}

export default function DigitalCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [digitalCard, setDigitalCard] = useState<DigitalCard>({
    ownerId: user?.uid || "",
    publicId: "",
    firstName: "",
    lastName: "",
    title: "",
    company: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    services: "",
    testimonials: "",
    isPublic: true,
    updatedAt: new Date(),
  });

  useEffect(() => {
    if (!user) return;
    fetchDigitalCard();
  }, [user]);

  useEffect(() => {
    // Generate QR code when card data changes
    if (digitalCard.firstName || digitalCard.lastName) {
      generateQRCode();
    }
  }, [digitalCard]);

  const fetchDigitalCard = async () => {
    try {
      const cardsQuery = query(collection(db, "digitalCards"), where("ownerId", "==", user!.uid));
      const cardsSnapshot = await getDocs(cardsQuery);
      
      if (!cardsSnapshot.empty) {
        const cardData = cardsSnapshot.docs[0].data();
        setDigitalCard({
          id: cardsSnapshot.docs[0].id,
          ...cardData,
          updatedAt: cardData.updatedAt?.toDate() || new Date(),
        } as DigitalCard);
      } else {
        // Generate a unique public ID for new cards
        const publicId = `${user!.uid.slice(0, 8)}-${Date.now().toString(36)}`;
        setDigitalCard(prev => ({ ...prev, publicId }));
      }
    } catch (error) {
      console.error("Error fetching digital card:", error);
      toast({
        title: "Error",
        description: "Failed to fetch digital card",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async () => {
    try {
      const vCardData = buildVCard({
        firstName: digitalCard.firstName,
        lastName: digitalCard.lastName,
        title: digitalCard.title,
        company: digitalCard.company,
        email: digitalCard.email,
        phone: digitalCard.phone,
        website: digitalCard.website,
        address: digitalCard.address,
      });
      
      const qrUrl = await generateQrFromText(vCardData);
      setQrCodeUrl(qrUrl);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const timestamp = Date.now();
      const avatarUrl = await uploadToStorage(file, `users/${user!.uid}/avatar-${timestamp}.${file.name.split('.').pop()}`);
      setDigitalCard(prev => ({ ...prev, avatarUrl }));
      
      toast({
        title: "Success",
        description: "Profile picture updated successfully",
      });
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Upload Error",
        description: error.message || "Failed to upload profile picture. Please check your internet connection and try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    
    try {
      const cardData = {
        ...digitalCard,
        ownerId: user!.uid,
        updatedAt: serverTimestamp(),
      };

      if (digitalCard.id) {
        // Update existing card
        await updateDoc(doc(db, "digitalCards", digitalCard.id), cardData);
      } else {
        // Create new card
        const docRef = await addDoc(collection(db, "digitalCards"), cardData);
        setDigitalCard(prev => ({ ...prev, id: docRef.id }));
      }

      toast({
        title: "Success",
        description: "Digital card saved successfully",
      });
    } catch (error) {
      console.error("Error saving digital card:", error);
      toast({
        title: "Error",
        description: "Failed to save digital card",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadVCard = () => {
    const vCardData = buildVCard({
      firstName: digitalCard.firstName,
      lastName: digitalCard.lastName,
      title: digitalCard.title,
      company: digitalCard.company,
      email: digitalCard.email,
      phone: digitalCard.phone,
      website: digitalCard.website,
      address: digitalCard.address,
    });

    const blob = new Blob([vCardData], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${digitalCard.firstName}_${digitalCard.lastName}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "vCard downloaded successfully",
    });
  };

  const handleDownloadQR = () => {
    if (!qrCodeUrl) return;

    const a = document.createElement('a');
    a.href = qrCodeUrl;
    a.download = `${digitalCard.firstName}_${digitalCard.lastName}_QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    toast({
      title: "Success",
      description: "QR code downloaded successfully",
    });
  };

  const handleCopyShareLink = () => {
    const baseUrl = import.meta.env.VITE_APP_PUBLIC_BASE_URL || window.location.origin;
    const shareUrl = `${baseUrl}/share/${digitalCard.publicId}`;
    
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast({
        title: "Success",
        description: "Share link copied to clipboard",
      });
    });
  };

  const handleFieldChange = (field: keyof DigitalCard, value: string) => {
    setDigitalCard(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-8"></div>
            <div className="lg:grid lg:grid-cols-12 lg:gap-8">
              <div className="lg:col-span-7 bg-gray-200 h-96 rounded-lg"></div>
              <div className="lg:col-span-5 bg-gray-200 h-96 rounded-lg"></div>
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
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">Digital Card Builder</h2>
            <p className="mt-1 text-sm text-gray-500">Create and customize your digital business card</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="mt-6 lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Form Section */}
          <div className="lg:col-span-7">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">Profile Information</h3>
                
                {/* Profile Picture Upload */}
                <div className="mb-6">
                  <Label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture</Label>
                  <div className="flex items-center space-x-6">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={digitalCard.avatarUrl} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xl">
                        {digitalCard.firstName.charAt(0)}{digitalCard.lastName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <Button
                        variant="outline"
                        disabled={uploading}
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/jpeg,image/png,image/gif,image/webp';
                          input.onchange = (e) => {
                            const files = (e.target as HTMLInputElement).files;
                            if (files && files[0]) handleAvatarUpload(files[0]);
                          };
                          input.click();
                        }}
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        {uploading ? "Uploading..." : "Change Photo"}
                      </Button>
                      <p className="mt-1 text-sm text-gray-500">JPG, PNG up to 5MB</p>
                    </div>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={digitalCard.firstName}
                      onChange={(e) => handleFieldChange('firstName', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={digitalCard.lastName}
                      onChange={(e) => handleFieldChange('lastName', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="title">Job Title</Label>
                    <Input
                      id="title"
                      value={digitalCard.title}
                      onChange={(e) => handleFieldChange('title', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={digitalCard.company}
                      onChange={(e) => handleFieldChange('company', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={digitalCard.email}
                      onChange={(e) => handleFieldChange('email', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={digitalCard.phone}
                      onChange={(e) => handleFieldChange('phone', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      type="url"
                      value={digitalCard.website}
                      onChange={(e) => handleFieldChange('website', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={digitalCard.address}
                      onChange={(e) => handleFieldChange('address', e.target.value)}
                      rows={3}
                      className="mt-1"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="services">Services</Label>
                    <Textarea
                      id="services"
                      value={digitalCard.services}
                      onChange={(e) => handleFieldChange('services', e.target.value)}
                      rows={3}
                      className="mt-1"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="testimonials">Client Testimonials</Label>
                    <Textarea
                      id="testimonials"
                      value={digitalCard.testimonials}
                      onChange={(e) => handleFieldChange('testimonials', e.target.value)}
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-8 flex flex-col sm:flex-row sm:justify-between gap-4">
                  <div className="flex space-x-3">
                    <Button onClick={handleSaveProfile} disabled={saving}>
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? "Saving..." : "Save Profile"}
                    </Button>
                    <Button variant="outline" onClick={handleDownloadVCard}>
                      <Download className="h-4 w-4 mr-2" />
                      Download .vcf
                    </Button>
                  </div>
                  <div className="flex space-x-3">
                    <Button variant="outline" onClick={handleDownloadQR}>
                      <QrCode className="h-4 w-4 mr-2" />
                      Download QR
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Live Preview Section */}
          <div className="mt-8 lg:mt-0 lg:col-span-5">
            <Card className="sticky top-6">
              <CardContent className="p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">Live Preview</h3>
                
                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-xl">
                  {/* Profile Section */}
                  <div className="text-center mb-6">
                    <Avatar className="mx-auto h-24 w-24 mb-4">
                      <AvatarImage src={digitalCard.avatarUrl} />
                      <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                        {digitalCard.firstName.charAt(0)}{digitalCard.lastName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <h2 className="text-xl font-bold text-gray-900">
                      {digitalCard.firstName} {digitalCard.lastName}
                    </h2>
                    <p className="text-primary font-medium">{digitalCard.title}</p>
                    <p className="text-gray-600">{digitalCard.company}</p>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-3 mb-6">
                    {digitalCard.email && (
                      <div className="flex items-center text-sm text-gray-600">
                        <div className="w-4 h-4 mr-3 text-primary">📧</div>
                        <span>{digitalCard.email}</span>
                      </div>
                    )}
                    {digitalCard.phone && (
                      <div className="flex items-center text-sm text-gray-600">
                        <div className="w-4 h-4 mr-3 text-primary">📞</div>
                        <span>{digitalCard.phone}</span>
                      </div>
                    )}
                    {digitalCard.website && (
                      <div className="flex items-center text-sm text-gray-600">
                        <div className="w-4 h-4 mr-3 text-primary">🌐</div>
                        <span>{digitalCard.website}</span>
                      </div>
                    )}
                    {digitalCard.address && (
                      <div className="flex items-start text-sm text-gray-600">
                        <div className="w-4 h-4 mr-3 mt-1 text-primary">📍</div>
                        <span className="whitespace-pre-line">{digitalCard.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Services */}
                  {digitalCard.services && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-900 mb-2">Services</h4>
                      <div className="text-sm text-gray-600 whitespace-pre-line">
                        {digitalCard.services}
                      </div>
                    </div>
                  )}

                  {/* QR Code */}
                  <div className="text-center border-t pt-4">
                    <div className="inline-block p-3 bg-white rounded-lg shadow-sm">
                      {qrCodeUrl ? (
                        <img src={qrCodeUrl} alt="QR Code" className="w-24 h-24" />
                      ) : (
                        <div className="w-24 h-24 bg-gray-200 rounded flex items-center justify-center">
                          <QrCode className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-gray-500">Scan to save contact</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
