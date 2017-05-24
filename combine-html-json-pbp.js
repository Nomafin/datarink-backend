/**
 * combine-html-json-pbp.js is used to fill in pbp jsons with 0 entries in allPlays
 * Usage: node combine-html-json-pbp.js 2016 20001
 * Output: 2016020001-pbp.json
 * To use the output:
 *  1. Put the output json in /raw-data
 *  2. node scrape-games.js 2016 200001 local
 */

const request = require('request');
const cheerio = require('cheerio');

// Parse user arguments
const season = parseInt(process.argv[2], 10);
const gid = parseInt(process.argv[3], 10);

// Create promise to fetch data
const htmlUrl = `http://www.nhl.com/scores/htmlreports/${season}${season + 1}/PL0${gid}.HTM`;
const jsonUrl = `https://statsapi.web.nhl.com/api/v1/game/${season}0${gid}/feed/live`;
const promises = [htmlUrl, jsonUrl].map(url => (
  new Promise((resolve, reject) => {
    request(url, (err, res, body) => {
      if (err) {
        return reject(err);
      } else if (res.statusCode !== 200) {
        const rejErr = new Error(`Unexpected status code: ${res.statusCode}`);
        rejErr.res = res;
        return reject(rejErr);
      }

      return resolve(body);
    });
  })
));

// Convert a "0:00<br>20:00" string to elapsed time in seconds
function parseTime(htmlString) {
  const elapsedMmss = htmlString.split('<br>')[0];
  const arr = elapsedMmss.split(':').map(str => parseInt(str, 10));
  return (60 * arr[0]) + arr[1];
}


// Use the html pbp to append plays to json pbp
function createJsonPlays(htmlPbp, jsonPbp) {
  const $ = cheerio.load(htmlPbp);

  /**
   * Given an array of <font> elements (used to list on-ice players in the html pbp),
   * return an array of players
   */
  function getOnIcePlayers(fontEls) {
    const players = [];
    fontEls.each((idx, el) => {
      players.push({
        name: $(el).attr('title').split(' - ')[1],
        position: $(el).attr('title').split(' - ')[0],
        jersey: parseInt($(el).text(), 10),
      });
    });
    return players;
  }

  // For each tr element, add a play object to htmlPlays
  const htmlPlays = [];
  const trs = $('tr.evenColor');
  trs.each((i, tr) => {
    const tds = $(tr).children('td.bborder');
    htmlPlays.push({
      id: parseInt($(tds[0]).text(), 10),
      period: parseInt($(tds[1]).text(), 10),
      time: parseTime($(tds[3]).html()),
      type: $(tds[4]).text().toLowerCase(),
      description: $(tds[5]).html().split('<br>').join(' '),
      aOnIce: getOnIcePlayers($(tds[6]).find('font')),
      hOnIce: getOnIcePlayers($(tds[7]).find('font')),
    });
  });

  // Get the team abbreviations from the '### On Ice' table headings
  const tds = $('td.heading.bborder[width="10%"]');
  const teams = [
    $(tds[0]).text().split(' On Ice')[0].toLowerCase(),
    $(tds[1]).text().split(' On Ice')[0].toLowerCase(),
  ];
}

Promise.all(promises)
  .then(fetched => createJsonPlays(fetched[0], fetched[1]));
