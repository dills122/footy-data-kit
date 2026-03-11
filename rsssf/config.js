import path from 'node:path';

export const RSSSF_URL_TEMPLATE = 'https://www.rsssf.org/engpaul/FLA/{seasonSlug}.html';
export const RSSSF_DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), 'data-output', 'rsssf');
export const RSSSF_AGGREGATE_FILE_NAME = 'rsssf_promotion_relegations_by_season.json';
export const RSSSF_PAGE_FILE_FALLBACK = 'rsssf-page';
export const RSSSF_SEASON_FILE_PREFIX = 'rsssf-';
export const RSSSF_COMMAND_NAME = 'rsssf-scraper';
export const RSSSF_DEFAULT_ENCODING = 'windows-1252';
