import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function isDuplicateContact(ownerId: string, email?: string, phone?: string) {
  try {
    const col = collection(db, "contacts");
    
    // If no email or phone provided, not a duplicate
    if (!email && !phone) return false;
    
    // Check for email match first
    if (email && email.trim()) {
      const emailQuery = query(
        col, 
        where("ownerId", "==", ownerId), 
        where("email", "==", email.toLowerCase().trim()),
        limit(1)
      );
      const emailSnap = await getDocs(emailQuery);
      if (!emailSnap.empty) return true;
    }
    
    // Check for phone match if email didn't match
    if (phone && phone.trim()) {
      const phoneQuery = query(
        col, 
        where("ownerId", "==", ownerId), 
        where("phone", "==", phone.trim()),
        limit(1)
      );
      const phoneSnap = await getDocs(phoneQuery);
      if (!phoneSnap.empty) return true;
    }
    
    return false;
  } catch (error) {
    console.error("Error checking for duplicates:", error);
    return false; // Allow addition if check fails
  }
}
