import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  MessageSquare, 
  Building2, 
  Users, 
  Search,
  Filter,
  RefreshCw,
  Bookmark,
  BookmarkCheck,
  Waves,
  Home,
  Trees,
  Car,
  Dumbbell,
  Snowflake,
  Sofa,
  ShieldCheck,
  ArrowUpDown
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";

export default function Messages() {
  const { user, isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  // Name-this-contact state
  const [labelDialog, setLabelDialog] = useState<{ phone: string; currentName: string } | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const { data: contactLabels } = trpc.contacts.getLabels.useQuery();
  const setLabelMutation = trpc.contacts.setLabel.useMutation({
    onSuccess: () => {
      toast.success("Contact named successfully");
      setLabelDialog(null);
      refetchSupply();
    },
    onError: () => toast.error("Failed to save label"),
  });
  const getContactDisplay = useCallback((phone: string, name: string) => {
    const label = contactLabels?.find((l: any) => l.phone.replace(/[^0-9]/g, '') === phone.replace(/[^0-9]/g, ''));
    return label?.label || name || phone;
  }, [contactLabels]);
  const isPhoneOnly = (name: string) => /^[0-9+\s]{7,}$/.test(name?.trim() || '');

  const [locationFilter, setLocationFilter] = useState("all");
  const [amenityFilters, setAmenityFilters] = useState({
    hasPool: false,
    hasBalcony: false,
    hasGarden: false,
    hasParking: false,
    hasElevator: false,
    hasSecurity: false,
    hasGym: false,
    hasFurnished: false,
    hasAC: false
  });

  const { data: messages, refetch, isLoading } = trpc.messages.recent.useQuery({ limit: 100 });
  const { data: supplyList, refetch: refetchSupply } = trpc.supply.recent.useQuery({ limit: 50 });
  const { data: filteredSupply, refetch: refetchFiltered } = trpc.supply.withAmenities.useQuery({
    ...amenityFilters,
    limit: 50
  }, {
    enabled: Object.values(amenityFilters).some(v => v)
  });
  const { data: demandList } = trpc.demand.recent.useQuery({ limit: 50 });
  const { data: userBookmarks, refetch: refetchBookmarks } = trpc.bookmarks.list.useQuery(undefined, {
    enabled: isAuthenticated
  });

  const utils = trpc.useUtils();

  const addBookmarkMutation = trpc.bookmarks.add.useMutation({
    onSuccess: () => {
      toast.success("Listing bookmarked!");
      refetchBookmarks();
    },
    onError: () => {
      toast.error("Failed to bookmark listing");
    }
  });

  const removeBookmarkMutation = trpc.bookmarks.remove.useMutation({
    onSuccess: () => {
      toast.success("Bookmark removed");
      refetchBookmarks();
    },
    onError: () => {
      toast.error("Failed to remove bookmark");
    }
  });

  const formatPrice = (price: string | number | null) => {
    if (!price) return "N/A";
    const num = parseFloat(String(price));
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M EGP`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K EGP`;
    return `${num} EGP`;
  };

  const isSupplyBookmarked = (supplyId: number) => {
    return userBookmarks?.some(b => b.bookmark.supplyId === supplyId);
  };

  const isDemandBookmarked = (demandId: number) => {
    return userBookmarks?.some(b => b.bookmark.demandId === demandId);
  };

  const getBookmarkId = (supplyId?: number, demandId?: number) => {
    const bookmark = userBookmarks?.find(b => 
      (supplyId && b.bookmark.supplyId === supplyId) || 
      (demandId && b.bookmark.demandId === demandId)
    );
    return bookmark?.bookmark.id;
  };

  const toggleBookmark = (type: 'supply' | 'demand', id: number) => {
    if (!isAuthenticated) {
      toast.error("Please login to bookmark listings");
      return;
    }

    const isBookmarked = type === 'supply' ? isSupplyBookmarked(id) : isDemandBookmarked(id);
    
    if (isBookmarked) {
      const bookmarkId = getBookmarkId(type === 'supply' ? id : undefined, type === 'demand' ? id : undefined);
      if (bookmarkId) {
        removeBookmarkMutation.mutate({ bookmarkId });
      }
    } else {
      if (type === 'supply') {
        addBookmarkMutation.mutate({ supplyId: id });
      } else {
        addBookmarkMutation.mutate({ demandId: id });
      }
    }
  };

  const filteredMessages = messages?.filter(msg => 
    !searchTerm || 
    msg.messageText?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.groupName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const hasActiveFilters = Object.values(amenityFilters).some(v => v);
  const displaySupply = hasActiveFilters ? filteredSupply : supplyList;

  const amenityOptions = [
    { key: 'hasPool', label: 'Pool', icon: Waves },
    { key: 'hasBalcony', label: 'Balcony', icon: Home },
    { key: 'hasGarden', label: 'Garden', icon: Trees },
    { key: 'hasParking', label: 'Parking', icon: Car },
    { key: 'hasGym', label: 'Gym', icon: Dumbbell },
    { key: 'hasAC', label: 'AC', icon: Snowflake },
    { key: 'hasFurnished', label: 'Furnished', icon: Sofa },
    { key: 'hasSecurity', label: 'Security', icon: ShieldCheck },
    { key: 'hasElevator', label: 'Elevator', icon: ArrowUpDown },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
          <p className="text-muted-foreground">All WhatsApp messages and extracted listings</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="All Locations" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {supplyList && demandList && Array.from(new Set([...(supplyList as any[]).map(s => s.location).filter(Boolean), ...(demandList as any[]).map(d => d.location).filter(Boolean)])).sort().map(loc => (
              <SelectItem key={loc} value={loc}>{loc}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant={hasActiveFilters ? "default" : "outline"}>
              <Filter className="w-4 h-4 mr-2" /> 
              Amenities
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  {Object.values(amenityFilters).filter(v => v).length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <h4 className="font-medium">Filter by Amenities</h4>
              <div className="grid grid-cols-2 gap-3">
                {amenityOptions.map(({ key, label, icon: Icon }) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={key}
                      checked={amenityFilters[key as keyof typeof amenityFilters]}
                      onCheckedChange={(checked) => {
                        setAmenityFilters(prev => ({
                          ...prev,
                          [key]: checked
                        }));
                      }}
                    />
                    <Label htmlFor={key} className="flex items-center gap-1 cursor-pointer">
                      <Icon className="w-4 h-4" />
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
              {hasActiveFilters && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => setAmenityFilters({
                    hasPool: false,
                    hasBalcony: false,
                    hasGarden: false,
                    hasParking: false,
                    hasElevator: false,
                    hasSecurity: false,
                    hasGym: false,
                    hasFurnished: false,
                    hasAC: false
                  })}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            All Listings
            <Badge variant="secondary">{(displaySupply?.length || supplyList?.length || 0) + (demandList?.length || 0)}</Badge>
          </TabsTrigger>
          <TabsTrigger value="supply" className="gap-2">
            <Building2 className="h-4 w-4" />
            Supply
            <Badge variant="secondary">{displaySupply?.length || supplyList?.length || 0}</Badge>
          </TabsTrigger>
          <TabsTrigger value="demand" className="gap-2">
            <Users className="h-4 w-4" />
            Demand
            <Badge variant="secondary">{demandList?.length || 0}</Badge>
          </TabsTrigger>
          {isAuthenticated && (
            <TabsTrigger value="bookmarks" className="gap-2">
              <Bookmark className="h-4 w-4" />
              Bookmarks
              <Badge variant="secondary">{userBookmarks?.length || 0}</Badge>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <div className="space-y-4">
            {/* Supply Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Supply Listings ({displaySupply?.length || supplyList?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-40">
                      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : !displaySupply || displaySupply.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                      <Building2 className="h-12 w-12 mb-4 opacity-50" />
                      <p>No supply listings</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {displaySupply.map((item) => (
                        <div key={item.id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.propertyType || "Property"}</span>
                              <Badge variant="default">Supply</Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleBookmark('supply', item.id)}
                            >
                              {isSupplyBookmarked(item.id) ? (
                                <BookmarkCheck className="h-4 w-4" />
                              ) : (
                                <Bookmark className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground">{item.location}</p>
                          <p className="text-sm font-semibold">{formatPrice(item.price)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Demand Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Demand Listings ({demandList?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-40">
                      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : !demandList || demandList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                      <Users className="h-12 w-12 mb-4 opacity-50" />
                      <p>No demand listings</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {demandList.map((item) => (
                        <div key={item.id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.propertyType || "Property"}</span>
                              <Badge variant="secondary">Demand</Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleBookmark('demand', item.id)}
                            >
                              {isDemandBookmarked(item.id) ? (
                                <BookmarkCheck className="h-4 w-4" />
                              ) : (
                                <Bookmark className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground">{item.location}</p>
                          <p className="text-sm font-semibold">{formatPrice(item.priceMin)} - {formatPrice(item.priceMax)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="supply" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Supply Listings</span>
                {hasActiveFilters && (
                  <Badge variant="outline">
                    Filtered by: {amenityOptions.filter(a => amenityFilters[a.key as keyof typeof amenityFilters]).map(a => a.label).join(', ')}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                {!displaySupply || displaySupply.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <Building2 className="h-12 w-12 mb-4 opacity-50" />
                    <p>{hasActiveFilters ? "No listings match your filters" : "No supply listings yet"}</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {displaySupply.map((item: any) => (
                      <div key={item.id} className="border rounded-lg p-4 space-y-3 relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={() => toggleBookmark('supply', item.id)}
                        >
                          {isSupplyBookmarked(item.id) ? (
                            <BookmarkCheck className="w-5 h-5 text-primary" />
                          ) : (
                            <Bookmark className="w-5 h-5" />
                          )}
                        </Button>
                        <div className="flex items-center gap-2 pr-10">
                          <Badge>{item.propertyType || "Property"}</Badge>
                          <Badge variant={item.purpose === "sale" ? "default" : "secondary"}>
                            For {item.purpose || "sale"}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium text-lg">{formatPrice(item.price)}</p>
                          <p className="text-sm text-muted-foreground">
                            📍 {item.location || item.area || "Unknown location"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.size && (
                            <Badge variant="outline">📐 {item.size} m²</Badge>
                          )}
                          {item.bedrooms && (
                            <Badge variant="outline">🛏️ {item.bedrooms} BR</Badge>
                          )}
                          {item.bathrooms && (
                            <Badge variant="outline">🚿 {item.bathrooms} BA</Badge>
                          )}
                        </div>
                        {/* Amenities */}
                        {item.amenities && (
                          <div className="flex flex-wrap gap-1">
                            {item.amenities.hasPool === 1 && <Badge variant="outline" className="text-xs"><Waves className="w-3 h-3 mr-1" />Pool</Badge>}
                            {item.amenities.hasBalcony === 1 && <Badge variant="outline" className="text-xs"><Home className="w-3 h-3 mr-1" />Balcony</Badge>}
                            {item.amenities.hasGarden === 1 && <Badge variant="outline" className="text-xs"><Trees className="w-3 h-3 mr-1" />Garden</Badge>}
                            {item.amenities.hasParking === 1 && <Badge variant="outline" className="text-xs"><Car className="w-3 h-3 mr-1" />Parking</Badge>}
                            {item.amenities.hasGym === 1 && <Badge variant="outline" className="text-xs"><Dumbbell className="w-3 h-3 mr-1" />Gym</Badge>}
                            {item.amenities.hasAC === 1 && <Badge variant="outline" className="text-xs"><Snowflake className="w-3 h-3 mr-1" />AC</Badge>}
                          </div>
                        )}
                         {item.contact && (
                          <div className="flex items-center gap-2">
                            <p className="text-sm">📞 {getContactDisplay(item.contact, item.contactName)}</p>
                            {isPhoneOnly(item.contactName) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-primary"
                                title="Name this contact"
                                onClick={() => { setLabelDialog({ phone: item.contact, currentName: item.contactName }); setLabelInput(""); }}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Confidence: {parseFloat(String(item.confidence || 0)).toFixed(0)}%</span>
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="demand" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Demand Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                {!demandList || demandList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <Users className="h-12 w-12 mb-4 opacity-50" />
                    <p>No demand requests yet</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {demandList.map((item) => (
                      <div key={item.id} className="border rounded-lg p-4 space-y-3 relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={() => toggleBookmark('demand', item.id)}
                        >
                          {isDemandBookmarked(item.id) ? (
                            <BookmarkCheck className="w-5 h-5 text-primary" />
                          ) : (
                            <Bookmark className="w-5 h-5" />
                          )}
                        </Button>
                        <div className="flex items-center gap-2 pr-10">
                          <Badge variant="secondary">{item.propertyType || "Property"}</Badge>
                          <Badge variant={item.purpose === "sale" ? "default" : "secondary"}>
                            Looking to {item.purpose || "buy"}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium text-lg">
                            Budget: {formatPrice(item.priceMin)} - {formatPrice(item.priceMax)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            📍 {item.location || item.area || "Any location"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(item.sizeMin || item.sizeMax) && (
                            <Badge variant="outline">
                              📐 {item.sizeMin || "?"} - {item.sizeMax || "?"} m²
                            </Badge>
                          )}
                          {item.bedrooms && (
                            <Badge variant="outline">🛏️ {item.bedrooms} BR</Badge>
                          )}
                        </div>
                        {item.contact && (
                          <div className="flex items-center gap-2">
                            <p className="text-sm">📞 {getContactDisplay(item.contact, item.contactName)}</p>
                            {isPhoneOnly(item.contactName) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-primary"
                                title="Name this contact"
                                onClick={() => { setLabelDialog({ phone: item.contact, currentName: item.contactName }); setLabelInput(""); }}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Confidence: {parseFloat(String(item.confidence || 0)).toFixed(0)}%</span>
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        {isAuthenticated && (
          <TabsContent value="bookmarks" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Bookmarked Listings</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  {!userBookmarks || userBookmarks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                      <Bookmark className="h-12 w-12 mb-4 opacity-50" />
                      <p>No bookmarked listings yet</p>
                      <p className="text-sm">Click the bookmark icon on any listing to save it</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {userBookmarks.map(({ bookmark, supply: s, demand: d }) => (
                        <div key={bookmark.id} className="border rounded-lg p-4 space-y-3 relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2"
                            onClick={() => {
                              removeBookmarkMutation.mutate({ bookmarkId: bookmark.id });
                            }}
                          >
                            <BookmarkCheck className="w-5 h-5 text-primary" />
                          </Button>
                          {s && (
                            <>
                              <div className="flex items-center gap-2 pr-10">
                                <Badge>{s.propertyType || "Property"}</Badge>
                                <Badge variant="default">Supply</Badge>
                              </div>
                              <div className="space-y-1">
                                <p className="font-medium text-lg">{formatPrice(s.price)}</p>
                                <p className="text-sm text-muted-foreground">
                                  📍 {s.location || s.area || "Unknown"}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {s.size && <Badge variant="outline">📐 {s.size} m²</Badge>}
                                {s.bedrooms && <Badge variant="outline">🛏️ {s.bedrooms} BR</Badge>}
                              </div>
                              {s.contact && <p className="text-sm">📞 {s.contact}</p>}
                            </>
                          )}
                          {d && (
                            <>
                              <div className="flex items-center gap-2 pr-10">
                                <Badge variant="secondary">{d.propertyType || "Property"}</Badge>
                                <Badge variant="secondary">Demand</Badge>
                              </div>
                              <div className="space-y-1">
                                <p className="font-medium text-lg">
                                  Budget: {formatPrice(d.priceMin)} - {formatPrice(d.priceMax)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  📍 {d.location || d.area || "Any"}
                                </p>
                              </div>
                              {d.contact && <p className="text-sm">📞 {d.contact}</p>}
                            </>
                          )}
                          {bookmark.notes && (
                            <p className="text-sm italic text-muted-foreground">Note: {bookmark.notes}</p>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Saved: {new Date(bookmark.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Name-this-contact Dialog */}
      <Dialog open={!!labelDialog} onOpenChange={(open) => !open && setLabelDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Name this Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Phone: <span className="font-mono font-medium">{labelDialog?.phone}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              This name will apply to all their listings and matches automatically.
            </p>
            <Input
              placeholder="Enter contact name (e.g. Ahmed Broker)"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && labelInput.trim() && labelDialog) {
                  setLabelMutation.mutate({ phone: labelDialog.phone, label: labelInput.trim() });
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabelDialog(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (labelInput.trim() && labelDialog) {
                  setLabelMutation.mutate({ phone: labelDialog.phone, label: labelInput.trim() });
                }
              }}
              disabled={!labelInput.trim() || setLabelMutation.isPending}
            >
              {setLabelMutation.isPending ? "Saving..." : "Save Name"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
