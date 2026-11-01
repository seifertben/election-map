import { formatMargin } from "../lib/polling";
import type { RacePoll } from "../lib/polling";
import { currentLocale, formatNumber } from '../i18n/runtime';

const POPULATION_LABELS = {
  LV: "likely voters",
  RV: "registered voters",
  A: "adults",
};

export function PollDetails({
  polls,
  optionLabel,
  onToggle,
}: {
  polls: RacePoll[];
  optionLabel: string;
  onToggle: () => void;
}) {
  return (
    <details className="poll-details" onToggle={onToggle}>
      <summary>
        Poll details · {polls.length} {polls.length === 1 ? "poll" : "polls"}
      </summary>
      <div
        className="poll-details__scroll"
        role="region"
        aria-label={`Polls included in ${optionLabel}`}
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Pollster</th>
              <th scope="col">Field end</th>
              <th scope="col">D</th>
              <th scope="col">R</th>
              <th scope="col">Margin</th>
              <th scope="col">Sample</th>
            </tr>
          </thead>
          <tbody>
            {polls.map((poll, index) => (
              <tr key={`${poll.pollster}:${poll.date}:${index}`}>
                <th scope="row">{poll.pollster}</th>
                <td>
                  <time dateTime={poll.date}>{currentLocale() === 'en' ? poll.date : new Date(`${poll.date}T12:00:00Z`).toLocaleDateString(currentLocale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</time>
                </td>
                <td>{formatNumber(poll.d)}%</td>
                <td>{formatNumber(poll.r)}%</td>
                <td>{formatMargin(poll.d - poll.r)}</td>
                <td>
                  {poll.sample?.toLocaleString(currentLocale()) ?? "—"}
                  {poll.population ? (
                    <span className="poll-details__population">
                      {POPULATION_LABELS[poll.population]}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
