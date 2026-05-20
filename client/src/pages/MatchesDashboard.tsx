import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Phone, MapPin, DollarSign, Home, MessageSquare, TrendingUp } from 'lucide-react';

interface Match {
  supplyId: number;
  demandId: number;
  supplyName: string;
  supplyPhone: string;
  demandName: string;
  demandPhone: string;
  propertyType: string;
  location: string;
  supplyPrice: number | null;
  demandBudgetMin: number | null;
  demandBudgetMax: number | null;
  matchScore: number;
  matchReason: string;
  supplyMessage: string;
  demandMessage: string;
}

export default function MatchesDashboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterScore, setFilterScore] = useState('75');
  const [locations, setLocations] = useState<string[]>([]);

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual tRPC call
      // const result = await trpc.matches.getTopMatches.useQuery({ limit: 100 });
      // setMatches(result.data || []);

      // Mock data for now
      const mockMatches: Match[] = [
        {
          supplyId: 1,
          demandId: 101,
          supplyName: 'أحمد محمد',
          supplyPhone: '+201001234567',
          demandName: 'فاطمة علي',
          demandPhone: '+201101234567',
          propertyType: 'شقة',
          location: 'مدينتي',
          supplyPrice: 5500000,
          demandBudgetMin: 5000000,
          demandBudgetMax: 6000000,
          matchScore: 92,
          matchReason: 'Property type match: شقة | Location match: مدينتي | Price within budget: 5,500,000 EGP | Bedrooms match: 3',
          supplyMessage: 'شقة للبيع في مدينتي 3 نوم 2 حمام 180 متر',
          demandMessage: 'محتاجة شقة في مدينتي 3 نوم نص تشطيب بادجيت 5.5 مليون',
        },
        {
          supplyId: 2,
          demandId: 102,
          supplyName: 'محمود حسن',
          supplyPhone: '+201201234567',
          demandName: 'سارة محمود',
          demandPhone: '+201301234567',
          propertyType: 'فيلا',
          location: 'الشيخ زايد',
          supplyPrice: 8000000,
          demandBudgetMin: 7500000,
          demandBudgetMax: 9000000,
          matchScore: 88,
          matchReason: 'Property type match: فيلا | Location match: الشيخ زايد | Price within budget: 8,000,000 EGP',
          supplyMessage: 'فيلا للبيع في الشيخ زايد 4 نوم',
          demandMessage: 'بدور فيلا في الشيخ زايد بسعر معقول',
        },
      ];

      setMatches(mockMatches);

      // Extract unique locations
      const uniqueLocations = [...new Set(mockMatches.map((m) => m.location))];
      setLocations(uniqueLocations);
    } catch (error) {
      console.error('Failed to load matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMatches = matches.filter((match) => {
    const scoreThreshold = parseInt(filterScore);
    const locationMatch = filterLocation === 'all' || match.location === filterLocation;
    const scoreMatch = match.matchScore >= scoreThreshold;
    const searchMatch =
      searchTerm === '' ||
      match.supplyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.demandName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.location.toLowerCase().includes(searchTerm.toLowerCase());

    return locationMatch && scoreMatch && searchMatch;
  });

  const getScoreBadgeColor = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 80) return 'bg-blue-500';
    if (score >= 70) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">🎯 Market Matches</h1>
        <p className="text-gray-500 mt-2">Top 100 supply-demand matches with accuracy scores</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{matches.length}</div>
            <p className="text-xs text-gray-500">High-confidence matches</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {matches.length > 0 ? Math.round(matches.reduce((a, b) => a + b.matchScore, 0) / matches.length) : 0}%
            </div>
            <p className="text-xs text-gray-500">Average match accuracy</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">90+ Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{matches.filter((m) => m.matchScore >= 90).length}</div>
            <p className="text-xs text-gray-500">Perfect matches</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{locations.length}</div>
            <p className="text-xs text-gray-500">Areas covered</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Search</label>
              <Input
                placeholder="Search by name or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mt-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Location</label>
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Min Score</label>
              <Select value={filterScore} onValueChange={setFilterScore}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="75">75%+</SelectItem>
                  <SelectItem value="80">80%+</SelectItem>
                  <SelectItem value="85">85%+</SelectItem>
                  <SelectItem value="90">90%+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={loadMatches} className="w-full">
            Refresh Matches
          </Button>
        </CardContent>
      </Card>

      {/* Matches List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading matches...</span>
            </CardContent>
          </Card>
        ) : filteredMatches.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">No matches found with selected filters</p>
            </CardContent>
          </Card>
        ) : (
          filteredMatches.map((match, index) => (
            <Card key={`${match.supplyId}-${match.demandId}`} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Supply Side */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <Home className="h-5 w-5 text-blue-500" />
                          {match.supplyName}
                        </h3>
                        <p className="text-sm text-gray-500">Property Seller</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{match.supplyPhone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span>{match.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Home className="h-4 w-4 text-gray-400" />
                        <span>{match.propertyType}</span>
                      </div>
                      {match.supplyPrice && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-gray-400" />
                          <span>{match.supplyPrice.toLocaleString()} EGP</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-blue-50 p-3 rounded-lg text-sm">
                      <p className="text-gray-700">{match.supplyMessage}</p>
                    </div>
                  </div>

                  {/* Match Score & Demand Side */}
                  <div className="space-y-3">
                    {/* Score Display */}
                    <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg">
                      <div>
                        <p className="text-sm text-gray-600">Match Score</p>
                        <p className="text-2xl font-bold">{match.matchScore}%</p>
                      </div>
                      <Badge className={`${getScoreBadgeColor(match.matchScore)} text-white text-lg px-4 py-2`}>
                        <TrendingUp className="h-4 w-4 mr-1 inline" />
                        {match.matchScore >= 90 ? 'Perfect' : match.matchScore >= 80 ? 'Excellent' : 'Good'}
                      </Badge>
                    </div>

                    {/* Demand Side */}
                    <div className="space-y-2">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-green-500" />
                        {match.demandName}
                      </h3>
                      <p className="text-sm text-gray-500">Property Buyer</p>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span>{match.demandPhone}</span>
                        </div>
                        {match.demandBudgetMin && match.demandBudgetMax && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-gray-400" />
                            <span>
                              {match.demandBudgetMin.toLocaleString()} - {match.demandBudgetMax.toLocaleString()} EGP
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="bg-green-50 p-3 rounded-lg text-sm">
                        <p className="text-gray-700">{match.demandMessage}</p>
                      </div>
                    </div>

                    {/* Match Reason */}
                    <div className="bg-yellow-50 p-3 rounded-lg text-sm border-l-4 border-yellow-400">
                      <p className="font-semibold text-gray-700 mb-1">Why This Match?</p>
                      <p className="text-gray-600">{match.matchReason}</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        Send Offer
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
