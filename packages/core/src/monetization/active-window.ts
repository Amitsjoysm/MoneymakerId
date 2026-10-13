// The date filter for paid placements: featured listings (`FeaturedView`) and campaigns (`CampaignView`).
// A placement is live when `starts_on <= today <= ends_on`, both ends inclusive, with "today" the IST calendar day
// (CONTRACTS §1). Dates are `YYYY-MM-DD`, so comparing them as strings is comparing them as days.
import { istDate } from '../season/ist.ts';

/** The dates a paid placement runs between (`YYYY-MM-DD`, inclusive). */
export interface DateWindow {
  starts_on: string;
  ends_on: string;
}

/** Is the window live on `today` (an IST `YYYY-MM-DD` day)? A window that ends before it starts is never live. */
export function isActiveOn(window: DateWindow, today: string): boolean {
  return window.starts_on <= today && today <= window.ends_on;
}

/** Is the window live at `now`? The day is the IST day of that instant. Throws a `RangeError` for an invalid `Date`. */
export function isActive(window: DateWindow, now: Date): boolean {
  return isActiveOn(window, istDate(now));
}

/** The items whose window is live at `now`, in their original order. Returns a new array of the same objects. */
export function filterActive<T extends DateWindow>(items: readonly T[], now: Date): T[] {
  const today = istDate(now);
  return items.filter((item) => isActiveOn(item, today));
}
