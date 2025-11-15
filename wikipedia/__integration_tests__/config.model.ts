import type { LeagueTableEntry } from '../models/output-file';

export type DataSource = 'promotion' | 'overview';
export type TestPages = Page[];

export interface Page {
  url: string; //url to the wikipedia page we are testing
  season: string; //string year season key to use to find the season in the file
  tests: TestCasesForPage;
  source?: DataSource; // Which Wikipedia parsing flow to validate (default: promotion)
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
