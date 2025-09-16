import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Lock, CreditCard, Users, Layers, Camera, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

interface UsageLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: 'contact' | 'group' | 'digitalCard' | 'aiScan';
  currentCount: number;
  limit: number;
}

export default function UsageLimitModal({ 
  isOpen, 
  onClose, 
  feature, 
  currentCount, 
  limit 
}: UsageLimitModalProps) {
  const [, setLocation] = useLocation();

  const featureConfig = {
    contact: {
      icon: Users,
      title: "Contact Limit Reached",
      description: "You've reached the limit of 1 contact for free users.",
      color: "text-blue-600"
    },
    group: {
      icon: Layers,
      title: "Group Limit Reached", 
      description: "You've reached the limit of 1 group for free users.",
      color: "text-green-600"
    },
    digitalCard: {
      icon: CreditCard,
      title: "Digital Card Limit Reached",
      description: "You've reached the maximum limit of digital cards.",
      color: "text-purple-600"
    },
    aiScan: {
      icon: Camera,
      title: "AI Scan Limit Reached",
      description: "You've reached the limit of 1 AI scan for free users.",
      color: "text-orange-600"
    }
  };

  const config = featureConfig[feature];
  const IconComponent = config.icon;

  const handleUpgrade = () => {
    onClose();
    setLocation("#");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg bg-gray-100 ${config.color}`}>
              <IconComponent className="h-6 w-6" />
            </div>
            <span>{config.title}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <div className="text-center mb-6">
            <Lock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              {config.description}
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Current Usage:</span>
                <Badge variant="outline" className="text-sm">
                  {currentCount} / {limit === Infinity ? '∞' : limit}
                </Badge>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center space-x-3 mb-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Upgrade Benefits</h3>
              </div>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Unlimited contacts and groups</li>
                <li>• Unlimited AI business card scanning</li>
                <li>• Advanced features and templates</li>
                <li>• Priority support</li>
              </ul>
            </div>

            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpgrade}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Upgrade Now
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
