import { describe, expect, it } from 'vitest';
import {
  CSV_HEADERS,
  CSV_TEMPLATES,
  DemandRowSchema,
  ExperienceRowSchema,
  LocalFactRowSchema,
  PlaceDishRowSchema,
  PlaceRowSchema,
  ProviderRowSchema,
  isExampleRow,
  parseOpeningHoursCell,
} from './csv.ts';

describe('CSV_HEADERS (CONTRACTS §6)', () => {
  it('are the exact header rows', () => {
    expect(CSV_HEADERS.places.join(',')).toBe(
      'name,kind,locality_id,address,lat,lng,phone,website,cuisines,diet,price_level,service_modes,opening_hours,tags,source_url,retrieved_at,valid_until',
    );
    expect(CSV_HEADERS.place_dishes.join(',')).toBe(
      'place_name,locality_id,dish_id,variant_label,price_inr,source_url,retrieved_at,valid_until',
    );
    expect(CSV_HEADERS.providers.join(',')).toBe(
      'name,locality_id,address,phone,website,services,service_localities,specializations,experience_years,accepts_leads,min_job_inr,source_url,retrieved_at',
    );
    expect(CSV_HEADERS.experiences.join(',')).toBe(
      'place_name,locality_id,visited_at,dish_id,price_paid_inr,rating,would_recommend,tags,notes',
    );
    expect(CSV_HEADERS.local_facts.join(',')).toBe(
      'locality_id,topic,services,text,source_url,source_title,publisher,retrieved_at',
    );
    expect(CSV_HEADERS.demand.join(',')).toBe(
      'service_or_dish,sub_id,locality_id,monthly_searches,est_lead_value_inr,data_ready,source',
    );
  });
  it('each row schema reads exactly its template columns', () => {
    for (const [name, template] of Object.entries(CSV_TEMPLATES)) {
      expect([...Object.keys(template.row.shape)], name).toEqual([...CSV_HEADERS[name as keyof typeof CSV_HEADERS]]);
    }
  });
});

describe('isExampleRow', () => {
  it('skips rows whose first field starts with EXAMPLE', () => {
    expect(isExampleRow(['EXAMPLE Biryani House', 'restaurant'])).toBe(true);
    expect(isExampleRow(['EXAMPLE wakad', 'water'])).toBe(true);
    expect(isExampleRow(['Real Place', 'restaurant'])).toBe(false);
    expect(isExampleRow(['Example lower case'])).toBe(false);
    expect(isExampleRow([])).toBe(false);
  });
});

describe('parseOpeningHoursCell', () => {
  it('reads day=HH:MM-HH:MM;… into the OpeningHours shape', () => {
    expect(parseOpeningHoursCell('mon=11:00-23:30;tue=11:00-15:00|18:00-23:00')).toEqual({
      mon: [['11:00', '23:30']],
      tue: [
        ['11:00', '15:00'],
        ['18:00', '23:00'],
      ],
    });
  });
  it('returns null for an empty cell and throws on a malformed one', () => {
    expect(parseOpeningHoursCell('')).toBeNull();
    expect(() => parseOpeningHoursCell('mon=11:00')).toThrow(/mon=11:00/);
    expect(() => parseOpeningHoursCell('funday=11:00-12:00')).toThrow(/funday/);
    expect(() => parseOpeningHoursCell('mon=25:00-26:00')).toThrow();
    expect(() => parseOpeningHoursCell('mon=11:00-12:00;mon=13:00-14:00')).toThrow(/twice/);
  });
});

const row = (schema: { safeParse(v: unknown): { success: boolean; data?: unknown } }, v: Record<string, string>) =>
  schema.safeParse(v);

describe('PlaceRowSchema', () => {
  const place = {
    name: 'Green Leaf Cafe',
    kind: 'restaurant',
    locality_id: 'wakad',
    address: '12 Sample Road, Wakad, Pune',
    lat: '18.5987',
    lng: '73.7611',
    phone: '',
    website: 'https://example.com/',
    cuisines: 'Cafe|Continental',
    diet: 'veg',
    price_level: '2',
    service_modes: 'dine_in|takeaway',
    opening_hours: 'mon=11:00-23:30;tue=11:00-23:30',
    tags: 'family',
    source_url: 'visited',
    retrieved_at: '2026-10-06',
    valid_until: '',
  };
  it('turns cells into typed values', () => {
    const r = row(PlaceRowSchema, place);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({
      name: 'Green Leaf Cafe',
      lat: 18.5987,
      phone: null,
      cuisines: ['Cafe', 'Continental'],
      price_level: 2,
      service_modes: ['dine_in', 'takeaway'],
      opening_hours: { mon: [['11:00', '23:30']], tue: [['11:00', '23:30']] },
      valid_until: null,
      source_url: 'visited',
    });
  });
  it('accepts an https, visited or owner source and rejects other sources', () => {
    expect(row(PlaceRowSchema, { ...place, source_url: 'https://example.com/menu' }).success).toBe(true);
    expect(row(PlaceRowSchema, { ...place, source_url: 'owner' }).success).toBe(true);
    expect(row(PlaceRowSchema, { ...place, source_url: '' }).success).toBe(false);
    expect(row(PlaceRowSchema, { ...place, source_url: 'http://example.com' }).success).toBe(false);
    expect(row(PlaceRowSchema, { ...place, source_url: 'somewhere' }).success).toBe(false);
  });
  it('rejects a bad enum, a bad number and one coordinate without the other', () => {
    expect(row(PlaceRowSchema, { ...place, diet: 'vegan' }).success).toBe(false);
    expect(row(PlaceRowSchema, { ...place, price_level: '4' }).success).toBe(false);
    expect(row(PlaceRowSchema, { ...place, lat: 'north' }).success).toBe(false);
    expect(row(PlaceRowSchema, { ...place, lng: '' }).success).toBe(false);
    expect(row(PlaceRowSchema, { ...place, lat: '', lng: '' }).success).toBe(true);
    expect(row(PlaceRowSchema, { ...place, name: '' }).success).toBe(false);
  });
});

describe('other row schemas', () => {
  it('PlaceDishRow', () => {
    const r = {
      place_name: 'Green Leaf Cafe',
      locality_id: 'wakad',
      dish_id: 'biryani',
      variant_label: 'Chicken biryani, full plate',
      price_inr: '249',
      source_url: 'https://example.com/menu',
      retrieved_at: '2026-10-06',
      valid_until: '',
    };
    expect(row(PlaceDishRowSchema, r).data).toMatchObject({ price_inr: 249, valid_until: null });
    expect(row(PlaceDishRowSchema, { ...r, price_inr: '24.9' }).success).toBe(false);
    expect(row(PlaceDishRowSchema, { ...r, variant_label: '' }).success).toBe(true);
  });
  it('ProviderRow', () => {
    const r = {
      name: 'Shree Waterproofing',
      locality_id: 'wagholi',
      address: '',
      phone: '',
      website: '',
      services: 'terrace-waterproofing|leakage-repair',
      service_localities: 'wagholi|kharadi',
      specializations: 'Terrace',
      experience_years: '8',
      accepts_leads: 'true',
      min_job_inr: '15000',
      source_url: 'owner',
      retrieved_at: '2026-10-06',
    };
    expect(row(ProviderRowSchema, r).data).toMatchObject({
      services: ['terrace-waterproofing', 'leakage-repair'],
      accepts_leads: true,
      experience_years: 8,
      min_job_inr: 15000,
    });
    expect(row(ProviderRowSchema, { ...r, accepts_leads: 'yes' }).success).toBe(false);
    expect(row(ProviderRowSchema, { ...r, services: '' }).success).toBe(false);
  });
  it('ExperienceRow', () => {
    const r = {
      place_name: 'Green Leaf Cafe',
      locality_id: 'wakad',
      visited_at: '2026-10-04',
      dish_id: 'biryani',
      price_paid_inr: '260',
      rating: '4',
      would_recommend: 'true',
      tags: 'family|late_night',
      notes: 'Generous portion',
    };
    expect(row(ExperienceRowSchema, r).data).toMatchObject({ rating: 4, would_recommend: true, tags: ['family', 'late_night'] });
    expect(row(ExperienceRowSchema, { ...r, rating: '6' }).success).toBe(false);
    expect(row(ExperienceRowSchema, { ...r, rating: '0' }).success).toBe(false);
  });
  it('LocalFactRow', () => {
    const r = {
      locality_id: 'wakad',
      topic: 'water',
      services: 'terrace-waterproofing|bathroom-waterproofing',
      text: 'A fact in our own words.',
      source_url: 'https://example.com/report',
      source_title: 'Report',
      publisher: 'Publisher',
      retrieved_at: '2026-10-06',
    };
    expect(row(LocalFactRowSchema, r).data).toMatchObject({ services: ['terrace-waterproofing', 'bathroom-waterproofing'] });
    expect(row(LocalFactRowSchema, { ...r, source_url: 'visited' }).success).toBe(false); // a fact needs a real source
    expect(row(LocalFactRowSchema, { ...r, topic: 'gossip' }).success).toBe(false);
  });
  it('DemandRow: empty monthly_searches means unknown', () => {
    const r = {
      service_or_dish: 'waterproofing',
      sub_id: '',
      locality_id: 'wakad',
      monthly_searches: '',
      est_lead_value_inr: '400',
      data_ready: '0',
      source: 'prior',
    };
    expect(row(DemandRowSchema, r).data).toEqual({
      service_or_dish: 'waterproofing',
      sub_id: null,
      locality_id: 'wakad',
      monthly_searches: null,
      est_lead_value_inr: 400,
      data_ready: false,
      source: 'prior',
    });
    expect(row(DemandRowSchema, { ...r, monthly_searches: '1200', data_ready: '1' }).data).toMatchObject({
      monthly_searches: 1200,
      data_ready: true,
    });
    expect(row(DemandRowSchema, { ...r, data_ready: '2' }).success).toBe(false);
    expect(row(DemandRowSchema, { ...r, est_lead_value_inr: '' }).success).toBe(false);
  });
});
