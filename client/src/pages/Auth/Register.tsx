import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Eye, EyeOff, Users, Shield, Sparkles, Zap } from "lucide-react";
import { FaGoogle } from "react-icons/fa";
import { auth } from "@/lib/firebase";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";

export default function Register() {
  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { register } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Password validation rules
  const passwordRules = {
    hasUpper: /[A-Z]/.test(formData.password),
    hasLower: /[a-z]/.test(formData.password),
    hasNumber: /[0-9]/.test(formData.password),
    hasSymbol: /[^A-Za-z0-9]/.test(formData.password),
    minLength: formData.password.length >= 8,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    const allValid = Object.values(passwordRules).every(Boolean);
    if (!allValid) {
      toast({
        title: "Invalid Password",
        description: "Password must meet all requirements",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await register(formData.email, formData.password, formData.displayName);
      toast({ title: "Welcome!", description: "Account created successfully" });
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Something went wrong.",
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
      provider.addScope("email");
      provider.addScope("profile");

      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        toast({
          title: "Welcome!",
          description: "Successfully signed up with Google",
        });
        setLocation("/");
      }
    } catch (error: any) {
      toast({
        title: "Sign-up Failed",
        description: error.message || "Google sign-up failed.",
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
      delay: "0s",
    },
    {
      icon: Sparkles,
      title: "AI Scanning",
      description: "Intelligent text recognition technology",
      color: "purple",
      delay: "0.2s",
    },
    {
      icon: Users,
      title: "Contact Sync",
      description: "Seamless integration with your contacts",
      color: "green",
      delay: "0.4s",
    },
    {
      icon: Shield,
      title: "Secure Storage",
      description: "End-to-end encrypted data protection",
      color: "red",
      delay: "0.6s",
    },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      blue: "bg-blue-100 text-blue-600 border-blue-200",
      purple: "bg-purple-100 text-purple-600 border-purple-200",
      green: "bg-green-100 text-green-600 border-green-200",
      red: "bg-red-100 text-red-600 border-red-200",
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 relative overflow-hidden">
      {/* Company Logo */}
      <div
        className={`absolute top-6 left-6 z-10 transition-all duration-1000 ${
          mounted ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
        }`}
      >
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

      <div className="flex items-center justify-center min-h-screen py-6 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-6xl flex items-center justify-between gap-12">
          {/* Left Features */}
          <div
            className={`hidden lg:block flex-1 transition-all duration-1000 delay-300 ${
              mounted ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
            }`}
          >
            <div className="space-y-8">
              <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                Join the Future of
              </h2>
              <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-6">
                Business Networking
              </h2>
              <p className="text-xl text-gray-600 leading-relaxed">
                Create your account today and experience AI-powered scanning, intelligent organization, and seamless networking.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className={`group p-6 rounded-2xl border-2 bg-white/70 backdrop-blur-sm shadow-lg hover:shadow-xl transform hover:-translate-y-2 transition-all duration-500 ${getColorClasses(
                      feature.color
                    )}`}
                    style={{
                      animationDelay: feature.delay,
                      animation: mounted
                        ? `slideInUp 0.8s ease-out ${feature.delay} both`
                        : "none",
                    }}
                  >
                    <div className="flex items-start space-x-4">
                      <div
                        className={`p-3 rounded-xl ${getColorClasses(
                          feature.color
                        )} group-hover:scale-110 transition-transform duration-300`}
                      >
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

          {/* Right Register Form */}
          <div
            className={`w-full max-w-md h-screen flex flex-col justify-center px-4 transition-all duration-1000 delay-500 ${
              mounted ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
            }`}
          >
            <Card className="flex flex-col justify-between h-full shadow-2xl border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-bold text-gray-900">
                  Create Account
                </CardTitle>
                <p className="text-gray-600 mt-2">Get started with your free account</p>
              </CardHeader>

              {/* Scrollable Form */}
              <CardContent className="flex-1 overflow-y-auto px-6 space-y-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="displayName">Full Name</Label>
                    <Input
                      id="displayName"
                      name="displayName"
                      value={formData.displayName}
                      onChange={(e) =>
                        setFormData({ ...formData, displayName: e.target.value })
                      }
                      required
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      required
                      placeholder="Enter your email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        required
                        placeholder="Enter your password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <div className="mt-2 space-y-1 text-sm">
                      <PasswordRule label="At least 8 characters" valid={passwordRules.minLength} />
                      <PasswordRule label="One uppercase letter" valid={passwordRules.hasUpper} />
                      <PasswordRule label="One lowercase letter" valid={passwordRules.hasLower} />
                      <PasswordRule label="One number" valid={passwordRules.hasNumber} />
                      <PasswordRule label="One special symbol" valid={passwordRules.hasSymbol} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          confirmPassword: e.target.value,
                        })
                      }
                      required
                      placeholder="Re-enter your password"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium shadow-lg transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                    disabled={loading}
                  >
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>

                <div className="relative">
                  <Separator className="my-6" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-white px-4 text-sm text-gray-500">or</span>
                  </div>
                </div>

                <Button
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading || loading}
                  className="w-full h-12 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 shadow-sm"
                  variant="outline"
                >
                  <FaGoogle className="mr-3 h-5 w-5 text-red-500" />
                  {googleLoading ? "Signing up..." : "Continue with Google"}
                </Button>

                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    Already have an account?{" "}
                    <Link
                      href="/login"
                      className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
                    >
                      Sign in
                    </Link>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

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

// ✅ Password rule helper
function PasswordRule({ label, valid }: { label: string; valid: boolean }) {
  return (
    <p className={`flex items-center gap-2 ${valid ? "text-green-600" : "text-gray-500"}`}>
      {valid ? "✔️" : "❌"} {label}
    </p>
  );
}
