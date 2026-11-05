import type { DisplayJob } from "./types";

/**
 * Returns true when the job contains the query string in any searchable field:
 * issue number, issue title, agent name, branch name, or session id.
 *
 * A leading "#" is stripped before matching the issue number so both "#117"
 * and "117" resolve the same job.
 */
export function matchesQuery(job: DisplayJob, q: string): boolean {
  const trimmed = q.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  const issueSearch = lower.startsWith("#") ? lower.slice(1) : lower;
  return (
    job.sessionId.toLowerCase().includes(lower) ||
    job.issue.includes(issueSearch) ||
    (job.issueTitle?.toLowerCase().includes(lower) ?? false) ||
    job.agentName.toLowerCase().includes(lower) ||
    (job.branchName?.toLowerCase().includes(lower) ?? false)
  );
}
