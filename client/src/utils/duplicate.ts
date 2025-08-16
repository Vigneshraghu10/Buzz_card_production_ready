import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function isDuplicateContact(ownerId: string, email?: string, phone?: string) {
  const col = collection(db, "contacts");
  const filters = [];
  
  if (email) filters.push(where("email", "==", email.toLowerCase()));
  if (phone) filters.push(where("phone", "==", phone));
  if (!filters.length) return false;
  
  const q = query(col, where("ownerId","==",ownerId), ...filters, limit(1));
  const snap = await getDocs(q);
  return !snap.empty;
}
