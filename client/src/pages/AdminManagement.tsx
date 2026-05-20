import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Shield,
  UserPlus,
  UserX,
  UserCheck,
  Phone,
  Mail,
  Calendar,
  RefreshCw,
  Lock,
} from "lucide-react";

export default function AdminManagement() {
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  const { data: admins, isLoading, refetch } = trpc.adminManagement.list.useQuery();
  const utils = trpc.useUtils();

  const addAdmin = trpc.adminManagement.add.useMutation({
    onSuccess: () => {
      toast.success(`Admin added — ${form.name} can now log in via WhatsApp OTP.`);
      setForm({ name: "", phone: "", email: "" });
      setAddOpen(false);
      utils.adminManagement.list.invalidate();
    },
    onError: (err) => {
      toast.error(`Failed to add admin: ${err.message}`);
    },
  });

  const deactivate = trpc.adminManagement.deactivate.useMutation({
    onSuccess: () => {
      toast.success("Admin deactivated — they can no longer log in.");
      utils.adminManagement.list.invalidate();
    },
    onError: (err) => {
       toast.error(`Failed to deactivate: ${err.message}`);
    },
  });

  const reactivate = trpc.adminManagement.reactivate.useMutation({
    onSuccess: () => {
      toast.success("Admin reactivated — they can now log in again.");
      utils.adminManagement.list.invalidate();
    },
    onError: (err) => {
      toast.error(`Failed to reactivate: ${err.message}`);
    },
  });

  const activeAdmins = admins?.filter((a) => a.isActive === 1) ?? [];
  const inactiveAdmins = admins?.filter((a) => a.isActive !== 1) ?? [];

  function formatPhone(phone: string | null) {
    if (!phone) return "—";
    const clean = phone.replace(/\D/g, "");
    if (clean.startsWith("20") && clean.length === 12) {
      return `+${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 8)} ${clean.slice(8)}`;
    }
    return `+${clean}`;
  }

  function formatDate(d: Date | string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Shield className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Management</h1>
            <p className="text-sm text-muted-foreground">
              Control who can log in to MatchPro™ via WhatsApp OTP
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">
                <UserPlus className="h-4 w-4 mr-1" />
                Add Admin
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Authorized Admin</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">Full Name *</label>
                  <Input
                    placeholder="e.g. Ahmed Hassan"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">WhatsApp Phone Number *</label>
                  <Input
                    placeholder="e.g. 201012345678"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Include country code without + (e.g. 201012345678 for Egypt)
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Email (optional)</label>
                  <Input
                    type="email"
                    placeholder="e.g. ahmed@crystalpowerinvestment.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                    disabled={!form.name || !form.phone || addAdmin.isPending}
                    onClick={() => addAdmin.mutate({ name: form.name, phone: form.phone, email: form.email })}
                  >
                    {addAdmin.isPending ? "Adding..." : "Add Admin"}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 bg-card/50">
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-2xl font-bold text-amber-500">{activeAdmins.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Active Admins</div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-card/50">
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-2xl font-bold text-muted-foreground">{inactiveAdmins.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Deactivated</div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-card/50">
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-2xl font-bold">{admins?.length ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Total</div>
          </CardContent>
        </Card>
      </div>

      {/* Active admins */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-green-500" />
            Active Admins
            <Badge className="bg-green-500/10 text-green-600 border-0 ml-1">{activeAdmins.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
          ) : activeAdmins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No active admins</div>
          ) : (
            <div className="space-y-2">
              {activeAdmins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-amber-500">
                        {(admin.name ?? "?")[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{admin.name ?? "Unnamed"}</div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {admin.phone && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {formatPhone(admin.phone)}
                          </span>
                        )}
                        {admin.email && !admin.email.includes("@whatsapp") && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                            <Mail className="h-3 w-3" />
                            {admin.email}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          Added {formatDate(admin.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10 shrink-0"
                        disabled={deactivate.isPending}
                      >
                        <UserX className="h-4 w-4 mr-1" />
                        Deactivate
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate {admin.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          They will no longer be able to log in to MatchPro™. You can reactivate them at any time.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-500 hover:bg-red-600"
                          onClick={() => deactivate.mutate({ id: admin.id })}
                        >
                          Deactivate
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deactivated admins */}
      {inactiveAdmins.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              Deactivated Admins
              <Badge variant="secondary" className="ml-1">{inactiveAdmins.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inactiveAdmins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/10 opacity-60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-muted/30 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-muted-foreground">
                        {(admin.name ?? "?")[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate line-through text-muted-foreground">
                        {admin.name ?? "Unnamed"}
                      </div>
                      {admin.phone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {formatPhone(admin.phone)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={reactivate.isPending}
                    onClick={() => reactivate.mutate({ id: admin.id })}
                  >
                    <UserCheck className="h-4 w-4 mr-1" />
                    Reactivate
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
