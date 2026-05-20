import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { trpc } from '@/lib/trpc';

const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'villa', label: 'Villa' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'land', label: 'Land' },
  { value: 'studio', label: 'Studio' },
  { value: 'penthouse', label: 'Penthouse' },
];

const EGYPTIAN_LOCATIONS = [
  { value: 'cairo', label: 'Cairo' },
  { value: 'new-cairo', label: 'New Cairo' },
  { value: 'giza', label: 'Giza' },
  { value: '6-october', label: '6th October' },
  { value: 'sheikh-zayed', label: 'Sheikh Zayed' },
  { value: 'new-capital', label: 'New Administrative Capital' },
  { value: 'helwan', label: 'Helwan' },
  { value: 'maadi', label: 'Maadi' },
  { value: 'zamalek', label: 'Zamalek' },
  { value: 'nasr-city', label: 'Nasr City' },
  { value: 'heliopolis', label: 'Heliopolis' },
  { value: 'mohandessin', label: 'Mohandessin' },
  { value: 'dokki', label: 'Dokki' },
  { value: 'agouza', label: 'Agouza' },
  { value: 'imbaba', label: 'Imbaba' },
  { value: 'alex', label: 'Alexandria' },
  { value: 'hurghada', label: 'Hurghada' },
  { value: 'sharm', label: 'Sharm El-Sheikh' },
  { value: 'aswan', label: 'Aswan' },
  { value: 'luxor', label: 'Luxor' },
];

export default function DailyLeadSettings() {
  const { data: user } = trpc.auth.me.useQuery();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const [formData, setFormData] = useState({
    locations: [] as string[],
    propertyTypes: [] as string[],
    confidenceThreshold: 70,
    excludeBrokers: true,
    emailFrequency: 'daily',
    emailTime: '09:00',
    maxLeadsPerEmail: 50,
    includeDataLeads: false,
  });

  // Fetch current settings
  const { data: settings, isLoading } = trpc.dailyLeadSettings.get.useQuery();

  useEffect(() => {
    if (settings) {
      setFormData({
        locations: settings.locations || [],
        propertyTypes: settings.propertyTypes || [],
        confidenceThreshold: settings.confidenceThreshold || 70,
        excludeBrokers: settings.excludeBrokers ?? true,
        emailFrequency: settings.emailFrequency || 'daily',
        emailTime: settings.emailTime || '09:00',
        maxLeadsPerEmail: settings.maxLeadsPerEmail || 50,
        includeDataLeads: settings.includeDataLeads ?? false,
      });
    }
  }, [settings]);

  const saveMutation = trpc.dailyLeadSettings.save.useMutation({
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (error) => {
      console.error('Failed to save settings:', error);
    },
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      await saveMutation.mutateAsync(formData);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Daily Lead Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure your automated daily lead email preferences. Leads will be sent every day at your specified time with your selected filters.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email Configuration</CardTitle>
          <CardDescription>Set when and how often you receive lead updates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emailTime" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Email Time (Daily)
              </Label>
              <Input
                id="emailTime"
                type="time"
                value={formData.emailTime}
                onChange={(e) => setFormData({ ...formData, emailTime: e.target.value })}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">Default: 9:00 AM</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxLeads">Max Leads Per Email</Label>
              <Input
                id="maxLeads"
                type="number"
                min="10"
                max="500"
                value={formData.maxLeadsPerEmail}
                onChange={(e) => setFormData({ ...formData, maxLeadsPerEmail: parseInt(e.target.value) })}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">Recommended: 50-100</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Location Preferences</CardTitle>
          <CardDescription>Select which Egyptian locations to include in your leads</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {EGYPTIAN_LOCATIONS.map(loc => (
              <label key={loc.value} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={formData.locations.includes(loc.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setFormData({ ...formData, locations: [...formData.locations, loc.value] });
                    } else {
                      setFormData({ ...formData, locations: formData.locations.filter(l => l !== loc.value) });
                    }
                  }}
                />
                <span className="text-sm">{loc.label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {formData.locations.length === 0
              ? 'No locations selected. You will receive leads from all areas.'
              : `Showing leads from ${formData.locations.length} location(s)`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Property Types</CardTitle>
          <CardDescription>Which property types are you interested in?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {PROPERTY_TYPES.map(type => (
              <label key={type.value} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={formData.propertyTypes.includes(type.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setFormData({ ...formData, propertyTypes: [...formData.propertyTypes, type.value] });
                    } else {
                      setFormData({ ...formData, propertyTypes: formData.propertyTypes.filter(t => t !== type.value) });
                    }
                  }}
                />
                <span className="text-sm">{type.label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {formData.propertyTypes.length === 0
              ? 'No types selected. You will receive all property types.'
              : `Showing ${formData.propertyTypes.length} property type(s)`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lead Quality Filters</CardTitle>
          <CardDescription>Control which leads appear in your daily email</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Confidence Threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Confidence Threshold</Label>
              <span className="text-sm font-semibold text-primary">{formData.confidenceThreshold}%</span>
            </div>
            <Slider
              value={[formData.confidenceThreshold]}
              onValueChange={(value) => setFormData({ ...formData, confidenceThreshold: value[0] })}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Only show leads with {formData.confidenceThreshold}% or higher classification confidence
            </p>
          </div>

          {/* Broker Exclusion */}
          <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
            <Checkbox
              id="excludeBrokers"
              checked={formData.excludeBrokers}
              onCheckedChange={(checked) => setFormData({ ...formData, excludeBrokers: checked as boolean })}
            />
            <Label htmlFor="excludeBrokers" className="cursor-pointer flex-1">
              Exclude Broker Leads
              <p className="text-xs text-muted-foreground font-normal mt-1">
                Only show leads from real buyers/sellers, not brokers or agencies
              </p>
            </Label>
          </div>

          {/* Include Data Leads */}
          <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
            <Checkbox
              id="includeDataLeads"
              checked={formData.includeDataLeads}
              onCheckedChange={(checked) => setFormData({ ...formData, includeDataLeads: checked as boolean })}
            />
            <Label htmlFor="includeDataLeads" className="cursor-pointer flex-1">
              Include Data/Leads Buyers
              <p className="text-xs text-muted-foreground font-normal mt-1">
                Include people looking to buy real estate data or lead lists
              </p>
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold">Email Delivery</p>
              <p className="mt-1">
                Your personalized lead email will be sent daily at <strong>{formData.emailTime}</strong> to{' '}
                <strong>{user?.email}</strong>. Leads are sourced from WhatsApp groups and Facebook real estate communities.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={() => window.history.back()}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={loading || saveMutation.isPending}
          className="gap-2"
        >
          {saved && <CheckCircle2 className="w-4 h-4" />}
          {loading || saveMutation.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {saved && (
        <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2 text-green-900">
          <CheckCircle2 className="w-5 h-5" />
          Settings saved successfully!
        </div>
      )}
    </div>
  );
}
