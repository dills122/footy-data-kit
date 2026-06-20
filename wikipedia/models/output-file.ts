import type {
  DivisionKey,
  ParallelGroup,
  TierKey,
  TierStructure,
  WikipediaDataSourceId,
} from './wikipedia.ts';

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
  outcomeStatus: string | null;
}

export interface TierMetadata {
  source?: WikipediaDataSourceId | string;
  sourceUrl?: string | null;
  seasonSlug?: string | null;
  leagueId?: string | null;
  title?: string | null;
  leagueLevel?: number | null;
  structure?: TierStructure | string | null;
  parallelGroup?: ParallelGroup | string | null;
  divisionKey?: DivisionKey | string | null;
  divisionCount?: number | null;
  tableIndex?: number | null;
  tableCount?: number | null;
  tierKey?: TierKey | string | null;
}

export interface TierData {
  season: number;
  table: LeagueTableEntry[];
  relegated: string[];
  promoted: string[];
  metadata?: TierMetadata;
  divisions?: TierDivisionData[];
}

export interface TierDivisionData extends TierData {
  metadata?: TierMetadata;
}

export interface ParallelTierData extends TierData {
  divisions: TierDivisionData[];
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
  leagueStructureSpecialCases?: LeagueStructureSpecialCase[];
  notes?: string | null;
}

export interface LeagueStructureSpecialCase {
  type: string;
  levels: number[];
  tierKeys: string[];
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
  season?: number | null;
  label?: string | null;
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
  date?: string | null;
  fromSeason?: number | null;
  toSeason?: number | null;
  fromName?: string | null;
  toName?: string | null;
  label?: string | null;
  description?: string | null;
  notes?: string | null;
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
  current?:
    | 'active'
    | 'defunct'
    | 'historical'
    | 'relocated'
    | 'renamed'
    | 'merged'
    | 'phoenix'
    | 'unknown'
    | string;
  trackedFromSeason?: number | null;
  trackedToSeason?: number | null;
  hasUnexplainedGaps?: boolean;
  reason?: string | null;
  reasonLabel?: string | null;
  sourceRefs?: ClubSourceRef[];
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

export type AssetStatus =
  | 'usable'
  | 'placeholder'
  | 'restricted'
  | 'needs-review'
  | 'needs-more-research'
  | 'failed'
  | string;

export interface MetadataAssetLicense {
  shortName?: string | null;
  usageTerms?: string | null;
  licenseUrl?: string | null;
  copyrighted?: boolean | null;
  attribution?: string | null;
  credit?: string | null;
  artist?: string | null;
}

export interface MetadataAssetVerification {
  identityMatch?: 'strong' | 'possible' | 'weak' | 'none' | string | null;
  licenseCheck?: 'pass' | 'restricted' | 'unknown' | 'fail' | string | null;
  httpCheck?: 'pass' | 'unknown' | 'fail' | string | null;
  needsManualReview?: boolean;
  reviewReasons?: string[];
  checkedAt?: string | null;
}

export interface MetadataAssetCandidate {
  assetId: string;
  kind: string;
  status: AssetStatus;
  priority?: number | null;
  source: string;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  pageUrl?: string | null;
  fileTitle?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  license?: MetadataAssetLicense;
  verification?: MetadataAssetVerification;
  notes?: string | null;
}

export interface MetadataAssetBundle {
  preferred?: string | null;
  status: AssetStatus;
  candidates?: MetadataAssetCandidate[];
}

export interface MetadataAssets {
  crest?: MetadataAssetBundle;
  [kind: string]: MetadataAssetBundle | undefined;
}

export interface ClubMetadata {
  clubId?: string;
  canonicalName: string;
  status?: ClubStatus;
  history?: ClubHistory;
  derived?: ClubDerivedMetadata;
  assets?: MetadataAssets;
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
