import type { LeagueTableEntry } from '../models/output-file';

export type DataSource = 'promotion' | 'overview';
export type PageSource = DataSource | 'both';
export type TestPages = Page[];

export interface Page {
  urls: Partial<Record<DataSource, string>>; // Wikipedia page urls keyed by parser flow
  season: string; //string year season key to use to find the season in the file
  tests: TestCasesForPage;
  source?: PageSource; // Which Wikipedia parsing flow to validate (default: promotion)
}

export interface TestCasesForPage {
  promoted?: string[];
  relegated?: string[];
  tableEntries?: TableEntryTest[];
  //We can add more areas & ways to test the page later
}

export type TierKey = 'tier1' | 'tier2';

export interface TableEntryTest {
  tier: TierKey;
  data: Partial<LeagueTableEntry> & { team: string };
}
