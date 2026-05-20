import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, MoreVertical, RefreshCw, Send, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export default function ReportHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<number | null>(null);

  // Fetch report history
  const { data: historyData, isLoading: historyLoading, refetch } = trpc.report.getHistory.useQuery({
    limit: 30,
  });

  // Fetch report stats
  const { data: statsData } = trpc.report.getStats.useQuery();

  // Generate report mutation
  const generateMutation = trpc.report.generateReport.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success('✅ Report generated successfully');
        refetch();
      } else {
        toast.error(`❌ ${data.error}`);
      }
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Resend report mutation
  const resendMutation = trpc.report.resendReport.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success('✅ Report resent successfully');
        refetch();
      } else {
        toast.error(`❌ ${data.error}`);
      }
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Download report mutation
  const downloadMutation = trpc.report.downloadReport.useQuery(
    { reportId: selectedReport! },
    { enabled: !!selectedReport }
  );

  const handleDownload = async (reportId: number) => {
    setSelectedReport(reportId);
    // The download will be triggered by the query
  };

  const handleResend = (reportId: number) => {
    resendMutation.mutate({ reportId });
  };

  const handleGenerateReport = () => {
    generateMutation.mutate({ sendNotifications: true });
  };

  const reports = historyData?.data || [];
  const stats = statsData?.data;

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; label: string }> = {
      pending: { variant: 'outline', label: '⏳ Pending' },
      sent: { variant: 'secondary', label: '📤 Sent' },
      delivered: { variant: 'default', label: '✅ Delivered' },
      failed: { variant: 'destructive', label: '❌ Failed' },
      resent: { variant: 'secondary', label: '🔄 Resent' },
    };
    const config = statusConfig[status] || statusConfig['pending'];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getWhatsAppStatusBadge = (status?: string) => {
    if (!status) return <Badge variant="outline">-</Badge>;
    const config: Record<string, { variant: any; label: string }> = {
      pending: { variant: 'outline', label: '⏳ Pending' },
      sent: { variant: 'secondary', label: '📤 Sent' },
      delivered: { variant: 'default', label: '✅ Delivered' },
      read: { variant: 'default', label: '👁️ Read' },
      failed: { variant: 'destructive', label: '❌ Failed' },
    };
    const c = config[status] || config['pending'];
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const formatDate = (date: any) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('en-US', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">📊 Report History</h1>
          <p className="text-muted-foreground mt-2">Track and manage all generated reports</p>
        </div>
        <Button
          onClick={handleGenerateReport}
          disabled={generateMutation.isPending}
          className="gap-2"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Generate Report Now
            </>
          )}
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalReports}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">✅ Delivered</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">⏳ Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">❌ Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">📱 WhatsApp Sent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.whatsappSent}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Search Reports</CardTitle>
          <CardDescription>Filter by report name or email</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search by report name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Reports</CardTitle>
              <CardDescription>Last 30 generated reports</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={historyLoading}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No reports generated yet. Click "Generate Report Now" to create one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report Name</TableHead>
                    <TableHead>Generated</TableHead>
                    <TableHead>Demands</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Email Status</TableHead>
                    <TableHead>WhatsApp Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports
                    .filter(
                      (report: any) =>
                        !searchTerm ||
                        report.reportName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        report.recipientEmail.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((report: any) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">{report.reportName}</TableCell>
                        <TableCell className="text-sm">{formatDate(report.generatedAt)}</TableCell>
                        <TableCell>{report.demandsCount || 0}</TableCell>
                        <TableCell>{formatFileSize(report.fileSize)}</TableCell>
                        <TableCell>{getStatusBadge(report.deliveryStatus)}</TableCell>
                        <TableCell>{getWhatsAppStatusBadge(report.whatsappStatus)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleDownload(report.id)}
                                disabled={downloadMutation.isPending}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleResend(report.id)}
                                disabled={resendMutation.isPending}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Resend
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Configuration Info */}
      <Card>
        <CardHeader>
          <CardTitle>📧 Email Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>
            <strong>Recipient:</strong> {process.env.VITE_APP_TITLE || 'maisaramoamen@gmail.com'}
          </p>
          <p>
            <strong>Schedule:</strong> Every 6 hours (0:00, 6:00, 12:00, 18:00 Cairo time)
          </p>
          <p>
            <strong>Format:</strong> Excel (.xlsx) with 21 sheets and 130+ demands
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
