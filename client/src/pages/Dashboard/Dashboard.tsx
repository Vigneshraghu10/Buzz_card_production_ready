import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { 
  collection, query, where, getDocs, orderBy, limit, getCountFromServer 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Layers, FileText, Camera, UserPlus, FilePlus, CloudUpload, Eye, CreditCard, Crown, Shield, Settings } from "lucide-react";
import { useLocation } from "wouter";
import { useUsageLimits } from "@/hooks/useUsageLimits";

interface Stats {
  contactsCount: number;
  groupsCount: number;
  templatesCount: number;
  scannedCardsCount: number;
  digitalCardsCount: number;
}

interface SubscriptionStatus {
  hasSubscription: boolean;
  planName?: string;
  endDate?: Date;
  isActive?: boolean;
}

interface RecentActivity {
  id: string;
  type: 'scan' | 'bulk_scan' | 'contact_add';
  description: string;
  timestamp: Date;
  details?: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { usage, limits, loading: usageLimitsLoading } = useUsageLimits();
  const [stats, setStats] = useState<Stats>({
    contactsCount: 0,
    groupsCount: 0,
    templatesCount: 0,
    scannedCardsCount: 0,
    digitalCardsCount: 0,
  });
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    hasSubscription: false
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      try {
        // Fetch counts for all collections
        const collections = ["contacts", "groups", "templates", "digitalCards"];
        const counts = await Promise.all(
          collections.map(async (collectionName) => {
            const collRef = collection(db, collectionName);
            const q = query(collRef, where("ownerId", "==", user.uid));
            const snapshot = await getCountFromServer(q);
            return snapshot.data().count;
          })
        );

        // Get scanned cards count from contacts where source is business card scan
        const scannedCardsQuery = query(
          collection(db, "contacts"),
          where("ownerId", "==", user.uid),
          where("source", "in", ["business_card_scan", "bulk_scan"])
        );
        const scannedCardsSnapshot = await getCountFromServer(scannedCardsQuery);
        const scannedCardsCount = scannedCardsSnapshot.data().count;

        setStats({
          contactsCount: counts[0],
          groupsCount: counts[1],
          templatesCount: counts[2],
          digitalCardsCount: counts[3],
          scannedCardsCount: scannedCardsCount,
        });

        // Fetch subscription status
        try {
          const subscriptionResponse = await fetch(`/api/subscription/${user.uid}`);
          if (subscriptionResponse.ok) {
            const subscription = await subscriptionResponse.json();
            setSubscriptionStatus({
              hasSubscription: subscription.hasSubscription || false,
              planName: subscription.planName,
              endDate: subscription.endDate ? new Date(subscription.endDate) : undefined,
              isActive: subscription.isActive || false
            });
          } else {
            console.warn(`Subscription API returned ${subscriptionResponse.status}: ${subscriptionResponse.statusText}`);
          }
        } catch (error) {
          console.error("Error fetching subscription:", error);
          // Set default subscription status on error
          setSubscriptionStatus({ hasSubscription: false });
        }

        // Fetch recent activities from contacts with source information
        // Using separate query to avoid composite index requirement
        const recentContactsQuery = query(
          collection(db, "contacts"),
          where("ownerId", "==", user.uid),
          limit(50) // Get more results to sort client-side
        );
        const recentContactsSnapshot = await getDocs(recentContactsQuery);

        const activities: RecentActivity[] = [];

        recentContactsSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const timestamp = data.createdAt?.toDate() || new Date();
          const source = data.source || 'manual';
          
          if (source === 'business_card_scan') {
            activities.push({
              id: doc.id,
              type: 'scan',
              description: `Scanned business card for ${data.firstName} ${data.lastName}`.trim(),
              timestamp,
              details: data.company ? `Company: ${data.company}` : undefined
            });
          } else if (source === 'bulk_scan') {
            activities.push({
              id: doc.id,
              type: 'bulk_scan',
              description: `Bulk scanned card for ${data.firstName} ${data.lastName}`.trim(),
              timestamp,
              details: data.company ? `Company: ${data.company}` : undefined
            });
          } else if (source === 'manual' || !source) {
            activities.push({
              id: doc.id,
              type: 'contact_add',
              description: `Added contact ${data.firstName} ${data.lastName}`.trim(),
              timestamp,
              details: data.company ? `Company: ${data.company}` : undefined
            });
          }
        });

        // Sort by timestamp and take the 5 most recent
        activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setRecentActivities(activities.slice(0, 5));

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  const statsCards = [
    { name: "Total Contacts", count: stats.contactsCount, icon: Users, color: "from-blue-500 to-blue-600" },
    { name: "Groups", count: stats.groupsCount, icon: Layers, color: "from-green-500 to-green-600" },
    { name: "Digital Cards", count: `${usage.digitalCardsCount}/${limits.digitalCards}`, icon: CreditCard, color: "from-purple-500 to-purple-600" },
    { name: "AI Processed Cards", count: stats.scannedCardsCount, icon: Camera, color: "from-indigo-500 to-indigo-600" },
  ];

  const quickActions = [
    { 
      name: "Add Contact", 
      description: "Create a new contact entry", 
      icon: UserPlus, 
      color: "from-blue-50 to-blue-100 text-blue-600 border-blue-200", 
      action: () => setLocation("/contacts") 
    },
    { 
      name: "Create Template", 
      description: "Design a new message template", 
      icon: FilePlus, 
      color: "from-yellow-50 to-yellow-100 text-yellow-600 border-yellow-200", 
      action: () => setLocation("/templates") 
    },
    { 
      name: "Bulk Upload", 
      description: "Upload multiple business cards", 
      icon: CloudUpload, 
      color: "from-green-50 to-green-100 text-green-600 border-green-200", 
      action: () => setLocation("/bulk-uploads") 
    },
    { 
      name: "Manage Digital Cards", 
      description: "Create and share smart cards.", 
      icon: CreditCard, 
      color: "from-purple-50 to-purple-100 text-purple-600 border-purple-200", 
      action: () => setLocation("/manage-cards") 
    },
    // { 
    //   name: "Manage Cards", 
    //   description: "View and manage digital cards", 
    //   icon: Settings, 
    //   color: "from-indigo-50 to-indigo-100 text-indigo-600 border-indigo-200", 
    //   action: () => setLocation("/manage-cards") 
    // },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'scan':
        return <Camera className="text-purple-600 h-6 w-6" />;
      case 'bulk_scan':
        return <CloudUpload className="text-green-600 h-6 w-6" />;
      case 'contact_add':
        return <UserPlus className="text-blue-600 h-6 w-6" />;
      default:
        return <Users className="text-gray-600 h-6 w-6" />;
    }
  };

  const getActivityBgColor = (type: string) => {
    switch (type) {
      case 'scan':
        return 'from-purple-100 to-purple-200';
      case 'bulk_scan':
        return 'from-green-100 to-green-200';
      case 'contact_add':
        return 'from-blue-100 to-blue-200';
      default:
        return 'from-gray-100 to-gray-200';
    }
  };

  if (loading || usageLimitsLoading) {
    return (
      <div className="py-6 animate-pulse">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg w-48 mb-8"></div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div 
                key={i} 
                className="bg-gradient-to-br from-gray-200 to-gray-300 h-24 rounded-xl animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 animate-fadeIn">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(30px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
          60% { transform: translateY(-5px); }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        
        .animate-fadeIn { animation: fadeIn 0.8s ease-out; }
        .animate-slideInUp { animation: slideInUp 0.6s ease-out; }
        .animate-slideInLeft { animation: slideInLeft 0.5s ease-out; }
        .animate-bounce-gentle { animation: bounce 2s infinite; }
        .animate-shimmer { animation: shimmer 2s linear infinite; }
        .animate-spin-slow { animation: spin 8s linear infinite; }
        .animate-pulse-gentle { animation: pulse 3s ease-in-out infinite; }
        
        .card-hover {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .card-hover:hover {
          transform: translateY(-8px) scale(1.02);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
        
        .action-hover {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .action-hover:hover {
          transform: translateY(-4px) scale(1.03);
          box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.2);
        }
        
        .icon-spin:hover {
          animation: spin 0.6s ease-in-out;
        }
        
        .shimmer-effect {
          position: relative;
          overflow: hidden;
        }
        
        .shimmer-effect::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          animation: shimmer 3s ease-in-out infinite;
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 
          className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent animate-slideInUp"
          style={{ animationDelay: '200ms', animationFillMode: 'both' }}
        >
          Dashboard
        </h1>
      </div>

      {/* Subscription Status Card */}
      {subscriptionStatus.hasSubscription ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 mt-8">
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                    <Shield className="text-white h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-800">Active Subscription</h3>
                    <p className="text-sm text-green-600">
                      {subscriptionStatus.planName} • Valid until {subscriptionStatus.endDate?.toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="border-green-300 text-green-700 hover:bg-green-100"
                  onClick={() => setLocation("#")}
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Manage
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 mt-8">
          <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
                    <Crown className="text-white h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-amber-800">Free Plan</h3>
                    <p className="text-sm text-amber-600">
                      Upgrade to unlock unlimited features and AI processing
                    </p>
                  </div>
                </div>
                <Button 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  onClick={() => setLocation("#")}
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 mt-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {statsCards.map((card, i) => (
            <div
              key={card.name}
              className="animate-slideInUp card-hover"
              style={{ 
                animationDelay: `${300 + i * 150}ms`, 
                animationFillMode: 'both' 
              }}
            >
              <Card 
                className={`relative overflow-hidden border-0 shadow-xl backdrop-blur-sm shimmer-effect ${
                  card.name === "Digital Cards" ? "cursor-pointer hover:shadow-2xl hover:scale-105 transition-all duration-300" : ""
                }`}
                onClick={card.name === "Digital Cards" ? () => setLocation("#") : undefined}
                data-testid={card.name === "Digital Cards" ? "card-digital-cards-manage" : undefined}
              >
                <CardContent className="p-6 relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`w-14 h-14 bg-gradient-to-br ${card.color} rounded-2xl flex items-center justify-center shadow-lg icon-spin`}>
                        <card.icon className="text-white h-7 w-7" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">
                          {card.name}
                          {card.name === "Digital Cards" && (
                            <span className="text-xs text-blue-500 ml-2"></span>
                          )}
                        </p>
                        <p 
                          className="text-3xl font-bold text-gray-900 animate-pulse-gentle"
                          style={{ 
                            animationDelay: `${800 + i * 100}ms`,
                            animationFillMode: 'both'
                          }}
                        >
                          {card.count}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 mt-12">
        <h3 
          className="text-xl font-semibold text-gray-900 mb-6 flex items-center animate-slideInUp"
          style={{ animationDelay: '1000ms', animationFillMode: 'both' }}
        >
          <span className="mr-3 text-2xl animate-bounce-gentle">⚡</span>
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action, i) => (
            <div
              key={action.name}
              className="animate-slideInUp action-hover"
              style={{ 
                animationDelay: `${1200 + i * 100}ms`, 
                animationFillMode: 'both' 
              }}
            >
              <Button
                variant="outline"
                className={`h-auto p-6 flex flex-col items-start space-y-4 transition-all duration-300 border-2 bg-gradient-to-br ${action.color}`}
                onClick={action.action}
              >
                <div className="rounded-2xl inline-flex p-4 shadow-md icon-spin">
                  <action.icon className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold mb-1">{action.name}</h3>
                  <p className="text-sm text-gray-600">{action.description}</p>
                </div>
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activities */}
      {/* <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 mt-12">
        <h3 
          className="text-xl font-semibold text-gray-900 mb-6 flex items-center animate-slideInUp"
          style={{ animationDelay: '1600ms', animationFillMode: 'both' }}
        >
          <span className="mr-3 text-2xl animate-spin-slow">🕒</span>
          Recent Activities
        </h3>
        <div 
          className="animate-slideInUp"
          style={{ animationDelay: '1800ms', animationFillMode: 'both' }}
        >
          <Card className="shadow-xl border-0 overflow-hidden">
            <CardContent className="p-0">
              {recentActivities.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {recentActivities.map((activity, i) => (
                    <li
                      key={activity.id}
                      className="animate-slideInLeft hover:bg-blue-50 transition-colors duration-200"
                      style={{ 
                        animationDelay: `${2000 + i * 100}ms`, 
                        animationFillMode: 'both' 
                      }}
                    >
                      <div className="px-6 py-5 flex justify-between items-center">
                        <div className="flex items-center">
                          <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${getActivityBgColor(activity.type)} flex items-center justify-center shadow-md icon-spin`}>
                            {getActivityIcon(activity.type)}
                          </div>
                          <div className="ml-4">
                            <p className="text-sm font-semibold text-gray-900">{activity.description}</p>
                            {activity.details && (
                              <p className="text-xs text-gray-500 mt-0.5">{activity.details}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {activity.timestamp.toLocaleDateString()} at {activity.timestamp.toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-blue-600 hover:bg-blue-100 font-medium transition-colors duration-200"
                          onClick={() => setLocation("/contacts")}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-6 py-12 text-center text-gray-500 animate-pulse-gentle">
                  <Camera className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p className="text-lg font-medium mb-2">No recent activities</p>
                  <p className="text-sm">Start scanning business cards or adding contacts to see activities here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div> */}
    </div>
  );
}
