// One line of text for a list of validation issues: `path: message`, at most five, never the offending value.
export function formatIssues(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): string {
  const shown = issues.slice(0, 5).map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`);
  if (issues.length > 5) shown.push(`and ${issues.length - 5} more`);
  return shown.join('; ');
}
