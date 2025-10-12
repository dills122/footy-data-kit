// ✅ Represents a single team's record in a season table
export interface LeagueTableEntry {
  pos: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number | null;
  goalAverage: number | null;
  points: number;
  notes: string | null;
  wasRelegated: boolean;
  wasPromoted: boolean;
  isExpansionTeam: boolean;
  wasReElected: boolean;
  wasReprieved: boolean;
}

// ✅ A single tier for a given season (e.g., tier1 or tier2)
export interface TierData {
  season: number;
  table: LeagueTableEntry[];
  relegated: string[];
  promoted: string[];
  seasonSlug?: string | null;
  sourceUrl?: string | null;
  tier?: string | null;
  title?: string | null;
  seasonMetadata?: Record<string, unknown>;
}

// ✅ A season's data, containing multiple tiers (tier1, tier2, etc.)
export interface SeasonData {
  [tierKey: string]: TierData | LeagueTableEntry[];
  // Example: { tier1: TierData, tier2: LeagueTableEntry[] }
}

// ✅ The full dataset, mapping seasons (like "1950") to their data
export interface SeasonsMap {
  [seasonYear: string]: SeasonData;
}

// ✅ The root object
export interface FootballData {
  seasons: SeasonsMap;
}
