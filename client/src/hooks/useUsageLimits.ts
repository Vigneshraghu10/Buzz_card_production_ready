import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getCountFromServer, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface UsageLimits {
  contacts: number;
  groups: number;
  digitalCards: number;
  aiScans: number;
}

interface UserUsage {
  contactsCount: number;
  groupsCount: number;
  digitalCardsCount: number;
  aiScansCount: number;
}

interface UsageLimitsHook {
  usage: UserUsage;
  limits: UsageLimits;
  hasActiveSubscription: boolean;
  canAddContact: boolean;
  canAddGroup: boolean;
  canAddDigitalCard: boolean;
  canUseAIScan: boolean;
  loading: boolean;
  refreshUsage: () => Promise<void>;
}

export function useUsageLimits(): UsageLimitsHook {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UserUsage>({
    contactsCount: 0,
    groupsCount: 0,
    digitalCardsCount: 0,
    aiScansCount: 0,
  });
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [loading, setLoading] = useState(true);

  // Define limits for free users
  const freeLimits: UsageLimits = {
    contacts: 1,
    groups: 1,
    digitalCards: 10, // Both free and paid users can store up to 10 digital cards
    aiScans: 1,
  };

  // Unlimited for paid users
  const paidLimits: UsageLimits = {
    contacts: Infinity,
    groups: Infinity,
    digitalCards: 10, // Limited to 10 digital cards for paid users
    aiScans: Infinity,
  };

  const limits = hasActiveSubscription ? paidLimits : freeLimits;

  const refreshUsage = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Check subscription status
      const userDoc = await getDoc(doc(db, "users", user.uid));
      let isActive = false;
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const subscription = userData.subscription;
        isActive = subscription && 
          subscription.status === 'active' && 
          new Date() < new Date(subscription.expiryDate?.toDate?.() || subscription.expiryDate);
      }
      setHasActiveSubscription(isActive);

      // Fetch usage counts
      const collections = ["contacts", "groups", "digitalCards"];
      const counts = await Promise.all(
        collections.map(async (collectionName) => {
          const collRef = collection(db, collectionName);
          const q = query(collRef, where("ownerId", "==", user.uid));
          const snapshot = await getCountFromServer(q);
          return snapshot.data().count;
        })
      );

      // Count AI scans (contacts with source = business_card_scan or bulk_scan)
      const aiScansQuery = query(
        collection(db, "contacts"),
        where("ownerId", "==", user.uid),
        where("source", "in", ["business_card_scan", "bulk_scan"])
      );
      const aiScansSnapshot = await getCountFromServer(aiScansQuery);

      setUsage({
        contactsCount: counts[0],
        groupsCount: counts[1],
        digitalCardsCount: counts[2],
        aiScansCount: aiScansSnapshot.data().count,
      });
    } catch (error) {
      console.error("Error fetching usage data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      refreshUsage();
    }
  }, [user]);

  return {
    usage,
    limits,
    hasActiveSubscription,
    canAddContact: usage.contactsCount < limits.contacts,
    canAddGroup: usage.groupsCount < limits.groups,
    canAddDigitalCard: usage.digitalCardsCount < limits.digitalCards,
    canUseAIScan: usage.aiScansCount < limits.aiScans,
    loading,
    refreshUsage,
  };
}