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
import { Plus, Users, Trash2, Tag, X } from "lucide-react";

interface Group {
  id: string;
  name: string;
  createdAt: Date;
  ownerId: string;
  contactCount?: number;
  tags?: string[];
}

export default function Groups() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
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
      const contacts = contactsSnapshot.docs.map(doc => doc.data());

      const groupsWithCounts = groupsSnapshot.docs.map(doc => {
        const groupData = doc.data();
        const contactCount = contacts.filter(contact => 
          contact.groupIds?.includes(doc.id)
        ).length;

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
        .filter(doc => doc.data().groupIds?.includes(groupId))
        .map(contactDoc => {
          const currentGroupIds = contactDoc.data().groupIds || [];
          const updatedGroupIds = currentGroupIds.filter((id: string) => id !== groupId);
          return updateDoc(doc(db, "contacts", contactDoc.id), { groupIds: updatedGroupIds });
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
          <div className="mt-4 flex md:mt-0 md:ml-4">
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteGroup(group.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
