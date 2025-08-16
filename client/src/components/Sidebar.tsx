import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
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
  LogOut 
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: ChartLine },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Groups", href: "/groups", icon: Layers },
  { name: "Templates", href: "/templates", icon: FileText },
  { name: "Bulk Uploads", href: "/bulk-uploads", icon: CloudUpload },
  { name: "Scanned Cards", href: "/scanned-cards", icon: Camera },
  { name: "Digital Card", href: "/digital-card", icon: CreditCard },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { logout } = useAuth();

  return (
    <div className="hidden lg:flex lg:flex-shrink-0">
      <div className="flex flex-col w-64">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200 pt-5 pb-4 overflow-y-auto">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 px-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <CreditCard className="text-white h-4 w-4" />
              </div>
              <h1 className="ml-3 text-lg font-semibold text-gray-900">CardManager</h1>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="mt-8 flex-1 px-2 space-y-1">
            {navigation.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.name} href={item.href}>
                  <div className={`
                    group flex items-center px-2 py-2 text-sm font-medium rounded-md cursor-pointer
                    ${isActive 
                      ? 'bg-primary/10 border-r-2 border-primary text-primary' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}>
                    <item.icon className={`
                      mr-3 h-4 w-4
                      ${isActive ? 'text-primary' : 'text-gray-400'}
                    `} />
                    {item.name}
                  </div>
                </Link>
              );
            })}
            
            {/* Divider */}
            <div className="border-t border-gray-200 my-4"></div>
            
            {/* NFC Card - Coming Soon */}
            <div className="text-gray-400 cursor-not-allowed group flex items-center px-2 py-2 text-sm font-medium rounded-md">
              <Smartphone className="text-gray-300 mr-3 h-4 w-4" />
              NFC Card
              <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">Soon</span>
            </div>
            
            {/* Logout */}
            <Button
              variant="ghost"
              onClick={logout}
              className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700 mt-8"
            >
              <LogOut className="text-red-500 mr-3 h-4 w-4" />
              Logout
            </Button>
          </nav>
        </div>
      </div>
    </div>
  );
}
