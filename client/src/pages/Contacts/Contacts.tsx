import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isDuplicateContact } from "@/utils/duplicate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Grid3X3, List, MoreVertical, Edit, MessageCircle, Trash2, Users2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
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

export default function Contacts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [selectedContactForGroup, setSelectedContactForGroup] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    company: "",
    services: "",
    address: "",
    groupIds: [] as string[],
  });

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  useEffect(() => {
    let filtered = contacts;

    if (searchTerm) {
      filtered = filtered.filter(contact => 
        contact.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.phone.includes(searchTerm) ||
        contact.company.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedGroup !== "all") {
      filtered = filtered.filter(contact => 
        contact.groupIds.includes(selectedGroup)
      );
    }

    setFilteredContacts(filtered);
  }, [contacts, searchTerm, selectedGroup]);

  const fetchData = async () => {
    try {
      // Fetch contacts
      const contactsQuery = query(collection(db, "contacts"), where("ownerId", "==", user!.uid));
      const contactsSnapshot = await getDocs(contactsQuery);
      const contactsData = contactsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Contact[];

      // Fetch groups
      const groupsQuery = query(collection(db, "groups"), where("ownerId", "==", user!.uid));
      const groupsSnapshot = await getDocs(groupsQuery);
      const groupsData = groupsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Group[];

      setContacts(contactsData);
      setGroups(groupsData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch contacts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingContact) {
        // Update existing contact
        await updateDoc(doc(db, "contacts", editingContact.id), {
          ...formData,
          email: formData.email.toLowerCase(),
        });
        
        toast({
          title: "Success",
          description: "Contact updated successfully",
        });
        
        setShowEditModal(false);
        setEditingContact(null);
      } else {
        // Check for duplicates only if email or phone is provided
        if (formData.email || formData.phone) {
          const isDupe = await isDuplicateContact(user!.uid, formData.email, formData.phone);
          if (isDupe) {
            toast({
              title: "Duplicate Contact",
              description: "A contact with this email or phone already exists",
              variant: "destructive",
            });
            return;
          }
        }

        await addDoc(collection(db, "contacts"), {
          ...formData,
          email: formData.email.toLowerCase(),
          ownerId: user!.uid,
          createdAt: serverTimestamp(),
        });

        toast({
          title: "Success",
          description: "Contact added successfully",
        });
        
        setShowAddModal(false);
      }

      setFormData({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        company: "",
        services: "",
        address: "",
        groupIds: [],
      });
      fetchData();
    } catch (error) {
      console.error("Error saving contact:", error);
      toast({
        title: "Error",
        description: "Failed to save contact",
        variant: "destructive",
      });
    }
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone,
      email: contact.email,
      company: contact.company,
      services: contact.services,
      address: contact.address || "",
      groupIds: contact.groupIds,
    });
    setShowEditModal(true);
  };

  const handleDeleteContact = async (contactId: string) => {
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
      const updatedGroupIds = selectedContactForGroup.groupIds.includes(groupId)
        ? selectedContactForGroup.groupIds.filter(id => id !== groupId)
        : [...selectedContactForGroup.groupIds, groupId];
      
      await updateDoc(doc(db, "contacts", selectedContactForGroup.id), {
        groupIds: updatedGroupIds,
      });
      
      toast({
        title: "Success",
        description: "Group assignment updated",
      });
      
      setShowGroupModal(false);
      setSelectedContactForGroup(null);
      fetchData();
    } catch (error) {
      console.error("Error updating group assignment:", error);
      toast({
        title: "Error",
        description: "Failed to update group assignment",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = (contact: Contact) => {
    // Create WhatsApp message link
    const phoneNumber = contact.phone.replace(/[^\d]/g, ''); // Remove non-numeric characters
    const message = `Hi ${contact.firstName}, I hope you're doing well!`;
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    
    // Open WhatsApp in new tab
    window.open(whatsappUrl, '_blank');
    
    toast({
      title: "Message Sent",
      description: `Opening WhatsApp to send message to ${contact.firstName}`,
    });
  };

  const getGroupName = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    return group?.name || "";
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getBadgeColor = (index: number) => {
    const colors = ["bg-blue-100 text-blue-800", "bg-purple-100 text-purple-800", "bg-green-100 text-green-800", "bg-orange-100 text-orange-800"];
    return colors[index % colors.length];
  };

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

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">Contacts</h2>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <Dialog open={showAddModal || showEditModal} onOpenChange={(open) => {
              if (!open) {
                setShowAddModal(false);
                setShowEditModal(false);
                setEditingContact(null);
                setFormData({
                  firstName: "",
                  lastName: "",
                  phone: "",
                  email: "",
                  company: "",
                  services: "",
                  address: "",
                  groupIds: [],
                });
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingContact ? "Edit Contact" : "Add New Contact"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="services">Services</Label>
                    <Textarea
                      id="services"
                      value={formData.services}
                      onChange={(e) => setFormData(prev => ({ ...prev, services: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Address (Optional)</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="groups">Assign to Groups (Optional)</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {groups.map(group => (
                        <label key={group.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={formData.groupIds.includes(group.id)}
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
                  <div className="flex justify-end space-x-4">
                    <Button type="button" variant="outline" onClick={() => {
                      setShowAddModal(false);
                      setEditingContact(null);
                      setFormData({
                        firstName: "",
                        lastName: "",
                        phone: "",
                        email: "",
                        company: "",
                        services: "",
                        address: "",
                        groupIds: [],
                      });
                    }}>
                      Cancel
                    </Button>
                    <Button type="submit">{editingContact ? "Update Contact" : "Add Contact"}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
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
                      className="h-8 w-8 p-0"
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "table" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("table")}
                      className="h-8 w-8 p-0"
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

        {/* Contacts Grid */}
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredContacts.map((contact) => (
            <Card key={contact.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-medium text-lg">
                        {getInitials(contact.firstName, contact.lastName)}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {contact.firstName} {contact.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{contact.company}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditContact(contact)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Contact
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAssignToGroup(contact)}>
                            <Users2 className="h-4 w-4 mr-2" />
                            Assign to Group
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteContact(contact.id)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Contact
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-gray-900">{contact.email}</p>
                  <p className="text-sm text-gray-500">{contact.phone}</p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {contact.groupIds.map((groupId, index) => (
                      <Badge key={groupId} className={getBadgeColor(index)}>
                        {getGroupName(groupId)}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-primary hover:bg-primary/10"
                      onClick={() => handleSendMessage(contact)}
                      title="Send WhatsApp Message"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-gray-600 hover:bg-gray-100"
                      onClick={() => handleEditContact(contact)}
                      title="Edit Contact"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredContacts.length === 0 && (
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
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {groups.map(group => (
                  <div key={group.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`group-${group.id}`}
                      checked={selectedContactForGroup.groupIds.includes(group.id)}
                      onChange={() => handleGroupAssignment(group.id)}
                    />
                    <label htmlFor={`group-${group.id}`} className="text-sm cursor-pointer">
                      {group.name}
                    </label>
                  </div>
                ))}
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
    </div>
  );
}
