// Ids for label/description wiring. A counter, not a random value, so builds stay reproducible; every call
// gets a new number, so a component rendered twice on one page (the light and dark fixture panels) never
// repeats an id.
let next = 0;

export function uid(prefix: string): string {
  next += 1;
  return `${prefix}-${next}`;
}
