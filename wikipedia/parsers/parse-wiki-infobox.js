import * as cheerio from 'cheerio';

/**
 * Parse season info from a Football League Wikipedia page.
 * Handles both singular and plural 'New Club(s) in League' and optional 'Folded'.
 * @param {string} html - HTML content of the Wikipedia page
 * @returns {Promise<{season: string, relegated: string[], newClubs: string[], folded: string[]}>}
 */
async function parseInfobox(html) {
  const $ = cheerio.load(html);

  // Find the infobox with the correct caption
  const table = $('table.infobox')
    .filter((_, el) => {
      const captionLink = $(el).find('caption.infobox-title a');
      return captionLink.length > 0 && captionLink.text().trim() === 'The Football League';
    })
    .first();

  if (table.length === 0) {
    // No matching infobox found
    return { season: '', relegated: [], newClubs: [], folded: [], resigned: [] };
  }
  const season = table.find('th:contains("Season")').next('td').text().trim();

  // Get relegated teams
  const relegatedCell = table.find('th:contains("Relegated")').next('td');
  let relegated = [];
  if (relegatedCell.length > 0) {
    const text = relegatedCell.text().trim().toLowerCase();
    if (text !== 'none') {
      relegated = relegatedCell
        .find('a')
        .map((_, el) => $(el).text().trim())
        .get();
    }
  }

  // Handle both "New Club in League" (singular) and "New Clubs in League" (plural)
  const newClubsCell = table
    .find('th:contains("New Club in League"), th:contains("New Clubs in League")')
    .next('td');
  let newClubs = [];
  if (newClubsCell.length > 0) {
    const text = newClubsCell.text().trim().toLowerCase();
    if (text !== 'none') {
      newClubs = newClubsCell
        .find('a')
        .map((_, el) => $(el).text().trim())
        .get();
    }
  }

  // Optional folded clubs (some pages have it, some don't)
  const foldedCell = table.find('th:contains("Folded")').next('td');
  let folded = [];
  if (foldedCell.length > 0) {
    const text = foldedCell.text().trim().toLowerCase();
    if (text !== 'none') {
      folded = foldedCell
        .find('a')
        .map((_, el) => $(el).text().trim())
        .get();
    }
  }

  // Optional resigned clubs
  const resignedCell = table.find('th:contains("Resigned")').next('td');
  let resigned = [];
  if (resignedCell.length > 0) {
    const text = resignedCell.text().trim().toLowerCase();
    if (text !== 'none') {
      resigned = resignedCell
        .find('a')
        .map((_, el) => $(el).text().trim())
        .get();
    }
  }

  return { season, relegated, newClubs, folded, resigned };
}

export default parseInfobox;
