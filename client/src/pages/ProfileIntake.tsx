import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Home, TrendingUp, Key, Building2, DollarSign,
  MapPin, BedDouble, Ruler, CheckCircle2, ArrowRight, ArrowLeft
} from "lucide-react";

type IntentType = "buying" | "selling" | "renting_out" | "renting" | "investing";

const INTENT_OPTIONS: { value: IntentType; label: string; labelAr: string; icon: React.ReactNode; description: string }[] = [
  { value: "buying", label: "I want to Buy", labelAr: "أريد الشراء", icon: <Home className="h-6 w-6" />, description: "Looking to purchase a property" },
  { value: "selling", label: "I want to Sell", labelAr: "أريد البيع", icon: <DollarSign className="h-6 w-6" />, description: "Have a property to sell" },
  { value: "renting", label: "I want to Rent", labelAr: "أريد الإيجار", icon: <Key className="h-6 w-6" />, description: "Looking to rent a property" },
  { value: "renting_out", label: "I want to Rent Out", labelAr: "أريد التأجير", icon: <Building2 className="h-6 w-6" />, description: "Have a property to rent out" },
  { value: "investing", label: "I want to Invest", labelAr: "أريد الاستثمار", icon: <TrendingUp className="h-6 w-6" />, description: "Looking for investment opportunities" },
];

const PROPERTY_TYPES = ["apartment", "villa", "duplex", "studio", "penthouse", "land", "shop", "office", "chalet", "townhouse"];
const LOCATIONS = ["مدينتي", "القاهرة الجديدة", "الرحاب", "مدينة نور", "العاصمة الإدارية", "الشيخ زايد", "6 أكتوبر", "المعادي", "الزمالك", "مدينة نصر", "هليوبوليس", "الساحل الشمالي", "العين السخنة"];

interface IntakeForm {
  intentType: IntentType | null;
  propertyType: string;
  location: string;
  priceMin: string;
  priceMax: string;
  sizeMin: string;
  sizeMax: string;
  bedrooms: string;
  notes: string;
}

export default function ProfileIntake() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<IntakeForm>({
    intentType: null,
    propertyType: "",
    location: "",
    priceMin: "",
    priceMax: "",
    sizeMin: "",
    sizeMax: "",
    bedrooms: "",
    notes: "",
  });

  const createIntake = trpc.intake.create.useMutation({
    onSuccess: () => {
      toast.success(`Your ${form.intentType} request has been created and matching has started.`);
      navigate("/matches");
    },
    onError: (err: { message: string }) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = () => {
    if (!form.intentType) return;
    createIntake.mutate({
      intentType: form.intentType,
      propertyType: form.propertyType || null,
      location: form.location || null,
      priceMin: form.priceMin ? parseFloat(form.priceMin) : null,
      priceMax: form.priceMax ? parseFloat(form.priceMax) : null,
      sizeMin: form.sizeMin ? parseInt(form.sizeMin) : null,
      sizeMax: form.sizeMax ? parseInt(form.sizeMax) : null,
      bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
      notes: form.notes || null,
    });
  };

  const isSeller = form.intentType === "selling" || form.intentType === "renting_out";
  const isBuyer = form.intentType === "buying" || form.intentType === "renting" || form.intentType === "investing";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">Smart Profile Intake</h1>
          <p className="text-muted-foreground mt-2">Tell us what you need — we'll match you instantly</p>
          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-2 rounded-full transition-all ${s <= step ? "w-8 bg-primary" : "w-4 bg-muted"}`} />
            ))}
          </div>
        </div>

        {/* Step 1: Intent Selection */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>What would you like to do?</CardTitle>
              <CardDescription>Select your primary intent — we'll tailor the form accordingly</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {INTENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setForm(f => ({ ...f, intentType: opt.value })); setStep(2); }}
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all hover:border-primary hover:bg-primary/5 ${
                      form.intentType === opt.value ? "border-primary bg-primary/10" : "border-border"
                    }`}
                  >
                    <div className="text-primary mt-0.5">{opt.icon}</div>
                    <div>
                      <div className="font-semibold text-foreground">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.labelAr}</div>
                      <div className="text-xs text-muted-foreground mt-1">{opt.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Property Details */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {INTENT_OPTIONS.find(o => o.value === form.intentType)?.icon}
                {INTENT_OPTIONS.find(o => o.value === form.intentType)?.label}
              </CardTitle>
              <CardDescription>Fill in the property details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Property Type */}
              <div>
                <Label>Property Type</Label>
                <Select value={form.propertyType} onValueChange={(v) => setForm(f => ({ ...f, propertyType: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location */}
              <div>
                <Label><MapPin className="h-3.5 w-3.5 inline mr-1" />Location</Label>
                <Select value={form.location} onValueChange={(v) => setForm(f => ({ ...f, location: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select area..." />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATIONS.map(l => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Price Range */}
              <div>
                <Label><DollarSign className="h-3.5 w-3.5 inline mr-1" />
                  {isBuyer ? "Budget Range (EGP)" : "Asking Price (EGP)"}
                </Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Input
                    placeholder={isBuyer ? "Min budget" : "Price"}
                    value={form.priceMin}
                    onChange={(e) => setForm(f => ({ ...f, priceMin: e.target.value }))}
                    type="number"
                  />
                  {isBuyer && (
                    <Input
                      placeholder="Max budget"
                      value={form.priceMax}
                      onChange={(e) => setForm(f => ({ ...f, priceMax: e.target.value }))}
                      type="number"
                    />
                  )}
                </div>
              </div>

              {/* Size */}
              <div>
                <Label><Ruler className="h-3.5 w-3.5 inline mr-1" />Size (m²)</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Input
                    placeholder="Min size"
                    value={form.sizeMin}
                    onChange={(e) => setForm(f => ({ ...f, sizeMin: e.target.value }))}
                    type="number"
                  />
                  <Input
                    placeholder="Max size"
                    value={form.sizeMax}
                    onChange={(e) => setForm(f => ({ ...f, sizeMax: e.target.value }))}
                    type="number"
                  />
                </div>
              </div>

              {/* Bedrooms */}
              <div>
                <Label><BedDouble className="h-3.5 w-3.5 inline mr-1" />Bedrooms</Label>
                <Select value={form.bedrooms} onValueChange={(v) => setForm(f => ({ ...f, bedrooms: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Number of bedrooms..." />
                  </SelectTrigger>
                  <SelectContent>
                    {["1", "2", "3", "4", "5", "6+"].map(n => (
                      <SelectItem key={n} value={n}>{n} bedroom{n !== "1" ? "s" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button onClick={() => setStep(3)} className="flex-1">
                  Continue <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Notes + Confirm */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Review & Submit
              </CardTitle>
              <CardDescription>Add any additional notes, then submit to start matching</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Intent</span>
                  <Badge variant="outline">{INTENT_OPTIONS.find(o => o.value === form.intentType)?.label}</Badge>
                </div>
                {form.propertyType && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Property Type</span>
                    <span className="font-medium capitalize">{form.propertyType}</span>
                  </div>
                )}
                {form.location && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location</span>
                    <span className="font-medium">{form.location}</span>
                  </div>
                )}
                {(form.priceMin || form.priceMax) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Price</span>
                    <span className="font-medium">
                      {form.priceMin ? `${Number(form.priceMin).toLocaleString()} EGP` : ""}
                      {form.priceMin && form.priceMax ? " – " : ""}
                      {form.priceMax ? `${Number(form.priceMax).toLocaleString()} EGP` : ""}
                    </span>
                  </div>
                )}
                {form.bedrooms && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bedrooms</span>
                    <span className="font-medium">{form.bedrooms}</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <Label>Additional Notes (optional)</Label>
                <Textarea
                  placeholder="Any specific requirements, preferred floor, view, finishing, timeline..."
                  value={form.notes}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createIntake.isPending || !form.intentType}
                  className="flex-1"
                >
                  {createIntake.isPending ? "Submitting..." : "Submit & Start Matching"}
                  {!createIntake.isPending && <CheckCircle2 className="h-4 w-4 ml-1" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
