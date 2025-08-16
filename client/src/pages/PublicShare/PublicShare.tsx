import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { buildVCard } from "@/utils/vcard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Download, Mail, Phone, Globe, MapPin } from "lucide-react";

interface PublicDigitalCard {
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
  isPublic: boolean;
}

export default function PublicShare() {
  const [match, params] = useRoute("/share/:publicId");
  const [card, setCard] = useState<PublicDigitalCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!params?.publicId) return;
    fetchPublicCard(params.publicId);
  }, [params?.publicId]);

  const fetchPublicCard = async (publicId: string) => {
    try {
      const cardsQuery = query(
        collection(db, "digitalCards"), 
        where("publicId", "==", publicId),
        where("isPublic", "==", true)
      );
      const cardsSnapshot = await getDocs(cardsQuery);
      
      if (!cardsSnapshot.empty) {
        const cardData = cardsSnapshot.docs[0].data() as PublicDigitalCard;
        setCard(cardData);
      } else {
        setNotFound(true);
      }
    } catch (error) {
      console.error("Error fetching public card:", error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadVCard = () => {
    if (!card) return;

    const vCardData = buildVCard({
      firstName: card.firstName,
      lastName: card.lastName,
      title: card.title,
      company: card.company,
      email: card.email,
      phone: card.phone,
      website: card.website,
      address: card.address,
    });

    const blob = new Blob([vCardData], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${card.firstName}_${card.lastName}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (notFound || !card) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <div className="mb-4">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
                <span className="text-red-600 text-2xl">⚠️</span>
              </div>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Card Not Found</h1>
            <p className="text-gray-600 mb-4">
              The digital business card you're looking for doesn't exist or is no longer available.
            </p>
            <Button variant="outline" onClick={() => window.history.back()}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-md mx-auto px-4">
        <Card className="shadow-lg">
          <CardContent className="p-0">
            {/* Header with gradient background */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-t-lg">
              <div className="text-center">
                <Avatar className="mx-auto h-24 w-24 mb-4 ring-4 ring-white shadow-lg">
                  <AvatarImage src={card.avatarUrl} />
                  <AvatarFallback className="bg-primary text-white text-2xl">
                    {card.firstName.charAt(0)}{card.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  {card.firstName} {card.lastName}
                </h1>
                <p className="text-primary font-semibold mb-1">{card.title}</p>
                <p className="text-gray-600">{card.company}</p>
              </div>
            </div>

            {/* Contact Information */}
            <div className="p-6 space-y-4">
              {card.email && (
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <a 
                      href={`mailto:${card.email}`}
                      className="text-gray-900 hover:text-primary transition-colors"
                    >
                      {card.email}
                    </a>
                  </div>
                </div>
              )}

              {card.phone && (
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <a 
                      href={`tel:${card.phone}`}
                      className="text-gray-900 hover:text-primary transition-colors"
                    >
                      {card.phone}
                    </a>
                  </div>
                </div>
              )}

              {card.website && (
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <a 
                      href={card.website.startsWith('http') ? card.website : `https://${card.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-900 hover:text-primary transition-colors"
                    >
                      {card.website}
                    </a>
                  </div>
                </div>
              )}

              {card.address && (
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 whitespace-pre-line">{card.address}</p>
                  </div>
                </div>
              )}

              {/* Services */}
              {card.services && (
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-2">Services</h3>
                  <p className="text-gray-600 text-sm whitespace-pre-line">{card.services}</p>
                </div>
              )}

              {/* Save Contact Button */}
              <div className="pt-4">
                <Button 
                  onClick={handleDownloadVCard}
                  className="w-full"
                  size="lg"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Save Contact (.vcf)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Branding */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            Powered by <span className="font-semibold text-primary">CardManager</span>
          </p>
        </div>
      </div>
    </div>
  );
}
