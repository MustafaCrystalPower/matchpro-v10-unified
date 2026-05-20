import { useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, MapPin, DollarSign, Home, Send, Copy } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export function RequestMatches() {
  const [, params] = useRoute("/request-matches/:id");
  const [, setLocation] = useLocation();
  const requestId = params?.id ? parseInt(params.id) : 0;

  const [copied, setCopied] = useState<number | null>(null);

  // Fetch request details
  const { data: request } = trpc.myRequests.getById.useQuery(
    { id: requestId },
    { enabled: requestId > 0 }
  );

  // Fetch matches for this request
  const { data: matches = [], isLoading } = trpc.myRequests.findMatches.useQuery(
    { requestId },
    { enabled: requestId > 0 }
  );

  const handleCopyPhone = (phone: string, index: number) => {
    navigator.clipboard.writeText(phone);
    setCopied(index);
    toast.success("Phone copied!");
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSendWhatsApp = (phone: string, sellerName: string) => {
    const message = `Hi ${sellerName}, I'm interested in your property. Can we discuss?`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, "_blank");
  };

  if (!requestId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Invalid request ID</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocation("/intake")}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Matching Properties</h1>
          <p className="text-muted-foreground">
            {request ? `For: ${request.title} in ${request.location}` : "Loading..."}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{matches.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{matches.filter((m: any) => m.matchScore >= 80).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Match Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {matches.length > 0
                ? Math.round(matches.reduce((sum: number, m: any) => sum + m.matchScore, 0) / matches.length)
                : 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Matches List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading matches...</p>
        </div>
      ) : matches.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <p className="text-muted-foreground">No matching properties found yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {matches.map((match: any, index: number) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{match.sellerName || "Property Seller"}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" />
                      {match.sellerLocation || "Location not specified"}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-green-600">{match.matchScore}%</div>
                    <p className="text-xs text-muted-foreground">Match Score</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Match Breakdown */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Location</div>
                    <div className="text-lg font-semibold">{match.locationScore}%</div>
                  </div>
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Price</div>
                    <div className="text-lg font-semibold">{match.priceScore}%</div>
                  </div>
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Type</div>
                    <div className="text-lg font-semibold">{match.typeScore}%</div>
                  </div>
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Bedrooms</div>
                    <div className="text-lg font-semibold">{match.bedroomScore}%</div>
                  </div>
                </div>

                {/* Property Details */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Price</span>
                    <span className="font-semibold flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {match.propertyPrice?.toLocaleString() || "N/A"} EGP
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Property Type</span>
                    <Badge variant="outline">{match.propertyType || "N/A"}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Bedrooms</span>
                    <span className="font-semibold">{match.bedrooms || "N/A"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Bathrooms</span>
                    <span className="font-semibold">{match.bathrooms || "N/A"}</span>
                  </div>
                  {match.size && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Size</span>
                      <span className="font-semibold">{match.size} m²</span>
                    </div>
                  )}
                </div>

                {/* Contact & Actions */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyPhone(match.sellerPhone, index)}
                    className="gap-2 flex-1"
                  >
                    {copied === index ? (
                      <>
                        <Copy className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Phone className="w-4 h-4" />
                        {match.sellerPhone}
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSendWhatsApp(match.sellerPhone, match.sellerName)}
                    className="gap-2 flex-1"
                  >
                    <Send className="w-4 h-4" />
                    WhatsApp
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

export default RequestMatches;
