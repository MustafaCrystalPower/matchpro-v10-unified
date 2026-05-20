import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Star, Send } from "lucide-react";
import { toast } from "sonner";

interface Match {
  id: number;
  matchScore: string | number;
  status: string | null;
  matchSummary: string | null;
}

export default function MatchFeedback() {
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const { data: matches, isLoading: isLoadingMatches } = trpc.matches.recent.useQuery(
    { limit: 20 },
    { refetchInterval: 30000 }
  );

  const submitFeedback = trpc.matches.feedback.useMutation({
    onSuccess: () => {
      toast.success("Feedback submitted! Helping improve the matching algorithm.");
      setSelectedRating(0);
      setComment("");
      setSelectedMatch(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to submit feedback: ${error.message}`);
    },
  });

  const handleSubmitFeedback = () => {
    if (!selectedMatch || selectedRating === 0) {
      toast.error("Please select a match and rating");
      return;
    }

    submitFeedback.mutate({
      matchId: selectedMatch.id,
      rating: selectedRating,
      comment: comment || undefined,
      helpful: selectedRating >= 4 ? 1 : 0,
    });
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return "text-green-600";
    if (rating >= 3) return "text-yellow-600";
    return "text-red-600";
  };

  if (isLoadingMatches) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Match Feedback</h1>
        <p className="text-muted-foreground mt-2">
          Help improve our matching algorithm by rating matches. Your feedback drives continuous learning.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Matches */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Recent Matches</CardTitle>
              <CardDescription>Select a match to rate</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {matches && matches.length > 0 ? (
                matches.map((match) => (
                  <button
                    key={match.id}
                    onClick={() => setSelectedMatch(match)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      selectedMatch?.id === match.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Match #{match.id}</span>
                      <Badge variant="outline">{(Number(match.matchScore) * 100).toFixed(0)}%</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {match.matchSummary || "No summary available"}
                    </p>
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No matches available yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Feedback Form */}
        <div className="lg:col-span-2">
          {selectedMatch ? (
            <Card>
              <CardHeader>
                <CardTitle>Rate This Match</CardTitle>
                <CardDescription>
                  Match #{selectedMatch.id} - Score: {(Number(selectedMatch.matchScore) * 100).toFixed(0)}%
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Match Details */}
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm font-medium mb-2">Match Summary</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedMatch.matchSummary || "No summary available"}
                  </p>
                </div>

                {/* Star Rating */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">How helpful was this match?</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => setSelectedRating(rating)}
                        className={`p-2 rounded-lg transition-all ${
                          selectedRating >= rating
                            ? "bg-yellow-500 text-white"
                            : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                        }`}
                      >
                        <Star
                          className="h-6 w-6"
                          fill={selectedRating >= rating ? "currentColor" : "none"}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedRating > 0 && (
                      <span className={getRatingColor(selectedRating)}>
                        {selectedRating === 1 && "Poor - Not helpful"}
                        {selectedRating === 2 && "Fair - Somewhat helpful"}
                        {selectedRating === 3 && "Good - Helpful"}
                        {selectedRating === 4 && "Very Good - Very helpful"}
                        {selectedRating === 5 && "Excellent - Excellent match"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Comment */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Additional Comments (Optional)</label>
                  <Textarea
                    placeholder="What could be improved? Any specific feedback?"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="min-h-24"
                  />
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleSubmitFeedback}
                  disabled={selectedRating === 0 || submitFeedback.isPending}
                  className="w-full"
                  size="lg"
                >
                  {submitFeedback.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Feedback
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Your feedback helps train our algorithm to make better matches over time.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">
                  Select a match from the list to rate it
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Learning Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">How Continuous Learning Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 space-y-2">
          <p>
            • <strong>Your ratings</strong> help the algorithm understand which matches are truly valuable
          </p>
          <p>
            • <strong>Pattern recognition</strong> identifies what makes successful matches
          </p>
          <p>
            • <strong>Weight adjustment</strong> automatically improves future match quality
          </p>
          <p>
            • <strong>A/B testing</strong> validates improvements before rolling them out
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
