import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, getDoc } from "firebase/firestore";
import { useLocation } from "wouter";
import { db } from "@/lib/firebase";
import { uploadToStorage } from "@/utils/upload";
import { buildVCard } from "@/utils/vcard";
import { generateQrFromText } from "@/utils/qr";
import { useUsageLimits } from "@/hooks/useUsageLimits";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import UsageLimitModal from "@/components/UsageLimitModal";
import html2canvas from 'html2canvas';
import { 
  Save, Download, Link as LinkIcon, QrCode, Camera, Mail, Phone, 
  Globe, MapPin, Briefcase, Award, Users, Palette, Sparkles,
  Building2, Star, Heart, Zap, Crown, Coffee, Laptop, Paintbrush,
  Rocket, Diamond, Image as ImageIcon
} from "lucide-react";

interface DigitalCard {
  id?: string;
  ownerId: string;
  publicId: string;
  avatarUrl?: string;
  companyLogoUrl?: string;
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
  template: string;
  primaryColor: string;
  secondaryColor: string;
  qrEnabled: boolean;
  qrLogoEnabled: boolean;
  updatedAt: Date;
}

const TEMPLATES = [
  {
    id: 'modern',
    name: 'Modern Gradient',
    preview: '🌈',
    description: 'Clean design with vibrant gradients',
    icon: Sparkles
  },
  {
    id: 'professional',
    name: 'Professional',
    preview: '💼',
    description: 'Classic business card style',
    icon: Briefcase
  },
  {
    id: 'creative',
    name: 'Creative',
    preview: '🎨',
    description: 'Bold and artistic design',
    icon: Paintbrush
  },
  {
    id: 'minimal',
    name: 'Minimal',
    preview: '⚪',
    description: 'Clean and simple layout',
    icon: Users
  },
  {
    id: 'luxury',
    name: 'Luxury',
    preview: '👑',
    description: 'Premium golden design',
    icon: Crown
  },
  {
    id: 'tech',
    name: 'Tech',
    preview: '💻',
    description: 'Modern tech-focused design',
    icon: Laptop
  },
  {
    id: 'elegant',
    name: 'Elegant',
    preview: '💎',
    description: 'Sophisticated and refined',
    icon: Diamond
  },
  {
    id: 'startup',
    name: 'Startup',
    preview: '🚀',
    description: 'Dynamic startup vibe',
    icon: Rocket
  },
  {
    id: 'coffee',
    name: 'Coffee Shop',
    preview: '☕',
    description: 'Warm and inviting design',
    icon: Coffee
  },
  {
    id: 'neon',
    name: 'Neon',
    preview: '⚡',
    description: 'Electric neon style',
    icon: Zap
  }
];

const COLOR_SCHEMES = [
  { primary: '#3B82F6', secondary: '#1E40AF', name: 'Ocean Blue' },
  { primary: '#10B981', secondary: '#047857', name: 'Emerald Green' },
  { primary: '#8B5CF6', secondary: '#5B21B6', name: 'Royal Purple' },
  { primary: '#F59E0B', secondary: '#D97706', name: 'Golden Orange' },
  { primary: '#EF4444', secondary: '#DC2626', name: 'Ruby Red' },
  { primary: '#EC4899', secondary: '#BE185D', name: 'Pink Rose' },
  { primary: '#06B6D4', secondary: '#0891B2', name: 'Sky Cyan' },
  { primary: '#84CC16', secondary: '#65A30D', name: 'Lime Green' },
  { primary: '#6366F1', secondary: '#4338CA', name: 'Indigo Blue' },
  { primary: '#F97316', secondary: '#EA580C', name: 'Sunset Orange' }
];

export default function AdvancedDigitalCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { usage, limits, canAddDigitalCard, refreshUsage } = useUsageLimits();
  const [location, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [downloadingImage, setDownloadingImage] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editCardId, setEditCardId] = useState<string>("");
  const previewRef = useRef<HTMLDivElement>(null);
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
    template: 'modern',
    primaryColor: '#3B82F6',
    secondaryColor: '#1E40AF',
    qrEnabled: true,
    qrLogoEnabled: false,
    updatedAt: new Date(),
  });

  useEffect(() => {
    if (!user) return;
    
    // Parse URL query parameters
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    const editId = urlParams.get('edit');
    
    if (editId) {
      setIsEditMode(true);
      setEditCardId(editId);
      fetchCardForEdit(editId);
    } else {
      setIsEditMode(false);
      setEditCardId('');
      fetchDigitalCard();
    }
  }, [user, location]);

  // Auto-enable QR logo when company logo is uploaded
  useEffect(() => {
    setDigitalCard(prev => ({
      ...prev,
      qrLogoEnabled: !!prev.companyLogoUrl
    }));
  }, [digitalCard.companyLogoUrl]);

  useEffect(() => {
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
          qrEnabled: cardData.qrEnabled ?? true,
          qrLogoEnabled: cardData.qrLogoEnabled ?? false,
          updatedAt: cardData.updatedAt?.toDate() || new Date(),
        } as DigitalCard);
      } else {
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

  const fetchCardForEdit = async (cardId: string) => {
    try {
      const cardRef = doc(db, "digitalCards", cardId);
      const cardSnap = await getDoc(cardRef);
      
      if (cardSnap.exists()) {
        const cardData = cardSnap.data();
        
        // Verify ownership
        if (cardData.ownerId !== user!.uid) {
          toast({
            title: "Access Denied",
            description: "You don't have permission to edit this card",
            variant: "destructive",
          });
          navigate("/manage-cards");
          return;
        }
        
        setDigitalCard({
          id: cardSnap.id,
          ...cardData,
          qrEnabled: cardData.qrEnabled ?? true,
          qrLogoEnabled: cardData.qrLogoEnabled ?? false,
          updatedAt: cardData.updatedAt?.toDate() || new Date(),
        } as DigitalCard);
      } else {
        toast({
          title: "Card Not Found",
          description: "The digital card you're trying to edit doesn't exist",
          variant: "destructive",
        });
        navigate("/manage-cards");
      }
    } catch (error) {
      console.error("Error fetching card for edit:", error);
      toast({
        title: "Error",
        description: "Failed to fetch card for editing",
        variant: "destructive",
      });
      navigate("/manage-cards");
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
      
      const logoUrl = digitalCard.qrLogoEnabled && digitalCard.companyLogoUrl ? digitalCard.companyLogoUrl : undefined;
      const qrUrl = await generateQrFromText(vCardData, logoUrl);
      setQrCodeUrl(qrUrl);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

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
        description: error.message || "Failed to upload profile picture",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCompanyLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploadingLogo(true);
    try {
      const timestamp = Date.now();
      const logoUrl = await uploadToStorage(file, `users/${user!.uid}/logo-${timestamp}.${file.name.split('.').pop()}`);
      setDigitalCard(prev => ({ ...prev, companyLogoUrl: logoUrl }));
      
      toast({
        title: "Success",
        description: "Company logo updated successfully",
      });
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      toast({
        title: "Upload Error",
        description: error.message || "Failed to upload company logo",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const resetForm = () => {
    const newPublicId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setDigitalCard({
      ownerId: user?.uid || "",
      publicId: newPublicId,
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
      avatarUrl: "",
      companyLogoUrl: "",
      isPublic: true,
      template: 'modern',
      primaryColor: '#3B82F6',
      secondaryColor: '#1E40AF',
      qrEnabled: true,
      qrLogoEnabled: false,
      updatedAt: new Date(),
    });
    setQrCodeUrl("");
  };

  const handleSaveProfile = async () => {
    // Check usage limits for new digital cards
    if (!digitalCard.id && !canAddDigitalCard) {
      setShowLimitModal(true);
      return;
    }

    setSaving(true);
    
    try {
      const cardData = {
        ...digitalCard,
        ownerId: user!.uid,
        updatedAt: serverTimestamp(),
      };

      if (digitalCard.id) {
        await updateDoc(doc(db, "digitalCards", digitalCard.id), cardData);
      } else {
        const docRef = await addDoc(collection(db, "digitalCards"), cardData);
        setDigitalCard(prev => ({ ...prev, id: docRef.id }));
        
        // Refresh usage after creating new digital card
        await refreshUsage();
      }

      toast({
        title: "Success",
        description: isEditMode ? "Digital card updated successfully" : "Digital card saved successfully",
      });

      // Handle post-save actions
      if (isEditMode) {
        // Redirect to manage cards after editing
        navigate("/manage-cards");
      } else {
        // For new cards, refresh usage to get updated counts
        await refreshUsage();
        
        // Reset form for new card creation after a delay
        setTimeout(() => {
          resetForm();
          toast({
            title: "Form Reset",
            description: "Ready to create another digital card",
          });
          
          // Check if user has reached the limit using fresh usage data
          if (usage.digitalCardsCount >= limits.digitalCards) {
            toast({
              title: "Limit Reached",
              description: `You have reached the maximum limit of ${limits.digitalCards} digital cards`,
              variant: "default",
            });
          }
        }, 1500);
      }
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

  const handleDownloadPreview = async () => {
    if (!previewRef.current) return;

    setDownloadingImage(true);
    try {
      // Find the card element within the preview container
      const cardElement = previewRef.current.querySelector('[data-card-preview]') as HTMLElement;
      if (!cardElement) {
        throw new Error("Card preview element not found");
      }

      const canvas = await html2canvas(cardElement, {
        scale: 3, // Higher scale for better quality
        backgroundColor: null,
        useCORS: true,
        allowTaint: true,
        imageTimeout: 10000,
      });

      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${digitalCard.firstName}_${digitalCard.lastName}_Card.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          toast({
            title: "Success",
            description: "Card preview downloaded successfully",
          });
        }
      }, 'image/png', 1.0);
    } catch (error) {
      console.error("Error downloading preview:", error);
      toast({
        title: "Error",
        description: "Failed to download card preview",
        variant: "destructive",
      });
    } finally {
      setDownloadingImage(false);
    }
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

  const handleFieldChange = (field: keyof DigitalCard, value: string | boolean) => {
    setDigitalCard(prev => ({ ...prev, [field]: value }));
  };

  const handleColorSchemeChange = (primary: string, secondary: string) => {
    setDigitalCard(prev => ({
      ...prev,
      primaryColor: primary,
      secondaryColor: secondary
    }));
  };

  const renderCardPreview = () => {
    const { template, primaryColor, secondaryColor } = digitalCard;
    
    const baseClasses = "w-full max-w-sm mx-auto rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300 hover:scale-105";
    
    switch (template) {
      case 'modern':
        return (
          <div className={`${baseClasses} bg-gradient-to-br text-white`} 
               style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor}, #ec4899)` }}
               data-card-preview>
            <div className="relative p-8">
              <div className="absolute top-4 right-4">
                {digitalCard.companyLogoUrl && (
                  <img src={digitalCard.companyLogoUrl} alt="Company" className="w-12 h-12 rounded-lg bg-white/20 p-2" />
                )}
              </div>
              
              <div className="text-center mb-6">
                <div className="relative inline-block">
                  <Avatar className="mx-auto h-24 w-24 mb-4 ring-4 ring-white/30">
                    <AvatarImage src={digitalCard.avatarUrl} />
                    <AvatarFallback className="bg-white/20 text-white text-2xl font-bold">
                      {digitalCard.firstName.charAt(0)}{digitalCard.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <h2 className="text-2xl font-bold mb-1">{digitalCard.firstName} {digitalCard.lastName}</h2>
                <p className="text-blue-100 font-medium mb-1">{digitalCard.title}</p>
                <p className="text-blue-200 text-sm">{digitalCard.company}</p>
              </div>

              <div className="space-y-3 mb-6">
                {digitalCard.email && (
                  <div className="flex items-center text-sm bg-white/10 rounded-lg p-3 backdrop-blur">
                    <Mail className="h-4 w-4 mr-3 text-blue-200" />
                    <span>{digitalCard.email}</span>
                  </div>
                )}
                {digitalCard.phone && (
                  <div className="flex items-center text-sm bg-white/10 rounded-lg p-3 backdrop-blur">
                    <Phone className="h-4 w-4 mr-3 text-blue-200" />
                    <span>{digitalCard.phone}</span>
                  </div>
                )}
                {digitalCard.website && (
                  <div className="flex items-center text-sm bg-white/10 rounded-lg p-3 backdrop-blur">
                    <Globe className="h-4 w-4 mr-3 text-blue-200" />
                    <span className="truncate">{digitalCard.website}</span>
                  </div>
                )}
              </div>

              {qrCodeUrl && digitalCard.qrEnabled && (
                <div className="text-center">
                  <div className="inline-block p-3 bg-white rounded-xl">
                    <img src={qrCodeUrl} alt="QR Code" className="w-20 h-20" />
                  </div>
                  <p className="mt-2 text-xs text-blue-200">Scan to connect</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'professional':
        return (
          <div className={`${baseClasses} bg-white border-2`} style={{ borderColor: primaryColor }} data-card-preview>
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <Avatar className="h-16 w-16 ring-2" style={{ '--tw-ring-color': primaryColor } as any}>
                  <AvatarImage src={digitalCard.avatarUrl} />
                  <AvatarFallback style={{ backgroundColor: primaryColor, color: 'white' }} className="text-lg font-bold">
                    {digitalCard.firstName.charAt(0)}{digitalCard.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {digitalCard.companyLogoUrl && (
                  <img src={digitalCard.companyLogoUrl} alt="Company" className="w-16 h-16 object-contain" />
                )}
              </div>
              
              <h2 className="text-xl font-bold text-gray-800 mb-1">{digitalCard.firstName} {digitalCard.lastName}</h2>
              <p style={{ color: primaryColor }} className="font-semibold mb-1">{digitalCard.title}</p>
              <p className="text-gray-600 text-sm">{digitalCard.company}</p>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 gap-3">
                {digitalCard.email && (
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="w-8 h-8 rounded-full mr-3 flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                      <Mail className="h-4 w-4 text-white" />
                    </div>
                    <span>{digitalCard.email}</span>
                  </div>
                )}
                {digitalCard.phone && (
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="w-8 h-8 rounded-full mr-3 flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                      <Phone className="h-4 w-4 text-white" />
                    </div>
                    <span>{digitalCard.phone}</span>
                  </div>
                )}
                {digitalCard.website && (
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="w-8 h-8 rounded-full mr-3 flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                      <Globe className="h-4 w-4 text-white" />
                    </div>
                    <span className="truncate">{digitalCard.website}</span>
                  </div>
                )}
              </div>

              {qrCodeUrl && digitalCard.qrEnabled && (
                <div className="mt-4 text-center pt-4 border-t border-gray-200">
                  <img src={qrCodeUrl} alt="QR Code" className="w-16 h-16 mx-auto" />
                  <p className="mt-2 text-xs text-gray-500">Scan to save contact</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'creative':
        return (
          <div className={`${baseClasses} text-white relative overflow-hidden`}
               style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
               data-card-preview>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
            
            <div className="relative p-8 z-10">
              <div className="flex items-center justify-between mb-6">
                {digitalCard.companyLogoUrl && (
                  <img src={digitalCard.companyLogoUrl} alt="Company" className="w-12 h-12 rounded-xl bg-white/20 p-2" />
                )}
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-yellow-300 rounded-full"></div>
                  <div className="w-2 h-2 bg-green-300 rounded-full"></div>
                  <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
                </div>
              </div>
              
              <div className="text-center mb-6">
                <Avatar className="mx-auto h-20 w-20 mb-4 ring-4 ring-white/40">
                  <AvatarImage src={digitalCard.avatarUrl} />
                  <AvatarFallback className="bg-white/20 text-white text-xl font-bold">
                    {digitalCard.firstName.charAt(0)}{digitalCard.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-2xl font-black mb-2 bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
                  {digitalCard.firstName} {digitalCard.lastName}
                </h2>
                <p className="text-orange-100 font-bold text-lg">{digitalCard.title}</p>
                <p className="text-pink-200">{digitalCard.company}</p>
              </div>

              <div className="space-y-3 mb-6">
                {digitalCard.email && (
                  <div className="flex items-center text-sm bg-black/20 rounded-xl p-3 backdrop-blur">
                    <div className="w-6 h-6 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full mr-3 flex items-center justify-center">
                      <Mail className="h-3 w-3 text-white" />
                    </div>
                    <span>{digitalCard.email}</span>
                  </div>
                )}
                {digitalCard.phone && (
                  <div className="flex items-center text-sm bg-black/20 rounded-xl p-3 backdrop-blur">
                    <div className="w-6 h-6 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full mr-3 flex items-center justify-center">
                      <Phone className="h-3 w-3 text-white" />
                    </div>
                    <span>{digitalCard.phone}</span>
                  </div>
                )}
              </div>

              {qrCodeUrl && digitalCard.qrEnabled && (
                <div className="text-center">
                  <div className="inline-block p-3 bg-white/90 rounded-2xl backdrop-blur">
                    <img src={qrCodeUrl} alt="QR Code" className="w-16 h-16" />
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'minimal':
        return (
          <div className={`${baseClasses} bg-white shadow-xl border border-gray-100`} data-card-preview>
            <div className="p-8">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-light text-gray-800 mb-1">{digitalCard.firstName}</h2>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{digitalCard.lastName}</h2>
                  <div className="w-16 h-0.5" style={{ backgroundColor: primaryColor }}></div>
                </div>
                {digitalCard.avatarUrl && (
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={digitalCard.avatarUrl} />
                    <AvatarFallback style={{ backgroundColor: primaryColor, color: 'white' }} className="text-lg">
                      {digitalCard.firstName.charAt(0)}{digitalCard.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>

              <div className="mb-6">
                <p className="text-gray-600 font-medium mb-1">{digitalCard.title}</p>
                <div className="flex items-center">
                  {digitalCard.companyLogoUrl && (
                    <img src={digitalCard.companyLogoUrl} alt="Company" className="w-6 h-6 mr-2 object-contain" />
                  )}
                  <p className="text-gray-500">{digitalCard.company}</p>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                {digitalCard.email && (
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="w-1 h-1 rounded-full mr-3" style={{ backgroundColor: primaryColor }}></div>
                    <span>{digitalCard.email}</span>
                  </div>
                )}
                {digitalCard.phone && (
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="w-1 h-1 rounded-full mr-3" style={{ backgroundColor: primaryColor }}></div>
                    <span>{digitalCard.phone}</span>
                  </div>
                )}
                {digitalCard.website && (
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="w-1 h-1 rounded-full mr-3" style={{ backgroundColor: primaryColor }}></div>
                    <span className="truncate">{digitalCard.website}</span>
                  </div>
                )}
              </div>

              {qrCodeUrl && digitalCard.qrEnabled && (
                <div className="text-center">
                  <img src={qrCodeUrl} alt="QR Code" className="w-12 h-12 mx-auto opacity-60" />
                </div>
              )}
            </div>
          </div>
        );

      case 'luxury':
        return (
          <div className={`${baseClasses} bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white relative`} data-card-preview>
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 via-transparent to-yellow-600/10"></div>
            
            <div className="relative p-8">
              <div className="flex items-center justify-between mb-6">
                {digitalCard.companyLogoUrl && (
                  <img src={digitalCard.companyLogoUrl} alt="Company" className="w-12 h-12 rounded-lg bg-yellow-400/20 p-2" />
                )}
              </div>
              
              <div className="text-center mb-8">
                <Avatar className="mx-auto h-24 w-24 mb-4 ring-4 ring-yellow-400/50">
                  <AvatarImage src={digitalCard.avatarUrl} />
                  <AvatarFallback className="bg-gradient-to-br from-yellow-400 to-yellow-600 text-black text-2xl font-bold">
                    {digitalCard.firstName.charAt(0)}{digitalCard.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-500 bg-clip-text text-transparent">
                  {digitalCard.firstName} {digitalCard.lastName}
                </h2>
                <div className="w-16 h-px bg-gradient-to-r from-transparent via-yellow-400 to-transparent mx-auto mb-2"></div>
                <p className="text-yellow-200 font-medium text-lg">{digitalCard.title}</p>
                <p className="text-gray-300">{digitalCard.company}</p>
              </div>

              <div className="space-y-3 mb-6">
                {digitalCard.email && (
                  <div className="flex items-center text-sm bg-white/5 rounded-lg p-3 border border-yellow-400/20">
                    <div className="w-6 h-6 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full mr-3 flex items-center justify-center">
                      <Mail className="h-3 w-3 text-black" />
                    </div>
                    <span className="text-gray-200">{digitalCard.email}</span>
                  </div>
                )}
                {digitalCard.phone && (
                  <div className="flex items-center text-sm bg-white/5 rounded-lg p-3 border border-yellow-400/20">
                    <div className="w-6 h-6 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full mr-3 flex items-center justify-center">
                      <Phone className="h-3 w-3 text-black" />
                    </div>
                    <span className="text-gray-200">{digitalCard.phone}</span>
                  </div>
                )}
              </div>

              {qrCodeUrl && digitalCard.qrEnabled && (
                <div className="text-center">
                  <div className="inline-block p-3 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-xl">
                    <img src={qrCodeUrl} alt="QR Code" className="w-16 h-16" />
                  </div>
                  <p className="mt-2 text-xs text-yellow-200">Exclusive Access</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'tech':
        return (
          <div className={`${baseClasses} bg-gradient-to-br from-gray-900 to-gray-700 text-white relative overflow-hidden`} data-card-preview>
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 left-4 w-20 h-20 border border-cyan-400 rounded-lg rotate-45"></div>
              <div className="absolute bottom-8 right-8 w-16 h-16 border border-purple-400 rounded-full"></div>
            </div>
            
            <div className="relative p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                </div>
                {digitalCard.companyLogoUrl && (
                  <img src={digitalCard.companyLogoUrl} alt="Company" className="w-12 h-12 rounded-lg bg-white/10 p-2" />
                )}
              </div>
              
              <div className="text-center mb-6">
                <Avatar className="mx-auto h-20 w-20 mb-4 ring-2 ring-cyan-400">
                  <AvatarImage src={digitalCard.avatarUrl} />
                  <AvatarFallback style={{ backgroundColor: primaryColor, color: 'white' }} className="text-xl font-mono">
                    {digitalCard.firstName.charAt(0)}{digitalCard.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-2xl font-mono font-bold mb-2 text-cyan-400">
                  {digitalCard.firstName} {digitalCard.lastName}
                </h2>
                <p className="text-purple-300 font-medium">{digitalCard.title}</p>
                <p className="text-gray-400 text-sm font-mono">{digitalCard.company}</p>
              </div>

              <div className="space-y-3 mb-6">
                {digitalCard.email && (
                  <div className="flex items-center text-sm bg-gray-800 rounded-lg p-3 border border-gray-600">
                    <Mail className="h-4 w-4 mr-3 text-cyan-400" />
                    <span className="font-mono">{digitalCard.email}</span>
                  </div>
                )}
                {digitalCard.phone && (
                  <div className="flex items-center text-sm bg-gray-800 rounded-lg p-3 border border-gray-600">
                    <Phone className="h-4 w-4 mr-3 text-purple-400" />
                    <span className="font-mono">{digitalCard.phone}</span>
                  </div>
                )}
              </div>

              {qrCodeUrl && digitalCard.qrEnabled && (
                <div className="text-center">
                  <div className="inline-block p-3 bg-gray-800 rounded-xl border border-gray-600">
                    <img src={qrCodeUrl} alt="QR Code" className="w-16 h-16" />
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'elegant':
        return (
          <div className={`${baseClasses} bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200`} data-card-preview>
            <div className="p-8">
              <div className="text-center mb-8">
                <Avatar className="mx-auto h-20 w-20 mb-4 ring-2" style={{ '--tw-ring-color': primaryColor } as any}>
                  <AvatarImage src={digitalCard.avatarUrl} />
                  <AvatarFallback style={{ backgroundColor: primaryColor, color: 'white' }} className="text-xl font-serif">
                    {digitalCard.firstName.charAt(0)}{digitalCard.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-2xl font-serif mb-2" style={{ color: primaryColor }}>
                  {digitalCard.firstName} {digitalCard.lastName}
                </h2>
                <div className="w-24 h-px mx-auto mb-3" style={{ backgroundColor: primaryColor }}></div>
                <p className="text-purple-700 font-medium italic">{digitalCard.title}</p>
                <p className="text-purple-600 text-sm">{digitalCard.company}</p>
              </div>

              <div className="space-y-4">
                {digitalCard.email && (
                  <div className="flex items-center justify-center text-sm text-purple-700">
                    <Mail className="h-4 w-4 mr-3" style={{ color: primaryColor }} />
                    <span>{digitalCard.email}</span>
                  </div>
                )}
                {digitalCard.phone && (
                  <div className="flex items-center justify-center text-sm text-purple-700">
                    <Phone className="h-4 w-4 mr-3" style={{ color: primaryColor }} />
                    <span>{digitalCard.phone}</span>
                  </div>
                )}
              </div>

              {qrCodeUrl && digitalCard.qrEnabled && (
                <div className="mt-6 text-center">
                  <img src={qrCodeUrl} alt="QR Code" className="w-14 h-14 mx-auto opacity-70" />
                </div>
              )}
            </div>
          </div>
        );

      case 'startup':
        return (
          <div className={`${baseClasses} text-white relative overflow-hidden`}
               style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
               data-card-preview>
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-20 translate-x-20"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-16 -translate-x-16"></div>
            
            <div className="relative p-8">
              <div className="flex items-center justify-between mb-6">
                {digitalCard.companyLogoUrl && (
                  <img src={digitalCard.companyLogoUrl} alt="Company" className="w-12 h-12 rounded-xl bg-white/10 p-2" />
                )}
              </div>
              
              <div className="text-center mb-6">
                <Avatar className="mx-auto h-20 w-20 mb-4 ring-4 ring-white/30">
                  <AvatarImage src={digitalCard.avatarUrl} />
                  <AvatarFallback className="bg-white/20 text-white text-xl font-bold">
                    {digitalCard.firstName.charAt(0)}{digitalCard.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-2xl font-bold mb-2">
                  {digitalCard.firstName} {digitalCard.lastName}
                </h2>
                <p className="text-yellow-200 font-semibold text-lg">{digitalCard.title}</p>
                <p className="text-white/80">{digitalCard.company}</p>
              </div>

              <div className="space-y-3 mb-6">
                {digitalCard.email && (
                  <div className="flex items-center text-sm bg-white/10 rounded-lg p-3 backdrop-blur">
                    <Mail className="h-4 w-4 mr-3 text-yellow-300" />
                    <span>{digitalCard.email}</span>
                  </div>
                )}
                {digitalCard.phone && (
                  <div className="flex items-center text-sm bg-white/10 rounded-lg p-3 backdrop-blur">
                    <Phone className="h-4 w-4 mr-3 text-yellow-300" />
                    <span>{digitalCard.phone}</span>
                  </div>
                )}
              </div>

              {qrCodeUrl && digitalCard.qrEnabled && (
                <div className="text-center">
                  <div className="inline-block p-3 bg-white/90 rounded-2xl">
                    <img src={qrCodeUrl} alt="QR Code" className="w-16 h-16" />
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'coffee':
        return (
          <div className={`${baseClasses} bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200`} data-card-preview>
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                {digitalCard.companyLogoUrl && (
                  <img src={digitalCard.companyLogoUrl} alt="Company" className="w-12 h-12 rounded-lg object-contain" />
                )}
              </div>
              
              <div className="text-center mb-6">
                <Avatar className="mx-auto h-20 w-20 mb-4 ring-4 ring-amber-300">
                  <AvatarImage src={digitalCard.avatarUrl} />
                  <AvatarFallback className="bg-amber-600 text-white text-xl font-bold">
                    {digitalCard.firstName.charAt(0)}{digitalCard.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-2xl font-bold text-amber-800 mb-2">
                  {digitalCard.firstName} {digitalCard.lastName}
                </h2>
                <p className="text-amber-700 font-medium text-lg">{digitalCard.title}</p>
                <p className="text-amber-600">{digitalCard.company}</p>
              </div>

              <div className="space-y-3 mb-6">
                {digitalCard.email && (
                  <div className="flex items-center text-sm bg-white/60 rounded-lg p-3">
                    <Mail className="h-4 w-4 mr-3 text-amber-700" />
                    <span className="text-amber-800">{digitalCard.email}</span>
                  </div>
                )}
                {digitalCard.phone && (
                  <div className="flex items-center text-sm bg-white/60 rounded-lg p-3">
                    <Phone className="h-4 w-4 mr-3 text-amber-700" />
                    <span className="text-amber-800">{digitalCard.phone}</span>
                  </div>
                )}
              </div>

              {qrCodeUrl && digitalCard.qrEnabled && (
                <div className="text-center">
                  <div className="inline-block p-3 bg-white rounded-xl shadow-sm">
                    <img src={qrCodeUrl} alt="QR Code" className="w-16 h-16" />
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'neon':
        return (
          <div className={`${baseClasses} bg-black text-white relative overflow-hidden`} data-card-preview>
            <div className="absolute inset-0">
              <div className="absolute top-4 left-4 w-16 h-16 border-2 border-cyan-400 rounded-lg animate-pulse"></div>
              <div className="absolute top-8 right-8 w-12 h-12 border-2 border-pink-400 rounded-full animate-pulse"></div>
              <div className="absolute bottom-8 left-8 w-14 h-14 border-2 border-yellow-400 rounded-lg rotate-45 animate-pulse"></div>
            </div>
            
            <div className="relative p-8">
              <div className="flex items-center justify-between mb-6">
                {digitalCard.companyLogoUrl && (
                  <img src={digitalCard.companyLogoUrl} alt="Company" className="w-12 h-12 rounded-lg bg-white/5 p-2" />
                )}
              </div>
              
              <div className="text-center mb-6">
                <Avatar className="mx-auto h-20 w-20 mb-4 ring-2 ring-cyan-400">
                  <AvatarImage src={digitalCard.avatarUrl} />
                  <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-pink-500 text-white text-xl font-bold">
                    {digitalCard.firstName.charAt(0)}{digitalCard.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-2xl font-bold mb-2 text-cyan-400" style={{ textShadow: '0 0 10px currentColor' }}>
                  {digitalCard.firstName} {digitalCard.lastName}
                </h2>
                <p className="text-pink-400 font-bold text-lg" style={{ textShadow: '0 0 8px currentColor' }}>
                  {digitalCard.title}
                </p>
                <p className="text-yellow-300">{digitalCard.company}</p>
              </div>

              <div className="space-y-3 mb-6">
                {digitalCard.email && (
                  <div className="flex items-center text-sm bg-gray-900/50 rounded-lg p-3 border border-cyan-400/30">
                    <Mail className="h-4 w-4 mr-3 text-cyan-400" />
                    <span>{digitalCard.email}</span>
                  </div>
                )}
                {digitalCard.phone && (
                  <div className="flex items-center text-sm bg-gray-900/50 rounded-lg p-3 border border-pink-400/30">
                    <Phone className="h-4 w-4 mr-3 text-pink-400" />
                    <span>{digitalCard.phone}</span>
                  </div>
                )}
              </div>

              {qrCodeUrl && digitalCard.qrEnabled && (
                <div className="text-center">
                  <div className="inline-block p-3 bg-white rounded-xl">
                    <img src={qrCodeUrl} alt="QR Code" className="w-16 h-16" />
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return renderCardPreview();
    }
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
    <div className="py-6 bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h2 className="text-3xl font-bold leading-7 text-gray-900 sm:text-4xl sm:truncate bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Advanced Digital Card Studio
            </h2>
            <p className="mt-2 text-lg text-gray-600">Create stunning, professional digital business cards with advanced templates</p>
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Form Section - Scrollable */}
          <div className="lg:col-span-7">
            <div className="space-y-6 max-h-[calc(100vh-120px)] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {/* Template Selection */}
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur">
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                    <Palette className="h-5 w-5 mr-2 text-purple-600" />
                    Choose Your Template
                  </h3>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {TEMPLATES.map((template) => {
                      const IconComponent = template.icon;
                      return (
                        <div
                          key={template.id}
                          onClick={() => handleFieldChange('template', template.id)}
                          className={`cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-lg hover:scale-105 ${
                            digitalCard.template === template.id
                              ? 'border-purple-500 bg-purple-50 shadow-md ring-2 ring-purple-200'
                              : 'border-gray-200 hover:border-purple-300'
                          }`}
                        >
                          <div className="text-center">
                            <div className="text-3xl mb-2">{template.preview}</div>
                            <IconComponent className={`h-5 w-5 mx-auto mb-2 ${
                              digitalCard.template === template.id ? 'text-purple-600' : 'text-gray-400'
                            }`} />
                            <h4 className={`font-medium text-sm mb-1 ${
                              digitalCard.template === template.id ? 'text-purple-800' : 'text-gray-900'
                            }`}>
                              {template.name}
                            </h4>
                            <p className="text-xs text-gray-500">{template.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Color Scheme Selection */}
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Sparkles className="h-5 w-5 mr-2 text-blue-600" />
                    Color Scheme
                  </h3>
                  <div className="grid grid-cols-5 gap-3">
                    {COLOR_SCHEMES.map((scheme) => (
                      <div
                        key={scheme.name}
                        className={`cursor-pointer rounded-lg p-3 transition-all duration-200 hover:scale-105 ${
                          digitalCard.primaryColor === scheme.primary
                            ? 'ring-4 ring-gray-800 shadow-xl'
                            : 'hover:shadow-lg'
                        }`}
                        onClick={() => handleColorSchemeChange(scheme.primary, scheme.secondary)}
                      >
                        <div
                          className="w-full h-12 rounded-md mb-2 shadow-md"
                          style={{ backgroundColor: scheme.primary }}
                        />
                        <p className="text-xs font-medium text-gray-700 text-center">{scheme.name}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Profile Information */}
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                    <Users className="h-5 w-5 mr-2 text-green-600" />
                    Profile Information
                  </h3>
                  
                  {/* Profile Picture & Company Logo Upload */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Profile Picture */}
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-3">Profile Picture</Label>
                      <div className="flex items-center space-x-4">
                        <Avatar className="h-16 w-16 ring-2 ring-gray-200">
                          <AvatarImage src={digitalCard.avatarUrl} />
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-lg font-bold">
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
                            className="w-full"
                          >
                            <Camera className="h-4 w-4 mr-2" />
                            {uploading ? "Uploading..." : "Upload Photo"}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Company Logo */}
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-3">Company Logo</Label>
                      <div className="flex items-center space-x-4">
                        <div className="h-16 w-16 rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                          {digitalCard.companyLogoUrl ? (
                            <img src={digitalCard.companyLogoUrl} alt="Company Logo" className="h-12 w-12 object-contain" />
                          ) : (
                            <Building2 className="h-8 w-8 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <Button
                            variant="outline"
                            disabled={uploadingLogo}
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml';
                              input.onchange = (e) => {
                                const files = (e.target as HTMLInputElement).files;
                                if (files && files[0]) handleCompanyLogoUpload(files[0]);
                              };
                              input.click();
                            }}
                            className="w-full"
                          >
                            <Building2 className="h-4 w-4 mr-2" />
                            {uploadingLogo ? "Uploading..." : "Upload Logo"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="firstName" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <Users className="h-4 w-4 mr-1" />
                        First Name
                      </Label>
                      <Input
                        id="firstName"
                        value={digitalCard.firstName}
                        onChange={(e) => handleFieldChange('firstName', e.target.value)}
                        className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                        placeholder="Enter your first name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="lastName" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <Users className="h-4 w-4 mr-1" />
                        Last Name
                      </Label>
                      <Input
                        id="lastName"
                        value={digitalCard.lastName}
                        onChange={(e) => handleFieldChange('lastName', e.target.value)}
                        className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                        placeholder="Enter your last name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="title" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <Briefcase className="h-4 w-4 mr-1" />
                        Job Title
                      </Label>
                      <Input
                        id="title"
                        value={digitalCard.title}
                        onChange={(e) => handleFieldChange('title', e.target.value)}
                        className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                        placeholder="Your professional title"
                      />
                    </div>

                    <div>
                      <Label htmlFor="company" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <Building2 className="h-4 w-4 mr-1" />
                        Company
                      </Label>
                      <Input
                        id="company"
                        value={digitalCard.company}
                        onChange={(e) => handleFieldChange('company', e.target.value)}
                        className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                        placeholder="Your company name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="email" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <Mail className="h-4 w-4 mr-1" />
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={digitalCard.email}
                        onChange={(e) => handleFieldChange('email', e.target.value)}
                        className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                        placeholder="your@email.com"
                      />
                    </div>

                    <div>
                      <Label htmlFor="phone" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <Phone className="h-4 w-4 mr-1" />
                        Phone
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={digitalCard.phone}
                        onChange={(e) => handleFieldChange('phone', e.target.value)}
                        className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Label htmlFor="website" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <Globe className="h-4 w-4 mr-1" />
                        Website
                      </Label>
                      <Input
                        id="website"
                        type="url"
                        value={digitalCard.website}
                        onChange={(e) => handleFieldChange('website', e.target.value)}
                        className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                        placeholder="https://yourwebsite.com"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Label htmlFor="address" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <MapPin className="h-4 w-4 mr-1" />
                        Address
                      </Label>
                      <Textarea
                        id="address"
                        value={digitalCard.address}
                        onChange={(e) => handleFieldChange('address', e.target.value)}
                        rows={3}
                        className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                        placeholder="Your business address..."
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Label htmlFor="services" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <Award className="h-4 w-4 mr-1" />
                        Services
                      </Label>
                      <Textarea
                        id="services"
                        value={digitalCard.services}
                        onChange={(e) => handleFieldChange('services', e.target.value)}
                        rows={3}
                        className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                        placeholder="Describe your services or expertise..."
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Label htmlFor="testimonials" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <Heart className="h-4 w-4 mr-1" />
                        Client Testimonials
                      </Label>
                      <Textarea
                        id="testimonials"
                        value={digitalCard.testimonials}
                        onChange={(e) => handleFieldChange('testimonials', e.target.value)}
                        rows={3}
                        className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                        placeholder="Share what clients say about your work..."
                      />
                    </div>

                    {/* QR Code Information */}
                    <div className="sm:col-span-2 space-y-4">
                      {/* QR Code Info Panel */}
                      <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                        <div className="flex items-center mb-3">
                          <QrCode className="h-5 w-5 mr-3 text-blue-600" />
                          <div>
                            <Label className="text-sm font-medium text-gray-900">QR Code</Label>
                            <p className="text-xs text-gray-600 mt-1">QR code is automatically generated for easy contact sharing</p>
                          </div>
                        </div>
                        {digitalCard.companyLogoUrl ? (
                          <div className="flex items-center text-xs text-green-700 bg-green-100 rounded-md px-2 py-1">
                            <Building2 className="h-3 w-3 mr-2" />
                            Company logo will appear in QR code center
                          </div>
                        ) : (
                          <div className="flex items-center text-xs text-gray-600 bg-gray-100 rounded-md px-2 py-1">
                            <ImageIcon className="h-3 w-3 mr-2" />
                            Upload company logo to display in QR code center
                          </div>
                        )}
                      </div>

                      {!digitalCard.companyLogoUrl && (
                        <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                          Upload a company logo to enable QR code logo embedding.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-8 space-y-4">
                    {/* Primary Actions */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button 
                        onClick={handleSaveProfile} 
                        disabled={saving}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white flex-1"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? "Saving..." : "Save Profile"}
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        onClick={handleCopyShareLink} 
                        className="border-blue-300 text-blue-700 hover:bg-blue-50 flex-1"
                      >
                        <LinkIcon className="h-4 w-4 mr-2" />
                        Copy Link
                      </Button>
                    </div>

                    {/* Secondary Actions */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button 
                        variant="outline" 
                        onClick={handleDownloadVCard} 
                        className="border-purple-300 text-purple-700 hover:bg-purple-50 flex-1"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download vCard
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        onClick={handleDownloadQR} 
                        className="border-green-300 text-green-700 hover:bg-green-50 flex-1"
                        disabled={!qrCodeUrl}
                      >
                        <QrCode className="h-4 w-4 mr-2" />
                        Download QR
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Live Preview Section - Fixed and Properly Sized */}
          <div className="mt-8 lg:mt-0 lg:col-span-5">
            <div className="lg:sticky lg:top-6">
              <Card className="shadow-2xl border-0 bg-white/90 backdrop-blur">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Zap className="h-5 w-5 mr-2 text-yellow-600" />
                      Live Preview
                    </h3>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span>Live</span>
                    </div>
                  </div>
                  
                  {/* Preview Container with proper sizing */}
                  <div 
                    ref={previewRef}
                    className="flex items-center justify-center min-h-[500px] max-h-[600px] overflow-auto bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4"
                  >
                    <div className="w-full max-w-xs">
                      {renderCardPreview()}
                    </div>
                  </div>

                  {/* Download Preview Button */}
                  <div className="mt-4 text-center">
                    <Button
                      variant="outline"
                      onClick={handleDownloadPreview}
                      disabled={downloadingImage}
                      className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      {downloadingImage ? "Downloading..." : "Download as PNG"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Limit Modal */}
      <UsageLimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        feature="digitalCard"
        currentCount={usage.digitalCardsCount}
        limit={limits.digitalCards}
      />
    </div>
  );
}