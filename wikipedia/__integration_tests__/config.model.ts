import type { LeagueTableEntry, SeasonInfo, TierMetadata } from '../models/output-file';

export type DataSource = 'promotion' | 'overview';
export type PageSource = DataSource | 'both';
export type TestPages = Page[];

export interface Page {
  urls: Partial<Record<DataSource, string>>; // Wikipedia page urls keyed by parser flow
  season: string; //string year season key to use to find the season in the file
  tests: TestCasesForPage;
  source?: PageSource; // Which Wikipedia parsing flow to validate (default: promotion)
  coverage?: string[]; // Scenario tags this fixture is intended to exercise
}

export interface TestCasesForPage {
  promoted?: string[];
  relegated?: string[];
  seasonInfo?: Partial<SeasonInfo>;
  tableEntries?: TableEntryTest[];
  tierMetadataEntries?: TierMetadataEntryTest[];
  //We can add more areas & ways to test the page later
}

export type TierKey = 'tier1' | 'tier2' | 'tier3' | 'tier4' | 'tier5' | 'tier6' | 'tier7';

export interface TableEntryTest {
  tier: TierKey;
  data: Partial<LeagueTableEntry> & { team: string };
}

export interface TierMetadataEntryTest {
  tier: TierKey;
  data: Partial<TierMetadata>;
}
