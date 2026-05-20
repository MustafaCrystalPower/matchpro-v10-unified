import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Users, ShieldCheck, CreditCard, UserX, RefreshCw, AlertTriangle } from "lucide-react";

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly (1 Year)",
  lifetime: "Lifetime",
};

const TIER_COLORS: Record<string, string> = {
  free: "secondary",
  monthly: "outline",
  quarterly: "outline",
  yearly: "default",
  lifetime: "destructive",
};

function formatDate(d: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-EG", { year: "numeric", month: "short", day: "numeric" });
}

function isExpired(expiry: string | Date | null) {
  if (!expiry) return false;
  return new Date(expiry) < new Date();
}

export default function UserManagement() {
  const { data: users = [], refetch, isLoading } = trpc.userManagement.listUsers.useQuery();
  const grantSub = trpc.userManagement.grantSubscription.useMutation({ onSuccess: () => { toast.success("Subscription granted"); refetch(); } });
  const updateUser = trpc.userManagement.updateUser.useMutation({ onSuccess: () => { toast.success("User updated"); refetch(); } });
  const deactivate = trpc.userManagement.deactivateUser.useMutation({ onSuccess: () => { toast.success("User deactivated"); refetch(); } });

  const [grantDialog, setGrantDialog] = useState<{ open: boolean; userId: number; name: string }>({ open: false, userId: 0, name: "" });
  const [grantTier, setGrantTier] = useState<"monthly" | "quarterly" | "yearly" | "lifetime">("yearly");
  const [grantNotes, setGrantNotes] = useState("");

  const [roleDialog, setRoleDialog] = useState<{ open: boolean; userId: number; name: string; role: string }>({ open: false, userId: 0, name: "", role: "user" });

  const activeUsers = users.filter((u: any) => u.isActive !== 0);
  const paidUsers = users.filter((u: any) => u.subscriptionTier && u.subscriptionTier !== "free");
  const { data: expiringSoon = [] } = trpc.userManagement.expiringSoon.useQuery();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            User Access Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage user roles, subscriptions, and access levels
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Expiry Alert Banner */}
      {(expiringSoon as any[]).length > 0 && (
        <div className="bg-amber-500/10 border border-amber-400/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-amber-600 text-sm">Subscriptions expiring within 7 days</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {(expiringSoon as any[]).map((u: any) => (
                <span key={u.id} className="text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-0.5 font-medium">
                  {u.name || u.email || u.whatsappNumber} — {formatDate(u.subscriptionExpiry)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: users.length, icon: Users, color: "text-blue-500" },
          { label: "Active", value: activeUsers.length, icon: ShieldCheck, color: "text-green-500" },
          { label: "Paid Subscribers", value: paidUsers.length, icon: CreditCard, color: "text-yellow-500" },
          { label: "Admins", value: users.filter((u: any) => u.role === "admin").length, icon: ShieldCheck, color: "text-purple-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border rounded-lg p-4 flex items-center gap-3">
            <Icon className={`w-8 h-8 ${color}`} />
            <div>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading users...</TableCell>
              </TableRow>
            )}
            {!isLoading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No users found</TableCell>
              </TableRow>
            )}
            {users.map((user: any) => (
              <TableRow key={user.id} className={user.isActive === 0 ? "opacity-50" : ""}>
                <TableCell>
                  <div className="font-medium">{user.name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{user.email || user.whatsappNumber || user.phone || "—"}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role === "admin" ? "Admin" : "User"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={(TIER_COLORS[user.subscriptionTier] || "secondary") as any}>
                    {TIER_LABELS[user.subscriptionTier] || "Free"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className={isExpired(user.subscriptionExpiry) ? "text-red-500 text-xs" : "text-xs"}>
                    {user.subscriptionExpiry
                      ? (isExpired(user.subscriptionExpiry) ? "⚠ Expired " : "") + formatDate(user.subscriptionExpiry)
                      : "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={user.isActive !== 0 ? "default" : "destructive"}>
                    {user.isActive !== 0 ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end flex-wrap">
                    {/* Grant subscription */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setGrantDialog({ open: true, userId: user.id, name: user.name || user.email || String(user.id) }); setGrantTier("yearly"); setGrantNotes(""); }}
                    >
                      <CreditCard className="w-3 h-3 mr-1" /> Subscribe
                    </Button>

                    {/* Toggle role */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRoleDialog({ open: true, userId: user.id, name: user.name || String(user.id), role: user.role || "user" })}
                    >
                      <ShieldCheck className="w-3 h-3 mr-1" /> Role
                    </Button>

                    {/* Deactivate */}
                    {user.isActive !== 0 && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => { if (confirm(`Deactivate ${user.name || user.email}?`)) deactivate.mutate({ userId: user.id }); }}
                      >
                        <UserX className="w-3 h-3 mr-1" /> Deactivate
                      </Button>
                    )}
                    {user.isActive === 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateUser.mutate({ id: user.id, isActive: 1 })}
                      >
                        Reactivate
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Grant Subscription Dialog */}
      <Dialog open={grantDialog.open} onOpenChange={(o) => setGrantDialog((d) => ({ ...d, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Subscription — {grantDialog.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Subscription Tier</Label>
              <Select value={grantTier} onValueChange={(v) => setGrantTier(v as any)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly (30 days)</SelectItem>
                  <SelectItem value="quarterly">Quarterly (90 days)</SelectItem>
                  <SelectItem value="yearly">Yearly (365 days)</SelectItem>
                  <SelectItem value="lifetime">Lifetime</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                className="mt-1"
                placeholder="e.g. Paid via bank transfer, receipt #123"
                value={grantNotes}
                onChange={(e) => setGrantNotes(e.target.value)}
                rows={2}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                grantSub.mutate({ userId: grantDialog.userId, tier: grantTier, notes: grantNotes || undefined });
                setGrantDialog((d) => ({ ...d, open: false }));
              }}
              disabled={grantSub.isPending}
            >
              {grantSub.isPending ? "Granting..." : "Grant Subscription"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={roleDialog.open} onOpenChange={(o) => setRoleDialog((d) => ({ ...d, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role — {roleDialog.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Role</Label>
              <Select value={roleDialog.role} onValueChange={(v) => setRoleDialog((d) => ({ ...d, role: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User — Standard access</SelectItem>
                  <SelectItem value="admin">Admin — Full access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                updateUser.mutate({ id: roleDialog.userId, role: roleDialog.role as "user" | "admin" });
                setRoleDialog((d) => ({ ...d, open: false }));
              }}
              disabled={updateUser.isPending}
            >
              {updateUser.isPending ? "Saving..." : "Save Role"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
