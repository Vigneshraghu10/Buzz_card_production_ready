import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChartLine, 
  Users, 
  Layers, 
  FileText, 
  CloudUpload, 
  Camera, 
  CreditCard, 
  Settings, 
  Smartphone, 
  LogOut,
  Zap,
  Sparkles 
} from "lucide-react";

const navigation = [
  { 
    name: "Dashboard", 
    href: "/", 
    icon: ChartLine, 
    description: "Overview & Analytics"
  },
  { 
    name: "Contacts", 
    href: "/contacts", 
    icon: Users, 
    description: "Manage your contacts"
  },
  { 
    name: "Groups", 
    href: "/groups", 
    icon: Layers, 
    description: "Organize contacts"
  },
  { 
    name: "Templates", 
    href: "/templates", 
    icon: FileText, 
    description: "Message templates"
  },
  { 
    name: "AI Card Scanner", 
    href: "/bulk-uploads", 
    icon: Sparkles, 
    description: "Bulk AI extraction",
    isNew: true
  },
  { 
    name: "Single Scan", 
    href: "/scanned-cards", 
    icon: Camera, 
    description: "Individual card scan"
  },
  { 
    name: "Digital Card", 
    href: "/digital-card", 
    icon: CreditCard, 
    description: "Your digital profile"
  },
  { 
    name: "Settings", 
    href: "/settings", 
    icon: Settings, 
    description: "App preferences"
  },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();

  return (
    <div className="hidden lg:flex lg:flex-shrink-0">
      <div className="flex flex-col w-72">
        <div className="flex flex-col flex-grow bg-gradient-to-b from-slate-900 to-slate-800 pt-5 pb-4 overflow-y-auto shadow-2xl">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 px-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Zap className="text-white h-5 w-5" />
              </div>
              <div className="ml-3">
                <h1 className="text-xl font-bold text-white">CardManager</h1>
                <p className="text-xs text-slate-300">AI-Powered Business Cards</p>
              </div>
            </div>
          </div>
          
          {/* User Profile */}
          <div className="mt-6 px-6">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {user?.displayName || 'User'}
                  </p>
                  <p className="text-xs text-slate-300 truncate">
                    {user?.email}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="mt-8 flex-1 px-4 space-y-2">
            {navigation.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.name} href={item.href}>
                  <div className={`
                    group flex items-center px-4 py-3 text-sm font-medium rounded-xl cursor-pointer transition-all duration-200
                    ${isActive 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-105' 
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                    }
                  `}>
                    <item.icon className={`
                      mr-3 h-5 w-5 transition-all duration-200
                      ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}
                    `} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span>{item.name}</span>
                        {item.isNew && (
                          <Badge className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5">
                            NEW
                          </Badge>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 ${
                        isActive ? 'text-blue-100' : 'text-slate-400'
                      }`}>
                        {item.description}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
            
            {/* Divider */}
            <div className="border-t border-slate-700 my-6"></div>
            
            {/* NFC Card - Coming Soon */}
            <div className="group flex items-center px-4 py-3 text-sm font-medium rounded-xl text-slate-400 cursor-not-allowed">
              <Smartphone className="text-slate-500 mr-3 h-5 w-5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span>NFC Card</span>
                  <Badge className="ml-2 bg-amber-500 text-white text-xs px-2 py-0.5">
                    SOON
                  </Badge>
                </div>
                <p className="text-xs mt-0.5 text-slate-500">
                  Tap to share contacts
                </p>
              </div>
            </div>
            
            {/* Logout */}
            <Button
              variant="ghost"
              onClick={logout}
              className="w-full justify-start text-red-400 hover:bg-red-900/20 hover:text-red-300 mt-6 rounded-xl px-4 py-3"
            >
              <LogOut className="text-red-400 mr-3 h-5 w-5" />
              <div className="text-left">
                <div>Logout</div>
                <div className="text-xs text-red-400/70">Sign out safely</div>
              </div>
            </Button>
          </nav>
        </div>
      </div>
    </div>
  );
}
