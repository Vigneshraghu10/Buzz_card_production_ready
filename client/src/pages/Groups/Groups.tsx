import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Trash2, Tag, X, Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from 'xlsx';

interface Group {
  id: string;
  name: string;
  createdAt: Date;
  ownerId: string;
  contactCount?: number;
  tags?: string[];
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  notes?: string;
  tags?: string[];
  groupIds?: string[];
  groupId?: string;
  groups?: any[];
  group?: string;
  categoryId?: string;
  categories?: any[];
  createdAt?: Date;
  updatedAt?: Date;
}

export default function Groups() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupContacts, setGroupContacts] = useState<Contact[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    if (!user) return;
    fetchGroups();
  }, [user]);

  const fetchGroups = async () => {
    try {
      const groupsQuery = query(collection(db, "groups"), where("ownerId", "==", user!.uid));
      const groupsSnapshot = await getDocs(groupsQuery);
      
      // Get contact counts for each group
      const contactsQuery = query(collection(db, "contacts"), where("ownerId", "==", user!.uid));
      const contactsSnapshot = await getDocs(contactsQuery);
      const contacts = contactsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Store all contacts for later use
      setAllContacts(contacts);

      const groupsWithCounts = groupsSnapshot.docs.map(doc => {
        const groupData = doc.data();
        
        // Calculate contact count - check multiple possible field names and structures
        const contactCount = contacts.filter(contact => {
          const possibleGroupFields = [
            contact.groupIds,
            contact.groupId, 
            contact.groups,
            contact.group,
            contact.categoryId,
            contact.categories
          ];

          for (const field of possibleGroupFields) {
            if (!field) continue;
            
            if (Array.isArray(field)) {
              if (field.includes(doc.id)) return true;
              if (field.some(g => g?.id === doc.id)) return true;
            } else if (typeof field === 'string') {
              if (field === doc.id) return true;
            }
          }
          return false;
        }).length;

        return {
          id: doc.id,
          ...groupData,
          createdAt: groupData.createdAt?.toDate() || new Date(),
          contactCount,
        } as Group;
      });

      setGroups(groupsWithCounts);
    } catch (error) {
      console.error("Error fetching groups:", error);
      toast({
        title: "Error",
        description: "Failed to fetch groups",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupContacts = async (groupId: string) => {
    try {
      const contacts = allContacts.filter(contact => {
        const possibleGroupFields = [
          contact.groupIds,
          contact.groupId, 
          contact.groups,
          contact.group,
          contact.categoryId,
          contact.categories
        ];

        for (const field of possibleGroupFields) {
          if (!field) continue;
          
          if (Array.isArray(field)) {
            if (field.includes(groupId)) return true;
            if (field.some(g => g?.id === groupId)) return true;
          } else if (typeof field === 'string') {
            if (field === groupId) return true;
          }
        }
        return false;
      });

      setGroupContacts(contacts);
    } catch (error) {
      console.error("Error fetching group contacts:", error);
      toast({
        title: "Error",
        description: "Failed to fetch group contacts",
        variant: "destructive",
      });
    }
  };

  const exportGroupToExcel = async (group: Group) => {
    setExporting(true);
    try {
      // Get contacts for this group
      const contacts = allContacts.filter(contact => {
        const possibleGroupFields = [
          contact.groupIds,
          contact.groupId, 
          contact.groups,
          contact.group,
          contact.categoryId,
          contact.categories
        ];

        for (const field of possibleGroupFields) {
          if (!field) continue;
          
          if (Array.isArray(field)) {
            if (field.includes(group.id)) return true;
            if (field.some(g => g?.id === group.id)) return true;
          } else if (typeof field === 'string') {
            if (field === group.id) return true;
          }
        }
        return false;
      });

      // Create a new workbook
      const workbook = XLSX.utils.book_new();

      // Group Information Sheet
      const groupInfo = [
        ['Group Information'],
        [''],
        ['Group Name', group.name],
        ['Total Contacts', contacts.length],
        ['Created Date', group.createdAt.toLocaleDateString()],
        ['Tags', group.tags?.join(', ') || 'No tags'],
        ['Export Date', new Date().toLocaleDateString()],
        ['Export Time', new Date().toLocaleTimeString()],
      ];

      const groupInfoSheet = XLSX.utils.aoa_to_sheet(groupInfo);
      
      // Style the header
      if (!groupInfoSheet['!merges']) groupInfoSheet['!merges'] = [];
      groupInfoSheet['!merges'].push({s: {r: 0, c: 0}, e: {r: 0, c: 1}});
      
      // Set column widths
      groupInfoSheet['!cols'] = [
        { width: 20 },
        { width: 30 }
      ];

      XLSX.utils.book_append_sheet(workbook, groupInfoSheet, 'Group Info');

      // Contacts Sheet
      if (contacts.length > 0) {
        const contactsData = contacts.map(contact => ({
          'First Name': contact.firstName || '',
          'Last Name': contact.lastName || '',
          'Full Name': `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
          'Email': contact.email || '',
          'Phone': contact.phone || '',
          'Company': contact.company || '',
          'Position': contact.position || '',
          'Address': contact.address || '',
          'City': contact.city || '',
          'State': contact.state || '',
          'Zip Code': contact.zipCode || '',
          'Country': contact.country || '',
          'Notes': contact.notes || '',
          'Contact Tags': contact.tags?.join(', ') || '',
          'Created Date': contact.createdAt ? new Date(contact.createdAt).toLocaleDateString() : '',
          'Updated Date': contact.updatedAt ? new Date(contact.updatedAt).toLocaleDateString() : '',
        }));

        const contactsSheet = XLSX.utils.json_to_sheet(contactsData);
        
        // Set column widths for contacts sheet
        contactsSheet['!cols'] = [
          { width: 15 }, // First Name
          { width: 15 }, // Last Name
          { width: 25 }, // Full Name
          { width: 25 }, // Email
          { width: 15 }, // Phone
          { width: 20 }, // Company
          { width: 20 }, // Position
          { width: 30 }, // Address
          { width: 15 }, // City
          { width: 10 }, // State
          { width: 10 }, // Zip Code
          { width: 15 }, // Country
          { width: 30 }, // Notes
          { width: 20 }, // Contact Tags
          { width: 12 }, // Created Date
          { width: 12 }, // Updated Date
        ];

        XLSX.utils.book_append_sheet(workbook, contactsSheet, 'Contacts');
      } else {
        // Empty contacts sheet with headers
        const emptyContactsData = [[
          'First Name', 'Last Name', 'Full Name', 'Email', 'Phone', 'Company', 
          'Position', 'Address', 'City', 'State', 'Zip Code', 'Country', 
          'Notes', 'Contact Tags', 'Created Date', 'Updated Date'
        ], ['No contacts found in this group']];
        
        const emptySheet = XLSX.utils.aoa_to_sheet(emptyContactsData);
        XLSX.utils.book_append_sheet(workbook, emptySheet, 'Contacts');
      }

      // Summary Sheet
      const summaryData = [
        ['Contact Group Export Summary'],
        [''],
        ['Group Name', group.name],
        ['Export Summary', ''],
        ['Total Contacts', contacts.length],
        ['Contacts with Email', contacts.filter(c => c.email).length],
        ['Contacts with Phone', contacts.filter(c => c.phone).length],
        ['Contacts with Company', contacts.filter(c => c.company).length],
        ['Contacts with Address', contacts.filter(c => c.address).length],
        [''],
        ['Company Breakdown', ''],
      ];

      // Add company breakdown
      const companies = contacts.reduce((acc, contact) => {
        if (contact.company) {
          acc[contact.company] = (acc[contact.company] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      Object.entries(companies).forEach(([company, count]) => {
        summaryData.push([company, count.toString()]);
      });

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      
      // Style the summary sheet
      if (!summarySheet['!merges']) summarySheet['!merges'] = [];
      summarySheet['!merges'].push({s: {r: 0, c: 0}, e: {r: 0, c: 1}});
      
      summarySheet['!cols'] = [
        { width: 25 },
        { width: 15 }
      ];

      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      const filename = `${group.name.replace(/[^a-zA-Z0-9]/g, '_')}_Contacts_${timestamp}.xlsx`;

      // Save the file
      XLSX.writeFile(workbook, filename);

      toast({
        title: "Export Successful",
        description: `Group "${group.name}" exported successfully with ${contacts.length} contacts`,
      });

    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export group data to Excel",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const exportAllGroupsToExcel = async () => {
    setExporting(true);
    try {
      const workbook = XLSX.utils.book_new();

      // Overview Sheet
      const overviewData = [
        ['All Contact Groups Export'],
        [''],
        ['Export Date', new Date().toLocaleDateString()],
        ['Export Time', new Date().toLocaleTimeString()],
        ['Total Groups', groups.length.toString()],
        ['Total Contacts', allContacts.length.toString()],
        [''],
        ['Groups Overview'],
        ['Group Name', 'Contact Count', 'Tags', 'Created Date'],
      ];

      groups.forEach(group => {
        overviewData.push([
          group.name,
          group.contactCount?.toString() || '0',
          group.tags?.join(', ') || '',
          group.createdAt.toLocaleDateString()
        ]);
      });

      const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData);
      overviewSheet['!cols'] = [
        { width: 25 }, // Group Name
        { width: 15 }, // Contact Count
        { width: 30 }, // Tags
        { width: 15 }, // Created Date
      ];

      XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Overview');

      // Create a sheet for each group
      for (const group of groups) {
        const contacts = allContacts.filter(contact => {
          const possibleGroupFields = [
            contact.groupIds,
            contact.groupId, 
            contact.groups,
            contact.group,
            contact.categoryId,
            contact.categories
          ];

          for (const field of possibleGroupFields) {
            if (!field) continue;
            
            if (Array.isArray(field)) {
              if (field.includes(group.id)) return true;
              if (field.some(g => g?.id === group.id)) return true;
            } else if (typeof field === 'string') {
              if (field === group.id) return true;
            }
          }
          return false;
        });

        if (contacts.length > 0) {
          const contactsData = contacts.map(contact => ({
            'First Name': contact.firstName || '',
            'Last Name': contact.lastName || '',
            'Email': contact.email || '',
            'Phone': contact.phone || '',
            'Company': contact.company || '',
            'Position': contact.position || '',
            'Address': contact.address || '',
            'City': contact.city || '',
            'State': contact.state || '',
            'Country': contact.country || '',
            'Notes': contact.notes || '',
          }));

          const contactsSheet = XLSX.utils.json_to_sheet(contactsData);
          contactsSheet['!cols'] = [
            { width: 15 }, { width: 15 }, { width: 25 }, { width: 15 },
            { width: 20 }, { width: 20 }, { width: 30 }, { width: 15 },
            { width: 10 }, { width: 15 }, { width: 30 }
          ];

          // Sanitize sheet name
          const sheetName = group.name.replace(/[^\w\s]/g, '').substring(0, 30);
          XLSX.utils.book_append_sheet(workbook, contactsSheet, sheetName);
        }
      }

      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      const filename = `All_Contact_Groups_${timestamp}.xlsx`;

      XLSX.writeFile(workbook, filename);

      toast({
        title: "Export Successful",
        description: `All groups exported successfully with ${allContacts.length} total contacts`,
      });

    } catch (error) {
      console.error("Error exporting all groups:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export all groups data to Excel",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const removeContactFromGroup = async (contactId: string, groupId: string) => {
    try {
      const contact = allContacts.find(c => c.id === contactId);
      if (!contact) return;

      const updates: any = {};
      
      // Update groupIds array if it exists
      if (contact.groupIds && Array.isArray(contact.groupIds)) {
        updates.groupIds = contact.groupIds.filter((id: string) => id !== groupId);
      }
      // Clear single groupId if it matches
      if (contact.groupId === groupId) {
        updates.groupId = null;
      }
      // Handle other possible field variations
      if (contact.groups && Array.isArray(contact.groups)) {
        updates.groups = contact.groups.filter((g: any) => g?.id !== groupId);
      }
      if (contact.group === groupId) {
        updates.group = null;
      }

      await updateDoc(doc(db, "contacts", contactId), updates);

      toast({
        title: "Success",
        description: "Contact removed from group successfully",
      });

      // Refresh data
      fetchGroups();
      fetchGroupContacts(groupId);
    } catch (error) {
      console.error("Error removing contact from group:", error);
      toast({
        title: "Error",
        description: "Failed to remove contact from group",
        variant: "destructive",
      });
    }
  };

  const addContactToGroup = async (contactId: string, groupId: string) => {
    try {
      const contact = allContacts.find(c => c.id === contactId);
      if (!contact) return;

      const updates: any = {};
      
      // Add to groupIds array (most common pattern)
      const currentGroupIds = contact.groupIds || [];
      if (!currentGroupIds.includes(groupId)) {
        updates.groupIds = [...currentGroupIds, groupId];
      }

      await updateDoc(doc(db, "contacts", contactId), updates);

      toast({
        title: "Success",
        description: "Contact added to group successfully",
      });

      // Refresh data
      fetchGroups();
      fetchGroupContacts(groupId);
    } catch (error) {
      console.error("Error adding contact to group:", error);
      toast({
        title: "Error",
        description: "Failed to add contact to group",
        variant: "destructive",
      });
    }
  };

  const openContactsModal = (group: Group) => {
    setSelectedGroup(group);
    fetchGroupContacts(group.id);
    setShowContactsModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await addDoc(collection(db, "groups"), {
        name: groupName,
        ownerId: user!.uid,
        createdAt: serverTimestamp(),
        tags: [],
      });

      toast({
        title: "Success",
        description: "Group created successfully",
      });

      setShowAddModal(false);
      setGroupName("");
      fetchGroups();
    } catch (error) {
      console.error("Error creating group:", error);
      toast({
        title: "Error",
        description: "Failed to create group",
        variant: "destructive",
      });
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim() || !selectedGroup) return;

    try {
      const currentTags = selectedGroup.tags || [];
      if (currentTags.includes(newTag.trim())) {
        toast({
          title: "Tag already exists",
          description: "This tag is already added to the group",
          variant: "destructive",
        });
        return;
      }

      const updatedTags = [...currentTags, newTag.trim()];
      await updateDoc(doc(db, "groups", selectedGroup.id), { tags: updatedTags });

      setSelectedGroup({ ...selectedGroup, tags: updatedTags });
      setNewTag("");
      fetchGroups();

      toast({
        title: "Success",
        description: "Tag added successfully",
      });
    } catch (error) {
      console.error("Error adding tag:", error);
      toast({
        title: "Error",
        description: "Failed to add tag",
        variant: "destructive",
      });
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!selectedGroup) return;

    try {
      const currentTags = selectedGroup.tags || [];
      const updatedTags = currentTags.filter(tag => tag !== tagToRemove);
      await updateDoc(doc(db, "groups", selectedGroup.id), { tags: updatedTags });

      setSelectedGroup({ ...selectedGroup, tags: updatedTags });
      fetchGroups();

      toast({
        title: "Success",
        description: "Tag removed successfully",
      });
    } catch (error) {
      console.error("Error removing tag:", error);
      toast({
        title: "Error",
        description: "Failed to remove tag",
        variant: "destructive",
      });
    }
  };

  const openTagsModal = (group: Group) => {
    setSelectedGroup(group);
    setShowTagsModal(true);
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      // Remove group from all contacts that reference it
      const contactsQuery = query(collection(db, "contacts"), where("ownerId", "==", user!.uid));
      const contactsSnapshot = await getDocs(contactsQuery);
      
      const updatePromises = contactsSnapshot.docs
        .filter(doc => {
          const data = doc.data();
          // Check all possible field variations
          const possibleGroupFields = [
            data.groupIds,
            data.groupId, 
            data.groups,
            data.group,
            data.categoryId,
            data.categories
          ];

          for (const field of possibleGroupFields) {
            if (!field) continue;
            
            if (Array.isArray(field)) {
              if (field.includes(groupId)) return true;
              if (field.some(g => g?.id === groupId)) return true;
            } else if (typeof field === 'string') {
              if (field === groupId) return true;
            }
          }
          return false;
        })
        .map(contactDoc => {
          const data = contactDoc.data();
          const updates: any = {};
          
          // Update groupIds array if it exists
          if (data.groupIds && Array.isArray(data.groupIds)) {
            updates.groupIds = data.groupIds.filter((id: string) => id !== groupId);
          }
          // Clear single groupId if it matches
          if (data.groupId === groupId) {
            updates.groupId = null;
          }
          // Handle other possible field variations
          if (data.groups && Array.isArray(data.groups)) {
            updates.groups = data.groups.filter((g: any) => g?.id !== groupId);
          }
          if (data.group === groupId) {
            updates.group = null;
          }
          
          return updateDoc(doc(db, "contacts", contactDoc.id), updates);
        });

      await Promise.all(updatePromises);

      // Delete the group
      await deleteDoc(doc(db, "groups", groupId));

      toast({
        title: "Success",
        description: "Group deleted successfully",
      });

      fetchGroups();
    } catch (error) {
      console.error("Error deleting group:", error);
      toast({
        title: "Error",
        description: "Failed to delete group",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-gray-200 h-32 rounded-lg"></div>
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
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">Groups</h2>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">
            {groups.length > 0 && (
              <Button
                variant="outline"
                onClick={exportAllGroupsToExcel}
                disabled={exporting}
                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
              >
                {exporting ? (
                  <div className="animate-spin h-4 w-4 mr-2 border-2 border-green-600 border-t-transparent rounded-full" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                Export All Groups
              </Button>
            )}
            <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Group
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Group</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="groupName">Group Name</Label>
                    <Input
                      id="groupName"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Enter group name"
                      required
                    />
                  </div>
                  <div className="flex justify-end space-x-4">
                    <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Create Group</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Users className="text-primary h-6 w-6" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">{group.name}</h3>
                      <p className="text-sm text-gray-500">
                        {group.contactCount || 0} contact{(group.contactCount || 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportGroupToExcel(group)}
                      disabled={exporting}
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      title="Export to Excel"
                    >
                      {exporting ? (
                        <div className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteGroup(group.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Tags */}
                {group.tags && group.tags.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      {group.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Created {group.createdAt.toLocaleDateString()}
                  </p>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openContactsModal(group)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <Users className="h-4 w-4 mr-1" />
                      View Contacts
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openTagsModal(group)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Tag className="h-4 w-4 mr-1" />
                      Tags
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tags Management Modal */}
        <Dialog open={showTagsModal} onOpenChange={setShowTagsModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Manage Tags - {selectedGroup?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Add New Tag */}
              <div className="flex space-x-2">
                <Input
                  placeholder="Enter tag name..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
                <Button onClick={handleAddTag} disabled={!newTag.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Current Tags */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">Current Tags</Label>
                {selectedGroup?.tags && selectedGroup.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedGroup.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 hover:bg-red-100"
                          onClick={() => handleRemoveTag(tag)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No tags added yet</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Contacts Management Modal */}
        <Dialog open={showContactsModal} onOpenChange={setShowContactsModal}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Manage Contacts - {selectedGroup?.name}</span>
                {selectedGroup && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportGroupToExcel(selectedGroup)}
                    disabled={exporting}
                    className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                  >
                    {exporting ? (
                      <div className="animate-spin h-4 w-4 mr-2 border-2 border-green-600 border-t-transparent rounded-full" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Export Excel
                  </Button>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Current Contacts in Group */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Contacts in this group ({groupContacts.length})
                </Label>
                {groupContacts.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2">
                    {groupContacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {contact.firstName} {contact.lastName}
                          </p>
                          {contact.email && (
                            <p className="text-xs text-gray-500">{contact.email}</p>
                          )}
                          {contact.phone && (
                            <p className="text-xs text-gray-500">{contact.phone}</p>
                          )}
                          {contact.company && (
                            <p className="text-xs text-blue-600">{contact.company}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeContactFromGroup(contact.id, selectedGroup!.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-4 text-center border rounded-lg">
                    No contacts in this group yet
                  </p>
                )}
              </div>

              {/* Add Contacts to Group */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Add Contacts to Group
                </Label>
                {allContacts.filter(contact => 
                  !groupContacts.some(gc => gc.id === contact.id)
                ).length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2">
                    {allContacts
                      .filter(contact => !groupContacts.some(gc => gc.id === contact.id))
                      .map((contact) => (
                        <div key={contact.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {contact.firstName} {contact.lastName}
                            </p>
                            {contact.email && (
                              <p className="text-xs text-gray-500">{contact.email}</p>
                            )}
                            {contact.phone && (
                              <p className="text-xs text-gray-500">{contact.phone}</p>
                            )}
                            {contact.company && (
                              <p className="text-xs text-blue-600">{contact.company}</p>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addContactToGroup(contact.id, selectedGroup!.id)}
                            className="text-green-600 hover:text-green-700"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-4 text-center border rounded-lg">
                    All contacts are already in this group
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {groups.length === 0 && (
          <div className="mt-6 text-center py-12">
            <div className="text-gray-500">
              No groups yet. Create your first group to organize your contacts.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}