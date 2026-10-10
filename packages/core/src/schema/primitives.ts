// Field-level building blocks shared by every schema module (CONTRACTS §1 conventions).
import { z } from 'zod';
import { isReservedSlug } from '../constants/reference-ids.ts';

/** Lowercase ASCII slug used as a reference id and URL segment: `hinjewadi-phase-1`. */
export const SlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a lowercase ASCII slug');

/** A slug that identifies a locality, dish or service, so it may not be a reserved word (CONTRACTS §4a). */
export const ReferenceIdSchema = SlugSchema.refine((s) => !isReservedSlug(s), 'is a reserved slug');

/** Non-empty text. Curated prose is never empty. */
export const TextSchema = z.string().min(1);

/** `YYYY-MM-DD`, a real calendar date. */
export const IsoDateSchema = z.iso.date();

/** ISO 8601 instant with a zone: `Z` or an offset (Postgres `timestamptz` serialises with `+00:00`). */
export const TimestampSchema = z.iso.datetime({ offset: true });

/** Record ids and client idempotency keys. */
export const UuidSchema = z.uuid();

/** Integer INR, never negative (`price_inr: 249`). */
export const InrSchema = z.number().int().nonnegative();

/** An `https://` URL. */
export const HttpsUrlSchema = z.url({ protocol: /^https$/ });

/** E.164 Indian mobile, after normalisation. */
export const PhoneE164Schema = z.string().regex(/^\+91[6-9]\d{9}$/, 'must be an E.164 Indian mobile');

/** WGS84 `{ lat, lng }`. */
export const GeoSchema = z.strictObject({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type Geo = z.infer<typeof GeoSchema>;

/** A fraction from 0 to 1 (scores, confidence, weights). */
export const UnitIntervalSchema = z.number().min(0).max(1);

/** An `http://` or `https://` URL: crawled pages and business websites are not always on https. */
export const HttpUrlSchema = z.url({ protocol: /^https?$/ });

/** A date or a full timestamp, for display fields that carry whichever the source had. */
export const DateOrTimestampSchema = IsoDateSchema.or(TimestampSchema);

/** `HH:MM`, 24-hour, IST. `24:00` is allowed as a closing time. */
export const ClockTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/, 'must be HH:MM');
