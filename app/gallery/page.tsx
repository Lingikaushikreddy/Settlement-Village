import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseGalleryIndex } from "@/lib/gallery/index-schema";
import { summarizeGalleryEntry } from "@/lib/gallery/summary";
import type { AgentReport } from "@/lib/testbed/report";
import "@/components/experiments.css";
import "./gallery.css";

export const metadata: Metadata = {
  title: "Settlement gallery — verified agent reports",
  description: "Explore verified agent reports, compare authored scenario results with the Check evidence policy, and replay each report in Settlement.",
};

const percent = (rate: number | null) => rate === null ? "n/a" : `${(rate * 100).toFixed(1)}%`;

export default function Gallery() {
  const entries = parseGalleryIndex(JSON.parse(readFileSync(resolve(process.cwd(), "gallery/index.json"), "utf8")));
  return (
    <main className="gallery-page">
      <header className="gallery-header">
        <Link href="/">Back to the village</Link>
        <h1>Gallery of verified reports</h1>
        <p>The scenarios and claim texts are authored and fixed. An agent tuned to these exact texts can score well without being robust. A good score means your agent resisted <em>these</em> attacks. It is not a general safety certification.</p>
        <a className="gallery-submit" href="https://github.com/Lingikaushikreddy/Settlement-Village/blob/main/docs/gallery.md">Submit yours</a>
      </header>
      {entries.map(entry => {
        const report = JSON.parse(readFileSync(resolve(process.cwd(), entry.report), "utf8")) as AgentReport;
        const summary = summarizeGalleryEntry(entry, report);
        const replay = `/?view=research&report=${encodeURIComponent(`https://raw.githubusercontent.com/Lingikaushikreddy/Settlement-Village/main/${entry.report}`)}`;
        return (
          <article className="evaluation-panel gallery-entry" key={entry.id} aria-labelledby={`${entry.id}-title`}>
            <header className="evaluation-report-heading">
              <div>
                <h2 id={`${entry.id}-title`}>{entry.title}</h2>
                <div className="gallery-agent">
                  {entry.agent.homepage ? <a href={entry.agent.homepage}>{entry.agent.name}</a> : <strong>{entry.agent.name}</strong>}
                  <small className="gallery-kind">{entry.agent.kind}</small>
                </div>
                <p>Submitted by {entry.submittedBy} on <time dateTime={entry.submittedAt}>{entry.submittedAt}</time></p>
              </div>
              <dl className="gallery-details">
                <div><dt>Cases</dt><dd>{summary.cases}</dd></div>
                <div><dt>Seeds</dt><dd>{summary.seeds}</dd></div>
                <div><dt>Engine</dt><dd>{summary.engineVersion}</dd></div>
              </dl>
            </header>
            {entry.notes && <p className="gallery-notes">{entry.notes}</p>}
            <div className="evaluation-table gallery-table" role="region" aria-label={`Scenario rates for ${entry.title}`} tabIndex={0}>
              <table>
                <thead><tr>
                  <th scope="col">Scenario</th>
                  <th scope="col"><span>Attack success</span><small>unresolved attacks included</small></th>
                  <th scope="col">Honest refusal</th>
                  <th scope="col">Invalid</th>
                  <th scope="col"><span>Check evidence</span><small>Attack success / honest refusal</small></th>
                </tr></thead>
                <tbody>{summary.scenarios.map(scenario => (
                  <tr key={scenario.id}>
                    <td>{scenario.name}</td>
                    <td>{percent(scenario.attackSuccess)}</td>
                    <td>{percent(scenario.honestRefusal)}</td>
                    <td>{percent(scenario.invalid)}</td>
                    <td>{percent(scenario.baselineAttackSuccess)} / {percent(scenario.baselineHonestRefusal)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <footer className="gallery-footer">
              <span className="evaluation-verified">Report checked by repository verification</span>
              <Link href={replay}>Verify and replay</Link>
            </footer>
          </article>
        );
      })}
    </main>
  );
}
