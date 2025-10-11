import * as cheerio from "cheerio";

/**
 * Normalize header text to map columns reliably across eras.
 */
function normalizeHeader(txt) {
  const t = txt.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.]/g, "");

  if (t === "pos" || t === "position" || t === "no") return "pos";
  if (t === "team" || t === "club" || t === "side") return "team";
  if (t === "pld" || t === "p" || t === "played") return "played";
  if (t === "w" || t === "won") return "won";
  if (t === "d" || t === "draw" || t === "drawn") return "drawn";
  if (t === "l" || t === "lost") return "lost";
  if (t === "gf" || t === "goals for") return "goalsFor";
  if (t === "ga" || t === "goals against") return "goalsAgainst";
  if (t === "gd" || t === "goal difference") return "goalDifference";
  if (
    t === "gav" ||
    t === "gavg" ||
    t === "goal average" ||
    t === "ga v" ||
    t === "g av"
  )
    return "goalAverage";
  if (t === "pts" || t === "points") return "points";
  if (
    t.includes("qualification") ||
    t.includes("relegation") ||
    t === "notes" ||
    t === "remarks"
  )
    return "notes";
  return t; // unknown, keep raw (won't be mapped)
}

/**
 * Note flag helpers
 */
function wasRelegated(note) {
  const n = String(note || "").toLowerCase();
  if (!n) return false;

  if (n.includes("relegat")) return true;
  if (n.includes("demoted to the")) return true;

  // Explicit cases that mean NOT relegated
  if (n.includes("re-elected")) return false;
  if (
    n.includes("reprived from re-election") ||
    n.includes("reprieved from re-election")
  )
    return false;

  return false;
}

function wasPromoted(note) {
  return String(note || "")
    .toLowerCase()
    .includes("promot");
}

function isExpansionTeam(note) {
  const n = String(note || "").toLowerCase();
  return (
    n.includes("expansion") ||
    n.includes("new club") ||
    n.includes("admitted") ||
    n.includes("joined league")
  );
}

/**
 * Extract clean text from a cell: strips references/footnotes.
 */
function cellText($, cell) {
  const clone = $(cell).clone();
  clone
    .find(
      "sup.reference, span.reference, style, script, .navbar, .plainlinks, .hlist"
    )
    .remove();
  return clone
    .text()
    .replace(/\[\d+\]/g, "")
    .trim();
}

function mapDivisionToSlug(division) {
  switch (division) {
    case "first":
      return "#First_Division";
    case "second":
      return "#Second_Division";
    default:
      return "";
  }
}

function fallbackHeadersForEarlyYears($) {
  const possibleHeaders = ["#Final_league_table", "#League_table"];

  for (const slug of possibleHeaders) {
    const header = $(slug);
    if (header.length) {
      return header;
    }
  }

  // Nothing found
  return null;
}

/**
 * Util methods
 */

function isFirstDivision(division) {
  return `${division}`.toLowerCase().includes("first");
}

/**
 * Parse a league division table from a Football League Wikipedia page.
 */
export function parseDivisionTable(html, division) {
  const $ = cheerio.load(html);

  const headerSlug = mapDivisionToSlug(division);

  //fallback check, if no header found with that, check if league table or final league table League_table,

  // Step 1: Find the header
  let header = $(headerSlug);
  if (!header.length) {
    header = fallbackHeadersForEarlyYears($);
    if (!header) {
      console.warn("⚠️ No known league table header found for this season");
      return []; //exit early
    }
  }

  // Step 2: From that header, traverse forward to the first .wikitable
  const table = header.closest("div").nextAll(".wikitable").first();

  // Build header map (index -> field)
  const headerRow = table.find("tr").first();
  const headerCells = headerRow.find("th");
  const headerMap = [];
  headerCells.each((i, th) => {
    const label = cellText($, th);
    headerMap[i] = normalizeHeader(label);
  });

  // Helper to find index by field name
  const idxOf = (field) => headerMap.findIndex((h) => h === field);

  // Track rowspan carryover for 'notes' column
  let notesCarry = { text: null, remaining: 0 };
  const results = [];

  // Iterate data rows (skip the header row)
  table
    .find("tr")
    .slice(1)
    .each((_, tr) => {
      const $tr = $(tr);

      // Skip sub-headers or separators
      const dataCells = $tr.find('td, th[scope="row"]');
      if (dataCells.length === 0) return;

      // Collect texts
      const texts = [];
      dataCells.each((_, c) => {
        if ($(c).is('th[scope="row"]')) {
          const teamLink = $(c).find("a").first().text().trim();
          texts.push(teamLink || cellText($, c));
        } else {
          texts.push(cellText($, c));
        }
      });

      const isProbablyHeader =
        texts.every((t) => Number.isNaN(parseInt(t, 10))) &&
        texts.some((t) => /team|club|pld|pts/i.test(t));
      if (isProbablyHeader) return;

      const get = (field) => {
        const i = idxOf(field);
        if (i === -1) return undefined;
        return texts[i];
      };

      const num = (v) => {
        if (v == null) return null;
        const n = parseFloat(String(v).replace(/[^\d.-]/g, ""));
        return Number.isNaN(n) ? null : n;
      };

      const row = {
        pos: num(get("pos")),
        team: get("team") || null,
        played: num(get("played")),
        won: num(get("won")),
        drawn: num(get("drawn")),
        lost: num(get("lost")),
        goalsFor: num(get("goalsFor")),
        goalsAgainst: num(get("goalsAgainst")),
        goalDifference: num(get("goalDifference")),
        goalAverage: num(get("goalAverage")),
        points: num(get("points")),
        notes: null,
        wasRelegated: null,
        wasPromoted: null,
        isExpansionTeam: null,
        wasReElected: null,
        wasReprieved: null,
      };

      // Handle notes
      let notesIdx = idxOf("notes");
      if (notesIdx === -1 && headerMap.length > 0) {
        // fallback: assume last column
        notesIdx = headerMap.length - 1;
      }

      if (notesIdx !== -1) {
        const rawNotesCell = $tr.find("td, th").get(notesIdx);
        if (rawNotesCell) {
          const text = cellText($, rawNotesCell) || null;
          row.notes = text?.length ? text : null;

          const rs = parseInt($(rawNotesCell).attr("rowspan") || "1", 10);
          if (!Number.isNaN(rs) && rs > 1) {
            notesCarry = { text: row.notes, remaining: rs - 1 };
          } else {
            notesCarry = { text: null, remaining: 0 };
          }
        } else if (notesCarry.remaining > 0) {
          row.notes = notesCarry.text;
          notesCarry.remaining -= 1;
        }
      }

      // Derive booleans from notes
      row.wasPromoted = isFirstDivision(division)
        ? false
        : wasPromoted(row.notes);
      row.wasRelegated = wasRelegated(row.notes);
      row.isExpansionTeam = isExpansionTeam(row.notes);

      // Extra explicit flags for clarity
      row.wasReElected = String(row.notes || "")
        .toLowerCase()
        .includes("re-elected");
      row.wasReprieved = /repriv(?:ed|ed) from re-election/.test(
        String(row.notes || "").toLowerCase()
      );

      if (row.team && row.pos != null) {
        results.push(row);
      }
    });

  return results;
}

export default parseDivisionTable;
