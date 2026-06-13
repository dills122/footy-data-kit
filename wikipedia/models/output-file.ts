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

export interface ClubNamePeriod {
  name: string;
  startSeason?: number | null;
  endSeason?: number | null;
  notes?: string | null;
}

export interface ClubFinancialEvent {
  type: string;
  startSeason?: number | null;
  endSeason?: number | null;
  seasonsMissed?: number[];
  notes?: string | null;
}

export interface ClubObservedNamePeriod {
  name: string;
  startSeason: number;
  endSeason: number;
}

export interface ClubObservedName {
  rawName: string;
  normalizedName: string;
  firstSeenSeason: number;
  lastSeenSeason: number;
  seasonsSeen: number[];
  tiersSeen: string[];
}

export interface ClubIdentitySource {
  type: string;
  sourceUrl: string;
  notes?: string | null;
}

export interface ClubRelationship {
  clubKey: string;
  relationship: string;
  direction: string;
  sourceRefs?: ClubIdentitySource[];
  notes?: string | null;
}

export interface ClubTierSeasons {
  tierKey: string;
  seasons: number[];
}

export interface ClubCoverageGap {
  startSeason: number;
  endSeason: number;
  length: number;
}

export interface ClubSourceRef {
  type: string;
  sourceUrl: string;
  notes?: string | null;
}

export interface ClubLifecycleEvent {
  type: string;
  season?: number | null;
  fromSeason?: number | null;
  toSeason?: number | null;
  fromName?: string | null;
  toName?: string | null;
  description?: string | null;
  sourceRefs?: ClubSourceRef[];
}

export interface ClubTrackedMembership {
  fromSeason: number;
  toSeason?: number | null;
  tiers?: string[];
  basis?: string | null;
  notes?: string | null;
  sourceRefs?: ClubSourceRef[];
}

export interface ClubAbsenceExplanation {
  fromSeason: number;
  toSeason?: number | null;
  reason: string;
  linkedEventType?: string | null;
  basis?: string | null;
  notes?: string | null;
  sourceRefs?: ClubSourceRef[];
}

export interface ClubHistory {
  nameHistory?: ClubNamePeriod[];
  lifecycleEvents?: ClubLifecycleEvent[];
  trackedMembership?: ClubTrackedMembership[];
  absenceExplanations?: ClubAbsenceExplanation[];
}

export interface ClubStatus {
  current?: 'active' | 'defunct' | 'renamed' | 'merged' | 'phoenix' | 'unknown' | string;
  trackedFromSeason?: number | null;
  trackedToSeason?: number | null;
  hasUnexplainedGaps?: boolean;
}

export interface ClubDerivedMetadata {
  source?: string | null;
  aliases?: string[];
  identitySources?: ClubIdentitySource[];
  relationships?: ClubRelationship[];
  observedNames?: ClubObservedName[];
  observedNamePeriods?: ClubObservedNamePeriod[];
  firstSeenSeason?: number | null;
  lastSeenSeason?: number | null;
  seasonsSeen?: number[];
  totalSeasonsSeen?: number;
  tiersSeen?: string[];
  tierSeasons?: ClubTierSeasons[];
  coverageGaps?: ClubCoverageGap[];
}

export interface ClubMetadata {
  clubId?: string;
  canonicalName: string;
  status?: ClubStatus;
  history?: ClubHistory;
  derived?: ClubDerivedMetadata;
  founded?: string | null;
  dissolved?: string | null;
  nameHistory?: ClubNamePeriod[];
  financialEvents?: ClubFinancialEvent[];
  notes?: string | null;
  sourceUrl?: string | null;
}

export interface ClubsMap {
  [clubKey: string]: ClubMetadata;
}

export interface FootballData {
  metadata?: DatasetMetadata;
  clubs?: ClubsMap;
  seasons: SeasonsMap;
}
