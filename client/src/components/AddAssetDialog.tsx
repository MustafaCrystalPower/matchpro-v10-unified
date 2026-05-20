import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface AddAssetDialogProps {
  onAssetAdded?: () => void;
}

export function AddAssetDialog({ onAssetAdded }: AddAssetDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    propertyType: "",
    location: "",
    price: "",
    bedrooms: "",
    bathrooms: "",
    size: "",
    purpose: "sale" as "sale" | "rent",
  });

  const createAssetMutation = trpc.assets.createAsset.useMutation({
    onSuccess: () => {
      toast.success("Asset added successfully!");
      setOpen(false);
      setFormData({
        propertyType: "",
        location: "",
        price: "",
        bedrooms: "",
        bathrooms: "",
        size: "",
        purpose: "sale",
      });
      onAssetAdded?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add asset");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.propertyType || !formData.location || !formData.purpose) {
      toast.error("Please fill in all required fields");
      return;
    }

    createAssetMutation.mutate({
      propertyType: formData.propertyType,
      location: formData.location,
      price: formData.price ? parseInt(formData.price) : undefined,
      bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : undefined,
      bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : undefined,
      size: formData.size ? parseInt(formData.size) : undefined,
      purpose: formData.purpose,
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-amber-500 hover:bg-amber-600">
          <Plus className="w-4 h-4" />
          Add New Asset
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Property</DialogTitle>
          <DialogDescription>
            List your property to find matching buyers or renters
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Property Type */}
          <div className="space-y-2">
            <Label htmlFor="propertyType">Property Type *</Label>
            <Select
              value={formData.propertyType}
              onValueChange={(value) =>
                handleSelectChange("propertyType", value)
              }
            >
              <SelectTrigger id="propertyType">
                <SelectValue placeholder="Select property type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="apartment">Apartment</SelectItem>
                <SelectItem value="villa">Villa</SelectItem>
                <SelectItem value="townhouse">Townhouse</SelectItem>
                <SelectItem value="studio">Studio</SelectItem>
                <SelectItem value="penthouse">Penthouse</SelectItem>
                <SelectItem value="duplex">Duplex</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="land">Land</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location *</Label>
            <Input
              id="location"
              name="location"
              placeholder="e.g., Fifth Settlement, Madinaty"
              value={formData.location}
              onChange={handleChange}
            />
          </div>

          {/* Purpose */}
          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose *</Label>
            <Select
              value={formData.purpose}
              onValueChange={(value) =>
                handleSelectChange("purpose", value as "sale" | "rent")
              }
            >
              <SelectTrigger id="purpose">
                <SelectValue placeholder="Select purpose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sale">For Sale</SelectItem>
                <SelectItem value="rent">For Rent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price">
              Price {formData.purpose === "rent" ? "(Monthly)" : "(EGP)"}
            </Label>
            <Input
              id="price"
              name="price"
              type="number"
              placeholder="e.g., 5000000"
              value={formData.price}
              onChange={handleChange}
            />
          </div>

          {/* Bedrooms */}
          <div className="space-y-2">
            <Label htmlFor="bedrooms">Bedrooms</Label>
            <Input
              id="bedrooms"
              name="bedrooms"
              type="number"
              placeholder="e.g., 3"
              value={formData.bedrooms}
              onChange={handleChange}
            />
          </div>

          {/* Bathrooms */}
          <div className="space-y-2">
            <Label htmlFor="bathrooms">Bathrooms</Label>
            <Input
              id="bathrooms"
              name="bathrooms"
              type="number"
              placeholder="e.g., 2"
              value={formData.bathrooms}
              onChange={handleChange}
            />
          </div>

          {/* Size */}
          <div className="space-y-2">
            <Label htmlFor="size">Size (m²)</Label>
            <Input
              id="size"
              name="size"
              type="number"
              placeholder="e.g., 250"
              value={formData.size}
              onChange={handleChange}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-amber-500 hover:bg-amber-600"
              disabled={createAssetMutation.isPending}
            >
              {createAssetMutation.isPending ? "Adding..." : "Add Asset"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
