import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { isDuplicateContact } from "../../utils/duplicate";
import { useUsageLimits } from "../../hooks/useUsageLimits";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Badge } from "../../components/ui/badge";
import { useToast } from "../../hooks/use-toast";
import UsageLimitModal from "../../components/UsageLimitModal";
import { Plus, Search, Grid3X3, List, MoreVertical, Edit, Trash2, Users2, Loader2, Download, Check, FileText, Copy, Upload, FileDown, Phone, Mail, MapPin, Building, User } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "../../components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import * as XLSX from 'xlsx';

// WhatsApp Icon Component
const WhatsAppIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893A11.821 11.821 0 0020.905 3.288z"/>
  </svg>
);

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  phones: string[];
  email: string;
  company: string;
  services: string;
  address?: string;
  groupIds: string[];
  createdAt: Date;
  ownerId: string;
}

interface Group {
  id: string;
  name: string;
  ownerId: string;
}

interface Template {
  id: string;
  name: string;
  content: string;
  createdAt: Date;
  ownerId: string;
}

function Contacts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { usage, limits, canAddContact, refreshUsage } = useUsageLimits();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [selectedContactForGroup, setSelectedContactForGroup] = useState<Contact | null>(null);
  const [selectedContactForMessage, setSelectedContactForMessage] = useState<Contact | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [formData, setFormData] = useState<{
    firstName: string;
    lastName: string;
    phones: string[];
    email: string;
    company: string;
    services: string;
    address: string;
    groupIds: string[];
  }>({
    firstName: "",
    lastName: "",
    phones: [],
    email: "",
    company: "",
    services: "",
    address: "",
    groupIds: [],
  });

  useEffect(() => {
    const initializeContacts = async () => {
      try {
        setLoading(true);
        if (user) {
          await fetchData();
        }
      } catch (error) {
        console.error("Error initializing contacts:", error);
        toast({
          title: "Error",
          description: "Failed to initialize contacts",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    initializeContacts();
  }, [user]);

  useEffect(() => {
    let filtered = contacts;

    if (searchTerm) {
      filtered = filtered.filter(contact => 
        contact.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.phones?.some(p => p.includes(searchTerm)) ||
        contact.company?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedGroup !== "all") {
      filtered = filtered.filter(contact => 
        contact.groupIds?.includes(selectedGroup)
      );
    }

    setFilteredContacts(filtered);
  }, [contacts, searchTerm, selectedGroup]);

  const fetchData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch contacts
      const contactsQuery = query(
        collection(db, "contacts"), 
        where("ownerId", "==", user.uid)
      );
      const contactsSnapshot = await getDocs(contactsQuery);
      const contactsData = contactsSnapshot.docs.map(doc => {
        const data = doc.data() as any; // Use any to handle old and new data structures
        const contact: Contact = {
          id: doc.id,
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          phones: [],
          email: data.email || "",
          company: data.company || "",
          services: data.services || "",
          address: data.address || "",
          groupIds: data.groupIds || [],
          createdAt: data.createdAt?.toDate() || new Date(),
          ownerId: data.ownerId,
        };

        if (Array.isArray(data.phones)) {
          contact.phones = data.phones;
        } else {
          const phoneNumbers = [];
          if (data.phone) phoneNumbers.push(data.phone);
          if (data.phone2) phoneNumbers.push(data.phone2);
          contact.phones = phoneNumbers;
        }
        
        return contact;
      });

      // Fetch groups
      const groupsQuery = query(
        collection(db, "groups"), 
        where("ownerId", "==", user.uid)
      );
      const groupsSnapshot = await getDocs(groupsQuery);
      const groupsData = groupsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Group[];

      // Fetch templates
      const templatesQuery = query(
        collection(db, "templates"), 
        where("ownerId", "==", user.uid)
      );
      const templatesSnapshot = await getDocs(templatesQuery);
      const templatesData = templatesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Template[];

      setContacts(contactsData);
      setGroups(groupsData);
      setTemplates(templatesData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch data",
        variant: "destructive",
      });
    }
  };

  // Bulk Import Function
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        // Transform and validate data
        const transformedData = jsonData.map((row: any, index) => {
          const firstName = row['First Name'] || row['firstName'] || row['Name']?.split(' ')[0] || '';
          const lastName = row['Last Name'] || row['lastName'] || row['Name']?.split(' ').slice(1).join(' ') || '';
          const phone = row['Phone'] || row['phone'] || row['Phone Number'] || row['Mobile'] || '';
          const phone2 = row['Phone 2'] || row['phone2'] || row['Secondary Phone'] || '';
          const email = row['Email'] || row['email'] || row['Email Address'] || '';
          const company = row['Company'] || row['company'] || row['Organization'] || '';
          
          const phones = [phone, phone2].filter(p => p).map(p => p.toString().trim());

          return {
            index: index + 1,
            firstName: firstName.toString().trim(),
            lastName: lastName.toString().trim(),
            phones: phones,
            email: email.toString().toLowerCase().trim(),
            company: company.toString().trim(),
            services: row['Services'] || row['services'] || '',
            address: row['Address'] || row['address'] || '',
            isValid: !!(firstName && phones.length > 0) // Minimum required fields
          };
        }).filter(row => row.firstName || (row.phones && row.phones.length > 0)); // Filter out completely empty rows

        setImportPreview(transformedData);
      } catch (error) {
        console.error("Error reading file:", error);
        toast({
          title: "File Error",
          description: "Unable to read the selected file. Please ensure it's a valid Excel file.",
          variant: "destructive",
        });
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  const handleBulkImport = async () => {
    if (!user || !importPreview.length) return;
    
    setImporting(true);
    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    
    try {
      for (const contact of importPreview.filter(c => c.isValid)) {
        try {
          // Check for duplicates
          if (contact.email || contact.phones.length > 0) {
            const isDupe = await isDuplicateContact(user.uid, contact.email, contact.phones);
            if (isDupe) {
              duplicateCount++;
              continue;
            }
          }
          
          const contactData = {
            firstName: contact.firstName,
            lastName: contact.lastName,
            phones: contact.phones,
            email: contact.email,
            company: contact.company,
            services: contact.services || '',
            address: contact.address || '',
            groupIds: [],
            ownerId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          await addDoc(collection(db, "contacts"), contactData);
          successCount++;
        } catch (error) {
          console.error(`Error importing contact ${contact.firstName}:`, error);
          errorCount++;
        }
      }
      
      toast({
        title: "Import Complete",
        description: `Successfully imported ${successCount} contacts. ${duplicateCount} duplicates skipped. ${errorCount} errors.`,
      });
      
      setShowImportModal(false);
      setImportFile(null);
      setImportPreview([]);
      await fetchData();
      
    } catch (error) {
      console.error("Error during bulk import:", error);
      toast({
        title: "Import Error",
        description: "An error occurred during import. Some contacts may not have been saved.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  // Excel Export Function
  const handleExportToExcel = async () => {
    try {
      setExporting(true);
      
      if (filteredContacts.length === 0) {
        toast({
          title: "No Data",
          description: "No contacts available to export",
          variant: "destructive",
        });
        return;
      }

      const excelData = filteredContacts.map(contact => {
        const groupNames = contact.groupIds?.map(groupId => {
          const group = groups.find(g => g.id === groupId);
          return group?.name || '';
        }).filter(name => name).join(', ') || 'No Groups';

        return {
          'First Name': contact.firstName || '',
          'Last Name': contact.lastName || '',
          'Full Name': `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
          'Phones': contact.phones?.join(', ') || '',
          'Email': contact.email || '',
          'Company': contact.company || '',
          'Services': contact.services || '',
          'Address': contact.address || '',
          'Groups': groupNames,
          'Created Date': contact.createdAt ? contact.createdAt.toLocaleDateString() : '',
          'Created Time': contact.createdAt ? contact.createdAt.toLocaleTimeString() : '',
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      const colWidths = [
        { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 30 },
        { wch: 20 }, { wch: 30 }, { wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Contacts');

      const currentDate = new Date();
      const dateString = currentDate.toISOString().split('T')[0];
      const filename = `contacts_export_${dateString}.xlsx`;

      XLSX.writeFile(wb, filename);

      toast({
        title: "Success",
        description: `${filteredContacts.length} contacts exported successfully to ${filename}`,
      });

    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast({
        title: "Export Error",
        description: `Failed to export contacts: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  // VCF Export Function
  const generateVCF = (contact: Contact) => {
    const vcf = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${contact.firstName} ${contact.lastName}`,
      `N:${contact.lastName};${contact.firstName};;;`,
      ...(contact.phones || []).map((p, i) => `TEL;TYPE=${i === 0 ? 'CELL' : 'HOME'}:${p}`),
      contact.email ? `EMAIL:${contact.email}` : '',
      contact.company ? `ORG:${contact.company}` : '',
      contact.address ? `ADR;TYPE=WORK:;;${contact.address};;;;` : '',
      contact.services ? `NOTE:Services: ${contact.services}` : '',
      'END:VCARD'
    ].filter(Boolean).join('\n');

    return vcf;
  };

  const handleExportVCF = (contact: Contact) => {
    try {
      const vcfContent = generateVCF(contact);
      const blob = new Blob([vcfContent], { type: 'text/vcard' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${contact.firstName}_${contact.lastName}.vcf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: `VCF file downloaded for ${contact.firstName} ${contact.lastName}`,
      });
    } catch (error) {
      console.error("Error generating VCF:", error);
      toast({
        title: "Export Error",
        description: "Failed to generate VCF file",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName.trim() || !formData.lastName.trim() || formData.phones.length === 0 || !formData.phones[0].trim() || !formData.email.trim() || !formData.company.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    
    try {
      if (editingContact) {
        await updateDoc(doc(db, "contacts", editingContact.id), {
          ...formData,
          email: formData.email.toLowerCase(),
          updatedAt: serverTimestamp(),
        });
        
        toast({
          title: "Success",
          description: "Contact updated successfully",
        });
        
        setShowEditModal(false);
        setEditingContact(null);
      } else {
        // Check usage limits for new contacts
        if (!canAddContact) {
          setShowLimitModal(true);
          setSaving(false);
          return;
        }

        if (formData.email || formData.phones.length > 0) {
          try {
            const isDupe = await isDuplicateContact(user.uid, formData.email, formData.phones);
            if (isDupe) {
              toast({
                title: "Duplicate Contact",
                description: "A contact with this email or phone already exists",
                variant: "destructive",
              });
              setSaving(false);
              return;
            }
          } catch (dupeError) {
            console.error("Error checking duplicates:", dupeError);
          }
        }

        const contactData = {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          phones: formData.phones.map(p => p.trim()).filter(p => p),
          email: formData.email.toLowerCase().trim(),
          company: formData.company.trim(),
          services: formData.services.trim(),
          address: formData.address.trim(),
          groupIds: formData.groupIds || [],
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await addDoc(collection(db, "contacts"), contactData);

        toast({
          title: "Success",
          description: "Contact added successfully",
        });
        
        // Refresh usage after adding contact
        await refreshUsage();
        
        setShowAddModal(false);
      }

      setFormData({
        firstName: "",
        lastName: "",
        phones: [],
        email: "",
        company: "",
        services: "",
        address: "",
        groupIds: [],
      });
      
      await fetchData();
    } catch (error) {
      console.error("Error saving contact:", error);
      toast({
        title: "Error",
        description: `Failed to save contact: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      firstName: contact.firstName || "",
      lastName: contact.lastName || "",
      phones: contact.phones || [],
      email: contact.email || "",
      company: contact.company || "",
      services: contact.services || "",
      address: contact.address || "",
      groupIds: contact.groupIds || [],
    });
    setShowEditModal(true);
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!window.confirm("Are you sure you want to delete this contact?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "contacts", contactId));
      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });
      fetchData();
    } catch (error) {
      console.error("Error deleting contact:", error);
      toast({
        title: "Error",
        description: "Failed to delete contact",
        variant: "destructive",
      });
    }
  };

  const handleAssignToGroup = (contact: Contact) => {
    setSelectedContactForGroup(contact);
    setShowGroupModal(true);
  };

  const handleGroupAssignment = async (groupId: string) => {
    if (!selectedContactForGroup) return;
    
    try {
      const currentGroupIds = selectedContactForGroup.groupIds || [];
      const updatedGroupIds = currentGroupIds.includes(groupId)
        ? currentGroupIds.filter(id => id !== groupId)
        : [...currentGroupIds, groupId];
      
      await updateDoc(doc(db, "contacts", selectedContactForGroup.id), {
        groupIds: updatedGroupIds,
        updatedAt: serverTimestamp(),
      });
      
      setSelectedContactForGroup(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          groupIds: updatedGroupIds
        };
      });
      
      toast({
        title: "Success",
        description: "Group assignment updated",
      });
      
      await fetchData();
    } catch (error) {
      console.error("Error updating group assignment:", error);
      toast({
        title: "Error",
        description: "Failed to update group assignment",
        variant: "destructive",
      });
    }
  };

  // Updated handleSendMessage function with template integration
  const handleSendMessage = (contact: Contact) => {
    setSelectedContactForMessage(contact);
    setSelectedTemplate(null);
    setCustomMessage("");
    setShowTemplateModal(true);
  };

  // Function to replace placeholders in template content
  const replacePlaceholders = (content: string, contact: Contact) => {
    return content
      .replace(/\{firstName\}/g, contact.firstName || '')
      .replace(/\{lastName\}/g, contact.lastName || '')
      .replace(/\{fullName\}/g, `${contact.firstName || ''} ${contact.lastName || ''}`.trim())
      .replace(/\{company\}/g, contact.company || '')
      .replace(/\{email\}/g, contact.email || '')
      .replace(/\{phone\}/g, contact.phones?.[0] || '');
  };

  // Enhanced function to clean and format message for WhatsApp URL
  const formatMessageForWhatsApp = (message: string) => {
    // Clean the message by removing extra spaces and fixing line breaks
    let cleanMessage = message
      .trim()
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace multiple line breaks with double line breaks
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n /g, '\n') // Remove spaces after line breaks
      .replace(/ \n/g, '\n'); // Remove spaces before line breaks

    // Limit message length to avoid URL length issues (WhatsApp URL limit ~2000 chars)
    if (cleanMessage.length > 1500) {
      cleanMessage = cleanMessage.substring(0, 1500) + '...';
    }

    return cleanMessage;
  };

  // Copy message to clipboard function
const copyMessageToClipboard = async (message: string) => {
  try {
    await navigator.clipboard.writeText(message);
    toast({
      title: "Copied!",
      description: "Message copied to clipboard. You can paste it in WhatsApp manually.",
    });
  } catch (error) {
    console.error("Failed to copy message:", error);
    toast({
      title: "Copy Failed",
      description: "Unable to copy message to clipboard",
      variant: "destructive",
    });
  }
};

// Utility: Format phone number for WhatsApp
const formatPhoneNumber = (rawNumber: string): string => {
  if (!rawNumber) return "";

  let cleaned = rawNumber.replace(/[^\d]/g, ""); // keep only digits
  cleaned = cleaned.replace(/^0+/, ""); // remove leading zeros

  // Add default country code (India "91" here — change if global)
  if (!cleaned.startsWith("91") && cleaned.length <= 10) {
    cleaned = "91" + cleaned;
  }

  return cleaned;
};

// Function to send WhatsApp message
const handleSendWhatsAppMessage = () => {
  if (!selectedContactForMessage) return;

  const phoneNumber = formatPhoneNumber(selectedContactForMessage.phones?.[0] || "");
  if (!phoneNumber) {
    toast({
      title: "Error",
      description: "No phone number available for this contact",
      variant: "destructive",
    });
    return;
  }

  let messageContent = "";

  if (selectedTemplate) {
    messageContent = replacePlaceholders(
      selectedTemplate.content,
      selectedContactForMessage
    );
  } else if (customMessage.trim()) {
    messageContent = replacePlaceholders(
      customMessage,
      selectedContactForMessage
    );
  } else {
    messageContent = `Hi ${selectedContactForMessage.firstName}, I hope you're doing well!`;
  }

  const formattedMessage = formatMessageForWhatsApp(messageContent);

  try {
    const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(
      navigator.userAgent
    );

    let whatsappUrl: string;

    if (isMobile) {
      // ✅ Try to open WhatsApp mobile app
      whatsappUrl = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(
        formattedMessage
      )}`;

      // Fallback → if app not installed, use wa.me
      setTimeout(() => {
        window.open(
          `https://wa.me/${phoneNumber}?text=${encodeURIComponent(
            formattedMessage
          )}`,
          "_blank"
        );
      }, 500);
    } else {
      // ✅ Desktop → WhatsApp Web
      whatsappUrl = `https://web.whatsapp.com/send?phone=${phoneNumber}&text=${encodeURIComponent(
        formattedMessage
      )}`;
    }

    // Handle too long messages
    if (whatsappUrl.length > 2000) {
      copyMessageToClipboard(formattedMessage);

      const simpleUrl = isMobile
        ? `https://wa.me/${phoneNumber}`
        : `https://web.whatsapp.com/send?phone=${phoneNumber}`;

      window.open(simpleUrl, "_blank");
      toast({
        title: "Message Too Long",
        description:
          "Message copied to clipboard. Please paste it manually in WhatsApp.",
      });
    } else {
      window.open(whatsappUrl, "_blank");
      toast({
        title: "Success",
        description: `Opening WhatsApp to send message to ${selectedContactForMessage.firstName}`,
      });
    }
  } catch (error) {
    console.error("Error opening WhatsApp:", error);
    copyMessageToClipboard(formattedMessage);
  }

  setShowTemplateModal(false);
};






  const getGroupName = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    return group?.name || "";
  };

  const getInitials = (firstName: string, lastName: string) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return `${first}${last}`.toUpperCase();
  };

  const getBadgeColor = (index: number) => {
    const colors = [
      "bg-blue-100 text-blue-800", 
      "bg-purple-100 text-purple-800", 
      "bg-green-100 text-green-800", 
      "bg-orange-100 text-orange-800"
    ];
    return colors[index % colors.length];
  };

  const handleOpenAddModal = () => {
    setEditingContact(null);
    setFormData({
      firstName: "",
      lastName: "",
      phones: [],
      email: "",
      company: "",
      services: "",
      address: "",
      groupIds: [],
    });
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setEditingContact(null);
    setFormData({
      firstName: "",
      lastName: "",
      phones: [],
      email: "",
      company: "",
      services: "",
      address: "",
      groupIds: [],
    });
  };

  if (!user) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
            <p className="text-gray-600">Please log in to access your contacts.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-gray-200 h-48 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grid View Component
  const GridView = () => (
    <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {filteredContacts.map((contact) => (
        <Card key={contact.id} className="hover:shadow-md transition-shadow relative">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-medium">
                    {getInitials(contact.firstName, contact.lastName)}
                  </span>
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <h3 className="text-lg font-medium text-gray-900 truncate">
                    {contact.firstName} {contact.lastName}
                  </h3>
                  {contact.company && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Building className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate">{contact.company}</span>
                    </div>
                  )}
                  {contact.phones && contact.phones.length > 0 && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate">{contact.phones[0]}</span>
                      {contact.phones.length > 1 && (
                        <span className="ml-1 text-xs bg-gray-200 px-1 rounded">+{contact.phones.length - 1}</span>
                      )}
                    </div>
                  )}
                  {contact.email && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="absolute top-4 right-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => window.open(`tel:${contact.phones?.[0]}`)}>
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAssignToGroup(contact)}>
                      <Users2 className="h-4 w-4 mr-2" />
                      Assign Groups
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportVCF(contact)}>
                      <FileDown className="h-4 w-4 mr-2" />
                      Export VCF
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => handleDeleteContact(contact.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {contact.services && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-start space-x-2">
                  <User className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-700 line-clamp-2">{contact.services}</p>
                </div>
              </div>
            )}
            {contact.address && (
              <div className="mt-3">
                <div className="flex items-start space-x-2">
                  <MapPin className="h-3 w-3 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-600 line-clamp-2">{contact.address}</p>
                </div>
              </div>
            )}
            <div className="mt-4 flex justify-between items-center">
              <div className="flex flex-wrap gap-1">
                {contact.groupIds?.slice(0, 3).map((groupId, index) => (
                  <Badge 
                    key={groupId} 
                    variant="secondary" 
                    className={`text-xs ${getBadgeColor(index)}`}
                  >
                    {getGroupName(groupId)}
                  </Badge>
                ))}
                {contact.groupIds && contact.groupIds.length > 3 && (
                  <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-800">
                    +{contact.groupIds.length - 3}
                  </Badge>
                )}
              </div>
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSendMessage(contact)}
                >
                  <WhatsAppIcon className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditContact(contact)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // Table View Component
  const TableView = () => (
    <div className="mt-6">
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Groups</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary text-sm font-medium">
                          {getInitials(contact.firstName, contact.lastName)}
                        </span>
                      </div>
                      <span className="font-medium">
                        {contact.firstName} {contact.lastName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {contact.phones?.join(', ')}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{contact.email}</TableCell>
                  <TableCell className="max-w-xs truncate">{contact.company}</TableCell>
                  <TableCell>
                    {contact.groupIds && contact.groupIds.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {contact.groupIds.slice(0, 2).map((groupId, index) => (
                          <Badge 
                            key={groupId} 
                            variant="secondary" 
                            className={`text-xs ${getBadgeColor(index)}`}
                          >
                            {getGroupName(groupId)}
                          </Badge>
                        ))}
                        {contact.groupIds.length > 2 && (
                          <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-800">
                            +{contact.groupIds.length - 2}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">No groups</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSendMessage(contact)}
                      >
                        <WhatsAppIcon className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditContact(contact)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => window.open(`tel:${contact.phones?.[0]}`)}
                          >
                            <Phone className="h-4 w-4 mr-2" />
                            Call
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleAssignToGroup(contact)}
                          >
                            <Users2 className="h-4 w-4 mr-2" />
                          Assign Groups
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportVCF(contact)}>
                          <FileDown className="h-4 w-4 mr-2" />
                          Export VCF
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteContact(contact.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Contacts ({contacts.length})
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage your business contacts and relationships
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">
            <Button 
              variant="outline" 
              onClick={() => setShowImportModal(true)}
              className="text-blue-600 border-blue-600 hover:bg-blue-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Excel
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleExportToExcel}
              disabled={exporting || filteredContacts.length === 0}
              className="text-green-600 border-green-600 hover:bg-green-50"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel ({filteredContacts.length})
                </>
              )}
            </Button>

            <Button onClick={() => {
              if (!canAddContact) {
                setShowLimitModal(true);
                return;
              }
              handleOpenAddModal();
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
            
            <Dialog open={showAddModal || showEditModal} onOpenChange={(open) => {
              if (!open) {
                handleCloseModal();
              }
            }}>
              <DialogTrigger asChild>
                <div style={{ display: 'none' }} />
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingContact ? "Edit Contact" : "Add New Contact"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                        required
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                        required
                        disabled={saving}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Phones</Label>
                    {formData.phones.map((phone, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          type="tel"
                          value={phone}
                          onChange={(e) => {
                            const newPhones = [...formData.phones];
                            newPhones[index] = e.target.value;
                            setFormData(prev => ({ ...prev, phones: newPhones }));
                          }}
                          required={index === 0}
                          disabled={saving}
                        />
                        {index > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newPhones = formData.phones.filter((_, i) => i !== index);
                              setFormData(prev => ({ ...prev, phones: newPhones }));
                            }}
                            disabled={saving}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData(prev => ({ ...prev, phones: [...prev.phones, ''] }))}
                      disabled={saving}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Phone
                    </Button>
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <Label htmlFor="company">Company *</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                      required
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <Label htmlFor="services">Services</Label>
                    <Textarea
                      id="services"
                      value={formData.services}
                      onChange={(e) => setFormData(prev => ({ ...prev, services: e.target.value }))}
                      rows={3}
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Address (Optional)</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      rows={2}
                      disabled={saving}
                    />
                  </div>
                  {groups.length > 0 && (
                    <div>
                      <Label htmlFor="groups">Assign to Groups (Optional)</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {groups.map(group => (
                          <label key={group.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={formData.groupIds.includes(group.id)}
                              disabled={saving}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData(prev => ({ ...prev, groupIds: [...prev.groupIds, group.id] }));
                                } else {
                                  setFormData(prev => ({ ...prev, groupIds: prev.groupIds.filter(id => id !== group.id) }));
                                }
                              }}
                            />
                            <span className="text-sm">{group.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end space-x-4">
                    <Button type="button" variant="outline" onClick={handleCloseModal} disabled={saving}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {editingContact ? "Updating..." : "Adding..."}
                        </>
                      ) : (
                        editingContact ? "Update Contact" : "Add Contact"
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-6">
          <Card>
            <CardContent className="p-6">
              <div className="sm:flex sm:items-center sm:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      type="text"
                      className="pl-10"
                      placeholder="Search contacts by name, email, phone, or company..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-4 sm:mt-0 sm:ml-4 flex items-center space-x-4">
                  {/* View Toggle */}
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <Button
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("grid")}
                      className={`h-8 w-8 p-0 ${
                        viewMode === "grid" 
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm" 
                          : "hover:bg-gray-200 text-gray-600"
                      }`}
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "table" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("table")}
                      className={`h-8 w-8 p-0 ${
                        viewMode === "table" 
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm" 
                          : "hover:bg-gray-200 text-gray-600"
                      }`}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Filter */}
                  <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Groups</SelectItem>
                      {groups.map(group => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contacts Display */}
        {filteredContacts.length > 0 ? (
          viewMode === "grid" ? <GridView /> : <TableView />
        ) : (
          <div className="mt-6 text-center py-12">
            <div className="text-gray-500">
              {searchTerm || selectedGroup !== "all" 
                ? "No contacts found matching your criteria"
                : "No contacts yet. Add your first contact to get started."
              }
            </div>
          </div>
        )}
      </div>

      {/* Bulk Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Import Contacts</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Import Instructions:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Upload an Excel file (.xlsx) with contact information</li>
                <li>• Required columns: <strong>First Name</strong> and <strong>Phone</strong></li>
                <li>• Optional columns: Last Name, Email, Company, Services, Address</li>
                <li>• Alternative column names are supported (e.g., 'Name', 'Mobile', 'Organization')</li>
                <li>• Duplicates will be automatically skipped</li>
              </ul>
            </div>

            <div>
              <Label htmlFor="importFile">Select Excel File</Label>
              <Input

                id="importFile"
                name="importFile"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="mt-2"
              />
            </div>

            {importPreview.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Preview ({importPreview.length} rows)</h4>
                  <div className="text-sm text-gray-600">
                    Valid: {importPreview.filter(row => row.isValid).length} | 
                    Invalid: {importPreview.filter(row => !row.isValid).length}
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>First Name</TableHead>
                        <TableHead>Last Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Phone 2</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Company</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreview.slice(0, 10).map((row, index) => (
                        <TableRow key={index} className={!row.isValid ? "bg-red-50" : ""}>
                          <TableCell>
                            {row.isValid ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <span className="text-xs text-red-600">Invalid</span>
                            )}
                          </TableCell>
                          <TableCell>{row.firstName}</TableCell>
                          <TableCell>{row.lastName}</TableCell>
                          <TableCell>{row.phone}</TableCell>
                          <TableCell>{row.phone2}</TableCell>
                          <TableCell>{row.email}</TableCell>
                          <TableCell>{row.company}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {importPreview.length > 10 && (
                  <p className="text-sm text-gray-500">
                    Showing first 10 rows. Total: {importPreview.length} rows
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportPreview([]);
                }}
                disabled={importing}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleBulkImport}
                disabled={importing || importPreview.length === 0 || !importPreview.some(row => row.isValid)}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  `Import ${importPreview.filter(row => row.isValid).length} Contacts`
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Group Assignment Modal */}
      <Dialog open={showGroupModal} onOpenChange={setShowGroupModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Contact to Groups</DialogTitle>
          </DialogHeader>
          {selectedContactForGroup && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Assigning <strong>{selectedContactForGroup.firstName} {selectedContactForGroup.lastName}</strong> to groups:
              </p>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {groups.map(group => {
                  const isChecked = selectedContactForGroup.groupIds?.includes(group.id) || false;
                  return (
                    <div key={group.id} className="flex items-center space-x-3">
                      <div className="relative">
                        <input
                          type="checkbox"
                          id={`group-${group.id}`}
                          checked={isChecked}
                          onChange={() => handleGroupAssignment(group.id)}
                          className="sr-only"
                        />
                        <div
                          onClick={() => handleGroupAssignment(group.id)}
                          className={`w-5 h-5 border-2 rounded cursor-pointer flex items-center justify-center transition-all ${
                            isChecked 
                              ? "bg-blue-600 border-blue-600 text-white" 
                              : "border-gray-300 hover:border-gray-400"
                          }`}
                        >
                          {isChecked && <Check className="h-3 w-3" />}
                        </div>
                      </div>
                      <label 
                        htmlFor={`group-${group.id}`} 
                        className="text-sm cursor-pointer flex-1 select-none"
                        onClick={() => handleGroupAssignment(group.id)}
                      >
                        {group.name}
                      </label>
                    </div>
                  );
                })}
              </div>
              {groups.length === 0 && (
                <p className="text-sm text-gray-500">
                  No groups available. Create groups first to assign contacts.
                </p>
              )}
              <div className="flex justify-end space-x-4">
                <Button variant="outline" onClick={() => setShowGroupModal(false)}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Enhanced Template Selection Modal for WhatsApp Message */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send WhatsApp Message</DialogTitle>
          </DialogHeader>
          {selectedContactForMessage && (
            <div className="space-y-6">
              <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-medium">
                    {getInitials(selectedContactForMessage.firstName, selectedContactForMessage.lastName)}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{selectedContactForMessage.firstName} {selectedContactForMessage.lastName}</p>
                  <p className="text-sm text-gray-500">{selectedContactForMessage.phones?.join(', ')}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Choose Message Option:</h3>
                
                {/* Template Selection */}
                {templates.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Use a Template:</Label>
                    <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto">
                      {templates.map(template => (
                        <div
                          key={template.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-all ${
                            selectedTemplate?.id === template.id
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                          onClick={() => {
                            setSelectedTemplate(template);
                            setCustomMessage("");
                          }}
                        >
                          <div className="flex items-start space-x-3">
                            <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{template.name}</p>
                              <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                {replacePlaceholders(template.content, selectedContactForMessage).substring(0, 100)}...
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {selectedTemplate && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm font-medium text-blue-800">Preview:</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const previewText = replacePlaceholders(selectedTemplate.content, selectedContactForMessage);
                              copyMessageToClipboard(previewText);
                            }}
                            className="h-6 px-2 text-blue-600 hover:text-blue-700"
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <p className="text-sm text-blue-700 whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {replacePlaceholders(selectedTemplate.content, selectedContactForMessage)}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Custom Message */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">
                    {templates.length > 0 ? "Or Write Custom Message:" : "Write Custom Message:"}
                  </Label>
                  <Textarea
                    value={customMessage}
                    onChange={(e) => {
                      setCustomMessage(e.target.value);
                      setSelectedTemplate(null);
                    }}
                    placeholder="Write your custom message here... 

You can use placeholders:
{firstName} - Contact's first name
{lastName} - Contact's last name  
{fullName} - Contact's full name
{company} - Contact's company
{email} - Contact's email
{phone} - Contact's phone"
                    rows={6}
                    className="resize-none"
                  />
                  
                  {customMessage.trim() && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-medium text-green-800">Preview:</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const previewText = replacePlaceholders(customMessage, selectedContactForMessage);
                            copyMessageToClipboard(previewText);
                          }}
                          className="h-6 px-2 text-green-600 hover:text-green-700"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                      <p className="text-sm text-green-700 whitespace-pre-wrap max-h-32 overflow-y-auto">
                        {replacePlaceholders(customMessage, selectedContactForMessage)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Placeholder Help */}
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-xs text-gray-600">
                    <strong>Available placeholders:</strong> {"{firstName}"}, {"{lastName}"}, {"{fullName}"}, {"{company}"}, {"{email}"}, {"{phone}"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Note: Very long messages may be copied to clipboard instead of pre-filled in WhatsApp.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <Button variant="outline" onClick={() => setShowTemplateModal(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSendWhatsAppMessage}
                  disabled={!selectedTemplate && !customMessage.trim()}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <WhatsAppIcon className="h-4 w-4 mr-2" />
                  Send via WhatsApp
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Usage Limit Modal */}
      <UsageLimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        feature="contact"
        currentCount={usage.contactsCount}
        limit={limits.contacts}
      />
    </div>
  );
}

export default Contacts;
