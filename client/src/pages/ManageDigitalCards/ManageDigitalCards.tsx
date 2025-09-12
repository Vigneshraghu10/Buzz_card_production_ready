import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { buildVCard } from "@/utils/vcard";
import { generateQrFromText } from "@/utils/qr";
import html2canvas from "html2canvas";
import { 
  CreditCard, Search, Edit, Download, Share2, Trash2, 
  Plus, Eye, Calendar, Building2, User, Globe, FileText, QrCode, Image as ImageIcon, Mail, Phone
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface DigitalCard {
  id: string;
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
  qrStyle: string;
  qrEnabled: boolean;
  updatedAt: any;
  createdAt?: any;
}

export default function ManageDigitalCards() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [digitalCards, setDigitalCards] = useState<DigitalCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredCards, setFilteredCards] = useState<DigitalCard[]>([]);
  const [downloadingCards, setDownloadingCards] = useState<Set<string>>(new Set());
  const [qrCodes, setQrCodes] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (user) {
      fetchDigitalCards();
    }
  }, [user]);

  useEffect(() => {
    // Filter cards based on search term with runtime safety
    const filtered = digitalCards.filter(card => 
      `${card.firstName || ''} ${card.lastName || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (card.company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (card.title || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredCards(filtered);
  }, [digitalCards, searchTerm]);

  const fetchDigitalCards = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      // Remove orderBy to avoid composite index requirement - sort client-side instead
      const cardsQuery = query(
        collection(db, "digitalCards"),
        where("ownerId", "==", user.uid)
      );
      
      const cardsSnapshot = await getDocs(cardsQuery);
      const cards = cardsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DigitalCard[];
      
      // Sort cards by updatedAt on client-side to avoid composite index requirement
      const sortedCards = cards.sort((a, b) => {
        const aDate = a.updatedAt?.toDate?.() || new Date(0);
        const bDate = b.updatedAt?.toDate?.() || new Date(0);
        return bDate.getTime() - aDate.getTime();
      });
      
      setDigitalCards(sortedCards);
      
      // Generate QR codes for all cards
      await generateQrCodesForCards(sortedCards);
    } catch (error) {
      console.error("Error fetching digital cards:", error);
      toast({
        title: "Error",
        description: "Failed to load digital cards",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateQrCodesForCards = async (cards: DigitalCard[]) => {
    const newQrCodes = new Map<string, string>();
    
    for (const card of cards) {
      try {
        const vCardContent = buildVCard({
          firstName: card.firstName,
          lastName: card.lastName,
          title: card.title,
          company: card.company,
          email: card.email,
          phone: card.phone,
          website: card.website,
          address: card.address
        });
        
        const qrDataUrl = await generateQrFromText(vCardContent);
        newQrCodes.set(card.id, qrDataUrl);
      } catch (error) {
        console.error(`Error generating QR code for card ${card.id}:`, error);
      }
    }
    
    setQrCodes(newQrCodes);
  };

  const handleCreateNew = () => {
    setLocation("/digital-card");
  };

  const handleEdit = (cardId: string) => {
    setLocation(`/digital-card?edit=${cardId}`);
  };

  const handleDelete = async (cardId: string, cardName: string) => {
    if (!confirm(`Are you sure you want to delete the digital card for ${cardName}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "digitalCards", cardId));
      toast({
        title: "Success",
        description: "Digital card deleted successfully",
      });
      fetchDigitalCards(); // Refresh the list
    } catch (error) {
      console.error("Error deleting digital card:", error);
      toast({
        title: "Error",
        description: "Failed to delete digital card",
        variant: "destructive",
      });
    }
  };

  const handleShare = (publicId: string) => {
    const shareUrl = `${window.location.origin}/share/${publicId}`;
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Link Copied",
      description: "Share link copied to clipboard",
    });
  };

  const handleDownloadVCard = async (card: DigitalCard) => {
    try {
      setDownloadingCards(prev => new Set(prev).add(card.id));
      
      // Generate vCard content
      const vCardContent = buildVCard({
        firstName: card.firstName,
        lastName: card.lastName,
        title: card.title,
        company: card.company,
        email: card.email,
        phone: card.phone,
        website: card.website,
        address: card.address
      });
      
      // Create blob and download
      const blob = new Blob([vCardContent], { type: 'text/vcard;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${card.firstName || 'Contact'}_${card.lastName || 'Card'}.vcf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download Complete",
        description: "vCard file downloaded successfully",
      });
    } catch (error) {
      console.error("Error downloading vCard:", error);
      toast({
        title: "Download Failed",
        description: "Failed to download vCard file",
        variant: "destructive",
      });
    } finally {
      setDownloadingCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(card.id);
        return newSet;
      });
    }
  };

  const waitForImages = (element: HTMLElement): Promise<void> => {
    const images = element.querySelectorAll('img');
    const promises: Promise<void>[] = [];

    images.forEach(img => {
      if (img.complete && img.naturalWidth > 0) {
        return; // Image already loaded
      }

      promises.push(
        new Promise((resolve) => {
          const handleLoad = () => {
            img.removeEventListener('load', handleLoad);
            img.removeEventListener('error', handleError);
            resolve();
          };
          
          const handleError = () => {
            img.removeEventListener('load', handleLoad);
            img.removeEventListener('error', handleError);
            resolve(); // Continue even if image fails
          };

          img.addEventListener('load', handleLoad);
          img.addEventListener('error', handleError);
        })
      );
    });

    return Promise.all(promises).then(() => {});
  };

  const handleDownloadPreview = async (card: DigitalCard) => {
    try {
      setDownloadingCards(prev => new Set(prev).add(card.id));

      // Find the card preview element
      const cardElement = document.querySelector(`[data-card-preview="${card.id}"]`);
      if (!cardElement) {
        throw new Error("Card preview element not found");
      }

      // Wait for all images to load
      await waitForImages(cardElement as HTMLElement);

      // Generate screenshot using html2canvas
      const canvas = await html2canvas(cardElement as HTMLElement, {
        scale: 3,
        useCORS: true,
        allowTaint: false, // Changed to false for CORS safety
        imageTimeout: 15000,
        backgroundColor: null,
      });

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error("Failed to generate image blob");
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${card.firstName || 'Contact'}_${card.lastName || 'Card'}_Preview.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: "Download Complete",
          description: "Card preview downloaded successfully",
        });
      }, 'image/png', 1.0);
    } catch (error) {
      console.error("Error downloading preview:", error);
      toast({
        title: "Download Failed", 
        description: error instanceof Error ? error.message : "Failed to download card preview",
        variant: "destructive",
      });
    } finally {
      setDownloadingCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(card.id);
        return newSet;
      });
    }
  };

  const handleDownloadQR = async (card: DigitalCard) => {
    try {
      setDownloadingCards(prev => new Set(prev).add(card.id));
      
      // Generate vCard content for QR code
      const vCardContent = buildVCard({
        firstName: card.firstName,
        lastName: card.lastName,
        title: card.title,
        company: card.company,
        email: card.email,
        phone: card.phone,
        website: card.website,
        address: card.address
      });
      
      // Generate QR code with company logo if available
      const qrDataUrl = await generateQrFromText(vCardContent, card.companyLogoUrl);
      
      // Convert data URL to blob and download
      const response = await fetch(qrDataUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${card.firstName || 'Contact'}_${card.lastName || 'Card'}_QR.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download Complete",
        description: "QR code image downloaded successfully",
      });
    } catch (error) {
      console.error("Error downloading QR code:", error);
      toast({
        title: "Download Failed",
        description: "Failed to download QR code image",
        variant: "destructive",
      });
    } finally {
      setDownloadingCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(card.id);
        return newSet;
      });
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Unknown";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString();
    } catch (error) {
      return "Invalid date";
    }
  };

  const getTemplateDisplayName = (template: string) => {
    const templateNames: { [key: string]: string } = {
      modern: "Modern Gradient",
      professional: "Professional",
      creative: "Creative",
      minimal: "Minimal",
      luxury: "Luxury",
      tech: "Tech",
      elegant: "Elegant",
      startup: "Startup",
      coffee: "Coffee Shop",
      neon: "Neon"
    };
    return templateNames[template] || template;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your digital cards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center mb-2">
            <CreditCard className="h-8 w-8 mr-3 text-purple-600" />
            Manage Digital Cards
          </h1>
          <p className="text-gray-600">
            {digitalCards.length === 0 
              ? "You haven't created any digital cards yet" 
              : `You have ${digitalCards.length} digital card${digitalCards.length === 1 ? '' : 's'}`
            }
          </p>
        </div>
        <Button 
          onClick={handleCreateNew}
          className="mt-4 sm:mt-0 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          data-testid="button-create-new-card"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New Card
        </Button>
      </div>

      {/* Search */}
      {digitalCards.length > 0 && (
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by name, company, or title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-cards"
            />
          </div>
        </div>
      )}

      {/* Cards Grid */}
      {filteredCards.length === 0 ? (
        <div className="text-center py-12">
          <CreditCard className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            {digitalCards.length === 0 ? "No Digital Cards Yet" : "No Cards Found"}
          </h3>
          <p className="text-gray-500 mb-6">
            {digitalCards.length === 0 
              ? "Create your first professional digital business card" 
              : "Try adjusting your search terms"
            }
          </p>
          {digitalCards.length === 0 && (
            <Button 
              onClick={handleCreateNew}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Card
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCards.map((card) => (
            <Card key={card.id} className="hover:shadow-lg transition-shadow duration-200" data-testid={`card-${card.id}`}>
              <CardContent className="p-6">
                {/* Card Preview */}
                <div 
                  className="h-48 rounded-lg mb-4 p-4 text-white relative overflow-hidden"
                  style={{ 
                    background: `linear-gradient(135deg, ${card.primaryColor || '#3B82F6'}, ${card.secondaryColor || '#1E40AF'})` 
                  }}
                  data-card-preview={card.id}
                >
                  <div className="absolute inset-0 bg-black/10"></div>
                  <div className="relative z-10 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {card.avatarUrl ? (
                          <Avatar className="w-12 h-12 ring-2 ring-white/30">
                            <AvatarImage src={card.avatarUrl} crossOrigin="anonymous" />
                            <AvatarFallback className="bg-white/20 text-white font-bold">
                              {card.firstName?.charAt(0)}{card.lastName?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                            <User className="h-6 w-6 text-white" />
                          </div>
                        )}
                      </div>
                      {card.companyLogoUrl && (
                        <img 
                          src={card.companyLogoUrl} 
                          alt="Company" 
                          className="w-10 h-10 rounded object-contain bg-white/20 p-1"
                          crossOrigin="anonymous"
                        />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1">{card.firstName || ''} {card.lastName || ''}</h3>
                      <p className="text-sm opacity-90 mb-1">{card.title || 'No title'}</p>
                      <p className="text-xs opacity-75 mb-3">{card.company || 'No company'}</p>
                      
                      {/* Contact Info */}
                      <div className="space-y-1">
                        {card.email && (
                          <div className="flex items-center text-xs">
                            <Mail className="h-3 w-3 mr-2" />
                            <span className="truncate">{card.email}</span>
                          </div>
                        )}
                        {card.phone && (
                          <div className="flex items-center text-xs">
                            <Phone className="h-3 w-3 mr-2" />
                            <span>{card.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* QR Code */}
                    <div className="flex justify-center mt-auto">
                      <div className="bg-white p-2 rounded-lg">
                        {qrCodes.get(card.id) ? (
                          <img 
                            src={qrCodes.get(card.id)} 
                            alt="QR Code" 
                            className="w-8 h-8 object-contain" 
                            crossOrigin="anonymous"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-300 rounded flex items-center justify-center">
                            <QrCode className="h-4 w-4 text-gray-600" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Info */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      {getTemplateDisplayName(card.template || 'modern')}
                    </Badge>
                    <Badge variant={card.isPublic ? "default" : "outline"} className="text-xs">
                      {card.isPublic ? "Public" : "Private"}
                    </Badge>
                  </div>

                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="h-4 w-4 mr-2" />
                    Updated {formatDate(card.updatedAt)}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-3">
                    {/* Primary Actions Row */}
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleEdit(card.id)}
                        className="flex-1"
                        data-testid={`button-edit-${card.id}`}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleShare(card.publicId)}
                        data-testid={`button-share-${card.id}`}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDelete(card.id, `${card.firstName || ''} ${card.lastName || 'Unknown'}`)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        data-testid={`button-delete-${card.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Download Actions Row */}
                    <div className="grid grid-cols-3 gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDownloadVCard(card)}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        disabled={downloadingCards.has(card.id)}
                        data-testid={`button-download-vcard-${card.id}`}
                      >
                        {downloadingCards.has(card.id) ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-1"></div>
                        ) : (
                          <FileText className="h-4 w-4 mr-1" />
                        )}
                        vCard
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDownloadPreview(card)}
                        className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                        disabled={downloadingCards.has(card.id)}
                        data-testid={`button-download-png-${card.id}`}
                      >
                        {downloadingCards.has(card.id) ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-1"></div>
                        ) : (
                          <ImageIcon className="h-4 w-4 mr-1" />
                        )}
                        PNG
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDownloadQR(card)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        disabled={downloadingCards.has(card.id)}
                        data-testid={`button-download-qr-${card.id}`}
                      >
                        {downloadingCards.has(card.id) ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-1"></div>
                        ) : (
                          <QrCode className="h-4 w-4 mr-1" />
                        )}
                        QR Code
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}