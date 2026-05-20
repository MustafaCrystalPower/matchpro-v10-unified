import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Edit2, Check, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface ManualOverridePanelProps {
  messageId: number;
  currentClassification: "supply" | "demand" | "general";
  currentRole: "broker" | "end_user" | "seller" | "buyer" | "unknown";
  confidence: number;
  onOverrideSuccess?: () => void;
}

export function ManualOverridePanel({
  messageId,
  currentClassification,
  currentRole,
  confidence,
  onOverrideSuccess,
}: ManualOverridePanelProps) {
  const [open, setOpen] = useState(false);
  const [newClassification, setNewClassification] =
    useState<string>(currentClassification);
  const [newRole, setNewRole] = useState<string>(currentRole);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const overrideMutation = trpc.admin.overrideMessageClassification.useMutation({
    onSuccess: () => {
      toast.success("Classification updated successfully");
      setOpen(false);
      onOverrideSuccess?.();
    },
    onError: (error: any) => {
      toast.error(`Failed to update: ${error?.message || 'Unknown error'}`);
    },
  });

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await overrideMutation.mutateAsync({
        messageId,
        classification: newClassification as "supply" | "demand" | "general",
        role: newRole as
          | "broker"
          | "end_user"
          | "seller"
          | "buyer"
          | "unknown",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confidenceColor =
    confidence >= 80
      ? "bg-green-100 text-green-800"
      : confidence >= 60
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title="Manually override classification and role"
        >
          <Edit2 className="h-4 w-4 text-amber-500" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manual Override</DialogTitle>
          <DialogDescription>
            Update the classification and role for this message. Current
            confidence: {confidence}%
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Values */}
          <div className="rounded-lg bg-slate-50 p-4 space-y-3">
            <div className="text-sm font-medium text-slate-600">
              Current Classification
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {currentClassification}
              </Badge>
              <Badge className={confidenceColor}>{confidence}%</Badge>
            </div>

            <div className="text-sm font-medium text-slate-600 mt-4">
              Current Role
            </div>
            <Badge variant="outline" className="capitalize">
              {currentRole}
            </Badge>
          </div>

          {/* Override Selection */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                New Classification
              </label>
              <Select value={newClassification} onValueChange={setNewClassification}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supply">Supply (For Sale/Rent)</SelectItem>
                  <SelectItem value="demand">Demand (Buyer Request)</SelectItem>
                  <SelectItem value="general">General/Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                New Role
              </label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="broker">🏢 Broker</SelectItem>
                  <SelectItem value="end_user">👤 End User</SelectItem>
                  <SelectItem value="seller">🏠 Seller</SelectItem>
                  <SelectItem value="buyer">🔍 Buyer</SelectItem>
                  <SelectItem value="unknown">❓ Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Check className="h-4 w-4 mr-2" />
              {isSubmitting ? "Updating..." : "Update"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
