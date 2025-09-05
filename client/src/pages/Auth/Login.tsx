import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Mail, Zap, Eye, EyeOff, Users, Shield, Sparkles } from "lucide-react";
import { FaGoogle } from "react-icons/fa";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { login, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Animation mounting effect
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check authentication state and redirect if already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && user) {
        setLocation("/");
      }
      setAuthChecking(false);
    });

    return () => unsubscribe();
  }, [user, setLocation]);

  // Show loading while checking auth state
  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login(email, password);
      
      const checkAuthState = () => {
        return new Promise((resolve) => {
          const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
              unsubscribe();
              resolve(user);
            }
          });
          
          setTimeout(() => {
            unsubscribe();
            resolve(null);
          }, 5000);
        });
      };
      
      await checkAuthState();
      
      toast({
        title: "Welcome back!",
        description: "Successfully signed in to your account",
      });
      
      setTimeout(() => {
        setLocation("/");
      }, 100);
      
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Sign-in Failed",
        description:"Failed to sign in. Please check your credentials.",
        variant: "destructive",
      });
      
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      
      const result = await signInWithPopup(auth, provider);
      
      if (result.user) {
        toast({
          title: "Welcome!",
          description: "Successfully signed in with Google",
        });
        
        setTimeout(() => {
          setLocation("/");
        }, 100);
      }
      
    } catch (error) {
      console.error("Google sign-in error:", error);
      
      let errorMessage = "Failed to sign in with Google. Please try again.";
      
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = "Sign-in was cancelled.";
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = "Popup was blocked. Please allow popups for this site.";
      }
      
      toast({
        title: "Sign-in Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const features = [
    {
      icon: CreditCard,
      title: "Digital Cards",
      description: "Convert physical cards to digital format",
      color: "blue",
      delay: "0s"
    },
    {
      icon: Sparkles,
      title: "AI Scanning",
      description: "Intelligent text recognition technology",
      color: "purple",
      delay: "0.2s"
    },
    {
      icon: Users,
      title: "Contact Sync",
      description: "Seamless integration with your contacts",
      color: "green",
      delay: "0.4s"
    },
    {
      icon: Shield,
      title: "Secure Storage",
      description: "End-to-end encrypted data protection",
      color: "red",
      delay: "0.6s"
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: "bg-blue-100 text-blue-600 border-blue-200",
      purple: "bg-purple-100 text-purple-600 border-purple-200",
      green: "bg-green-100 text-green-600 border-green-200",
      red: "bg-red-100 text-red-600 border-red-200"
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 relative overflow-hidden">
      {/* Company Logo - Top Left */}
      <div className={`absolute top-6 left-6 z-10 transition-all duration-1000 ${mounted ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}`}>
        <div className="flex items-center space-x-3 bg-white/90 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-lg border border-white/20">
          <div className="relative">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg">
              <Zap className="text-white h-6 w-6" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-pulse"></div>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">CardManager</h3>
            <p className="text-xs text-gray-600">AI Business Solutions</p>
          </div>
        </div>
      </div>

      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 bg-blue-200/30 rounded-full animate-pulse"></div>
        <div className="absolute top-40 right-32 w-24 h-24 bg-purple-200/30 rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute bottom-32 left-40 w-16 h-16 bg-green-200/30 rounded-full animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="flex items-center justify-center min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-6xl flex items-center justify-between gap-12">
          
          {/* Left Side - Features Animation */}
          <div className={`hidden lg:block flex-1 transition-all duration-1000 delay-300 ${mounted ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}`}>
            <div className="space-y-8">
              <div className="text-left">
                <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                  Revolutionize Your
                </h2>
                <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-6">
                  Business Networking
                </h2>
                <p className="text-xl text-gray-600 leading-relaxed">
                  Transform the way you manage business cards with AI-powered scanning, 
                  intelligent organization, and seamless digital transformation.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className={`group p-6 rounded-2xl border-2 bg-white/70 backdrop-blur-sm shadow-lg hover:shadow-xl transform hover:-translate-y-2 transition-all duration-500 ${getColorClasses(feature.color)}`}
                    style={{
                      animationDelay: feature.delay,
                      animation: mounted ? `slideInUp 0.8s ease-out ${feature.delay} both` : 'none'
                    }}
                  >
                    <div className="flex items-start space-x-4">
                      <div className={`p-3 rounded-xl ${getColorClasses(feature.color)} group-hover:scale-110 transition-transform duration-300`}>
                        <feature.icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-gray-700 transition-colors">
                          {feature.title}
                        </h3>
                        <p className="text-sm text-gray-600 group-hover:text-gray-500 transition-colors">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className={`w-full max-w-md transition-all duration-1000 delay-500 ${mounted ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
            {/* Logo and Header for mobile */}
            <div className="text-center mb-8 lg:hidden">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 mb-4 shadow-xl">
                <Zap className="text-white h-8 w-8" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                CardManager
              </h1>
              <p className="text-gray-600 mt-2">AI-Powered Business Card Management</p>
            </div>

            <Card className="shadow-2xl border-0 bg-white/90 backdrop-blur-sm hover:shadow-3xl transition-all duration-500 transform hover:scale-[1.02]">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-bold text-gray-900">Welcome Back</CardTitle>
                <p className="text-gray-600 mt-2">Sign in to continue your journey</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Email Sign In Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="email" className="text-gray-700 font-medium">Email address</Label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400 transition-colors" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="pl-10 h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-300 hover:border-gray-400"
                        placeholder="Enter your email"
                        disabled={loading || googleLoading}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="password" className="text-gray-700 font-medium">Password</Label>
                    <div className="relative mt-1">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 pr-10 transition-all duration-300 hover:border-gray-400"
                        placeholder="Enter your password"
                        disabled={loading || googleLoading}
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-all duration-200"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={loading || googleLoading}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium shadow-lg transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]" 
                    disabled={loading || googleLoading}
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Signing in...
                      </div>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>

                <div className="relative">
                  <Separator className="my-6" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-white px-4 text-sm text-gray-500">or</span>
                  </div>
                </div>

                {/* Google Sign In */}
                <Button
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading || loading}
                  className="w-full h-12 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 shadow-sm transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  variant="outline"
                >
                  <FaGoogle className="mr-3 h-5 w-5 text-red-500" />
                  {googleLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                      Signing in...
                    </div>
                  ) : (
                    "Continue with Google"
                  )}
                </Button>
                
                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    Don't have an account?{" "}
                    <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                      Create account
                    </Link>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add custom keyframes for animations */}
      <style jsx>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .shadow-3xl {
          box-shadow: 0 35px 60px -12px rgba(0, 0, 0, 0.25);
        }
      `}</style>
    </div>
  );
}