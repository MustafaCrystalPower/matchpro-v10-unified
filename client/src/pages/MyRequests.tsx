import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, MapPin, DollarSign, Users, Zap, ChevronDown, Filter } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { LocationFilter } from "@/components/LocationFilter";

export function MyRequests() {
  const [, setLocation] = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    location: "",
    propertyType: "apartment",
    bedrooms: 0,
    bathrooms: 0,
    minPrice: 0,
    maxPrice: 0,
    minArea: 0,
    maxArea: 0,
    amenities: [] as string[],
    furnished: false,
    notes: "",
  });

  // Filter state
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    bedrooms: 0,
    bathrooms: 0,
    minPrice: 0,
    maxPrice: 0,
    minArea: 0,
    maxArea: 0,
    amenities: [] as string[],
    furnished: false,
  });

  // Fetch user's requests
  const { data: requests = [], isLoading, refetch } = trpc.myRequests.list.useQuery();

  // Create request mutation
  const createRequestMutation = trpc.myRequests.create.useMutation({
    onSuccess: () => {
      toast.success("Request created successfully!");
      refetch();
      setShowForm(false);
      setFormData({
        title: "",
        location: "",
        propertyType: "apartment",
        bedrooms: 0,
        bathrooms: 0,
        minPrice: 0,
        maxPrice: 0,
        minArea: 0,
        maxArea: 0,
        amenities: [],
        furnished: false,
        notes: "",
      });
    },
    onError: (err: any) => {
      toast.error(`Failed to create request: ${err.message}`);
    },
  });

  const handleCreateRequest = () => {
    if (!formData.title || !formData.location) {
      toast.error("Please fill in title and location");
      return;
    }
    createRequestMutation.mutate(formData);
  };

  const handleViewMatches = (requestId: number) => {
    setLocation(`/request-matches/${requestId}`);
  };

  const toggleAmenity = (amenity: string) => {
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  const amenitiesOptions = [
    { id: "pool", label: "Swimming Pool" },
    { id: "gym", label: "Gym" },
    { id: "parking", label: "Parking" },
    { id: "garden", label: "Garden" },
    { id: "balcony", label: "Balcony" },
    { id: "elevator", label: "Elevator" },
    { id: "security", label: "Security" },
    { id: "ac", label: "Air Conditioning" },
  ];

  // Filter requests by search
  const filteredRequests = requests.filter((req: any) =>
    req.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Requests</h1>
          <p className="text-muted-foreground">Create property requests and find matching supply</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Request
        </Button>
      </div>

      {/* Create Request Form */}
      {showForm && (
        <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950">
          <CardHeader>
            <CardTitle>Create New Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Title *</label>
                <Input
                  placeholder="e.g., 2-Bedroom Apartment"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Location(s) *</label>
                <LocationFilter
                  selectedLocations={selectedLocations}
                  onLocationsChange={(locs) => {
                    setSelectedLocations(locs);
                    setFormData({ ...formData, location: locs.join(', ') });
                  }}
                  maxSelections={5}
                  showRegions={true}
                />
              </div>
            </div>

            {/* Property Type */}
            <div>
              <label className="text-sm font-medium">Property Type</label>
              <select
                value={formData.propertyType}
                onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="apartment">Apartment</option>
                <option value="villa">Villa</option>
                <option value="townhouse">Townhouse</option>
                <option value="penthouse">Penthouse</option>
                <option value="studio">Studio</option>
              </select>
            </div>

            {/* Bedrooms & Bathrooms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Bedrooms</label>
                <Input
                  type="number"
                  min="0"
                  value={formData.bedrooms}
                  onChange={(e) => setFormData({ ...formData, bedrooms: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Bathrooms</label>
                <Input
                  type="number"
                  min="0"
                  value={formData.bathrooms}
                  onChange={(e) => setFormData({ ...formData, bathrooms: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Price Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Min Price (EGP)</label>
                <Input
                  type="number"
                  min="0"
                  value={formData.minPrice}
                  onChange={(e) => setFormData({ ...formData, minPrice: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Max Price (EGP)</label>
                <Input
                  type="number"
                  min="0"
                  value={formData.maxPrice}
                  onChange={(e) => setFormData({ ...formData, maxPrice: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Area Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Min Area (m²)</label>
                <Input
                  type="number"
                  min="0"
                  value={formData.minArea}
                  onChange={(e) => setFormData({ ...formData, minArea: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Max Area (m²)</label>
                <Input
                  type="number"
                  min="0"
                  value={formData.maxArea}
                  onChange={(e) => setFormData({ ...formData, maxArea: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Amenities */}
            <div>
              <label className="text-sm font-medium mb-2 block">Amenities</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {amenitiesOptions.map((amenity) => (
                  <div key={amenity.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.amenities.includes(amenity.id)}
                      onCheckedChange={() => toggleAmenity(amenity.id)}
                    />
                    <label className="text-sm cursor-pointer">{amenity.label}</label>
                  </div>
                ))}
              </div>
            </div>

            {/* Furnished */}
            <div className="flex items-center gap-2">
              <Checkbox
                checked={formData.furnished}
                onCheckedChange={(checked) => setFormData({ ...formData, furnished: checked as boolean })}
              />
              <label className="text-sm cursor-pointer">Furnished</label>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium">Additional Notes</label>
              <textarea
                placeholder="Any other requirements..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={handleCreateRequest} className="flex-1">
                Create Request
              </Button>
              <Button onClick={() => setShowForm(false)} variant="outline" className="flex-1">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{requests.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{requests.filter((r: any) => r.status === "active").length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{requests.reduce((sum: number, r: any) => sum + (r.matchCount || 0), 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Match Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">85%</div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="gap-2"
        >
          <Filter className="w-4 h-4" />
          Filters
        </Button>
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Min Bedrooms</label>
                <Input
                  type="number"
                  min="0"
                  value={filters.bedrooms}
                  onChange={(e) => setFilters({ ...filters, bedrooms: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Min Bathrooms</label>
                <Input
                  type="number"
                  min="0"
                  value={filters.bathrooms}
                  onChange={(e) => setFilters({ ...filters, bathrooms: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requests List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <p className="text-muted-foreground mb-4">No requests yet. Create your first request.</p>
            <Button onClick={() => setShowForm(true)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Create Request
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRequests.map((request: any) => (
            <Card key={request.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{request.title}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" />
                      {request.location}
                    </CardDescription>
                  </div>
                  <Badge variant={request.status === "active" ? "default" : "secondary"}>
                    {request.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Price Range */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Budget</span>
                  <span className="font-semibold flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    {request.minPrice?.toLocaleString() || "N/A"} - {request.maxPrice?.toLocaleString() || "N/A"} EGP
                  </span>
                </div>

                {/* Details */}
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {request.bedrooms !== undefined && (
                    <div className="text-center">
                      <div className="font-semibold">{request.bedrooms}</div>
                      <div className="text-xs text-muted-foreground">Beds</div>
                    </div>
                  )}
                  {request.bathrooms !== undefined && (
                    <div className="text-center">
                      <div className="font-semibold">{request.bathrooms}</div>
                      <div className="text-xs text-muted-foreground">Baths</div>
                    </div>
                  )}
                  {request.minArea && (
                    <div className="text-center">
                      <div className="font-semibold">{request.minArea}</div>
                      <div className="text-xs text-muted-foreground">m² min</div>
                    </div>
                  )}
                </div>

                {/* Matches */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {request.matchCount || 0} matches
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewMatches(request.id)}
                    className="gap-1"
                  >
                    <Zap className="w-3 h-3" />
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyRequests;
