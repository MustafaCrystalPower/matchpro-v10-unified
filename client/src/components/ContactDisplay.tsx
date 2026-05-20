import { Phone, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ContactDisplayProps {
  supplyContactName: string;
  supplyContactPhone: string;
  demandContactName: string;
  demandContactPhone: string;
  layout?: "horizontal" | "vertical";
}

/**
 * CRITICAL: Displays both supply and demand contacts prominently.
 * This component MUST be visible on every match.
 * Contact numbers are shown in large, bold, clear format.
 */
export default function ContactDisplay({
  supplyContactName,
  supplyContactPhone,
  demandContactName,
  demandContactPhone,
  layout = "horizontal",
}: ContactDisplayProps) {
  return (
    <div
      className={`bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg p-4 ${
        layout === "vertical" ? "space-y-4" : "grid grid-cols-2 gap-4"
      }`}
    >
      {/* Supply Contact - SELLER */}
      <div className="bg-white rounded-lg p-4 border-l-4 border-l-blue-600">
        <div className="flex items-center gap-2 mb-3">
          <Badge className="bg-blue-600">SUPPLY</Badge>
          <span className="text-xs font-bold text-blue-600">SELLER</span>
        </div>

        <div className="space-y-2">
          {/* Contact Name */}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-blue-600" />
            <span className="font-semibold text-gray-800">{supplyContactName}</span>
          </div>

          {/* Contact Phone - LARGE AND BOLD */}
          <div className="bg-blue-100 rounded-lg p-3 border-2 border-blue-500">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-blue-700 font-bold" />
              <span className="text-xl font-bold text-blue-700 tracking-wide">
                {supplyContactPhone}
              </span>
            </div>
            <p className="text-xs text-blue-600 mt-1">Seller Contact</p>
          </div>
        </div>
      </div>

      {/* Demand Contact - BUYER */}
      <div className="bg-white rounded-lg p-4 border-l-4 border-l-purple-600">
        <div className="flex items-center gap-2 mb-3">
          <Badge className="bg-purple-600">DEMAND</Badge>
          <span className="text-xs font-bold text-purple-600">BUYER</span>
        </div>

        <div className="space-y-2">
          {/* Contact Name */}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-purple-600" />
            <span className="font-semibold text-gray-800">{demandContactName}</span>
          </div>

          {/* Contact Phone - LARGE AND BOLD */}
          <div className="bg-purple-100 rounded-lg p-3 border-2 border-purple-500">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-purple-700 font-bold" />
              <span className="text-xl font-bold text-purple-700 tracking-wide">
                {demandContactPhone}
              </span>
            </div>
            <p className="text-xs text-purple-600 mt-1">Buyer Contact</p>
          </div>
        </div>
      </div>
    </div>
  );
}
