import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChartLine,
  Users,
  Layers,
  FileText,
  DollarSign,
  CreditCard,
  Smartphone,
  LogOut,
  Zap,
  Sparkles,
  Menu
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
    name: "Digital Card",
    href: "/digital-card",
    icon: CreditCard,
    description: "Your digital profile"
  },
  {
    name: "Manage Digital Cards",
    href: "/manage-cards",
    icon: CreditCard,
    description: "Keep all cards in one place",
    // isComingSoon: true
  },
  {
    name: "NFC Card",
    href: "/nfc-card",
    icon: Smartphone,
    description: "Tap to share contacts",
    isComingSoon: true
  },
  // {
  //   name: "Pricing",
  //   href: "/pricing",
  //   icon: DollarSign,
  //   description: "Subscription plans"
  // }
];

export default function Sidebar() {
  const [location] = useLocation();
  const { logout } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="bg-white/90 backdrop-blur-sm shadow-lg border-gray-200"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50
          w-72 h-screen
          transform transition-transform duration-300 ease-in-out
          bg-white shadow-2xl border-r border-gray-200
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:static lg:translate-x-0
        `}
      >
        <div className="flex flex-col h-full pt-5 pb-4 overflow-y-auto">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 px-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Zap className="text-white h-5 w-5" />
              </div>
              <div className="ml-3">
                <h1 className="text-xl font-bold text-gray-900">Smarticard</h1>
                <p className="text-xs text-gray-500">AI-Powered Business Cards</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="mt-8 flex-1 px-4 space-y-2">
            {navigation.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.name} href={item.href}>
                  <div
                    className={`
                      group flex items-center px-4 py-3 text-sm font-medium rounded-xl cursor-pointer transition-all duration-200
                      ${isActive
                        ? "bg-gray-100 text-blue-600"
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"}
                    `}
                    onClick={() => setIsMobileOpen(false)}
                  >
                    <item.icon
                      className={`
                        mr-3 h-5 w-5 transition-all duration-200
                        ${isActive ? "text-blue-600" : "text-gray-500 group-hover:text-gray-700"}
                      `}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span>{item.name}</span>
                        {item.isNew && (
                          <Badge className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5">
                            NEW
                          </Badge>
                        )}
                        {item.isComingSoon && (
                          <Badge className="ml-2 bg-amber-500 text-white text-xs px-2 py-0.5">
                            SOON
                          </Badge>
                        )}
                      </div>
                      <p
                        className={`text-xs mt-0.5 ${
                          isActive ? "text-blue-500" : "text-gray-400"
                        }`}
                      >
                        {item.description}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}

            {/* Divider */}
            <div className="border-t border-gray-200 my-6"></div>

            {/* Logout */}
            <Button
              variant="ghost"
              onClick={logout}
              className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700 mt-6 rounded-xl px-4 py-3"
            >
              <LogOut className="text-red-600 mr-3 h-5 w-5" />
              <div className="text-left">
                <div>Logout</div>
                <div className="text-xs text-red-500">Sign out safely</div>
              </div>
            </Button>
          </nav>
        </div>
      </div>
    </>
  );
}
