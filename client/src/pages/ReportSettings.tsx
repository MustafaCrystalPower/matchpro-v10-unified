import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Mail, Clock, MapPin, Filter, Save, RotateCcw } from "lucide-react";

export function ReportSettings() {
  const [frequency, setFrequency] = useState("daily");
  const [emailTime, setEmailTime] = useState("09:00");
  const [recipients, setRecipients] = useState("mmaisara@crystalpowerinvestment.com");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [minDemands, setMinDemands] = useState("1");
  const [isSaving, setIsSaving] = useState(false);

  // Mock locations and property types
  const locations = [
    "Cairo", "Giza", "Alexandria", "Helwan", "6th of October", "New Cairo",
    "Sheikh Zayed", "Maadi", "Nasr City", "Zamalek", "Dokki"
  ];

  const propertyTypes = [
    "Apartment", "Villa", "Townhouse", "Penthouse", "Studio",
    "Land", "Office", "Commercial", "Retail", "Industrial"
  ];

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // Validate
      if (!recipients.trim()) {
        toast.error("Please enter at least one email recipient");
        return;
      }

      // In a real app, this would call a tRPC mutation
      console.log({
        frequency,
        emailTime,
        recipients: recipients.split(",").map(e => e.trim()),
        locations: selectedLocations.length > 0 ? selectedLocations : "all",
        propertyTypes: selectedTypes.length > 0 ? selectedTypes : "all",
        minDemands: parseInt(minDemands),
      });

      toast.success("Report settings saved successfully");
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFrequency("daily");
    setEmailTime("09:00");
    setRecipients("mmaisara@crystalpowerinvestment.com");
    setSelectedLocations([]);
    setSelectedTypes([]);
    setMinDemands("1");
    toast.info("Settings reset to defaults");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Mail className="w-8 h-8 text-blue-500" />
          Report Settings
        </h1>
        <p className="text-muted-foreground mt-1">Configure daily demand report delivery</p>
      </div>

      {/* Main Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Email Delivery Configuration</CardTitle>
          <CardDescription>Customize when and how you receive daily demand reports</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Frequency & Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="frequency" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Report Frequency
              </Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly (Monday)</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Send Time (Cairo Time)</Label>
              <Input
                id="time"
                type="time"
                value={emailTime}
                onChange={(e) => setEmailTime(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Current: {emailTime} (UTC+2)
              </p>
            </div>
          </div>

          {/* Recipients */}
          <div className="space-y-2">
            <Label htmlFor="recipients">Email Recipients</Label>
            <Input
              id="recipients"
              placeholder="email1@example.com, email2@example.com"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple emails with commas
            </p>
          </div>

          {/* Minimum Demands Filter */}
          <div className="space-y-2">
            <Label htmlFor="minDemands">Minimum Demands to Report</Label>
            <Input
              id="minDemands"
              type="number"
              min="1"
              max="100"
              value={minDemands}
              onChange={(e) => setMinDemands(e.target.value)}
              className="w-24"
            />
            <p className="text-xs text-muted-foreground">
              Only report locations with at least this many demands
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Location Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Location Filters
          </CardTitle>
          <CardDescription>Leave empty to include all locations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {locations.map((loc) => (
              <div key={loc} className="flex items-center space-x-2">
                <Checkbox
                  id={`loc-${loc}`}
                  checked={selectedLocations.includes(loc)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedLocations([...selectedLocations, loc]);
                    } else {
                      setSelectedLocations(selectedLocations.filter(l => l !== loc));
                    }
                  }}
                />
                <Label htmlFor={`loc-${loc}`} className="text-sm cursor-pointer">
                  {loc}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Property Type Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Property Type Filters
          </CardTitle>
          <CardDescription>Leave empty to include all property types</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {propertyTypes.map((type) => (
              <div key={type} className="flex items-center space-x-2">
                <Checkbox
                  id={`type-${type}`}
                  checked={selectedTypes.includes(type)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedTypes([...selectedTypes, type]);
                    } else {
                      setSelectedTypes(selectedTypes.filter(t => t !== type));
                    }
                  }}
                />
                <Label htmlFor={`type-${type}`} className="text-sm cursor-pointer">
                  {type}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-sm">Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="font-semibold">Schedule:</span> {frequency === "daily" ? "Every day" : frequency === "weekly" ? "Every Monday" : "Disabled"} at {emailTime}
          </div>
          <div>
            <span className="font-semibold">Recipients:</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {recipients.split(",").map((email, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {email.trim()}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <span className="font-semibold">Locations:</span> {selectedLocations.length > 0 ? selectedLocations.join(", ") : "All"}
          </div>
          <div>
            <span className="font-semibold">Property Types:</span> {selectedTypes.length > 0 ? selectedTypes.join(", ") : "All"}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="gap-2 bg-blue-600 hover:bg-blue-700"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
        <Button
          onClick={handleReset}
          variant="outline"
          className="gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Reset to Defaults
        </Button>
      </div>

      {/* Info Box */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <p className="text-sm text-amber-900">
            <strong>ℹ️ Note:</strong> Daily reports are sent automatically at the configured time. Reports include demand statistics, property type breakdown, and full demand details for each location.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
