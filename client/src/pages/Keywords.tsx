import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tags, Plus, Trash2, ToggleLeft, ToggleRight, RefreshCw, Sparkles } from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  supply: "default",
  demand: "secondary",
  ignore: "destructive",
  real_estate_group: "outline",
};

const TYPE_LABELS: Record<string, string> = {
  supply: "Supply (Seller)",
  demand: "Demand (Buyer)",
  ignore: "Ignore",
  real_estate_group: "RE Group Name",
};

export default function Keywords() {
  const { data: keywords = [], refetch, isLoading } = trpc.keywords.list.useQuery();
  const addKw = trpc.keywords.add.useMutation({ onSuccess: () => { toast.success("Keyword added"); refetch(); setAddOpen(false); } });
  const toggleKw = trpc.keywords.toggle.useMutation({ onSuccess: () => refetch() });
  const removeKw = trpc.keywords.remove.useMutation({ onSuccess: () => { toast.success("Keyword removed"); refetch(); } });
  const updateWeight = trpc.keywords.updateWeight.useMutation({ onSuccess: () => refetch() });
  const [pendingWeights, setPendingWeights] = useState<Record<number, number>>({});

  const { data: suggestions = [], isLoading: loadingSuggestions, refetch: refetchSuggestions } = trpc.keywords.autoSuggest.useQuery();
  const [addOpen, setAddOpen] = useState(false);
  const [newKw, setNewKw] = useState("");
  const [newLang, setNewLang] = useState<"ar" | "en" | "both">("ar");
  const [newType, setNewType] = useState<"supply" | "demand" | "ignore" | "real_estate_group">("demand");
  const [newWeight, setNewWeight] = useState(2);
  const [filterType, setFilterType] = useState<string>("all");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filtered = filterType === "all" ? keywords : keywords.filter((k: any) => k.type === filterType);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tags className="w-6 h-6 text-primary" />
            Classification Keywords
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Keywords used to classify messages as supply, demand, or real estate groups
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button
            variant={showSuggestions ? "default" : "outline"}
            size="sm"
            onClick={() => setShowSuggestions(!showSuggestions)}
          >
            <Sparkles className="w-4 h-4 mr-2" /> Auto-Suggest
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Keyword
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(TYPE_LABELS).map(([type, label]) => {
          const count = keywords.filter((k: any) => k.type === type).length;
          const active = keywords.filter((k: any) => k.type === type && k.isActive).length;
          return (
            <div key={type} className="bg-card border rounded-lg p-3">
              <div className="text-lg font-bold">{active}<span className="text-muted-foreground text-sm">/{count}</span></div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", "supply", "demand", "ignore", "real_estate_group"].map((t) => (
          <Button
            key={t}
            size="sm"
            variant={filterType === t ? "default" : "outline"}
            onClick={() => setFilterType(t)}
          >
            {t === "all" ? "All" : TYPE_LABELS[t]}
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Keyword</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No keywords found</TableCell></TableRow>
            )}
            {filtered.map((kw: any) => (
              <TableRow key={kw.id} className={!kw.isActive ? "opacity-40" : ""}>
                <TableCell className="font-mono font-medium">{kw.keyword}</TableCell>
                <TableCell>
                  <Badge variant="outline">{kw.language === "ar" ? "🇪🇬 Arabic" : kw.language === "en" ? "🇬🇧 English" : "Both"}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={(TYPE_COLORS[kw.type] || "secondary") as any}>{TYPE_LABELS[kw.type] || kw.type}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 min-w-[120px]">
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={pendingWeights[kw.id] ?? kw.weight ?? 2}
                      onChange={(e) => setPendingWeights(prev => ({ ...prev, [kw.id]: Number(e.target.value) }))}
                      onMouseUp={(e) => {
                        const val = Number((e.target as HTMLInputElement).value);
                        updateWeight.mutate({ id: kw.id, weight: val });
                        toast.success(`Weight set to ${val}`);
                      }}
                      onTouchEnd={(e) => {
                        const val = Number((e.target as HTMLInputElement).value);
                        updateWeight.mutate({ id: kw.id, weight: val });
                      }}
                      className="w-16 h-1.5 accent-primary cursor-pointer"
                    />
                    <span className="text-xs font-bold w-4 text-center text-primary">{pendingWeights[kw.id] ?? kw.weight ?? 2}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={kw.isActive ? "default" : "secondary"}>{kw.isActive ? "Active" : "Disabled"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleKw.mutate({ id: kw.id, isActive: kw.isActive ? 0 : 1 })}
                      title={kw.isActive ? "Disable" : "Enable"}
                    >
                      {kw.isActive ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { if (confirm(`Remove keyword "${kw.keyword}"?`)) removeKw.mutate({ id: kw.id }); }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Auto-Suggest Section */}
      {showSuggestions && (
        <div className="bg-card border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-yellow-500" /> Suggested Keywords from Last 500 Messages</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Top words not yet in your keyword list — click to add instantly</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetchSuggestions()}><RefreshCw className="w-4 h-4" /></Button>
          </div>
          {loadingSuggestions ? (
            <p className="text-sm text-muted-foreground">Scanning messages...</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(suggestions as any[]).map((s: any) => (
                <button
                  key={s.word}
                  onClick={() => { setNewKw(s.word); setNewLang(/[\u0600-\u06FF]/.test(s.word) ? 'ar' : 'en'); setAddOpen(true); }}
                  className="px-3 py-1.5 rounded-full border text-sm font-mono hover:bg-primary hover:text-primary-foreground transition-colors flex items-center gap-1.5"
                >
                  {s.word}
                  <span className="text-xs opacity-60">×{s.count}</span>
                </button>
              ))}
              {(suggestions as any[]).length === 0 && <p className="text-sm text-muted-foreground">No new suggestions — all frequent words are already registered.</p>}
            </div>
          )}
        </div>
      )}

      {/* Add Keyword Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Classification Keyword</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Keyword (Arabic or English)</Label>
              <Input
                className="mt-1"
                placeholder="e.g. عايز شقة or looking for"
                value={newKw}
                onChange={(e) => setNewKw(e.target.value)}
                dir="auto"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Language</Label>
                <Select value={newLang} onValueChange={(v) => setNewLang(v as any)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">Arabic</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v as any)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supply">Supply (Seller)</SelectItem>
                    <SelectItem value="demand">Demand (Buyer)</SelectItem>
                    <SelectItem value="real_estate_group">RE Group Name</SelectItem>
                    <SelectItem value="ignore">Ignore (Spam)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Weight (1–10, higher = stronger signal)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                className="mt-1 w-24"
                value={newWeight}
                onChange={(e) => setNewWeight(Number(e.target.value))}
              />
            </div>
            <Button
              className="w-full"
              disabled={!newKw.trim() || addKw.isPending}
              onClick={() => addKw.mutate({ keyword: newKw.trim(), language: newLang, type: newType, weight: newWeight })}
            >
              {addKw.isPending ? "Adding..." : "Add Keyword"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
