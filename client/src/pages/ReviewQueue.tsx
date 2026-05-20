import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  MapPin,
  DollarSign,
  Home,
  User,
  Clock,
  AlertTriangle,
  Loader2,
  Eye,
  RefreshCw,
} from "lucide-react";

function ConfidenceBadge({ confidence }: { confidence: number | string | null }) {
  const val = typeof confidence === "string" ? parseFloat(confidence) : (confidence ?? 0);
  const pct = Math.round(val * 100);
  if (pct >= 70) return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{pct}% High</Badge>;
  if (pct >= 50) return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">{pct}% Medium</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{pct}% Low</Badge>;
}

function PriorityBadge({ priority }: { priority: string | null }) {
  if (priority === "high") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">High Priority</Badge>;
  if (priority === "medium") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Medium Priority</Badge>;
  return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Low Priority</Badge>;
}

function formatPrice(price: string | number | null) {
  if (!price) return "—";
  const n = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M EGP`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K EGP`;
  return `${n.toLocaleString()} EGP`;
}

interface RecordDetailDialogProps {
  record: any;
  type: "supply" | "demand";
  open: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  isLoading: boolean;
}

function RecordDetailDialog({ record, type, open, onClose, onApprove, onReject, isLoading }: RecordDetailDialogProps) {
  if (!record) return null;

  const originalMessage = record.originalMessage || record.rawMessageText;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-slate-900 border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            <Eye className="h-5 w-5 text-amber-400" />
            Review {type === "supply" ? "Property Listing" : "Buyer Request"} #{record.id}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 pr-4">
            {/* Status badges */}
            <div className="flex flex-wrap gap-2">
              <ConfidenceBadge confidence={record.confidence} />
              <PriorityBadge priority={record.priority} />
              {record.sourceGroup && (
                <Badge variant="outline" className="text-slate-400 border-slate-600">
                  {record.sourceGroup}
                </Badge>
              )}
              {record.nlpVersion && (
                <Badge variant="outline" className="text-slate-500 border-slate-700 text-xs">
                  NLP {record.nlpVersion}
                </Badge>
              )}
            </div>

            {/* Original message */}
            {originalMessage && (
              <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 mb-2 text-slate-400 text-sm">
                  <MessageSquare className="h-4 w-4" />
                  Original WhatsApp Message
                </div>
                <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap" dir="auto">
                  {originalMessage}
                </p>
              </div>
            )}

            <Separator className="bg-slate-700" />

            {/* Extracted data */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/40 rounded-lg p-3">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Home className="h-3 w-3" /> Property Type
                </div>
                <p className="text-slate-200 font-medium capitalize">{record.propertyType || "—"}</p>
              </div>

              <div className="bg-slate-800/40 rounded-lg p-3">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <MapPin className="h-3 w-3" /> Location
                </div>
                <p className="text-slate-200 font-medium">{record.location || "—"}</p>
              </div>

              <div className="bg-slate-800/40 rounded-lg p-3">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <DollarSign className="h-3 w-3" />
                  {type === "supply" ? "Price" : "Budget Range"}
                </div>
                <p className="text-slate-200 font-medium">
                  {type === "supply"
                    ? formatPrice(record.price)
                    : `${formatPrice(record.priceMin)} – ${formatPrice(record.priceMax)}`}
                </p>
              </div>

              <div className="bg-slate-800/40 rounded-lg p-3">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <User className="h-3 w-3" /> Contact
                </div>
                <p className="text-slate-200 font-medium">{record.contactName || record.contact || "—"}</p>
                {record.contact && record.contactName !== record.contact && (
                  <p className="text-slate-500 text-xs">{record.contact}</p>
                )}
              </div>

              {record.bedrooms != null && (
                <div className="bg-slate-800/40 rounded-lg p-3">
                  <div className="text-slate-400 text-xs mb-1">Bedrooms</div>
                  <p className="text-slate-200 font-medium">{record.bedrooms} BR</p>
                </div>
              )}

              {(record.size || record.sizeMin || record.sizeMax) && (
                <div className="bg-slate-800/40 rounded-lg p-3">
                  <div className="text-slate-400 text-xs mb-1">Area</div>
                  <p className="text-slate-200 font-medium">
                    {record.size ? `${record.size} m²` : `${record.sizeMin || "?"} – ${record.sizeMax || "?"} m²`}
                  </p>
                </div>
              )}

              {record.purpose && (
                <div className="bg-slate-800/40 rounded-lg p-3">
                  <div className="text-slate-400 text-xs mb-1">Purpose</div>
                  <p className="text-slate-200 font-medium capitalize">{record.purpose}</p>
                </div>
              )}

              {record.city && (
                <div className="bg-slate-800/40 rounded-lg p-3">
                  <div className="text-slate-400 text-xs mb-1">City</div>
                  <p className="text-slate-200 font-medium">{record.city}</p>
                </div>
              )}
            </div>

            {/* Features */}
            {record.features && Array.isArray(record.features) && record.features.length > 0 && (
              <div>
                <p className="text-slate-400 text-xs mb-2">Features</p>
                <div className="flex flex-wrap gap-1">
                  {record.features.map((f: string) => (
                    <Badge key={f} variant="outline" className="text-slate-400 border-slate-600 text-xs capitalize">
                      {f.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {record.rawNotes && (
              <div className="bg-slate-800/40 rounded-lg p-3">
                <p className="text-slate-400 text-xs mb-1">Notes</p>
                <p className="text-slate-300 text-sm">{record.rawNotes}</p>
              </div>
            )}

            <div className="text-slate-500 text-xs flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Received: {record.createdAt ? new Date(record.createdAt).toLocaleString() : "—"}
            </div>
          </div>
        </ScrollArea>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={onApprove}
            disabled={isLoading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Approve & Publish
          </Button>
          <Button
            onClick={onReject}
            disabled={isLoading}
            variant="outline"
            className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
            Reject
          </Button>
          <Button variant="ghost" onClick={onClose} className="text-slate-400">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ReviewCardProps {
  record: any;
  type: "supply" | "demand";
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onView: (record: any) => void;
  isProcessing: boolean;
}

function ReviewCard({ record, type, onApprove, onReject, onView, isProcessing }: ReviewCardProps) {
  const originalMessage = record.originalMessage || record.rawMessageText;
  const price = type === "supply" ? record.price : (record.priceMax || record.priceMin);

  return (
    <Card className="bg-slate-800/50 border-slate-700 hover:border-amber-500/40 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <ConfidenceBadge confidence={record.confidence} />
              <PriorityBadge priority={record.priority} />
              {record.sourceGroup && (
                <span className="text-slate-500 text-xs truncate max-w-[120px]">{record.sourceGroup}</span>
              )}
            </div>

            {/* Key fields */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3">
              {record.propertyType && (
                <span className="text-slate-300 capitalize flex items-center gap-1">
                  <Home className="h-3 w-3 text-slate-500" />
                  {record.propertyType}
                </span>
              )}
              {record.location && (
                <span className="text-slate-300 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-slate-500" />
                  {record.location}
                </span>
              )}
              {price && (
                <span className="text-emerald-400 flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {formatPrice(price)}
                </span>
              )}
              {record.bedrooms != null && (
                <span className="text-slate-400 text-xs">{record.bedrooms} BR</span>
              )}
            </div>

            {/* Message preview */}
            {originalMessage && (
              <p className="text-slate-500 text-xs line-clamp-2 italic" dir="auto">
                "{originalMessage.substring(0, 120)}{originalMessage.length > 120 ? "…" : ""}"
              </p>
            )}

            <div className="flex items-center gap-1 mt-2 text-slate-600 text-xs">
              <User className="h-3 w-3" />
              {record.contactName || record.contact || "Unknown"}
              <span className="mx-1">·</span>
              <Clock className="h-3 w-3" />
              {record.createdAt ? new Date(record.createdAt).toLocaleString() : "—"}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onView(record)}
              className="text-slate-400 hover:text-slate-200 h-8 w-8 p-0"
              title="View details"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => onApprove(record.id)}
              disabled={isProcessing}
              className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 h-8 w-8 p-0"
              title="Approve"
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onReject(record.id)}
              disabled={isProcessing}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
              title="Reject"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReviewQueue() {
  const [activeTab, setActiveTab] = useState<"supply" | "demand">("supply");
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Queries
  const pendingCount = trpc.review.pendingCount.useQuery(undefined, { refetchInterval: 10000 });
  const pendingSupply = trpc.supply.pendingReview.useQuery(undefined, { refetchInterval: 15000 });
  const pendingDemand = trpc.demand.pendingReview.useQuery(undefined, { refetchInterval: 15000 });

  const utils = trpc.useUtils();

  // Mutations
  const approveSupply = trpc.supply.approve.useMutation({
    onSuccess: () => {
      utils.supply.pendingReview.invalidate();
      utils.review.pendingCount.invalidate();
      toast.success("Property listing published to the system.");
    },
    onError: () => toast.error("Failed to approve record."),
    onSettled: () => setProcessingId(null),
  });

  const rejectSupply = trpc.supply.reject.useMutation({
    onSuccess: () => {
      utils.supply.pendingReview.invalidate();
      utils.review.pendingCount.invalidate();
      toast.success("Property listing removed from queue.");
    },
    onError: () => toast.error("Failed to reject record."),
    onSettled: () => setProcessingId(null),
  });

  const approveDemand = trpc.demand.approve.useMutation({
    onSuccess: () => {
      utils.demand.pendingReview.invalidate();
      utils.review.pendingCount.invalidate();
      toast.success("Buyer request published to the system.");
    },
    onError: () => toast.error("Failed to approve demand record."),
    onSettled: () => setProcessingId(null),
  });

  const rejectDemand = trpc.demand.reject.useMutation({
    onSuccess: () => {
      utils.demand.pendingReview.invalidate();
      utils.review.pendingCount.invalidate();
      toast.success("Buyer request removed from queue.");
    },
    onError: () => toast.error("Failed to reject demand record."),
    onSettled: () => setProcessingId(null),
  });

  const handleApprove = (id: number, type: "supply" | "demand") => {
    setProcessingId(id);
    if (type === "supply") approveSupply.mutate({ id });
    else approveDemand.mutate({ id });
    if (selectedRecord?.id === id) setSelectedRecord(null);
  };

  const handleReject = (id: number, type: "supply" | "demand") => {
    setProcessingId(id);
    if (type === "supply") rejectSupply.mutate({ id });
    else rejectDemand.mutate({ id });
    if (selectedRecord?.id === id) setSelectedRecord(null);
  };

  const supplyList = pendingSupply.data || [];
  const demandList = pendingDemand.data || [];
  const totalPending = pendingCount.data?.total || 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
            Review Queue
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Review and approve auto-extracted records with medium/low confidence scores
          </p>
        </div>
        <div className="flex items-center gap-3">
          {totalPending > 0 && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-base px-3 py-1">
              {totalPending} Pending
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              pendingSupply.refetch();
              pendingDemand.refetch();
              pendingCount.refetch();
            }}
            className="border-slate-600 text-slate-400 hover:text-slate-200"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-amber-300 font-medium">Auto-Ingestion Review Required</p>
          <p className="text-amber-400/70 mt-1">
            These records were extracted from WhatsApp messages with confidence below 70% or missing contact info.
            Review the original message and extracted data, then approve or reject each record.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "supply" | "demand")}>
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="supply" className="data-[state=active]:bg-slate-700 text-slate-300">
            Property Listings
            {(pendingCount.data?.supply || 0) > 0 && (
              <Badge className="ml-2 bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                {pendingCount.data?.supply}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="demand" className="data-[state=active]:bg-slate-700 text-slate-300">
            Buyer Requests
            {(pendingCount.data?.demand || 0) > 0 && (
              <Badge className="ml-2 bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                {pendingCount.data?.demand}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Supply tab */}
        <TabsContent value="supply" className="mt-4">
          {pendingSupply.isLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading pending listings...
            </div>
          ) : supplyList.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500/40" />
              <p className="text-lg font-medium text-slate-400">All clear!</p>
              <p className="text-sm">No property listings pending review.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {supplyList.map((record: any) => (
                <ReviewCard
                  key={record.id}
                  record={record}
                  type="supply"
                  onApprove={(id) => handleApprove(id, "supply")}
                  onReject={(id) => handleReject(id, "supply")}
                  onView={(r) => setSelectedRecord({ ...r, _type: "supply" })}
                  isProcessing={processingId === record.id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Demand tab */}
        <TabsContent value="demand" className="mt-4">
          {pendingDemand.isLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading pending requests...
            </div>
          ) : demandList.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500/40" />
              <p className="text-lg font-medium text-slate-400">All clear!</p>
              <p className="text-sm">No buyer requests pending review.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {demandList.map((record: any) => (
                <ReviewCard
                  key={record.id}
                  record={record}
                  type="demand"
                  onApprove={(id) => handleApprove(id, "demand")}
                  onReject={(id) => handleReject(id, "demand")}
                  onView={(r) => setSelectedRecord({ ...r, _type: "demand" })}
                  isProcessing={processingId === record.id}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail dialog */}
      {selectedRecord && (
        <RecordDetailDialog
          record={selectedRecord}
          type={selectedRecord._type}
          open={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onApprove={() => handleApprove(selectedRecord.id, selectedRecord._type)}
          onReject={() => handleReject(selectedRecord.id, selectedRecord._type)}
          isLoading={processingId === selectedRecord.id}
        />
      )}
    </div>
  );
}
