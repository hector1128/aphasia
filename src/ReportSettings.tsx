import { useState } from "react";
import { ChevronRight, FileText } from "lucide-react";
import { type Data, dateKey } from "./model";
import { reportData } from "./report-data";
import { weeklyReportData } from "./weekly";
import { weekDates } from "./date-time";
import { WeekPicker } from "./DateTimePicker";
import { SpeechField } from "./SpeechField";
import { cloud } from "./cloud";
export function ReportSettings({ data, onChange }: { data: Data; onChange: (data: Data) => void }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState<"day" | "week">("day");
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const date = period === "day" ? dateKey(new Date()) : selectedDate;
  const days = weekDates(date).map(dateKey);
  const title = period === "day" ? "today’s" : "weekly";
  const download = async () => {
    setBusy(true); setStatus("");
    try {
      const bytes = period === "day"
        ? await (await import("./report")).buildReportPdf(data, date)
        : await (await import("./report-week")).buildWeeklyReportPdf(data, date);
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url; link.download = `my-day-${period}-${period === "week" ? days[0] : date}.pdf`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setStatus("PDF downloaded.");
    } catch { setStatus("Could not create the PDF. Please try again."); }
    finally { setBusy(false); }
  };
  return <details className="settings-card report-settings">
    <summary><span className="settings-card-icon"><FileText aria-hidden="true" /></span><h2>Reports</h2><ChevronRight className="settings-chevron" aria-hidden="true" /></summary>
    <div className="settings-card-content">
    <div className="report-period" role="group" aria-label="Report period">
      {(["day", "week"] as const).map((option) => <button type="button" className="secondary" key={option}
        disabled={busy} aria-pressed={period === option} onClick={() => { setPeriod(option); setStatus(""); }}>
        {option === "day" ? "Daily" : "Weekly"}</button>)}
    </div>
    {period === "week" && <><WeekPicker value={selectedDate} onChange={setSelectedDate} max={dateKey(new Date())} />
      <p>{days[0]} to {days[6]}</p></>}
    <form onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setStatus("");
      try {
        const session = cloud ? (await cloud.auth.getSession()).data.session : null;
        const response = await fetch("/api/report", {
          method: "POST", headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
          body: JSON.stringify({ to: data.email.trim(), date, period,
            data: period === "week" ? weeklyReportData(data, date) : reportData(data, date) }),
        });
        const result = await response.json();
        setStatus(response.ok ? `Report accepted for delivery to ${data.email.trim()}.` : result.error || "Could not send. Please try again.");
      } catch { setStatus("Could not reach the email service. You can download the PDF."); }
      finally { setBusy(false); }
    }}>
      <label htmlFor="report-email">Email to send to</label>
      <SpeechField id="report-email" aria-label="Email to send to" type="email" autoComplete="email" required
        value={data.email} maxLength={254} onValueChange={(email) => onChange({ ...data, email })} />
      <button className="primary" disabled={busy}>{busy ? "Please wait…" : `Send ${title} report`}</button>
    </form>
    <button className="secondary" disabled={busy} onClick={download}>Download {title} PDF</button>
    {status && <p className="report-status" role="status">{status}</p>}
    </div>
  </details>;
}
