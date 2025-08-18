import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Menu, ChevronDown, Zap, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function TopNavbar() {
  const { user } = useAuth();

  return (
    <div className="relative z-10 flex-shrink-0 flex h-16 bg-white/80 backdrop-blur-md shadow-lg border-b border-gray-200/50 lg:ml-0 ml-0">
      
      <div className="flex-1 px-6 flex justify-between">
        <div className="flex-1 flex items-center">
          {/* AI Status Indicator */}
          <div className="hidden md:flex items-center mr-6">
            <div className="flex items-center space-x-2 bg-gradient-to-r from-green-50 to-blue-50 px-3 py-2 rounded-lg border border-green-200">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-green-700">AI Ready</span>
              <Zap className="h-4 w-4 text-green-600" />
            </div>
          </div>
          
          {/* Search */}
          <div className="w-full max-w-lg">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none pl-3">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input 
                className="block w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50/50 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200" 
                placeholder="Search contacts, groups, cards..." 
                type="search"
              />
            </div>
          </div>
        </div>
        
        <div className="ml-6 flex items-center space-x-4">
          {/* Quick Stats */}
          <div className="hidden lg:flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-blue-50 px-3 py-2 rounded-lg">
              <Activity className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">Live</span>
            </div>
          </div>



          {/* Profile dropdown */}
          <div className="relative">
            <div className="flex items-center cursor-pointer group">
              <Avatar className="h-9 w-9 ring-2 ring-gray-200 group-hover:ring-blue-300 transition-all duration-200">
                <AvatarImage src={user?.photoURL || ""} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                  {user?.displayName?.charAt(0) || user?.email?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="ml-3 hidden md:block">
                <div className="text-sm font-semibold text-gray-800">
                  {user?.displayName || "User"}
                </div>
                <div className="text-xs text-gray-500">
                  {user?.email}
                </div>
              </div>
              <ChevronDown className="ml-2 text-gray-400 h-4 w-4 group-hover:text-gray-600 transition-colors duration-200" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
