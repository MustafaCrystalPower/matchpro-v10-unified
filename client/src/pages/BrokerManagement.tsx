import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Mail, Clock } from "lucide-react";
import { toast } from "sonner";

interface Broker {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  whatsappNumber?: string;
  preferredAreas?: string[];
  preferredTypes?: string[];
  status: string;
  createdAt: Date;
}

export function BrokerManagement() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    whatsappNumber: "",
    preferredAreas: "",
    preferredTypes: "",
  });

  const { data: brokers, isLoading, refetch } = trpc.brokers.getAllBrokers.useQuery();
  const createBroker = trpc.brokers.createBroker.useMutation({
    onSuccess: () => {
      toast.success("Broker added successfully");
      setShowForm(false);
      setFormData({
        name: "",
        phone: "",
        email: "",
        whatsappNumber: "",
        preferredAreas: "",
        preferredTypes: "",
      });
      refetch();
    },
  });

  const deleteBroker = trpc.brokers.deleteBroker.useMutation({
    onSuccess: () => {
      toast.success("Broker removed");
      refetch();
    },
  });

  const scheduleDemandSheet = trpc.brokers.scheduleDemandSheet.useMutation({
    onSuccess: () => {
      toast.success("Demand sheet scheduled for 6 hours from now");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Broker name is required");
      return;
    }

    createBroker.mutate({
      name: formData.name,
      phone: formData.phone || undefined,
      email: formData.email || undefined,
      whatsappNumber: formData.whatsappNumber || undefined,
      preferredAreas: formData.preferredAreas ? formData.preferredAreas.split(",").map((a) => a.trim()) : undefined,
      preferredTypes: formData.preferredTypes ? formData.preferredTypes.split(",").map((t) => t.trim()) : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Broker Management</h1>
          <p className="text-muted-foreground mt-1">Manage brokers receiving 6-hour demand sheets</p>
        </div>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Broker
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Broker</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Broker name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+20 1234567890"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="broker@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">WhatsApp Number</label>
                <Input
                  value={formData.whatsappNumber}
                  onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                  placeholder="+20 1234567890"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Preferred Areas (comma-separated)</label>
                <Input
                  value={formData.preferredAreas}
                  onChange={(e) => setFormData({ ...formData, preferredAreas: e.target.value })}
                  placeholder="التجمع الخامس, الشيخ زايد, المعادي"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Preferred Property Types (comma-separated)</label>
                <Input
                  value={formData.preferredTypes}
                  onChange={(e) => setFormData({ ...formData, preferredTypes: e.target.value })}
                  placeholder="apartment, villa, townhouse"
                />
              </div>
              <Button type="submit" className="w-full" disabled={createBroker.isPending}>
                {createBroker.isPending ? "Adding..." : "Add Broker"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading brokers...</div>
      ) : !brokers || brokers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No brokers yet</p>
            <Button onClick={() => setShowForm(true)}>Add Your First Broker</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {brokers.map((broker: Broker) => (
            <Card key={broker.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{broker.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {broker.email || "No email"} • {broker.phone || "No phone"}
                    </p>
                  </div>
                  <Badge variant="outline">{broker.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {broker.preferredAreas && (
                  <div>
                    <span className="text-sm text-muted-foreground">Preferred Areas</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(typeof broker.preferredAreas === "string"
                        ? JSON.parse(broker.preferredAreas)
                        : broker.preferredAreas
                      ).map((area: string) => (
                        <Badge key={area} variant="secondary">
                          {area}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 flex-1"
                    onClick={() => scheduleDemandSheet.mutate({ brokerId: broker.id })}
                    disabled={scheduleDemandSheet.isPending}
                  >
                    <Clock className="w-4 h-4" />
                    {scheduleDemandSheet.isPending ? "Scheduling..." : "Schedule Demand Sheet"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 flex-1"
                  >
                    <Mail className="w-4 h-4" />
                    Send Now
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteBroker.mutate({ brokerId: broker.id })}
                    disabled={deleteBroker.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
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
