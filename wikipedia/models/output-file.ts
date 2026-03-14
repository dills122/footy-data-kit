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
  leagueLevel?: number | null;
  tableIndex?: number | null;
  tableCount?: number | null;
  tierKey?: string | null;
}

export interface TierData {
  season: number;
  table: LeagueTableEntry[];
  relegated: string[];
  promoted: string[];
  metadata?: TierMetadata;
}

export interface SeasonInfo {
  season: number;
  table: [];
  relegated: string[];
  promoted: string[];
  seasonSlug?: string | null;
  sourceUrl?: string | null;
  tableCount?: number | null;
  competitionStatus?: string | null;
  warSuspensionLabel?: string | null;
  officialLeagueTables?: boolean | null;
  officialCompetitionsSuspended?: boolean | null;
  officialCompetitionsAbandoned?: boolean | null;
  regionalBridgeSeason?: boolean | null;
  promotionRelegationApplies?: boolean | null;
  specialCompetitions?: string[];
  notes?: string | null;
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

export interface DatasetMetadata {
  schemaVersion?: number;
  generator?: string | null;
  generatedAt?: string | null;
  gitSha?: string | null;
  sourceFiles?: string[];
  buildOptions?: Record<string, string | number | boolean | null>;
}

export interface FootballData {
  metadata?: DatasetMetadata;
  seasons: SeasonsMap;
}
