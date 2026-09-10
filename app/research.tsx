"use client";
import { useState } from "react";
import Link from "next/link";
export default function Research() {
  const [report, setReport] = useState<Record<string, any> | null>(null),
    [error, setError] = useState("");
  const money = (n: number | null) =>
    n === null
      ? "Unavailable"
      : new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(n / 10000);
  async function upload(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 5000000) throw new Error("Report file is too large");
      const value = JSON.parse(await file.text());
      if (
        ![1, 2].includes(value.schemaVersion) ||
        !value.sessionId ||
        !value.survival ||
        !value.lifetime ||
        !value.capitalConstrained
      )
        throw new Error("Choose an exported Lights On research report");
      setReport(value);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report could not be opened");
    }
  }
  return (
    <main
      className="workspace"
      style={{ maxWidth: 1100, margin: "32px auto", padding: 24 }}
    >
      <div className="page-heading">
        <div>
          <div className="eyebrow">LIGHTS ON · PAPER RESEARCH</div>
          <h1>Opportunity research</h1>
          <p>Measure executable depth, costs, duration, and hedge survival.</p>
        </div>
      </div>
      <section className="panel" style={{ padding: 24, marginBottom: 24 }}>
        <h2>Observer controls</h2>
        <p>
          The background observer keeps collecting when the browser closes. Open
          its local dashboard to review mappings, pause observation, and see
          current measurements.
        </p>
        <p>
          <a
            className="primary"
            href="http://127.0.0.1:8789"
            target="_blank"
            rel="noreferrer"
          >
            Open local observer
          </a>
        </p>
        <p>
          For a worker on another computer, use the secure tunnel described in
          the research setup guide. This hosted page displays report snapshots;
          it is not a live connection to your worker.
        </p>
      </section>
      <section className="panel" style={{ padding: 24, marginBottom: 24 }}>
        <h2>Research report</h2>
        <label>
          Open an exported report{" "}
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => void upload(e.target.files?.[0])}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        {!report ? (
          <p>
            No observation report loaded. Import the observer’s JSON export.
            Missing evidence is not a zero-opportunity result.
          </p>
        ) : (
          <>
            <p>
              <strong>
                {report.dataMode === "fixture"
                  ? "Synthetic replay — not live market evidence"
                  : report.dataMode === "rest_probe"
                    ? "Public REST probe — not streaming evidence"
                    : "Recorded stream observation"}
              </strong>
            </p>
            <p>
              Started {new Date(report.startedAt).toLocaleString()} ·{" "}
              {report.bookUpdates} book updates
            </p>
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
                gap: 20,
              }}
            >
              {Object.entries({
                "Opportunities detected": report.opportunitiesDetected,
                "Rule verified": report.ruleVerifiedOpportunities,
                "Gross arbs": report.grossArbCount,
                "Fee positive": report.feePositiveArbCount,
                "1%+ net arbs": report.netOnePercentCount,
                "Median lifetime (ms)": report.lifetime.p50 ?? "Unavailable",
                "P10 / P90 lifetime": `${report.lifetime.p10 ?? "—"} / ${report.lifetime.p90 ?? "—"}`,
                "Theoretical profit": money(report.theoreticalProfit),
              }).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd style={{ fontSize: 24, margin: 0 }}>{String(value)}</dd>
                </div>
              ))}
            </dl>
            <h3>Hedge survival</h3>
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Delay</th>
                  <th>Survived / evaluable</th>
                  <th>Rate</th>
                  <th>Missing / stale</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(
                  report.byFirstVenue ?? { kalshi: report.survival },
                ).flatMap(([venue, buckets]: [string, any]) =>
                  Object.entries(buckets).map(([delay, b]: [string, any]) => (
                    <tr key={venue + delay}>
                      <td>
                        {venue === "poly" ? "Polymarket US" : "Kalshi"} first ·{" "}
                        {delay}ms
                      </td>
                      <td>
                        {b.survived} / {b.evaluable}
                      </td>
                      <td>
                        {b.rate === null
                          ? "Unavailable"
                          : `${(b.rate * 100).toFixed(1)}%`}
                      </td>
                      <td>
                        {b.unobserved} / {b.bookStale}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
            <h3>Bankroll scenarios</h3>
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Bankroll</th>
                  <th>Entries</th>
                  <th>Theoretical profit</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(report.capitalConstrained).map(
                  ([d, b]: [string, any]) => (
                    <tr key={d}>
                      <td>${d}</td>
                      <td>{b.entries}</td>
                      <td>{money(b.profit)}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
            <details>
              <summary>Full measurements, breakdowns and limitations</summary>
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {JSON.stringify(report, null, 2)}
              </pre>
            </details>
          </>
        )}
      </section>
      <p>
        <Link href="/challenge">
          Optional paper challenge and legacy scanner
        </Link>
      </p>
    </main>
  );
}
