import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Send, AlertTriangle } from "lucide-react";

interface Settings {
  displayName: string;
  businessName: string;
  defaultWhatsAppNumber: string;
  timezone: string;
  language: string;
  updatedAt: Date;
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    displayName: "",
    businessName: "",
    defaultWhatsAppNumber: "",
    timezone: "PST",
    language: "English",
    updatedAt: new Date(),
  });
  const [apiCredentials, setApiCredentials] = useState({
    whatsappToken: "",
    phoneNumberId: "",
  });

  useEffect(() => {
    if (!user) return;
    fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, "settings", user!.uid));
      
      if (settingsDoc.exists()) {
        const settingsData = settingsDoc.data();
        setSettings({
          ...settingsData,
          updatedAt: settingsData.updatedAt?.toDate() || new Date(),
        } as Settings);
      } else {
        // Initialize with user data
        setSettings(prev => ({
          ...prev,
          displayName: user!.displayName || "",
        }));
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast({
        title: "Error",
        description: "Failed to fetch settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    
    try {
      await setDoc(doc(db, "settings", user!.uid), {
        ...settings,
        ownerId: user!.uid,
        updatedAt: serverTimestamp(),
      });

      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestTemplate = () => {
    // Placeholder function - in real implementation, this would test WhatsApp Business API
    toast({
      title: "Test Template",
      description: "WhatsApp template test sent (placeholder functionality)",
    });
  };

  const handleFieldChange = (field: keyof Settings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
            <div className="space-y-6">
              <div className="bg-gray-200 h-64 rounded-lg"></div>
              <div className="bg-gray-200 h-48 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">Settings</h2>
            <p className="mt-1 text-sm text-gray-500">Manage your account and application preferences</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="mt-6 space-y-6">
          {/* Profile Settings */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">Profile Information</h3>
              
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={settings.displayName}
                    onChange={(e) => handleFieldChange('displayName', e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    value={settings.businessName}
                    onChange={(e) => handleFieldChange('businessName', e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="defaultWhatsApp">Default WhatsApp Number</Label>
                  <Input
                    id="defaultWhatsApp"
                    type="tel"
                    value={settings.defaultWhatsAppNumber}
                    onChange={(e) => handleFieldChange('defaultWhatsAppNumber', e.target.value)}
                    className="mt-1"
                  />
                  <p className="mt-1 text-sm text-gray-500">Used for "Send Profile" feature</p>
                </div>

                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={settings.timezone} onValueChange={(value) => handleFieldChange('timezone', value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PST">Pacific Standard Time (PST)</SelectItem>
                      <SelectItem value="EST">Eastern Standard Time (EST)</SelectItem>
                      <SelectItem value="CST">Central Standard Time (CST)</SelectItem>
                      <SelectItem value="MST">Mountain Standard Time (MST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="language">Language</Label>
                  <Select value={settings.language} onValueChange={(value) => handleFieldChange('language', value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Spanish">Spanish</SelectItem>
                      <SelectItem value="French">French</SelectItem>
                      <SelectItem value="German">German</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* WhatsApp Business Integration */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">WhatsApp Business Integration</h3>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">API Credentials</h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>These fields are for UI validation only. Never store API credentials in the database.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <Label htmlFor="whatsappToken">WhatsApp Business API Token</Label>
                  <Input
                    id="whatsappToken"
                    type="password"
                    value={apiCredentials.whatsappToken}
                    onChange={(e) => setApiCredentials(prev => ({ ...prev, whatsappToken: e.target.value }))}
                    placeholder="Enter your API token"
                    className="mt-1"
                  />
                  <p className="mt-1 text-sm text-gray-500">Required for sending messages via WhatsApp Business API</p>
                </div>

                <div>
                  <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                  <Input
                    id="phoneNumberId"
                    value={apiCredentials.phoneNumberId}
                    onChange={(e) => setApiCredentials(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                    placeholder="Enter Phone Number ID"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Button variant="outline" onClick={handleTestTemplate}>
                    <Send className="h-4 w-4 mr-2" />
                    Send Test Template
                  </Button>
                  <p className="mt-1 text-sm text-gray-500">Test your WhatsApp Business API configuration</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
