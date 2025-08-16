import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, Zap, Share2, Clock } from "lucide-react";

export default function NFCCard() {
  return (
    <div className="py-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="text-center">
          {/* Header */}
          <div className="mb-8">
            <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-primary/10 mb-6">
              <Smartphone className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">NFC Digital Cards</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Transform your networking with smart NFC-enabled digital business cards. 
              Share your contact information instantly with just a tap.
            </p>
          </div>

          {/* Coming Soon Badge */}
          <div className="inline-flex items-center px-6 py-3 rounded-full text-lg font-medium bg-gradient-to-r from-primary/10 to-purple-100 text-primary border border-primary/20 mb-8">
            <Clock className="h-5 w-5 mr-2" />
            Coming Soon
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <Card className="border-2 border-dashed border-gray-200">
              <CardContent className="p-8 text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
                  <Zap className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Instant Sharing</h3>
                <p className="text-gray-600">
                  Simply tap your NFC card on any smartphone to instantly share your digital business card.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-dashed border-gray-200">
              <CardContent className="p-8 text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                  <Share2 className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Always Updated</h3>
                <p className="text-gray-600">
                  Your NFC card automatically reflects any changes made to your digital profile in real-time.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-dashed border-gray-200">
              <CardContent className="p-8 text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-purple-100 mb-4">
                  <Smartphone className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Universal Compatibility</h3>
                <p className="text-gray-600">
                  Works with all NFC-enabled smartphones without requiring any special apps to be installed.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Call to Action */}
          <Card className="bg-gradient-to-r from-primary/5 to-purple-50 border border-primary/20">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Be the first to know!</h2>
              <p className="text-gray-600 mb-6 max-w-lg mx-auto">
                Get notified when NFC digital cards become available. Join our waitlist to secure early access 
                and special launch pricing.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button size="lg" disabled className="cursor-not-allowed opacity-60">
                  Join Waitlist
                </Button>
                <Button variant="outline" size="lg" disabled className="cursor-not-allowed opacity-60">
                  Learn More
                </Button>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Expected launch: Q2 2024
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
