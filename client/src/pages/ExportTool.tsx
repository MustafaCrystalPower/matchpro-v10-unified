import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Download, Filter } from "lucide-react";
import { toast } from "sonner";

export function ExportTool() {
  const [filters, setFilters] = useState({
    type: "all" as "all" | "supply" | "demand",
    area: "",
    purpose: "all" as "all" | "sale" | "rent",
    propertyType: "",
  });

  const [isExporting, setIsExporting] = useState(false);

  // Get locations and property types for filters
  const { data: locationStats } = trpc.dashboard.locationStats.useQuery();
  const { data: propertyTypeStats } = trpc.dashboard.propertyTypeStats.useQuery();

  // Trigger report export
  const triggerReport = trpc.reports.trigger.useMutation();

  const handleExport = async () => {
    if (!filters.area) {
      toast.error("Please select an area");
      return;
    }

    setIsExporting(true);
    try {
      // Trigger report with selected cycle
      await triggerReport.mutateAsync({
        cycle: "9AM",
      });
      toast.success("Export triggered! Check your email for the file");
    } catch (error) {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const uniqueLocations = locationStats
    ? Object.keys(locationStats).sort()
    : [];

  const uniquePropertyTypes = propertyTypeStats
    ? Object.keys(propertyTypeStats).sort()
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Export Tool</h1>
        <p className="text-muted-foreground mt-1">Extract and export supply/demand data with filters</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Export Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Type Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Data Type</label>
            <div className="flex gap-2">
              <Button
                variant={filters.type === "all" ? "default" : "outline"}
                onClick={() => setFilters({ ...filters, type: "all" })}
              >
                Both
              </Button>
              <Button
                variant={filters.type === "supply" ? "default" : "outline"}
                onClick={() => setFilters({ ...filters, type: "supply" })}
              >
                Supply Only
              </Button>
              <Button
                variant={filters.type === "demand" ? "default" : "outline"}
                onClick={() => setFilters({ ...filters, type: "demand" })}
              >
                Demand Only
              </Button>
            </div>
          </div>

          {/* Filters Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Area */}
            <div>
              <label className="text-sm font-medium mb-2 block">Area *</label>
              <Select value={filters.area} onValueChange={(v) => setFilters({ ...filters, area: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select area" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueLocations.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Purpose */}
            <div>
              <label className="text-sm font-medium mb-2 block">Purpose</label>
              <Select value={filters.purpose} onValueChange={(v: any) => setFilters({ ...filters, purpose: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="sale">For Sale</SelectItem>
                  <SelectItem value="rent">For Rent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Property Type */}
            <div>
              <label className="text-sm font-medium mb-2 block">Property Type</label>
              <Select value={filters.propertyType} onValueChange={(v) => setFilters({ ...filters, propertyType: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  {uniquePropertyTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Export Button */}
          <div className="flex gap-2 pt-4">
            <Button
              className="flex-1 gap-2"
              onClick={handleExport}
              disabled={isExporting || !filters.area}
              size="lg"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Exporting..." : "Export to Excel"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Export Format</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>Excel (.xlsx) with branded MatchPro header and logo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Delivery</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>Sent to your registered email immediately</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Data Included</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>Contact info, location, price, requirements, original messages</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
