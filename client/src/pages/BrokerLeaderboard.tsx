import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, CheckCircle } from "lucide-react";

interface BrokerStats {
  id: number;
  brokerPhone: string;
  brokerName: string | null;
  supplyCount: number | null;
  demandCount: number | null;
  matchCount: number | null;
  successfulMatches: number | null;
  avgMatchScore: string | null;
  lastActiveAt: Date | null;
}

export default function BrokerLeaderboard() {
  const [brokers, setBrokers] = useState<BrokerStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { data: topBrokersData, isLoading: isLoadingBrokers } = trpc.brokers.topBrokers.useQuery(
    { limit: 50 },
    { refetchInterval: 30000 } // Refresh every 30 seconds
  );

  useEffect(() => {
    if (topBrokersData) {
      setBrokers(topBrokersData as BrokerStats[]);
      setIsLoading(false);
    }
  }, [topBrokersData]);

  const getSuccessRatio = (broker: BrokerStats) => {
    const total = (broker.supplyCount || 0) + (broker.demandCount || 0);
    return total > 0 ? (((broker.successfulMatches || 0) / total) * 100).toFixed(1) : "0";
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return <Badge className="bg-yellow-500">🥇 1st</Badge>;
    if (index === 1) return <Badge className="bg-gray-400">🥈 2nd</Badge>;
    if (index === 2) return <Badge className="bg-orange-600">🥉 3rd</Badge>;
    return <Badge variant="outline">#{index + 1}</Badge>;
  };

  if (isLoading || isLoadingBrokers) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Broker Leaderboard</h1>
        <p className="text-muted-foreground mt-2">Top performing brokers by successful matches</p>
      </div>

      <div className="grid gap-4">
        {brokers.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">No broker data available yet</p>
            </CardContent>
          </Card>
        ) : (
          brokers.map((broker, index) => (
            <Card key={broker.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    {getRankBadge(index)}
                    <div>
                      <CardTitle className="text-xl">
                        {broker.brokerName || "Unknown Broker"}
                      </CardTitle>
                      <CardDescription className="font-mono text-sm">
                        {broker.brokerPhone}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      {broker.successfulMatches || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">Successful Matches</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      Supply
                    </div>
                    <p className="text-2xl font-semibold text-blue-600">{broker.supplyCount || 0}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      Demand
                    </div>
                    <p className="text-2xl font-semibold text-purple-600">{broker.demandCount || 0}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      Total Matches
                    </div>
                    <p className="text-2xl font-semibold text-orange-600">{broker.matchCount || 0}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4" />
                      Success Rate
                    </div>
                    <p className="text-2xl font-semibold text-green-600">
                      {getSuccessRatio(broker)}%
                    </p>
                  </div>
                </div>

                {broker.lastActiveAt && (
                  <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                    Last active: {new Date(broker.lastActiveAt).toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
