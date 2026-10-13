import { describe, expect, it } from 'vitest';
import { CatalogueSnapshotSchema, ManifestEntrySchema, PageCandidateSchema } from '../schema/index.ts';
import { exampleSnapshot, makeCandidate, makeEntry } from './fixtures.ts';

describe('the gate fixtures are valid contract shapes', () => {
  it('exampleSnapshot is a CatalogueSnapshot', () => {
    expect(() => CatalogueSnapshotSchema.parse(exampleSnapshot())).not.toThrow();
  });

  it('makeCandidate is a PageCandidate and makeEntry a ManifestEntry', () => {
    expect(() => PageCandidateSchema.parse(makeCandidate({ entity_ids: [] }))).not.toThrow();
    expect(() => ManifestEntrySchema.parse(makeEntry({ url: '/pune/' }))).not.toThrow();
  });
});
