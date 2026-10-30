import { useState } from "react";
import type { Candidate } from "../data/candidates";
import type { PollSummary } from "../lib/polling";

function CandidatePortrait({ candidate }: { candidate: Candidate }) {
  const [failed, setFailed] = useState(false);
  const initials = candidate.name.split(/\s+/).filter(Boolean).map(word => word[0]).filter((_, i, all) => i === 0 || i === all.length - 1).join("");
  return (
    <span className="candidate__portrait">
      {candidate.photo && !failed ? <img src={candidate.photo} alt={`${candidate.name} portrait`} width="52" height="60" decoding="async" onError={() => setFailed(true)} /> : <span className="candidate__initials" role="img" aria-label={`Portrait unavailable for ${candidate.name}`}>{initials}</span>}
    </span>
  );
}

export function CandidateCards({ candidates, summary }: { candidates: Candidate[]; summary?: PollSummary | null }) {
  const hasDemocrat = candidates.some(candidate => candidate.partyCode === "D");
  const sorted = [...candidates].sort((a, b) => ({ D: 0, I: 1, R: 2, O: 3 }[a.partyCode] - { D: 0, I: 1, R: 2, O: 3 }[b.partyCode]));
  return (
    <div className="candidates">
      <div className="candidates__eyebrow">Candidates</div>
      {sorted.map(candidate => {
        const share = summary ? candidate.partyCode === "D" || (!hasDemocrat && candidate.partyCode === "I") ? summary.d : candidate.partyCode === "R" ? summary.r : null : null;
        return <div className={`candidate candidate--${candidate.partyCode.toLowerCase()}`} key={`${candidate.name}:${candidate.party}`}>
          <CandidatePortrait candidate={candidate} />
          <div className="candidate__info">
            <span className="candidate__party">{candidate.party}</span>
            <strong className="candidate__name">{candidate.name}</strong>
            {candidate.photo && candidate.photoSource ? <a className="candidate__credit" href={candidate.photoSource} target="_blank" rel="noopener noreferrer">Photo & credits ↗</a> : null}
          </div>
          {share != null ? <span className="candidate__share">{share.toFixed(1)}<small>%</small></span> : null}
        </div>;
      })}
      {candidates[0]?.source ? <a className="candidates__source" href={candidates[0].source} target="_blank" rel="noopener noreferrer">Candidate information · Wikipedia ↗</a> : null}
    </div>
  );
}
