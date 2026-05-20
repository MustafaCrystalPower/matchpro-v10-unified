import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, Clock, FileText, Shield, Users, Gavel, Download, ChevronDown, ChevronUp, History } from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChecklistItem {
  id: string;
  label: string;
  deadline: string;
  critical: boolean;
  done: boolean;
}

interface AuditEntry {
  id: string;
  label: string;
  action: "completed" | "uncompleted";
  timestamp: string;
  user: string;
}

interface DPOForm {
  fullName: string;
  employeeId: string;
  position: string;
  nationalId: string;
  email: string;
  phone: string;
  appointmentDate: string;
  ceoName: string;
  ceoDate: string;
}

interface ConsentRecord {
  fullName: string;
  whatsappNumber: string;
  consentDate: string;
  ipDevice: string;
  serviceMessages: boolean;
  marketingComms: boolean;
  dataProcessing: boolean;
  language: "en" | "ar";
}

interface BrokerAgreement {
  brokerName: string;
  licenseNo: string;
  address: string;
  phone: string;
  email: string;
  signDate: string;
  cpiRepDate: string;
}

// ─── Initial checklist data ────────────────────────────────────────────────────
const INITIAL_CHECKLIST: ChecklistItem[] = [
  { id: "w1_1", label: "Select and appoint DPO from Crystal Power team", deadline: "Day 1-2", critical: true, done: false },
  { id: "w1_2", label: "Draft DPO appointment letter using provided template", deadline: "Day 1-2", critical: true, done: false },
  { id: "w1_3", label: "Prepare public DPO announcement for website", deadline: "Day 1-2", critical: false, done: false },
  { id: "w1_4", label: "Contact legal counsel (Matouk Bassiouny or Shehata & Partners)", deadline: "Day 3", critical: true, done: false },
  { id: "w1_5", label: "Gather corporate documents for PDPC applications", deadline: "Day 3-5", critical: true, done: false },
  { id: "w1_6", label: "Apply for WhatsApp Business Account", deadline: "Day 6-7", critical: true, done: false },
  { id: "w1_7", label: "Draft Arabic/English consent forms", deadline: "Day 6-7", critical: true, done: false },
  { id: "w2_1", label: "Sign retainer agreement with chosen law firm", deadline: "Week 2", critical: true, done: false },
  { id: "w2_2", label: "Submit DPO registration to PDPC", deadline: "Week 2", critical: true, done: false },
  { id: "w2_3", label: "Submit all 4 PDPC license applications", deadline: "Week 2", critical: true, done: false },
  { id: "w2_4", label: "Pay PDPC application fees (budget EGP 500K–2M)", deadline: "Week 2", critical: true, done: false },
  { id: "w2_5", label: "Contact Egypt Real Estate Oversight Unit", deadline: "Week 2", critical: false, done: false },
  { id: "w3_1", label: "Deploy field-level encryption (AES-256) for personal data", deadline: "Week 3-4", critical: true, done: false },
  { id: "w3_2", label: "Implement JWT/OAuth 2.0 secure authentication", deadline: "Week 3-4", critical: false, done: true },
  { id: "w3_3", label: "Set up comprehensive access/modification audit logs", deadline: "Week 3-4", critical: false, done: true },
  { id: "w3_4", label: "Complete WhatsApp Business Manager verification", deadline: "Week 3-4", critical: true, done: false },
  { id: "w3_5", label: "Create and submit WhatsApp message templates", deadline: "Week 3-4", critical: false, done: false },
  { id: "w3_6", label: "Build automated consent capture and logging system", deadline: "Week 3-4", critical: true, done: true },
  { id: "m2_1", label: "Receive PDPC license approvals (90-day max)", deadline: "Month 2-3", critical: true, done: false },
  { id: "m2_2", label: "Implement broker license verification system", deadline: "Month 2-3", critical: true, done: false },
  { id: "m2_3", label: "Execute broker partnership data agreements", deadline: "Month 2-3", critical: true, done: false },
  { id: "m2_4", label: "Pilot launch with 20-30 verified brokers", deadline: "Month 2-3", critical: false, done: false },
  { id: "m2_5", label: "Activate compliance tracking dashboards", deadline: "Month 2-3", critical: false, done: true },
  { id: "og_1", label: "Monthly PDPL compliance audit and reporting", deadline: "Monthly", critical: false, done: false },
  { id: "og_2", label: "Monthly WhatsApp template quality score review", deadline: "Monthly", critical: false, done: false },
  { id: "og_3", label: "Quarterly security assessment and penetration testing", deadline: "Quarterly", critical: true, done: false },
  { id: "og_4", label: "Semi-annual legal counsel review of regulatory changes", deadline: "Semi-Annual", critical: false, done: false },
  { id: "og_5", label: "Annual license renewals and compliance certification", deadline: "Annual", critical: true, done: false },
];

const RISKS = [
  { label: "Operating without licenses", fine: "EGP 500K – 5M", usd: "$16K–$162K", severity: "critical" },
  { label: "No DPO appointment", fine: "EGP 200K – 2M", usd: "$6.5K–$65K", severity: "high" },
  { label: "WhatsApp consent violations", fine: "EGP 200K – 2M", usd: "$6.5K–$65K", severity: "high" },
  { label: "Data breach without 72h notification", fine: "EGP 300K – 3M", usd: "$10K–$97K", severity: "critical" },
];

const SECTIONS = [
  { key: "week1", label: "Week 1 — Critical Path Initiation", ids: ["w1_1","w1_2","w1_3","w1_4","w1_5","w1_6","w1_7"] },
  { key: "week2", label: "Week 2 — Formal Applications", ids: ["w2_1","w2_2","w2_3","w2_4","w2_5"] },
  { key: "week34", label: "Week 3-4 — Technical Implementation", ids: ["w3_1","w3_2","w3_3","w3_4","w3_5","w3_6"] },
  { key: "month23", label: "Month 2-3 — Operations Launch", ids: ["m2_1","m2_2","m2_3","m2_4","m2_5"] },
  { key: "ongoing", label: "Ongoing Compliance Monitoring", ids: ["og_1","og_2","og_3","og_4","og_5"] },
];

export default function Compliance() {
  const [checklist, setChecklist] = useState<ChecklistItem[]>(INITIAL_CHECKLIST);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [activeTab, setActiveTab] = useState("checklist");
  const [expandedSection, setExpandedSection] = useState<string | null>("week1");
  const [showAuditLog, setShowAuditLog] = useState(false);

  const [dpo, setDpo] = useState<DPOForm>({
    fullName: "", employeeId: "", position: "", nationalId: "",
    email: "", phone: "", appointmentDate: "", ceoName: "Mo'men Maisara", ceoDate: "",
  });

  const [consent, setConsent] = useState<ConsentRecord>({
    fullName: "", whatsappNumber: "", consentDate: new Date().toISOString().split("T")[0],
    ipDevice: "", serviceMessages: false, marketingComms: false, dataProcessing: false, language: "en",
  });
  const [savedConsents, setSavedConsents] = useState<ConsentRecord[]>([]);

  const [broker, setBroker] = useState<BrokerAgreement>({
    brokerName: "", licenseNo: "", address: "", phone: "", email: "",
    signDate: "", cpiRepDate: new Date().toISOString().split("T")[0],
  });
  const [savedBrokers, setSavedBrokers] = useState<BrokerAgreement[]>([]);

  const completedCount = checklist.filter(i => i.done).length;
  const totalCount = checklist.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);
  const criticalPending = checklist.filter(i => i.critical && !i.done).length;

  const toggleItem = (id: string) => {
    const item = checklist.find(i => i.id === id);
    if (!item) return;
    const newDone = !item.done;
    const now = new Date();
    const timestamp = now.toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    setChecklist(prev => prev.map(i => i.id === id ? { ...i, done: newDone } : i));
    setAuditLog(prev => [{
      id: `${id}_${Date.now()}`,
      label: item.label,
      action: newDone ? "completed" : "uncompleted",
      timestamp,
      user: "Mo'men Maisara",
    }, ...prev]);
    toast.success(newDone ? `✅ Marked complete: ${item.label.slice(0, 40)}...` : `↩ Reverted: ${item.label.slice(0, 40)}...`);
  };

  const handleExportAuditLog = () => {
    if (auditLog.length === 0) { toast.error("No audit entries yet"); return; }
    const header = "Timestamp,User,Action,Task\n";
    const rows = auditLog.map(e => `"${e.timestamp}","${e.user}","${e.action}","${e.label}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PDPL_Audit_Log_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${auditLog.length} audit entries`);
  };

  const handleSaveConsent = () => {
    if (!consent.fullName || !consent.whatsappNumber) { toast.error("Full name and WhatsApp number are required"); return; }
    if (!consent.serviceMessages && !consent.marketingComms && !consent.dataProcessing) { toast.error("At least one consent type must be selected"); return; }
    setSavedConsents(prev => [...prev, { ...consent }]);
    toast.success("Consent record saved successfully");
    setConsent({ fullName: "", whatsappNumber: "", consentDate: new Date().toISOString().split("T")[0], ipDevice: "", serviceMessages: false, marketingComms: false, dataProcessing: false, language: "en" });
  };

  const handleSaveBroker = () => {
    if (!broker.brokerName || !broker.licenseNo || !broker.phone) { toast.error("Broker name, license number, and phone are required"); return; }
    setSavedBrokers(prev => [...prev, { ...broker }]);
    toast.success("Broker agreement saved");
    setBroker({ brokerName: "", licenseNo: "", address: "", phone: "", email: "", signDate: "", cpiRepDate: new Date().toISOString().split("T")[0] });
  };

  const handleExportDPO = () => {
    if (!dpo.fullName || !dpo.nationalId || !dpo.appointmentDate) { toast.error("Fill in Full Name, National ID, and Appointment Date before exporting"); return; }
    const content = `CRYSTAL POWER INVESTMENTS LLC\nCairo, Arab Republic of Egypt\nDate: ${dpo.appointmentDate}\n\nAPPOINTMENT OF DATA PROTECTION OFFICER\n(Article 8 — Egypt PDPL No. 151/2020)\n\nFull Name: ${dpo.fullName}\nEmployee ID: ${dpo.employeeId}\nPosition/Title: ${dpo.position}\nEgyptian National ID: ${dpo.nationalId}\nEmail: ${dpo.email}\nPhone: ${dpo.phone}\n\nDPO RESPONSIBILITIES (Article 9 PDPL):\n• Implementing provisions of PDPL, executive regulations, and PDPC decisions\n• Monitoring and supervising internal data protection procedures\n• Conducting regular assessments of data protection systems\n• Acting as main contact point with the PDPC\n• Enabling Data Subjects to exercise their legal rights\n• Notifying PDPC of data breaches within 72 hours\n• Maintaining data registers and processing operation records\n• Organizing employee training on data protection compliance\n\nLegal Representative: ${dpo.ceoName}          Data Protection Officer: ${dpo.fullName}\nCrystal Power Investments LLC                  (Acceptance of Appointment)\nDate: ${dpo.ceoDate}                           Date: ${dpo.appointmentDate}\n`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DPO_Appointment_${dpo.fullName.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("DPO Appointment Letter exported");
  };

  const handleExportConsents = () => {
    if (savedConsents.length === 0) { toast.error("No consent records to export"); return; }
    const header = "Full Name,WhatsApp Number,Date,Language,Service Messages,Marketing,Data Processing,Device/IP\n";
    const rows = savedConsents.map(c => `"${c.fullName}","${c.whatsappNumber}","${c.consentDate}","${c.language}","${c.serviceMessages ? "Yes" : "No"}","${c.marketingComms ? "Yes" : "No"}","${c.dataProcessing ? "Yes" : "No"}","${c.ipDevice}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Consent_Records_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${savedConsents.length} consent records`);
  };

  const handleExportBrokers = () => {
    if (savedBrokers.length === 0) { toast.error("No broker agreements to export"); return; }
    const header = "Broker Name,License No,Address,Phone,Email,Signed Date,CPI Rep Date\n";
    const rows = savedBrokers.map(b => `"${b.brokerName}","${b.licenseNo}","${b.address}","${b.phone}","${b.email}","${b.signDate}","${b.cpiRepDate}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Broker_Agreements_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${savedBrokers.length} broker agreements`);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            PDPL Legal Compliance
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Egypt Personal Data Protection Law No. 151/2020 — Crystal Power Investments</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {criticalPending > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="w-3 h-3" />
              {criticalPending} Critical Pending
            </Badge>
          )}
          <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
            <CheckCircle2 className="w-3 h-3" />
            {completedCount}/{totalCount} Complete
          </Badge>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowAuditLog(v => !v)}>
            <History className="w-3 h-3" />
            Audit Log ({auditLog.length})
          </Button>
        </div>
      </div>

      {/* Audit Log Panel */}
      {showAuditLog && (
        <Card className="border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600" />
              Compliance Audit Log
            </CardTitle>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleExportAuditLog}>
              <Download className="w-3 h-3" />Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            {auditLog.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No actions logged yet. Check off tasks to create audit entries.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {auditLog.map(entry => (
                  <div key={entry.id} className="flex items-start gap-2 text-xs py-1 border-b border-blue-100 dark:border-blue-900 last:border-0">
                    <span className={`shrink-0 font-medium ${entry.action === "completed" ? "text-green-600" : "text-orange-500"}`}>
                      {entry.action === "completed" ? "✅" : "↩"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-foreground">{entry.label}</span>
                      <div className="text-muted-foreground mt-0.5">
                        {entry.user} · {entry.timestamp}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Progress + Risk Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Overall Compliance Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-2">
              <Progress value={progressPct} className="flex-1 h-3" />
              <span className="text-lg font-bold text-primary">{progressPct}%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {completedCount} of {totalCount} tasks completed · {criticalPending} critical items still pending · {auditLog.length} audit entries
            </p>
          </CardContent>
        </Card>
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />Risk Exposure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {RISKS.map((r, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-muted-foreground truncate max-w-[55%]">{r.label}</span>
                <span className={`font-semibold ${r.severity === "critical" ? "text-destructive" : "text-orange-500"}`}>{r.fine}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Budget */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "PDPC Licenses", amount: "$65K–$260K", icon: "📋" },
          { label: "Legal Counsel", amount: "$15K–$25K", icon: "⚖️" },
          { label: "Technical Security", amount: "$30K–$50K", icon: "🔐" },
          { label: "Annual Ongoing", amount: "$65K–$105K/yr", icon: "📅" },
        ].map((b, i) => (
          <Card key={i} className="text-center p-3">
            <div className="text-2xl mb-1">{b.icon}</div>
            <div className="text-xs text-muted-foreground">{b.label}</div>
            <div className="text-sm font-bold text-primary mt-1">{b.amount}</div>
          </Card>
        ))}
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="checklist" className="text-xs md:text-sm"><CheckCircle2 className="w-3 h-3 mr-1" />Checklist</TabsTrigger>
          <TabsTrigger value="dpo" className="text-xs md:text-sm"><Users className="w-3 h-3 mr-1" />DPO Form</TabsTrigger>
          <TabsTrigger value="consent" className="text-xs md:text-sm"><FileText className="w-3 h-3 mr-1" />Consent</TabsTrigger>
          <TabsTrigger value="broker" className="text-xs md:text-sm"><Gavel className="w-3 h-3 mr-1" />Brokers</TabsTrigger>
        </TabsList>

        {/* CHECKLIST */}
        <TabsContent value="checklist" className="space-y-3 mt-4">
          {SECTIONS.map(section => {
            const items = checklist.filter(i => section.ids.includes(i.id));
            const sectionDone = items.filter(i => i.done).length;
            const isOpen = expandedSection === section.key;
            return (
              <Card key={section.key}>
                <button className="w-full text-left" onClick={() => setExpandedSection(isOpen ? null : section.key)}>
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">{section.label}</span>
                        <Badge variant={sectionDone === items.length ? "default" : "secondary"} className="text-xs">{sectionDone}/{items.length}</Badge>
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </CardHeader>
                </button>
                {isOpen && (
                  <CardContent className="pt-0 pb-4 px-4 space-y-2">
                    {items.map(item => (
                      <div key={item.id} className={`flex items-start gap-3 p-2 rounded-lg border ${item.done ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900" : item.critical ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900" : "border-border"}`}>
                        <Checkbox checked={item.done} onCheckedChange={() => toggleItem(item.id)} className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.label}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs py-0">{item.deadline}</Badge>
                            {item.critical && !item.done && <Badge variant="destructive" className="text-xs py-0">Critical</Badge>}
                            {item.done && (() => {
                              const entry = auditLog.find(e => e.id.startsWith(item.id) && e.action === "completed");
                              return entry ? <span className="text-xs text-muted-foreground">✅ {entry.timestamp}</span> : null;
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </TabsContent>

        {/* DPO FORM */}
        <TabsContent value="dpo" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" />DPO Appointment Letter</CardTitle>
              <CardDescription>Article 8 — Egypt PDPL No. 151/2020 · Crystal Power Investments LLC</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: "Full Name *", key: "fullName" as const, placeholder: "DPO Full Name" },
                  { label: "Employee ID", key: "employeeId" as const, placeholder: "EMP-001" },
                  { label: "Position / Title", key: "position" as const, placeholder: "Data Protection Officer" },
                  { label: "Egyptian National ID *", key: "nationalId" as const, placeholder: "14-digit National ID" },
                  { label: "Email", key: "email" as const, placeholder: "dpo@crystalpower.eg" },
                  { label: "Phone", key: "phone" as const, placeholder: "+20 1X XXXX XXXX" },
                  { label: "CEO Name", key: "ceoName" as const, placeholder: "Mo'men Maisara" },
                ].map(field => (
                  <div key={field.key} className="space-y-1">
                    <Label>{field.label}</Label>
                    <Input placeholder={field.placeholder} value={dpo[field.key]} onChange={e => setDpo(p => ({ ...p, [field.key]: e.target.value }))} />
                  </div>
                ))}
                <div className="space-y-1">
                  <Label>Appointment Date *</Label>
                  <Input type="date" value={dpo.appointmentDate} onChange={e => setDpo(p => ({ ...p, appointmentDate: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>CEO Signature Date</Label>
                  <Input type="date" value={dpo.ceoDate} onChange={e => setDpo(p => ({ ...p, ceoDate: e.target.value }))} />
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
                <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">DPO Responsibilities (Article 9 PDPL)</p>
                {["Implementing PDPL provisions and PDPC decisions","Monitoring internal data protection procedures","Acting as main contact point with the PDPC","Notifying PDPC of data breaches within 72 hours","Enabling Data Subjects to exercise their legal rights","Maintaining data registers and processing records","Organizing employee training on data protection"].map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" /><span>{r}</span>
                  </div>
                ))}
              </div>
              <Button onClick={handleExportDPO} className="w-full gap-2"><Download className="w-4 h-4" />Export DPO Appointment Letter (.txt)</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONSENT FORM */}
        <TabsContent value="consent" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-primary" />WhatsApp Consent Form</CardTitle>
              <CardDescription>PDPL Articles 17-18 — Explicit opt-in consent required before any communication</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button size="sm" variant={consent.language === "en" ? "default" : "outline"} onClick={() => setConsent(p => ({ ...p, language: "en" }))}>English</Button>
                <Button size="sm" variant={consent.language === "ar" ? "default" : "outline"} onClick={() => setConsent(p => ({ ...p, language: "ar" }))}>العربية</Button>
              </div>
              {consent.language === "ar" && (
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-3 text-right" dir="rtl">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">نموذج الموافقة على التواصل عبر واتساب</p>
                  <p className="text-xs text-muted-foreground mt-1">شركة كريستال باور للاستثمارات م.م.ش — منصة ماتش برو</p>
                  <p className="text-xs mt-2">بموجب قانون حماية البيانات الشخصية رقم 151 لسنة 2020</p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1"><Label>{consent.language === "ar" ? "الاسم الكامل *" : "Full Name *"}</Label><Input placeholder={consent.language === "ar" ? "الاسم الكامل" : "Full Name"} value={consent.fullName} onChange={e => setConsent(p => ({ ...p, fullName: e.target.value }))} /></div>
                <div className="space-y-1"><Label>{consent.language === "ar" ? "رقم واتساب *" : "WhatsApp Number *"}</Label><Input placeholder="+201XXXXXXXXX" value={consent.whatsappNumber} onChange={e => setConsent(p => ({ ...p, whatsappNumber: e.target.value }))} /></div>
                <div className="space-y-1"><Label>{consent.language === "ar" ? "تاريخ الموافقة" : "Date of Consent"}</Label><Input type="date" value={consent.consentDate} onChange={e => setConsent(p => ({ ...p, consentDate: e.target.value }))} /></div>
                <div className="space-y-1"><Label>{consent.language === "ar" ? "معرف الجهاز / IP" : "IP Address / Device ID"}</Label><Input placeholder="Auto-captured in production" value={consent.ipDevice} onChange={e => setConsent(p => ({ ...p, ipDevice: e.target.value }))} /></div>
              </div>
              <div className="space-y-3 border rounded-lg p-4">
                <p className="text-sm font-semibold">{consent.language === "ar" ? "الموافقة على:" : "Consent to:"}</p>
                {[
                  { key: "serviceMessages" as const, en: "Service Messages — account updates, property inquiries, platform notifications", ar: "رسائل الخدمة — تحديثات الحساب والاستفسارات العقارية والإشعارات" },
                  { key: "marketingComms" as const, en: "Marketing Communications — new features, market reports, training opportunities", ar: "الاتصالات التسويقية — الميزات الجديدة وتقارير السوق وفرص التدريب" },
                  { key: "dataProcessing" as const, en: "Data Processing — WhatsApp number, message content, metadata for MatchPro™ services", ar: "معالجة البيانات — رقم واتساب ومحتوى الرسائل والبيانات الوصفية لخدمات ماتش برو" },
                ].map(item => (
                  <div key={item.key} className="flex items-start gap-3">
                    <Checkbox checked={consent[item.key]} onCheckedChange={v => setConsent(p => ({ ...p, [item.key]: !!v }))} className="mt-0.5" />
                    <label className="text-sm cursor-pointer" onClick={() => setConsent(p => ({ ...p, [item.key]: !p[item.key] }))}>{consent.language === "ar" ? item.ar : item.en}</label>
                  </div>
                ))}
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold">Data Controller: Crystal Power Investments LLC | DPO: dpo@crystalpower.eg</p>
                <p>Retention: Duration of service + 3 years · Opt-out: Send "STOP" via WhatsApp</p>
                <p>Rights: Access · Correct · Delete · Object · Withdraw consent · Lodge PDPC complaint</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveConsent} className="flex-1 gap-2"><CheckCircle2 className="w-4 h-4" />Save Consent Record</Button>
                <Button variant="outline" onClick={handleExportConsents} className="gap-2"><Download className="w-4 h-4" />Export CSV ({savedConsents.length})</Button>
              </div>
              {savedConsents.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted"><tr><th className="text-left p-2">Name</th><th className="text-left p-2">WhatsApp</th><th className="text-left p-2">Date</th><th className="text-left p-2">Consents</th></tr></thead>
                    <tbody>{savedConsents.map((c, i) => (<tr key={i} className="border-t"><td className="p-2">{c.fullName}</td><td className="p-2">{c.whatsappNumber}</td><td className="p-2">{c.consentDate}</td><td className="p-2">{[c.serviceMessages && "Svc", c.marketingComms && "Mkt", c.dataProcessing && "Data"].filter(Boolean).join(", ")}</td></tr>))}</tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* BROKER AGREEMENT */}
        <TabsContent value="broker" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Gavel className="w-5 h-5 text-primary" />Broker Data Processing Agreement</CardTitle>
              <CardDescription>Joint controller agreement per PDPL — required for all broker partners</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: "Broker / Company Name *", key: "brokerName" as const, placeholder: "Broker or company name" },
                  { label: "Real Estate License No. *", key: "licenseNo" as const, placeholder: "License number" },
                  { label: "Address", key: "address" as const, placeholder: "Business address" },
                  { label: "Phone *", key: "phone" as const, placeholder: "+201XXXXXXXXX" },
                  { label: "Email", key: "email" as const, placeholder: "broker@example.com" },
                ].map(field => (
                  <div key={field.key} className="space-y-1">
                    <Label>{field.label}</Label>
                    <Input placeholder={field.placeholder} value={broker[field.key]} onChange={e => setBroker(p => ({ ...p, [field.key]: e.target.value }))} />
                  </div>
                ))}
                <div className="space-y-1"><Label>Broker Signature Date</Label><Input type="date" value={broker.signDate} onChange={e => setBroker(p => ({ ...p, signDate: e.target.value }))} /></div>
                <div className="space-y-1"><Label>CPI Representative Date</Label><Input type="date" value={broker.cpiRepDate} onChange={e => setBroker(p => ({ ...p, cpiRepDate: e.target.value }))} /></div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Agreement Scope</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div><p className="font-medium text-foreground mb-1">Data Categories</p>{["Client contact info (names, phones, emails)","Property requirements and preferences","WhatsApp conversation logs","Transaction history and pipeline status"].map((d,i) => <p key={i}>• {d}</p>)}</div>
                  <div><p className="font-medium text-foreground mb-1">Broker Obligations</p>{["Obtain valid consent from clients","Maintain current real estate license","Report suspected breaches immediately","Use data only for agreed purposes"].map((d,i) => <p key={i}>• {d}</p>)}</div>
                </div>
                <p className="text-xs text-muted-foreground pt-2 border-t">Term: Duration of broker's use of MatchPro™ · Termination: 30 days written notice · Data deletion: within 90 days of termination</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveBroker} className="flex-1 gap-2"><CheckCircle2 className="w-4 h-4" />Save Broker Agreement</Button>
                <Button variant="outline" onClick={handleExportBrokers} className="gap-2"><Download className="w-4 h-4" />Export CSV ({savedBrokers.length})</Button>
              </div>
              {savedBrokers.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted"><tr><th className="text-left p-2">Broker</th><th className="text-left p-2">License</th><th className="text-left p-2">Phone</th><th className="text-left p-2">Signed</th></tr></thead>
                    <tbody>{savedBrokers.map((b, i) => (<tr key={i} className="border-t"><td className="p-2">{b.brokerName}</td><td className="p-2">{b.licenseNo}</td><td className="p-2">{b.phone}</td><td className="p-2">{b.signDate || "—"}</td></tr>))}</tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-4">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-2">⚠ Legal Review Required — Contact Before Execution</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div><p className="font-medium text-foreground">Matouk Bassiouny & Hennawy</p><p>+20 2 2574-2397</p></div>
                <div><p className="font-medium text-foreground">Shehata & Partners</p><p>Cairo, Egypt</p></div>
                <div><p className="font-medium text-foreground">Andersen Egypt</p><p>Cairo, Egypt</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
