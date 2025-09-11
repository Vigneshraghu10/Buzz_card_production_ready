import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, Zap, Crown, Loader2 } from "lucide-react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PricingPlan {
  id: string;
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  popular?: boolean;
  razorpayPlanId: string;
}

const pricingPlans: PricingPlan[] = [
  {
    id: "basic",
    name: "Basic Plan",
    price: 999,
    period: "year",
    description: "Perfect for small businesses and individual professionals",
    features: [
      "Unlimited business card scanning",
      "AI-powered data extraction",
      "Up to 1,000 contacts storage",
      "Basic group management",
      "WhatsApp integration",
      "Email support"
    ],
    razorpayPlanId: "plan_basic_yearly"
  },
  {
    id: "premium",
    name: "Premium Plan",
    price: 1999,
    period: "year",
    description: "Advanced features for growing businesses",
    features: [
      "Everything in Basic Plan",
      "Unlimited contacts storage",
      "Advanced group management",
      "Digital business card creation",
      "QR code generation",
      "Bulk upload processing",
      "Template management",
      "Priority support"
    ],
    popular: true,
    razorpayPlanId: "plan_premium_yearly"
  }
];

export default function PricingSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [userSubscription, setUserSubscription] = useState<any>(null);

  // Load user subscription status
  const checkSubscriptionStatus = async () => {
    if (!user) return;
    
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserSubscription(userData.subscription);
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  };

  // Initialize Razorpay and handle payment
  const handlePayment = async (plan: PricingPlan) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to subscribe to a plan",
        variant: "destructive",
      });
      return;
    }

    setLoading(plan.id);

    try {
      // Load Razorpay script if not already loaded
      if (!window.Razorpay) {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
        });
      }

      // Create order on backend (you'll need to implement this API endpoint)
      const orderResponse = await fetch('/api/create-razorpay-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: plan.id,
          amount: plan.price,
          userId: user.uid
        })
      });

      if (!orderResponse.ok) {
        throw new Error('Failed to create payment order');
      }

      const orderData = await orderResponse.json();

      // Razorpay options
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID, // Your Razorpay key ID
        amount: plan.price * 100, // Amount in paise
        currency: 'INR',
        name: 'WhatsApp Business Card Manager',
        description: `${plan.name} - Yearly Subscription`,
        order_id: orderData.orderId,
        handler: async (response: any) => {
          try {
            // Verify payment on backend
            const verifyResponse = await fetch('/api/verify-razorpay-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                userId: user.uid,
                planId: plan.id
              })
            });

            if (verifyResponse.ok) {
              // Update user subscription in Firebase
              const expiryDate = new Date();
              expiryDate.setFullYear(expiryDate.getFullYear() + 1);

              await updateDoc(doc(db, "users", user.uid), {
                subscription: {
                  planId: plan.id,
                  planName: plan.name,
                  status: 'active',
                  startDate: new Date(),
                  expiryDate: expiryDate,
                  paymentId: response.razorpay_payment_id,
                  orderId: response.razorpay_order_id
                },
                features: {
                  unlimitedScanning: true,
                  contactStorage: plan.id === 'premium' ? 'unlimited' : '1000',
                  groupManagement: true,
                  digitalCards: plan.id === 'premium',
                  bulkUpload: plan.id === 'premium',
                  templateManagement: plan.id === 'premium'
                }
              });

              toast({
                title: "Payment Successful!",
                description: `You've successfully subscribed to ${plan.name}. All features are now unlocked!`,
              });

              // Refresh subscription status
              checkSubscriptionStatus();
            } else {
              throw new Error('Payment verification failed');
            }
          } catch (error) {
            console.error('Payment verification error:', error);
            toast({
              title: "Payment Verification Failed",
              description: "Please contact support with your payment ID",
              variant: "destructive",
            });
          }
        },
        prefill: {
          name: user.displayName || user.email,
          email: user.email,
        },
        theme: {
          color: '#3B82F6'
        },
        modal: {
          ondismiss: () => {
            setLoading(null);
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to initiate payment. Please try again.",
        variant: "destructive",
      });
      setLoading(null);
    }
  };

  // Check if user has active subscription
  const hasActiveSubscription = userSubscription && 
    userSubscription.status === 'active' && 
    new Date() < new Date(userSubscription.expiryDate?.toDate?.() || userSubscription.expiryDate);

  return (
    <div className="py-12 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            Choose Your Plan
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Unlock powerful AI-driven business card management features
          </p>
        </div>

        {hasActiveSubscription && (
          <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <Check className="h-5 w-5 text-green-600 mr-2" />
              <div>
                <p className="text-green-800 font-medium">
                  You have an active {userSubscription.planName} subscription
                </p>
                <p className="text-green-600 text-sm">
                  Expires on: {new Date(userSubscription.expiryDate?.toDate?.() || userSubscription.expiryDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-2 max-w-4xl mx-auto">
          {pricingPlans.map((plan) => (
            <Card key={plan.id} className={`relative ${plan.popular ? 'border-blue-500 shadow-lg' : ''}`}>
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-blue-500 text-white">
                    <Crown className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">
                  {plan.name}
                  {plan.popular && <Zap className="inline h-5 w-5 ml-2 text-yellow-500" />}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900">₹{plan.price.toLocaleString()}</span>
                  <span className="text-lg text-gray-600">/{plan.period}</span>
                </div>
              </CardHeader>
              
              <CardContent>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  className={`w-full ${plan.popular ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                  onClick={() => handlePayment(plan)}
                  disabled={loading === plan.id || hasActiveSubscription}
                  variant={plan.popular ? 'default' : 'outline'}
                >
                  {loading === plan.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : hasActiveSubscription ? (
                    userSubscription.planId === plan.id ? 'Current Plan' : 'Upgrade'
                  ) : (
                    `Subscribe to ${plan.name}`
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Why Choose Our Business Card Manager?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="text-center">
                <div className="bg-blue-100 rounded-full p-3 w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-blue-600" />
                </div>
                <h4 className="font-medium text-gray-900">AI-Powered OCR</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Advanced AI extracts data from multiple business cards in one image
                </p>
              </div>
              <div className="text-center">
                <div className="bg-green-100 rounded-full p-3 w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                  <Check className="h-6 w-6 text-green-600" />
                </div>
                <h4 className="font-medium text-gray-900">QR Code Support</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Automatically detects and extracts contact info from QR codes
                </p>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 rounded-full p-3 w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                  <Crown className="h-6 w-6 text-purple-600" />
                </div>
                <h4 className="font-medium text-gray-900">WhatsApp Integration</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Seamlessly connect with WhatsApp Business for customer outreach
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}