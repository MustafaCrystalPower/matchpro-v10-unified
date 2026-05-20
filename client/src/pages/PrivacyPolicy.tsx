export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">M</div>
            <div>
              <p className="font-bold text-sm">MatchPro Intelligence Engine™</p>
              <p className="text-xs text-muted-foreground">Crystal Power Investments LLC</p>
            </div>
          </div>
          <a href="/" className="text-xs text-primary hover:underline">← Back to Dashboard</a>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm">Effective Date: 1 April 2026 · Last Updated: 28 March 2026</p>
          <p className="text-muted-foreground text-sm mt-1">Governed by Egypt Personal Data Protection Law No. 151/2020 (PDPL)</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold border-b pb-2">1. Data Controller</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Crystal Power Investments LLC</strong> ("CPI", "we", "us") is the Data Controller for all personal data processed through the MatchPro Intelligence Engine™ platform. Our Data Protection Officer (DPO) can be contacted at <a href="mailto:dpo@crystalpower.eg" className="text-primary hover:underline">dpo@crystalpower.eg</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold border-b pb-2">2. Data We Collect</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-muted"><th className="text-left p-3 border">Category</th><th className="text-left p-3 border">Examples</th><th className="text-left p-3 border">Legal Basis (PDPL Art. 4)</th></tr></thead>
              <tbody>
                {[
                  ["Identity Data", "Full name, national ID, professional license", "Contractual necessity"],
                  ["Contact Data", "WhatsApp number, email, phone", "Consent (Art. 17-18)"],
                  ["Property Data", "Listings, requirements, price ranges, location", "Legitimate interests"],
                  ["Communication Data", "WhatsApp message content, timestamps", "Consent (Art. 17-18)"],
                  ["Technical Data", "IP address, device identifiers, session logs", "Legitimate interests"],
                  ["Transaction Data", "Match history, pipeline stage, contact records", "Contractual necessity"],
                ].map(([cat, ex, basis], i) => (
                  <tr key={i} className="border-b hover:bg-muted/30">
                    <td className="p-3 border font-medium">{cat}</td>
                    <td className="p-3 border text-muted-foreground">{ex}</td>
                    <td className="p-3 border text-muted-foreground">{basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold border-b pb-2">3. How We Use Your Data</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              "Matching real estate supply (sellers/landlords) with demand (buyers/tenants) using AI-powered analysis",
              "Sending WhatsApp notifications about relevant property matches",
              "Generating market intelligence reports and analytics for platform users",
              "Verifying broker licenses and managing broker onboarding",
              "Maintaining compliance records as required by Egyptian law",
              "Improving platform accuracy and performance through anonymised analytics",
            ].map((use, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>{use}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold border-b pb-2">4. WhatsApp Data Processing</h2>
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4 text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-200 mb-2">Important Notice — WhatsApp Communications</p>
            <p className="text-muted-foreground leading-relaxed">
              MatchPro™ processes WhatsApp messages sent to groups monitored by Crystal Power Investments for the purpose of real estate matching. By participating in these groups, you consent to the processing of your messages. You may withdraw consent at any time by sending <strong>"STOP"</strong> via WhatsApp to <strong>+20 10 6650 5665</strong> or by contacting our DPO.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold border-b pb-2">5. Data Retention</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-muted"><th className="text-left p-3 border">Data Type</th><th className="text-left p-3 border">Retention Period</th></tr></thead>
              <tbody>
                {[
                  ["Active user accounts", "Duration of account + 3 years"],
                  ["WhatsApp message logs", "2 years from date of receipt"],
                  ["Match records", "5 years (regulatory requirement)"],
                  ["Consent records", "Duration of consent + 5 years"],
                  ["Broker agreements", "Duration of partnership + 7 years"],
                  ["Audit logs", "7 years"],
                ].map(([type, period], i) => (
                  <tr key={i} className="border-b hover:bg-muted/30">
                    <td className="p-3 border font-medium">{type}</td>
                    <td className="p-3 border text-muted-foreground">{period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold border-b pb-2">6. Your Rights Under PDPL</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { right: "Right of Access (Art. 20)", desc: "Request a copy of your personal data we hold" },
              { right: "Right to Correction (Art. 21)", desc: "Request correction of inaccurate or incomplete data" },
              { right: "Right to Erasure (Art. 22)", desc: "Request deletion of your data where legally permitted" },
              { right: "Right to Object (Art. 23)", desc: "Object to processing based on legitimate interests" },
              { right: "Right to Withdraw Consent", desc: "Withdraw consent at any time without affecting prior processing" },
              { right: "Right to Lodge a Complaint", desc: "File a complaint with the Personal Data Protection Centre (PDPC)" },
            ].map((item, i) => (
              <div key={i} className="border rounded-lg p-3 bg-card">
                <p className="font-semibold text-sm">{item.right}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">To exercise any right, contact: <a href="mailto:dpo@crystalpower.eg" className="text-primary hover:underline">dpo@crystalpower.eg</a> · We will respond within 30 days.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold border-b pb-2">7. Data Security</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We implement industry-standard security measures including TLS 1.3 encryption in transit, AES-256 encryption at rest, JWT-based authentication with session expiry, role-based access controls, and comprehensive audit logging. In the event of a data breach, we will notify the PDPC within 72 hours and affected individuals without undue delay, as required by PDPL Article 24.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold border-b pb-2">8. Third-Party Services</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-muted"><th className="text-left p-3 border">Service</th><th className="text-left p-3 border">Purpose</th><th className="text-left p-3 border">Data Shared</th></tr></thead>
              <tbody>
                {[
                  ["WhatsApp Business API (via authorised provider)", "Message delivery and receipt", "Phone numbers, message content"],
                  ["Cloud hosting provider", "Platform infrastructure", "All platform data (encrypted)"],
                  ["Email delivery service", "Report and notification delivery", "Email addresses, report content"],
                ].map(([svc, purpose, data], i) => (
                  <tr key={i} className="border-b hover:bg-muted/30">
                    <td className="p-3 border font-medium">{svc}</td>
                    <td className="p-3 border text-muted-foreground">{purpose}</td>
                    <td className="p-3 border text-muted-foreground">{data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold border-b pb-2">9. Contact Us</h2>
          <div className="bg-card border rounded-lg p-4 text-sm space-y-2">
            <p><strong>Crystal Power Investments LLC</strong></p>
            <p className="text-muted-foreground">Cairo, Arab Republic of Egypt</p>
            <p>DPO Email: <a href="mailto:dpo@crystalpower.eg" className="text-primary hover:underline">dpo@crystalpower.eg</a></p>
            <p>General: <a href="mailto:mmaisara@crystalpowerinvestment.com" className="text-primary hover:underline">mmaisara@crystalpowerinvestment.com</a></p>
            <p className="text-muted-foreground text-xs mt-2">Personal Data Protection Centre (PDPC): <a href="https://pdpc.gov.eg" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">pdpc.gov.eg</a></p>
          </div>
        </section>

        <section className="space-y-2 text-xs text-muted-foreground border-t pt-6">
          <p>This Privacy Policy is governed by the Arab Republic of Egypt Personal Data Protection Law No. 151/2020 and its Executive Regulations. Any disputes shall be subject to Egyptian jurisdiction.</p>
          <p>Arabic version available upon request: <a href="mailto:dpo@crystalpower.eg" className="text-primary hover:underline">dpo@crystalpower.eg</a></p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card mt-10">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
          <p>© 2026 Crystal Power Investments LLC · MatchPro Intelligence Engine™ · All rights reserved.</p>
          <p className="mt-1">Protected under Egyptian Law No. 82/2002 (Copyright) and Law No. 151/2020 (PDPL)</p>
        </div>
      </footer>
    </div>
  );
}
