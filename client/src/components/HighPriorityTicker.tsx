import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Crown, TrendingUp, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface HighPriorityMessage {
  id: number;
  message: string;
  senderPhone: string;
  senderName?: string;
  classification: "supply" | "demand";
  confidence: number;
  location?: string;
  budget?: number;
  price?: number;
  propertyType?: string;
  timestamp: Date;
}

/**
 * Fixed scroll ticker for high-priority messages (owners/direct buyers)
 * Displays at the top of dashboard for immediate visibility
 */
export function HighPriorityTicker() {
  const [messages, setMessages] = useState<HighPriorityMessage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  // Fetch high-priority messages
  const { data: liveFeed } = trpc.dashboard.liveFeed.useQuery(
    { limit: 50 },
    { refetchInterval: 10000 } // Refresh every 10 seconds
  );

  useEffect(() => {
    if (!liveFeed || liveFeed.length === 0) {
      setMessages([]);
      return;
    }

    // Filter and map high-priority messages
    const highPriority: HighPriorityMessage[] = liveFeed
      .filter((msg: any) => {
        const role = msg.inferredRole || msg.role;
        const conf = msg.confidence || 0;
        return (
          (role === "end_user" || role === "seller" || role === "buyer") &&
          conf >= 0.8
        );
      })
      .map((msg: any) => ({
        id: msg.id || 0,
        message: msg.messageText || msg.message || "",
        senderPhone: msg.sender || msg.senderPhone || "",
        senderName: msg.senderName,
        classification: (msg.classification === "supply" ? "supply" : "demand") as "supply" | "demand",
        confidence: msg.confidence || 0,
        location: msg.location,
        budget: msg.budget,
        price: msg.price,
        propertyType: msg.propertyType,
        timestamp: msg.createdAt || new Date(),
      }))
      .slice(0, 20);

    setMessages(highPriority);
  }, [liveFeed]);

  // Auto-scroll through messages
  useEffect(() => {
    if (!isAutoScroll || messages.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % messages.length);
    }, 5000); // Change message every 5 seconds

    return () => clearInterval(interval);
  }, [isAutoScroll, messages.length]);

  if (messages.length === 0) {
    return null;
  }

  const currentMessage = messages[currentIndex];
  const isSupply = currentMessage.classification === "supply";
  const roleLabel =
    currentMessage.classification === "supply"
      ? "🏠 Direct Seller"
      : "🔍 Direct Buyer";

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 shadow-lg">
      <div className="max-w-full px-4 py-3">
        <div className="flex items-center gap-3 justify-between">
          {/* Left: Priority indicator */}
          <div className="flex items-center gap-2 min-w-0">
            <Crown className="h-5 w-5 text-yellow-300 flex-shrink-0" />
            <div className="hidden sm:block text-white font-semibold text-sm">
              HIGH PRIORITY
            </div>
          </div>

          {/* Center: Message content */}
          <div className="flex-1 min-w-0 px-3">
            <div className="flex items-center gap-2 mb-1">
              <Badge
                variant="secondary"
                className="bg-white text-emerald-700 font-semibold flex-shrink-0"
              >
                {roleLabel}
              </Badge>
              <Badge
                className={cn(
                  "flex-shrink-0",
                  isSupply
                    ? "bg-emerald-700 text-white"
                    : "bg-blue-700 text-white"
                )}
              >
                {isSupply ? "SUPPLY" : "DEMAND"} {Math.round(currentMessage.confidence * 100)}%
              </Badge>
            </div>

            <p className="text-white text-sm font-medium truncate">
              {currentMessage.message.substring(0, 100)}
              {currentMessage.message.length > 100 ? "..." : ""}
            </p>

            <div className="flex items-center gap-2 mt-1 text-xs text-emerald-50">
              {currentMessage.location && (
                <span>📍 {currentMessage.location}</span>
              )}
              {currentMessage.propertyType && (
                <span>🏢 {currentMessage.propertyType}</span>
              )}
              {isSupply && currentMessage.price && (
                <span>💰 {(currentMessage.price / 1000000).toFixed(1)}M</span>
              )}
              {!isSupply && currentMessage.budget && (
                <span>💵 {(currentMessage.budget / 1000000).toFixed(1)}M</span>
              )}
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setIsAutoScroll(!isAutoScroll)}
              className="text-white hover:text-yellow-200 transition-colors"
              title={isAutoScroll ? "Pause auto-scroll" : "Resume auto-scroll"}
            >
              {isAutoScroll ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
            </button>

            {/* Message counter */}
            <div className="text-white text-xs font-semibold bg-black/20 px-2 py-1 rounded">
              {currentIndex + 1}/{messages.length}
            </div>

            {/* Navigation dots */}
            <div className="hidden sm:flex gap-1">
              {messages.slice(0, 5).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentIndex(idx);
                    setIsAutoScroll(false);
                  }}
                  className={cn(
                    "h-2 w-2 rounded-full transition-all",
                    idx === currentIndex
                      ? "bg-yellow-300 w-4"
                      : "bg-white/50 hover:bg-white/75"
                  )}
                  title={`Go to message ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-white/20 mt-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-yellow-300 transition-all duration-300"
            style={{
              width: `${((currentIndex + 1) / messages.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
