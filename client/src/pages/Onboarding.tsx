import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { Copy, Download, Share2, QrCode } from 'lucide-react';

export default function Onboarding() {
  const [qrData, setQrData] = useState<{
    token: string;
    invitationUrl: string;
    qrCodeUrl: string;
    qrCodeDataUrl?: string;
    whatsappDeepLink?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateQRMutation = trpc.onboarding.generateQR.useMutation();

  const handleGenerateQR = async () => {
    setIsLoading(true);
    try {
      const result = await generateQRMutation.mutateAsync();
      setQrData({
        token: result.token,
        invitationUrl: result.invitationUrl,
        qrCodeUrl: result.qrCodeUrl,
        qrCodeDataUrl: result.qrCodeDataUrl,
        whatsappDeepLink: result.whatsappDeepLink,
      });
      toast.success('QR code generated successfully');
    } catch (error) {
      toast.error('Failed to generate QR code');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (qrData) {
      navigator.clipboard.writeText(qrData.invitationUrl);
      toast.success('Link copied to clipboard');
    }
  };

  const handleDownloadQR = async () => {
    if (qrData) {
      try {
        const response = await fetch(qrData.qrCodeUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `matchpro-qr-${qrData.token}.png`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('QR code downloaded');
      } catch (error) {
        toast.error('Failed to download QR code');
      }
    }
  };

  const handleShareQR = async () => {
    if (qrData && navigator.share) {
      try {
        await navigator.share({
          title: 'Join MatchPro™',
          text: 'Join MatchPro™ Real Estate Platform and get personalized property matches',
          url: qrData.invitationUrl,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          toast.error('Failed to share');
        }
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Invite New Users</h1>
        <p className="text-gray-500 mt-2">Generate QR codes and invitation links for new users to join MatchPro™</p>
      </div>

      {!qrData ? (
        <Card>
          <CardHeader>
            <CardTitle>Generate Invitation QR Code</CardTitle>
            <CardDescription>
              Create a unique QR code that new users can scan to join the platform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Generate a unique QR code for sharing</li>
                <li>New users scan the QR code with their phone</li>
                <li>They complete their profile with preferences</li>
                <li>System automatically matches them with properties</li>
                <li>They receive personalized notifications</li>
              </ul>
            </div>

            <Button 
              onClick={handleGenerateQR}
              disabled={isLoading}
              size="lg"
              className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
            >
              <QrCode className="w-5 h-5" />
              {isLoading ? 'Generating...' : 'Generate QR Code'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* QR Code Display */}
          <Card>
            <CardHeader>
              <CardTitle>Your Invitation QR Code</CardTitle>
              <CardDescription>Share this QR code with new users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                  <img 
                    src={qrData.qrCodeDataUrl || qrData.qrCodeUrl} 
                    alt="Invitation QR Code"
                    className="w-64 h-64"
                    onError={(e) => { (e.target as HTMLImageElement).src = qrData.qrCodeUrl; }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button 
                  onClick={handleDownloadQR}
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download QR
                </Button>
                <Button 
                  onClick={handleShareQR}
                  variant="outline"
                  className="gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Share QR
                </Button>
                <Button 
                  onClick={handleGenerateQR}
                  variant="outline"
                  className="gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  Generate New
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Invitation Link */}
          <Card>
            <CardHeader>
              <CardTitle>Invitation Link</CardTitle>
              <CardDescription>Share this link directly with new users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={qrData.invitationUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button 
                  onClick={handleCopyLink}
                  variant="outline"
                  size="icon"
                  className="gap-2"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">✓ Ready to share</h4>
                <p className="text-sm text-green-800">
                  Users who scan this QR code or click the link will be directed to complete their profile and start receiving personalized matches.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Token Information */}
          <Card>
            <CardHeader>
              <CardTitle>Invitation Token</CardTitle>
              <CardDescription>Technical details for integration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs break-all">
                {qrData.token}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Usage Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Tips</CardTitle>
          <CardDescription>Best practices for inviting new users</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <h4 className="font-semibold">📱 Mobile-First</h4>
            <p className="text-sm text-gray-600">
              Most users will scan QR codes with their phones. Ensure they have WhatsApp installed for instant notifications.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold">🎯 Targeted Invites</h4>
            <p className="text-sm text-gray-600">
              Share QR codes in WhatsApp groups, real estate forums, and social media for maximum reach.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold">✅ Profile Completion</h4>
            <p className="text-sm text-gray-600">
              Encourage users to complete their full profile for better property matches.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold">🔔 Enable Notifications</h4>
            <p className="text-sm text-gray-600">
              Remind users to enable WhatsApp and email notifications to receive match alerts.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
