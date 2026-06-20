# Wikipedia Source Issues

Use this file for source defects found while researching or ingesting Wikipedia
pages. It is for upstream Wikipedia bugs or likely bad source data, not parser
bugs in this repository and not ordinary lower-tier manual-review backlog.

## Workflow

Statuses:

- `suspected` - seen during research, but not independently checked yet
- `confirmed` - verified against another reliable source or clear internal page
  contradiction
- `reported` - raised on the relevant Wikipedia talk page or with an editor
- `fixed-upstream` - corrected on Wikipedia
- `closed-local` - no upstream edit is needed, but the local handling is
  documented

For every entry, include:

- affected Wikipedia page URL
- affected season, competition, division, club, or table row
- observed problem
- evidence used to verify the problem
- local handling in this repository, if any
- next action

## Current Register

| ID            | Status       | Area                         | Source page                                                                                                 | Problem                                                                                                                                                                                                                                                                               | Evidence                                                                                                                                                                                                                                               | Local handling                                                         | Next action                                                               |
| ------------- | ------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| WIKI-SRC-0001 | closed-local | Pre-2004 tier 6 source spike | 1979-80 through 2003-04 Northern Premier League, Southern Football League, and Isthmian League season pages | No confirmed upstream Wikipedia data defects found during the source-availability spike. The main ambiguity was structural: Southern Football League has separate Midland and Southern Divisions for 1979-80 through 1981-82 before the Premier Division target applies from 1982-83. | All 75 target pages were fetched and parsed; missing pages, missing target tables, and unexpected target division counts were all zero. See [pre-2004-tier6-source-spike.md](/Users/dsteele/repos/footy-data-kit/docs/pre-2004-tier6-source-spike.md). | Encoded as source-table selection rules instead of source corrections. | Keep closed unless later row-level validation finds a conflicting source. |

## Entry Template

```markdown
| WIKI-SRC-0002 | suspected | <area> | <url> | <observed problem> | <verification source or check> | <local parser/config/output handling> | <next action> |
```
