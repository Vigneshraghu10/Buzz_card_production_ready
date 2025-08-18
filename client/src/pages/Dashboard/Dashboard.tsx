import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Layers, FileText, Camera, UserPlus, FilePlus, CloudUpload } from "lucide-react";
import { useLocation } from "wouter";

interface Stats {
  contactsCount: number;
  groupsCount: number;
  templatesCount: number;
  scannedCardsCount: number;
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: Date;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    contactsCount: 0,
    groupsCount: 0,
    templatesCount: 0,
    scannedCardsCount: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      try {
        const collections = ['contacts', 'groups', 'templates', 'scannedCards'];
        const counts = await Promise.all(
          collections.map(async (collectionName) => {
            const q = query(collection(db, collectionName), where("ownerId", "==", user.uid));
            const snapshot = await getDocs(q);
            return snapshot.size;
          })
        );

        setStats({
          contactsCount: counts[0],
          groupsCount: counts[1],
          templatesCount: counts[2],
          scannedCardsCount: counts[3],
        });

        // Fetch recent activities (scanned cards) - simplified to avoid composite index requirement
        try {
          const recentQuery = query(
            collection(db, "scannedCards"),
            where("ownerId", "==", user.uid),
            limit(5)
          );
          const recentSnapshot = await getDocs(recentQuery);
          const activities = recentSnapshot.docs
            .map(doc => ({
              id: doc.id,
              type: "scan",
              description: `Scanned business card`,
              timestamp: doc.data().createdAt?.toDate() || new Date(),
            }))
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 5);
          
          setRecentActivities(activities);
        } catch (activityError) {
          console.log("Could not fetch recent activities:", activityError);
          setRecentActivities([]);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  const statsCards = [
    { name: "Total Contacts", count: stats.contactsCount, icon: Users, color: "bg-primary" },
    { name: "Groups", count: stats.groupsCount, icon: Layers, color: "bg-green-500" },
    { name: "Templates", count: stats.templatesCount, icon: FileText, color: "bg-yellow-500" },
    { name: "Scanned Cards", count: stats.scannedCardsCount, icon: Camera, color: "bg-purple-500" },
  ];

  const quickActions = [
    { 
      name: "Add Contact", 
      description: "Create a new contact entry manually",
      icon: UserPlus,
      color: "bg-primary-50 text-primary-600",
      action: () => setLocation("/contacts")
    },
    { 
      name: "Create Template", 
      description: "Design a new message template",
      icon: FilePlus,
      color: "bg-yellow-50 text-yellow-600",
      action: () => setLocation("/templates")
    },
    { 
      name: "Bulk Upload", 
      description: "Upload multiple business cards",
      icon: CloudUpload,
      color: "bg-green-50 text-green-600",
      action: () => setLocation("/bulk-uploads")
    },
    { 
      name: "Scan Card", 
      description: "Extract contact info from image",
      icon: Camera,
      color: "bg-purple-50 text-purple-600",
      action: () => setLocation("/scanned-cards")
    },
  ];

  if (loading) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-200 h-24 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Stats cards */}
        <div className="mt-8">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {statsCards.map((card) => (
              <Card key={card.name}>
                <CardContent className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className={`w-8 h-8 ${card.color} rounded-md flex items-center justify-center`}>
                        <card.icon className="text-white h-4 w-4" />
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">{card.name}</dt>
                        <dd className="text-lg font-medium text-gray-900">{card.count}</dd>
                      </dl>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <Button
                key={action.name}
                variant="outline"
                className="h-auto p-6 flex flex-col items-start space-y-4 hover:shadow-md transition-shadow"
                onClick={action.action}
              >
                <div className={`rounded-lg inline-flex p-3 ${action.color} ring-4 ring-white`}>
                  <action.icon className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-medium text-gray-900">{action.name}</h3>
                  <p className="mt-2 text-sm text-gray-500">{action.description}</p>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="mt-8">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Recent Activities</h3>
          <Card>
            <CardContent className="p-0">
              {recentActivities.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {recentActivities.map((activity) => (
                    <li key={activity.id}>
                      <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Camera className="text-primary h-5 w-5" />
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="flex items-center">
                                <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                              </div>
                              <div className="mt-1">
                                <p className="text-sm text-gray-500">
                                  {activity.timestamp.toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <Button variant="ghost" size="sm" className="text-primary">
                              View
                            </Button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-8 text-center text-gray-500">
                  No recent activities
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
