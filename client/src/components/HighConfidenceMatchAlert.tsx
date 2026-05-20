import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Target, 
  X, 
  Phone, 
  MapPin, 
  Building2, 
  DollarSign,
  ExternalLink
} from "lucide-react";

interface MatchAlertData {
  matchId: number;
  matchScore: number;
  locationScore: number;
  priceScore: number;
  specsScore: number;
  supply: {
    id: number;
    propertyType?: string;
    location?: string;
    area?: string;
    city?: string;
    price?: number;
    size?: number;
    bedrooms?: number;
    purpose?: string;
    contactName: string;
    contactPhone: string;
  };
  demand: {
    id: number;
    propertyType?: string;
    location?: string;
    area?: string;
    city?: string;
    priceMax?: number;
    bedrooms?: number;
    purpose?: string;
    contactName: string;
    contactPhone: string;
  };
  timestamp: string;
}

interface HighConfidenceMatchAlertProps {
  match: MatchAlertData;
  onDismiss: () => void;
  onViewDetails: (matchId: number) => void;
}

function formatPrice(price: number | null | undefined): string {
  if (!price) return "N/A";
  if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M EGP`;
  if (price >= 1000) return `${(price / 1000).toFixed(0)}K EGP`;
  return `${price} EGP`;
}

function formatWhatsAppLink(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${cleaned}`;
}

export function HighConfidenceMatchAlert({ match, onDismiss, onViewDetails }: HighConfidenceMatchAlertProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setIsVisible(true));
    
    // Auto-dismiss after 15 seconds
    const timer = setTimeout(() => {
      handleDismiss();
    }, 15000);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss();
    }, 300);
  };

  return (
    <div 
      className={`fixed top-4 right-4 z-[100] w-[420px] max-w-[calc(100vw-2rem)] transition-all duration-300 ${
        isVisible && !isExiting 
          ? "translate-x-0 opacity-100" 
          : "translate-x-full opacity-0"
      }`}
    >
      <Card className="border-2 border-green-500/50 bg-background shadow-2xl shadow-green-500/20">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Target className="h-6 w-6 text-green-500" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
              </div>
              <div>
                <span className="font-bold text-green-500">High-Confidence Match!</span>
                <Badge className="ml-2 bg-green-600 text-white text-sm px-2">
                  {match.matchScore}%
                </Badge>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Property Info */}
          <div className="bg-muted/50 rounded-lg p-3 mb-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {match.supply.propertyType || "Property"}
              </span>
              {match.supply.purpose && (
                <Badge variant="outline" className="text-xs">
                  For {match.supply.purpose}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{match.supply.location || match.demand.location || "N/A"}</span>
              {(match.supply.area || match.supply.city) && (
                <span className="text-xs text-muted-foreground">
                  ({match.supply.area || match.supply.city})
                </span>
              )}
            </div>
            {match.supply.price && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>{formatPrice(match.supply.price)}</span>
                {match.supply.bedrooms && (
                  <span className="text-muted-foreground">| {match.supply.bedrooms} BR</span>
                )}
                {match.supply.size && (
                  <span className="text-muted-foreground">| {match.supply.size}m²</span>
                )}
              </div>
            )}
          </div>

          {/* Contacts */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-emerald-500/10 rounded-lg p-2">
              <div className="text-xs text-emerald-400 font-medium mb-1">Seller</div>
              <div className="text-sm font-medium truncate">{match.supply.contactName}</div>
              {match.supply.contactPhone && match.supply.contactPhone !== "Unknown" && (
                <a 
                  href={formatWhatsAppLink(match.supply.contactPhone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200 mt-1"
                >
                  <Phone className="h-3 w-3" />
                  {match.supply.contactPhone}
                </a>
              )}
            </div>
            <div className="bg-blue-500/10 rounded-lg p-2">
              <div className="text-xs text-blue-400 font-medium mb-1">Buyer</div>
              <div className="text-sm font-medium truncate">{match.demand.contactName}</div>
              {match.demand.contactPhone && match.demand.contactPhone !== "Unknown" && (
                <a 
                  href={formatWhatsAppLink(match.demand.contactPhone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-300 hover:text-blue-200 mt-1"
                >
                  <Phone className="h-3 w-3" />
                  {match.demand.contactPhone}
                </a>
              )}
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="flex gap-3 mb-3 text-xs">
            <div className="flex-1">
              <div className="text-muted-foreground mb-1">Location</div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, match.locationScore)}%` }}
                />
              </div>
              <div className="text-right mt-0.5">{Math.min(100, match.locationScore)}%</div>
            </div>
            <div className="flex-1">
              <div className="text-muted-foreground mb-1">Price</div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, match.priceScore)}%` }}
                />
              </div>
              <div className="text-right mt-0.5">{Math.min(100, match.priceScore)}%</div>
            </div>
            <div className="flex-1">
              <div className="text-muted-foreground mb-1">Specs</div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, match.specsScore)}%` }}
                />
              </div>
              <div className="text-right mt-0.5">{Math.min(100, match.specsScore)}%</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              size="sm" 
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => onViewDetails(match.matchId)}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View Details
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1"
              onClick={handleDismiss}
            >
              Dismiss
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Container component that manages multiple match alerts
 */
interface MatchAlertContainerProps {
  alerts: MatchAlertData[];
  onDismiss: (matchId: number) => void;
  onViewDetails: (matchId: number) => void;
}

export function MatchAlertContainer({ alerts, onDismiss, onViewDetails }: MatchAlertContainerProps) {
  if (alerts.length === 0) return null;

  // Show only the most recent alert
  const latestAlert = alerts[0];

  return (
    <HighConfidenceMatchAlert
      key={latestAlert.matchId}
      match={latestAlert}
      onDismiss={() => onDismiss(latestAlert.matchId)}
      onViewDetails={onViewDetails}
    />
  );
}

export type { MatchAlertData };
