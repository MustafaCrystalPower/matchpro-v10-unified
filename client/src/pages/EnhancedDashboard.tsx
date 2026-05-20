/**
 * Enhanced Dashboard - Priority 4
 * Features: Unknown message review panel, area heatmap, 30-day trends, one-click export
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { Download, AlertCircle, MapPin } from 'lucide-react';

interface UnknownMessage {
  id: number;
  messageText: string;
  createdAt: string;
  senderName: string;
  groupName: string;
}

interface AreaMetric {
  area: string;
  demand: number;
  supply: number;
  matches: number;
  temperature: 'hot' | 'warm' | 'cool' | 'cold';
}

interface TrendData {
  date: string;
  demand: number;
  supply: number;
  matches: number;
}

export function EnhancedDashboard() {
  const [unknownMessages, setUnknownMessages] = useState<UnknownMessage[]>([]);
  const [areaMetrics, setAreaMetrics] = useState<AreaMetric[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [selectedUnknown, setSelectedUnknown] = useState<UnknownMessage | null>(null);

  // Initialize with mock data
  useEffect(() => {
    setUnknownMessages([
      {
        id: 1,
        messageText: 'محتاج شقة في التجمع 3 غرف',
        createdAt: new Date().toISOString(),
        senderName: 'Ahmed',
        groupName: 'Real Estate Group'
      },
      {
        id: 2,
        messageText: 'عندي فيلا للبيع بمدينتي',
        createdAt: new Date().toISOString(),
        senderName: 'Fatima',
        groupName: 'Property Listings'
      }
    ]);

    setAreaMetrics([
      { area: 'مدينتي', demand: 150, supply: 80, matches: 120, temperature: 'hot' },
      { area: 'الرحاب', demand: 100, supply: 60, matches: 80, temperature: 'warm' },
      { area: 'التجمع الخامس', demand: 200, supply: 120, matches: 150, temperature: 'hot' },
      { area: 'الشيخ زايد', demand: 80, supply: 50, matches: 60, temperature: 'cool' }
    ]);

    setTrendData([
      { date: '2026-04-15', demand: 150, supply: 80, matches: 120 },
      { date: '2026-04-16', demand: 180, supply: 90, matches: 140 },
      { date: '2026-04-17', demand: 200, supply: 110, matches: 160 },
      { date: '2026-04-18', demand: 220, supply: 130, matches: 180 },
      { date: '2026-04-19', demand: 250, supply: 150, matches: 200 },
      { date: '2026-04-20', demand: 280, supply: 170, matches: 220 },
      { date: '2026-04-21', demand: 300, supply: 190, matches: 240 }
    ]);
  }, []);

  // Export to Excel
  const handleExportExcel = async () => {
    try {
      const response = await fetch('/api/export/dashboard-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unknownMessages,
          areaMetrics,
          trendData
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MatchPro_Dashboard_${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleClassify = async (messageId: number, classification: 'demand' | 'supply') => {
    try {
      await fetch('/api/messages/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, classification })
      });

      setUnknownMessages(unknownMessages.filter(m => m.id !== messageId));
      setSelectedUnknown(null);
    } catch (error) {
      console.error('Classification failed:', error);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Enhanced Dashboard</h1>
          <p className="text-gray-600">Real-time market intelligence and analysis</p>
        </div>
        <Button onClick={handleExportExcel} className="gap-2">
          <Download className="w-4 h-4" />
          Export to Excel
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Demands</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">730</div>
            <p className="text-xs text-gray-600">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Supply</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">420</div>
            <p className="text-xs text-gray-600">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Hot Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">156</div>
            <p className="text-xs text-gray-600">90%+ confidence</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unknown Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{unknownMessages.length}</div>
            <p className="text-xs text-gray-600">Needs review</p>
          </CardContent>
        </Card>
      </div>

      {/* 30-Day Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>30-Day Trend Analysis</CardTitle>
          <CardDescription>Supply vs Demand vs Matches</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="demand" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="supply" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="matches" stroke="#f59e0b" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Area Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Area Heatmap & Metrics
          </CardTitle>
          <CardDescription>Market temperature by location</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Heatmap visualization */}
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="demand" name="Demand" />
                <YAxis type="number" dataKey="supply" name="Supply" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter
                  name="Areas"
                  data={areaMetrics.map(m => ({
                    ...m,
                    fill: m.temperature === 'hot' ? '#ef4444' : 
                          m.temperature === 'warm' ? '#f59e0b' :
                          m.temperature === 'cool' ? '#3b82f6' : '#6b7280'
                  }))}
                  fill="#8884d8"
                />
              </ScatterChart>
            </ResponsiveContainer>

            {/* Area details table */}
            <div className="space-y-2">
              {areaMetrics.map(metric => (
                <div key={metric.area} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium">{metric.area}</p>
                    <p className="text-sm text-gray-600">
                      D: {metric.demand} | S: {metric.supply} | M: {metric.matches}
                    </p>
                  </div>
                  <Badge
                    variant={
                      metric.temperature === 'hot' ? 'destructive' :
                      metric.temperature === 'warm' ? 'secondary' : 'outline'
                    }
                  >
                    {metric.temperature}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unknown Messages Review Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            Unknown Messages Review
          </CardTitle>
          <CardDescription>Messages requiring manual classification</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {unknownMessages.length === 0 ? (
              <p className="text-gray-600 text-center py-8">All messages classified! 🎉</p>
            ) : (
              unknownMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`p-3 border rounded cursor-pointer transition ${
                    selectedUnknown?.id === msg.id ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                  onClick={() => setSelectedUnknown(msg)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{msg.senderName}</p>
                      <p className="text-sm text-gray-700 mt-1">{msg.messageText.substring(0, 100)}...</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">{msg.groupName}</Badge>
                        <Badge variant="outline" className="text-xs">
                          {new Date(msg.createdAt).toLocaleDateString()}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Classification buttons */}
                  {selectedUnknown?.id === msg.id && (
                    <div className="flex gap-2 mt-3 pt-3 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleClassify(msg.id, 'demand')}
                      >
                        Mark as Demand
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleClassify(msg.id, 'supply')}
                      >
                        Mark as Supply
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
