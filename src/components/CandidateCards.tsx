import { useState } from "react";
import type { Candidate } from "../data/candidates";
import type { PollSummary } from "../lib/polling";
import type { Party } from "../types";

function CandidatePortrait({ candidate }: { candidate: Candidate }) {
  const [failed, setFailed] = useState(false);
  const initials = candidate.name.split(/\s+/).filter(Boolean).map(word => word[0]).filter((_, i, all) => i === 0 || i === all.length - 1).join("");
  return (
    <span className="candidate__portrait">
      {candidate.photo && !failed ? <img src={candidate.photo} alt={`${candidate.name} portrait`} width="52" height="60" decoding="async" onError={() => setFailed(true)} /> : <span className="candidate__initials" role="img" aria-label={`Portrait unavailable for ${candidate.name}`}>{initials}</span>}
    </span>
  );
}

export function CandidateCards({ candidates, summary, projection, favoredParty, marketOdds }: {
  candidates: Candidate[];
  summary?: PollSummary | null;
  /** Market/model estimates rank candidates without presenting them as polls. */
  projection?: PollSummary | null;
  favoredParty?: Party | null;
  marketOdds?: { name: string; party: string | null; price: number }[];
}) {
  const hasDemocrat = candidates.some(candidate => candidate.partyCode === "D");
  const side = (candidate: Candidate) => candidate.partyCode === "D" || (!hasDemocrat && candidate.partyCode === "I") ? "D" : candidate.partyCode === "R" ? "R" : null;
  const shareFor = (candidate: Candidate, estimate?: PollSummary | null) => {
    const party = side(candidate);
    // A party aggregate cannot rank or assign shares to two same-party candidates.
    if (!estimate || !party || candidates.filter(other => side(other) === party).length !== 1) return null;
    return party === "D" ? estimate.d : estimate.r;
  };
  const estimate = summary ?? projection;
  const normalizeName = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s*\([^)]*\)\s*$/, "").replace(/^(?:sen\.?|rep\.?|gov\.?)\s+/i, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const marketShareFor = (candidate: Candidate) => {
    const named = marketOdds?.find(odds => normalizeName(odds.name) === normalizeName(candidate.name));
    if (named) return named.price * 100;
    // Generic party markets can represent one nominee, never multiple same-party candidates.
    const generic = marketOdds?.find(odds => odds.party === side(candidate) && /^(?:Democrat(?:ic)?|Republican|Independent)(?: Party)?$/i.test(odds.name));
    return generic && candidates.filter(other => side(other) === side(candidate)).length === 1 ? generic.price * 100 : null;
  };
  const rankFor = (candidate: Candidate) => marketOdds ? marketShareFor(candidate) : shareFor(candidate, estimate);
  const sorted = [...candidates].sort((a, b) => {
    const aShare = rankFor(a);
    const bShare = rankFor(b);
    if (aShare != null || bShare != null) return (bShare ?? -Infinity) - (aShare ?? -Infinity);
    if (favoredParty === "D" || favoredParty === "R") return Number(side(b) === favoredParty) - Number(side(a) === favoredParty);
    // Preserve source order for ties or races without candidate-level estimates.
    return 0;
  });
  return (
    <div className="candidates">
      <div className="candidates__eyebrow">{marketOdds ? "Candidates · Polymarket win chance" : "Candidates"}</div>
      {sorted.map(candidate => {
        const share = marketOdds ? marketShareFor(candidate) : shareFor(candidate, summary);
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
