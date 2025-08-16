import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, Search, Menu, ChevronDown } from "lucide-react";

export default function TopNavbar() {
  const { user } = useAuth();

  return (
    <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow border-b border-gray-200">
      {/* Mobile menu button */}
      <Button variant="ghost" className="px-4 border-r border-gray-200 text-gray-500 lg:hidden">
        <Menu className="h-5 w-5" />
      </Button>
      
      <div className="flex-1 px-4 flex justify-between">
        <div className="flex-1 flex">
          <div className="w-full flex md:ml-0">
            <div className="relative w-full text-gray-400 focus-within:text-gray-600 hidden md:block">
              <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                <Search className="h-5 w-5" />
              </div>
              <input 
                className="block w-full h-full pl-8 pr-3 py-2 border-transparent text-gray-900 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-0 focus:border-transparent" 
                placeholder="Search contacts, groups..." 
                type="search"
              />
            </div>
          </div>
        </div>
        
        <div className="ml-4 flex items-center md:ml-6">
          {/* Notifications */}
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-500">
            <Bell className="h-5 w-5" />
          </Button>

          {/* Profile dropdown */}
          <div className="ml-3 relative">
            <div className="flex items-center">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.photoURL || ""} />
                <AvatarFallback>
                  {user?.displayName?.charAt(0) || user?.email?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="ml-3 hidden md:block">
                <div className="text-sm font-medium text-gray-700">
                  {user?.displayName || "User"}
                </div>
                <div className="text-xs text-gray-500">
                  {user?.email}
                </div>
              </div>
              <ChevronDown className="ml-2 text-gray-400 h-3 w-3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
