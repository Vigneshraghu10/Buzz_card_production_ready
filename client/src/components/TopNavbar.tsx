import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function TopNavbar() {
  const { user } = useAuth();

  return (
    <div className="relative z-10 flex-shrink-0 flex h-16 bg-white/80 backdrop-blur-md shadow-lg border-b border-gray-200/50 lg:ml-0 ml-0">
      <div className="flex-1 px-6 flex justify-between">
        <div className="flex-1 flex items-center">
          {/* AI Status Indicator with wave animation */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="hidden md:flex items-center mr-6"
          >
            <div className="relative flex items-center space-x-2 px-3 py-2 rounded-lg border border-green-200 shadow-sm overflow-hidden animated-gradient">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                className="w-2 h-2 bg-green-400 rounded-full"
              />
              <span className="text-sm font-medium text-green-700">AI Ready</span>
              <Zap className="h-4 w-4 text-green-600 animate-bounce" />
            </div>
          </motion.div>
        </div>

        {/* Profile dropdown */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="ml-6 flex items-center space-x-4"
        >
          <div className="relative">
            <div className="flex items-center cursor-pointer group">
              <Avatar className="h-9 w-9 ring-2 ring-gray-200 group-hover:ring-blue-300 transition-all duration-200">
                <AvatarImage src={user?.photoURL || ""} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                  {user?.displayName?.charAt(0) || user?.email?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
                className="ml-3 hidden md:block"
              >
                <div className="text-sm font-semibold text-gray-800">
                  {user?.displayName || "User"}
                </div>
                <div className="text-xs text-gray-500">{user?.email}</div>
              </motion.div>
              <ChevronDown className="ml-2 text-gray-400 h-4 w-4 group-hover:text-gray-600 transition-colors duration-200" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* 🔥 Gradient wave animation CSS */}
      <style jsx>{`
        .animated-gradient {
          background: linear-gradient(270deg, #d1fae5, #e0f2fe, #d1fae5);
          background-size: 400% 400%;
          animation: waveMove 6s ease infinite;
        }

        @keyframes waveMove {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </div>
  );
}
