# Club Metadata Layer 2 Plan

Layer 1 now derives club continuity metadata from the scraped season table data. It explains observed coverage gaps using table-row notes such as `Failed re-election`, `Resigned from league`, and `Relegation to Conference North`.

Layer 2 should add source-backed club history facts that are not safely derivable from season table rows alone.

## Current Layer 1 Boundary

Layer 1 is intentionally conservative:

- It is generated from `data-output/all-seasons.json`.
- It only uses facts already present in scraped table rows and season metadata.
- It emits `history.lifecycleEvents[]` and `history.absenceExplanations[]`.
- It emits `history.trackedMembership[]` as observed stints inside supported
  coverage, not continuous real-world existence.
- Table-note explanations use `basis: "table-note"`.
- Official competition pauses use `basis: "season-metadata"`.
- It explains why a club left our tracked table coverage, not every event that happened during a long absence.
- It writes `data/club-metadata-review.json` for lower-tier status cases that
  still need manual confirmation or curated rules.

This should stay reproducible. Do not hand-edit `data/club-metadata.json` to add researched facts.

## Layer 2 Goal

Layer 2 should enrich club metadata with researched, source-backed events such as:

- `club-dissolved`
- `club-reformed`
- `club-inactive`
- `liquidation`
- `administration`
- `phoenix`
- `identity-continuity-note`
- name changes with date ranges when they are not already covered by observed table names

These facts should help consumers understand long gaps and historical identity changes without overloading the season table data.

## Proposed Data Model

Keep layer 2 facts separate from generated observations until they are merged by the generator.

Recommended source file:

```text
data/club-history-overrides.json
```

Possible shape:

```json
{
  "metadata": {
    "schemaVersion": 1,
    "description": "Source-backed club history enrichments merged into generated club metadata."
  },
  "clubs": {
    "merthyr-town": {
      "history": {
        "lifecycleEvents": [
          {
            "type": "club-dissolved",
            "season": 1934,
            "description": "Original Merthyr Town ceased to play after four seasons back in the Southern League.",
            "basis": "researched-source",
            "sourceRefs": [
              {
                "type": "wikipedia-club-page",
                "sourceUrl": "https://en.wikipedia.org/wiki/Merthyr_Town_F.C."
              }
            ]
          }
        ]
      }
    }
  }
}
```

Open schema questions to settle during implementation:

- Whether `basis` should be added to `ClubLifecycleEvent` as a first-class typed field.
- Whether financial events should be event `type` values under `lifecycleEvents`, or a separate `history.financialEvents[]` list.
- Whether identity notes should live under `history.lifecycleEvents[]` or `derived.relationships[]` when they connect predecessor/successor clubs.

Recommendation:

- Add `basis?: string` to `ClubLifecycleEvent`.
- Keep financial events under `history.lifecycleEvents[]` for now with event types like `liquidation` and `administration`.
- Keep relationships in `derived.relationships[]` only when there are two distinct tracked club identities to connect.

## Merge Strategy

Layer 2 should be merged during `wiki:club-seed`, not edited into generated JSON manually.
Use `data/club-metadata-review.json` as the current worklist for lower-tier
status decisions.

Implementation steps:

1. Add `data/club-history-overrides.json`.
2. Add a loader/normalizer for the override file.
3. Merge override `history.lifecycleEvents[]`, `history.nameHistory[]`, and possibly `history.absenceExplanations[]` into generated records.
4. Preserve generated layer 1 events; do not replace them unless the override explicitly supersedes them.
5. Deduplicate events by stable fields like `type`, `season`, `description`, and `sourceRefs`.
6. Add tests for merge behavior and conflict handling.
7. Regenerate `data/club-metadata.json`.

The generator should fail loudly if an override references an unknown `clubId` or malformed source reference.

## Verification Strategy

The current continuity verifier only checks whether expected missing seasons are explained. Layer 2 should add source-quality checks:

- Every researched event must have at least one `sourceRefs[]` entry.
- Every researched event must have `basis: "researched-source"`.
- Every override club key must resolve to a generated club identity.
- Every source URL must be a non-empty HTTP(S) URL.
- Event types should come from a small allowed list.

Start these checks in report mode, then tighten to errors once the first batch is stable.

## Initial Club Queue

Prioritize long gaps where layer 1 is correct but incomplete:

| Club                   | Layer 1 gap | Current layer 1 reason                                    | Layer 2 research need                                                                              |
| ---------------------- | ----------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Merthyr Town           | 1930-2024   | Failed re-election and demoted to Southern League         | Dissolved/ceased in 1934, Merthyr Tydfil period from 1945, liquidation/reformation in 2010         |
| Bradford (Park Avenue) | 1970-2020   | Failed re-election and demoted to Northern Premier League | Disbanded/liquidated in 1974, reformed/phoenix identity in 1987                                    |
| Barrow                 | 1972-2011   | Failed re-election and demoted to Northern Premier League | Mostly confirms layer 1; note return to EFL in 2020 and non-league period                          |
| Southport              | 1978-2011   | Failed re-election and demoted to Northern Premier League | Mostly confirms layer 1; note long non-league period after losing Football League place            |
| Crewe Alexandra        | 1896-1920   | Resigned from league                                      | Confirm non-league competitions before Third Division North entry                                  |
| Luton Town             | 1900-1919   | Failed re-election and demoted to Southern League         | Financial instability caused exit; rejoined Football League in 1920-21                             |
| Walsall                | 1901-1920   | Failed re-election and demoted                            | Confirm competitions/identity during non-league period                                             |
| Doncaster Rovers       | 1905-1922   | Failed re-election and demoted                            | Lost re-election votes in 1903 and 1905; returned to Midland League and rejoined in 1923           |
| Boston United          | 2007-2020   | Relegation to Conference North                            | Financial/admin nuance: relegated from League Two, later still in administration and demoted again |
| Gillingham             | 1938-1949   | Failed re-election and demoted to Southern League         | Confirm Southern League period and Football League return                                          |
| Port Vale              | 1907-1918   | Resigned from the league                                  | Financial collapse/insolvency, identity continuity through new Port Vale                           |
| Stoke City             | 1908-1918   | Resigned from the league                                  | Financial problems/liquidation and league return after war                                         |

## Spot-Check Research Notes

These notes are for planning only. They should be re-verified when encoded as layer 2 metadata.

### Merthyr Town

Layer 1 says the club failed re-election and was demoted to the Southern League after the 1929-30 season.

Research notes:

- The club played in the Football League from 1920 to 1930.
- It was voted out of the Football League in 1930.
- It returned to the Southern League and ceased to play in 1934.
- A Merthyr Tydfil club formed in 1945.
- Merthyr Tydfil liquidated in 2010 and a new Merthyr Town was formed.

Source:

- https://en.wikipedia.org/wiki/Merthyr_Town_F.C.

Likely layer 2 events:

- `not-re-elected` already generated from layer 1.
- `club-dissolved` or `club-inactive`, season 1934.
- `club-reformed`, season 1945, likely linked to Merthyr Tydfil identity.
- `liquidation`, season 2010.
- `club-reformed`, season 2010.

### Bradford (Park Avenue)

Layer 1 says the club failed re-election and was demoted to the Northern Premier League after the 1969-70 season.

Research notes:

- The club failed in its Football League re-election bid in 1970.
- It spent four seasons in the Northern Premier League before disbanding.
- The modern club identity requires careful handling as a revived/reformed club.

Source:

- https://en.wikipedia.org/wiki/Bradford_%28Park_Avenue%29_A.F.C.

Likely layer 2 events:

- `not-re-elected` already generated from layer 1.
- `club-dissolved` or `club-inactive`, season 1974.
- `club-reformed` or `phoenix`, season 1987 if confirmed and modeled.

### Barrow

Layer 1 says the club failed re-election and was demoted to the Northern Premier League after the 1971-72 season.

Research notes:

- The generated reason is directionally correct.
- The club returned to the EFL as National League champions in 2020.
- Our layer 1 gap ends earlier than 2020 because lower-tier tracked coverage starts seeing Barrow again before the EFL return.

Source:

- https://en.wikipedia.org/wiki/Barrow_A.F.C.

Likely layer 2 events:

- No urgent new event needed beyond layer 1.
- Optional: add researched note for EFL return in 2020 if we later track re-entry milestones.

### Southport

Layer 1 says the club failed re-election and was demoted to the Northern Premier League after the 1977-78 season.

Research notes:

- Southport was a Football League member from 1921 to 1978.
- It failed to gain re-election in 1978.
- It then played in the Northern Premier League and Football Conference structure.

Source:

- https://en.wikipedia.org/wiki/Southport_F.C.

Likely layer 2 events:

- No urgent new event needed beyond layer 1.
- Optional: add researched note for post-Football League competitions.

### Crewe Alexandra

Layer 1 says the club resigned from the league after the 1895-96 season.

Research notes:

- The table note explains the gap.
- Further research should confirm the club's non-league competitions between the 1896 exit and 1921 Football League return.
- Known likely path includes Combination, Lancashire League, Birmingham & District League, and Central League, but encode only after source verification.

Source:

- https://en.wikipedia.org/wiki/Crewe_Alexandra_F.C.

Likely layer 2 events:

- `resigned-from-league` already generated from layer 1.
- Optional: researched `joined-nonleague-competition` events are probably too granular for now.

### Luton Town

Layer 1 says the club failed re-election and was demoted to the Southern League after the 1899-1900 season.

Research notes:

- Luton joined the Football League in 1897.
- It left again in 1900 because of financial instability.
- It rejoined the Football League for the 1920-21 season.

Source:

- https://en.wikipedia.org/wiki/History_of_Luton_Town_F.C._%281885%E2%80%931970%29

Likely layer 2 events:

- Layer 1 event should maybe stay as `not-re-elected` if driven by the table note.
- Add researched `financial-issue` or `left-football-league` event for 1900 if we introduce that type.

### Boston United

Layer 1 says the club was relegated to Conference North after the 2006-07 season.

Research notes:

- Boston was relegated from League Two in May 2007.
- The club was still in administration in May 2008 and was relegated again to the Northern Premier League Premier Division.
- This is a good candidate for financial/admin metadata.

Source:

- https://en.wikipedia.org/wiki/Boston_United_F.C.

Likely layer 2 events:

- `relegated-outside-tracked-coverage` already generated from layer 1.
- `administration`, around 2007-2008.
- Optional `demoted` event for the 2008 administrative/financial drop.

### Port Vale

Layer 1 says Burslem Port Vale resigned from the league after the 1906-07 season.

Research notes:

- Financial turmoil intensified with debts and falling support.
- The chairman declared the club insolvent on 14 June 1907.
- Vale resigned from the Football League.
- There is identity-continuity nuance around the Port Vale name after the old Burslem Port Vale era ended.

Source:

- https://en.wikipedia.org/wiki/1906%E2%80%9307_Burslem_Port_Vale_F.C._season

Likely layer 2 events:

- `resigned-from-league` already generated from layer 1.
- `liquidation` or `club-inactive`, season 1907.
- `identity-continuity-note` for continuation under Port Vale.

### Stoke City

Layer 1 says Stoke resigned from the league after the 1907-08 season.

Research notes:

- Stoke had financial problems around 1900.
- In 1908, Stoke went into liquidation and resigned from the League.
- The club later continued and returned after the war-era gap.

Source:

- https://en.wikipedia.org/wiki/History_of_Stoke_City_F.C.

Likely layer 2 events:

- `resigned-from-league` already generated from layer 1.
- `liquidation`, season 1908.
- Optional `club-reformed` or `identity-continuity-note` depending on how the source describes the new company.

### Doncaster Rovers

Layer 1 says the club failed re-election and was demoted after the 1904-05 season.

Research notes:

- Doncaster entered the Football League in 1901.
- It lost re-election votes in 1903 and 1905.
- It returned to the Midland League.
- It was admitted to the Football League for a third time in 1923.

Source:

- https://en.wikipedia.org/wiki/Doncaster_Rovers_F.C.

Likely layer 2 events:

- `not-re-elected` already generated from layer 1.
- Optional researched `returned-to-football-league`, season 1923, if we decide to track re-entry events.

## Implementation Notes

Keep event types small at first. A reasonable initial enum:

- `not-re-elected`
- `resigned-from-league`
- `relegated-outside-tracked-coverage`
- `club-inactive`
- `club-dissolved`
- `club-reformed`
- `liquidation`
- `administration`
- `phoenix`
- `identity-continuity-note`

Do not add all event types to generated layer 1. Layer 1 should stay limited to table-note-derived continuity signals.

Layer 2 should be implemented as a curated enrichment pass with explicit source references and tests.
