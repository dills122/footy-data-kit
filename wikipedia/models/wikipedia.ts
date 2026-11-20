import type { LeagueTableEntry, SeasonInfo } from './output-file.ts';

export type WikipediaDataSourceKey = 'promotion' | 'overview';

export type WikipediaDataSourceId =
  | 'wikipedia-promotion'
  | 'wikipedia-overview'
  | 'wikipedia-combined'
  | 'club-metadata-seed';

export type TierNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type TierKey = `tier${TierNumber}`;

export type WikipediaHistoricalPlaceholderStatus =
  | 'wartime-special'
  | 'abandoned-season'
  | 'regional-bridge-season';

export type WikipediaHistoricalSeasonFlags = Readonly<
  Pick<
    SeasonInfo,
    | 'officialLeagueTables'
    | 'officialCompetitionsSuspended'
    | 'officialCompetitionsAbandoned'
    | 'regionalBridgeSeason'
    | 'promotionRelegationApplies'
  >
>;

export interface WikipediaHistoricalPlaceholderSeason extends WikipediaHistoricalSeasonFlags {
  readonly competitionStatus: WikipediaHistoricalPlaceholderStatus;
  readonly warSuspensionLabel?: string;
  readonly specialCompetitions?: readonly string[];
  readonly notes?: string;
}

interface WikipediaSeasonOutcomeLists {
  readonly promoted?: readonly string[];
  readonly relegated?: readonly string[];
}

type WikipediaRowOutcomeOverride = Readonly<
  Partial<Pick<LeagueTableEntry, 'wasPromoted' | 'wasRelegated' | 'outcomeStatus'>>
>;

interface WikipediaTierOutcomeOverride extends WikipediaSeasonOutcomeLists {
  readonly rowFlagOverrides?: Readonly<Record<string, WikipediaRowOutcomeOverride>>;
}

export interface WikipediaSeasonOutcomeOverride {
  readonly seasonInfo?: WikipediaSeasonOutcomeLists;
  readonly tiers?: Readonly<Partial<Record<TierKey, WikipediaTierOutcomeOverride>>>;
}

export type TierStructure = 'single-league' | 'parallel-leagues';

export type ParallelGroup =
  | 'third-division-north-south'
  | 'conference-north-south'
  | 'national-league-north-south'
  | 'pre-2004-conference-feeders'
  | 'step-three-premier-divisions';

export type DivisionKey =
  | 'north'
  | 'south'
  | 'central'
  | 'isthmian'
  | 'northern'
  | 'northern-premier'
  | 'southern-midland'
  | 'southern-southern'
  | 'southern-premier'
  | 'isthmian-premier';

export interface WikipediaLeagueLevelRule {
  level: TierNumber;
  startSeason?: number;
  endSeason?: number;
  parallelGroup?: ParallelGroup;
  labels: readonly string[];
}

export interface WikipediaOverviewParsedTable {
  title: string;
  id: string | null;
  tableIndex: number;
  isTopFlight?: boolean;
  season?: number;
  rows: LeagueTableEntry[];
}

export interface WikipediaOverviewTierProfile {
  level: TierNumber | null;
  parallelGroup: ParallelGroup | null;
}
