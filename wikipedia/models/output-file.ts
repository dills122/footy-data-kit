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

export interface TierMetadata {
  source?: 'wikipedia-promotion' | 'wikipedia-overview' | string;
  sourceUrl?: string | null;
  seasonSlug?: string | null;
  leagueId?: string | null;
  title?: string | null;
  tableIndex?: number | null;
  tableCount?: number | null;
  tierKey?: string | null;
}

export interface TierData {
  season: number;
  table: LeagueTableEntry[];
  relegated: string[];
  promoted: string[];
  // Legacy flattened metadata fields are still present in current exports.
  seasonSlug?: string | null;
  sourceUrl?: string | null;
  tier?: string | null;
  title?: string | null;
  seasonMetadata?: Record<string, unknown>;
}

export interface SeasonInfo {
  season: number;
  table: [];
  relegated: string[];
  promoted: string[];
  seasonSlug?: string | null;
  sourceUrl?: string | null;
  tableCount?: number | null;
}

export interface SeasonData {
  seasonInfo: SeasonInfo;
  tier1: TierData;
  tier2?: TierData;
  tier3?: TierData;
  tier4?: TierData;
  tier5?: TierData;
  tier6?: TierData;
  tier7?: TierData;
  [tierKey: string]: SeasonInfo | TierData | undefined;
}

export interface SeasonsMap {
  [seasonYear: string]: SeasonData;
}

export interface FootballData {
  seasons: SeasonsMap;
}
