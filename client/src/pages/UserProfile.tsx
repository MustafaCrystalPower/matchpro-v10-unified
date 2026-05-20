import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Phone, MessageSquare, ShieldCheck, User } from 'lucide-react';

export default function UserProfile() {
  const [formData, setFormData] = useState({
    phoneNumber: '',
    whatsappNumber: '',
    userType: 'buyer' as const,
    propertyType: '',
    location: '',
    area: '',
    city: 'Cairo',
    priceMin: '',
    priceMax: '',
    sizeMin: '',
    sizeMax: '',
    bedrooms: '',
    bathrooms: '',
    purpose: 'sale' as const,
    notifyOnMatch: true,
    notifyViaWhatsapp: true,
    notifyViaEmail: true,
  });

  const [isLoading, setIsLoading] = useState(false);
  const userProfileQuery = trpc.userProfile.get.useQuery();
  const upsertProfileMutation = trpc.userProfile.upsert.useMutation();

  // Load existing profile
  useEffect(() => {
    if (userProfileQuery.data) {
      setFormData({
        phoneNumber: userProfileQuery.data.phoneNumber || '',
        whatsappNumber: userProfileQuery.data.whatsappNumber || '',
        userType: userProfileQuery.data.userType as any,
        propertyType: userProfileQuery.data.propertyType || '',
        location: userProfileQuery.data.location || '',
        area: userProfileQuery.data.area || '',
        city: userProfileQuery.data.city || 'Cairo',
        priceMin: userProfileQuery.data.priceMin ? userProfileQuery.data.priceMin.toString() : '',
        priceMax: userProfileQuery.data.priceMax ? userProfileQuery.data.priceMax.toString() : '',
        sizeMin: userProfileQuery.data.sizeMin ? userProfileQuery.data.sizeMin.toString() : '',
        sizeMax: userProfileQuery.data.sizeMax ? userProfileQuery.data.sizeMax.toString() : '',
        bedrooms: userProfileQuery.data.bedrooms ? userProfileQuery.data.bedrooms.toString() : '',
        bathrooms: userProfileQuery.data.bathrooms ? userProfileQuery.data.bathrooms.toString() : '',
        purpose: userProfileQuery.data.purpose as any,
        notifyOnMatch: userProfileQuery.data.notifyOnMatch === 1,
        notifyViaWhatsapp: userProfileQuery.data.notifyViaWhatsapp === 1,
        notifyViaEmail: userProfileQuery.data.notifyViaEmail === 1,
      });
    }
  }, [userProfileQuery.data]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await upsertProfileMutation.mutateAsync({
        phoneNumber: formData.phoneNumber || undefined,
        whatsappNumber: formData.whatsappNumber || undefined,
        userType: formData.userType,
        propertyType: formData.propertyType || undefined,
        location: formData.location || undefined,
        area: formData.area || undefined,
        city: formData.city || undefined,
        priceMin: formData.priceMin ? parseFloat(formData.priceMin) : undefined,
        priceMax: formData.priceMax ? parseFloat(formData.priceMax) : undefined,
        sizeMin: formData.sizeMin ? parseInt(formData.sizeMin) : undefined,
        sizeMax: formData.sizeMax ? parseInt(formData.sizeMax) : undefined,
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : undefined,
        bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : undefined,
        purpose: formData.purpose || undefined,
        notifyOnMatch: formData.notifyOnMatch,
        notifyViaWhatsapp: formData.notifyViaWhatsapp,
        notifyViaEmail: formData.notifyViaEmail,
      });

      toast.success('Profile updated successfully');
      userProfileQuery.refetch();
    } catch (error) {
      toast.error('Failed to update profile');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const { user } = useAuth();

  // Derive phone from openId if user logged in via WhatsApp (openId = wa_PHONE)
  const whatsappPhone = user?.openId?.startsWith('wa_') ? user.openId.replace('wa_', '') : null;
  const displayPhone = user?.whatsappNumber || whatsappPhone;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="text-gray-500 mt-2">Manage your preferences and get personalized property matches</p>
      </div>

      {/* Admin Account Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Account Information</CardTitle>
            {user?.role === 'admin' && (
              <Badge variant="default" className="ml-auto text-xs">Administrator</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium truncate">{user?.name || 'Not set'}</p>
              </div>
            </div>
            {displayPhone && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">WhatsApp</p>
                  <p className="text-sm font-medium font-mono">+{displayPhone}</p>
                </div>
              </div>
            )}
            {user?.email && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium truncate">{user.email}</p>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Login method: <span className="font-medium capitalize">{user?.loginMethod || 'Unknown'}</span>
          </p>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>Your contact details for property inquiries</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+201234567890"
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="whatsapp">WhatsApp Number</Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  placeholder="+201234567890"
                  value={formData.whatsappNumber}
                  onChange={(e) => handleInputChange('whatsappNumber', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Type & Purpose */}
        <Card>
          <CardHeader>
            <CardTitle>Account Type</CardTitle>
            <CardDescription>What describes you best?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="userType">I am a</Label>
                <Select value={formData.userType} onValueChange={(value) => handleInputChange('userType', value)}>
                  <SelectTrigger id="userType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buyer">Buyer</SelectItem>
                    <SelectItem value="seller">Seller</SelectItem>
                    <SelectItem value="investor">Investor</SelectItem>
                    <SelectItem value="agent">Real Estate Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="purpose">Looking for</Label>
                <Select value={formData.purpose} onValueChange={(value) => handleInputChange('purpose', value)}>
                  <SelectTrigger id="purpose">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">Sale</SelectItem>
                    <SelectItem value="rent">Rent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Property Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Property Preferences</CardTitle>
            <CardDescription>Tell us what you're looking for</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="propertyType">Property Type</Label>
                <Input
                  id="propertyType"
                  placeholder="e.g., Apartment, Villa, Townhouse"
                  value={formData.propertyType}
                  onChange={(e) => handleInputChange('propertyType', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="location">Location/District</Label>
                <Input
                  id="location"
                  placeholder="e.g., New Cairo, Heliopolis"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="area">Area/Compound</Label>
                <Input
                  id="area"
                  placeholder="e.g., Katameya, Maadi"
                  value={formData.area}
                  onChange={(e) => handleInputChange('area', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="Cairo"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                />
              </div>
            </div>

            {/* Price Range */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Budget Range</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priceMin">Minimum Price (EGP)</Label>
                  <Input
                    id="priceMin"
                    type="number"
                    placeholder="0"
                    value={formData.priceMin}
                    onChange={(e) => handleInputChange('priceMin', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="priceMax">Maximum Price (EGP)</Label>
                  <Input
                    id="priceMax"
                    type="number"
                    placeholder="0"
                    value={formData.priceMax}
                    onChange={(e) => handleInputChange('priceMax', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Size & Rooms */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Size & Rooms</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="sizeMin">Min Size (m²)</Label>
                  <Input
                    id="sizeMin"
                    type="number"
                    placeholder="0"
                    value={formData.sizeMin}
                    onChange={(e) => handleInputChange('sizeMin', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="sizeMax">Max Size (m²)</Label>
                  <Input
                    id="sizeMax"
                    type="number"
                    placeholder="0"
                    value={formData.sizeMax}
                    onChange={(e) => handleInputChange('sizeMax', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="bedrooms">Bedrooms</Label>
                  <Input
                    id="bedrooms"
                    type="number"
                    placeholder="0"
                    value={formData.bedrooms}
                    onChange={(e) => handleInputChange('bedrooms', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="bathrooms">Bathrooms</Label>
                  <Input
                    id="bathrooms"
                    type="number"
                    placeholder="0"
                    value={formData.bathrooms}
                    onChange={(e) => handleInputChange('bathrooms', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Settings</CardTitle>
            <CardDescription>How would you like to receive updates?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notifyOnMatch"
                  checked={formData.notifyOnMatch}
                  onCheckedChange={(checked) => handleInputChange('notifyOnMatch', checked)}
                />
                <Label htmlFor="notifyOnMatch" className="cursor-pointer">
                  Notify me when new matches are found
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notifyWhatsapp"
                  checked={formData.notifyViaWhatsapp}
                  onCheckedChange={(checked) => handleInputChange('notifyViaWhatsapp', checked)}
                />
                <Label htmlFor="notifyWhatsapp" className="cursor-pointer">
                  Send notifications via WhatsApp
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notifyEmail"
                  checked={formData.notifyViaEmail}
                  onCheckedChange={(checked) => handleInputChange('notifyViaEmail', checked)}
                />
                <Label htmlFor="notifyEmail" className="cursor-pointer">
                  Send notifications via Email
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex gap-2">
          <Button 
            type="submit" 
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </form>
    </div>
  );
}
