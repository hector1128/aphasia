import { useState } from "react";
import { Data, dateKey } from "./model";
import { reportData } from "./report-data";
export function ReportSettings({
  data,
  onChange,
}: {
  data: Data;
  onChange: (data: Data) => void;
}) {
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  const download = async () => {
    setBusy(true);
    try {
      const { buildReportPdf } = await import("./report");
      const bytes = await buildReportPdf(data, dateKey(new Date()));
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-day-${dateKey(new Date())}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setStatus("PDF downloaded.");
    } catch {
      setStatus("Could not create the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="report-settings">
      <h2>Daily report</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setStatus("");
          try {
            const date = dateKey(new Date());
            const response = await fetch("/api/report", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: data.email.trim(),
                date,
                data: reportData(data, date),
              }),
            });
            const result = await response.json();
            setStatus(
              response.ok
                ? `Report accepted for delivery to ${data.email.trim()}.`
                : result.error || "Could not send. Please try again.",
            );
          } catch {
            setStatus(
              "Could not reach the email service. You can download the PDF.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="report-email">Email to send to</label>
        <input
          id="report-email"
          type="email"
          autoComplete="email"
          required
          value={data.email}
          maxLength={254}
          onChange={(e) => onChange({ ...data, email: e.target.value })}
        />
        <button className="primary" disabled={busy}>
          {busy ? "Please wait…" : "Send today’s report"}
        </button>
      </form>
      <button className="secondary" disabled={busy} onClick={download}>
        Download today’s PDF
      </button>
      {status && (
        <p className="report-status" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
