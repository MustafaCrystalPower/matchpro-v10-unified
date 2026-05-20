/**
 * SavedSearches Component
 * Displays user's saved searches and their matches with email notifications
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Bell, AlertCircle } from "lucide-react";
export function SavedSearches() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSearch, setSelectedSearch] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    mode: "buy" as "sell" | "buy" | "urgent",
    location: "",
    propertyType: "",
    priceMin: "",
    priceMax: "",
    bedroomsMin: "",
    bedroomsMax: "",
    notifyEmail: "",
    notifyOnNewMatches: true,
    minScoreThreshold: 70,
  });

  // Queries
  const { data: searches = [], refetch: refetchSearches } = trpc.savedSearches.list.useQuery();
  const { data: selectedMatches = [] } = trpc.savedSearches.getMatches.useQuery(
    { savedSearchId: selectedSearch! },
    { enabled: !!selectedSearch }
  );

  // Mutations
  const createMutation = trpc.savedSearches.create.useMutation({
    onSuccess: () => {
      console.log("Search saved successfully");
      refetchSearches();
      setIsOpen(false);
      resetForm();
    },
    onError: (error) => {
      console.error("Error:", error.message);
    },
  });

  const deleteMutation = trpc.savedSearches.delete.useMutation({
    onSuccess: () => {
      console.log("Search deleted");
      refetchSearches();
      setSelectedSearch(null);
    },
    onError: (error) => {
      console.error("Error:", error.message);
    },
  });

  const markNotifiedMutation = trpc.savedSearches.markNotified.useMutation({
    onSuccess: () => {
      console.log("Marked as notified");
      if (selectedSearch) {
        trpc.useUtils().savedSearches.getMatches.invalidate({ savedSearchId: selectedSearch });
      }
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      mode: "buy",
      location: "",
      propertyType: "",
      priceMin: "",
      priceMax: "",
      bedroomsMin: "",
      bedroomsMax: "",
      notifyEmail: "",
      notifyOnNewMatches: true,
      minScoreThreshold: 70,
    });
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.notifyEmail) {
      console.error("Name and email are required");
      return;
    }

    await createMutation.mutateAsync({
      ...formData,
      priceMin: formData.priceMin ? parseInt(formData.priceMin) : undefined,
      priceMax: formData.priceMax ? parseInt(formData.priceMax) : undefined,
      bedroomsMin: formData.bedroomsMin ? parseInt(formData.bedroomsMin) : undefined,
      bedroomsMax: formData.bedroomsMax ? parseInt(formData.bedroomsMax) : undefined,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this saved search?")) {
      deleteMutation.mutate({ id });
    }
  };

  const unnotifiedMatches = selectedMatches.filter((m: any) => !m.notificationSent);

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Saved Searches</h2>
          <p className="text-sm text-muted-foreground">Get email notifications for new matches</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Search
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Saved Search</DialogTitle>
              <DialogDescription>Save your search criteria and receive email notifications</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <Label>Search Name *</Label>
                <Input
                  placeholder="e.g., 5th Settlement Villas"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              {/* Mode */}
              <div>
                <Label>Mode *</Label>
                <Select value={formData.mode} onValueChange={(v: any) => setFormData({ ...formData, mode: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">I'm Buying</SelectItem>
                    <SelectItem value="sell">I'm Selling</SelectItem>
                    <SelectItem value="urgent">Urgent (Today/Yesterday)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Location & Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Location</Label>
                  <Input
                    placeholder="e.g., 5th Settlement"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Property Type</Label>
                  <Input
                    placeholder="e.g., Villa"
                    value={formData.propertyType}
                    onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })}
                  />
                </div>
              </div>

              {/* Price Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Min Price</Label>
                  <Input
                    type="number"
                    placeholder="Min"
                    value={formData.priceMin}
                    onChange={(e) => setFormData({ ...formData, priceMin: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Max Price</Label>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={formData.priceMax}
                    onChange={(e) => setFormData({ ...formData, priceMax: e.target.value })}
                  />
                </div>
              </div>

              {/* Bedrooms */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Min Bedrooms</Label>
                  <Input
                    type="number"
                    placeholder="Min"
                    value={formData.bedroomsMin}
                    onChange={(e) => setFormData({ ...formData, bedroomsMin: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Max Bedrooms</Label>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={formData.bedroomsMax}
                    onChange={(e) => setFormData({ ...formData, bedroomsMax: e.target.value })}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <Label>Notification Email *</Label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={formData.notifyEmail}
                  onChange={(e) => setFormData({ ...formData, notifyEmail: e.target.value })}
                />
              </div>

              {/* Score Threshold */}
              <div>
                <Label>Min Match Score: {formData.minScoreThreshold}%</Label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.minScoreThreshold}
                  onChange={(e) => setFormData({ ...formData, minScoreThreshold: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Notify Checkbox */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={formData.notifyOnNewMatches}
                  onCheckedChange={(checked) => setFormData({ ...formData, notifyOnNewMatches: checked as boolean })}
                />
                <Label>Notify me on new matches</Label>
              </div>

              <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? "Creating..." : "Create Search"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Saved Searches List */}
      <div className="grid gap-4">
        {searches.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">No saved searches yet. Create one to get started!</p>
            </CardContent>
          </Card>
        ) : (
          searches.map((search: any) => (
            <Card key={search.id} className="cursor-pointer hover:bg-accent" onClick={() => setSelectedSearch(search.id)}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{search.name}</CardTitle>
                    <CardDescription>
                      {search.mode === "buy" && "Looking to buy"}
                      {search.mode === "sell" && "Looking to sell"}
                      {search.mode === "urgent" && "Urgent (Today/Yesterday)"}
                      {search.location && ` in ${search.location}`}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {search.notifyOnNewMatches && (
                      <Badge variant="outline" className="gap-1">
                        <Bell className="w-3 h-3" />
                        Notify
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(search.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-1">
                  {search.propertyType && <p>Type: {search.propertyType}</p>}
                  {search.priceMin && <p>Price: {search.priceMin.toLocaleString()} - {search.priceMax?.toLocaleString()}</p>}
                  {search.bedroomsMin && <p>Bedrooms: {search.bedroomsMin} - {search.bedroomsMax}</p>}
                  <p>Min Score: {search.minScoreThreshold}%</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Matches for Selected Search */}
      {selectedSearch && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Matches</CardTitle>
                <CardDescription>{selectedMatches.length} total matches</CardDescription>
              </div>
              {unnotifiedMatches.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    markNotifiedMutation.mutate({
                      matchIds: unnotifiedMatches.map((m: any) => m.id),
                    });
                  }}
                  className="gap-2"
                >
                  <Bell className="w-4 h-4" />
                  Mark {unnotifiedMatches.length} as Notified
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedMatches.length === 0 ? (
              <p className="text-muted-foreground">No matches yet</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedMatches.map((match: any) => (
                  <div key={match.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Score: {match.matchScore}%</p>
                      <p className="text-sm text-muted-foreground">{new Date(match.createdAt).toLocaleDateString()}</p>
                    </div>
                    {match.notificationSent ? (
                      <Badge variant="secondary">Notified</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <AlertCircle className="w-3 h-3" />
                        New
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
