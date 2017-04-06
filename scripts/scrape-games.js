const request = require('request');

/**
 * Return a Promise.all whose iterable contains:
 * 0. A promise for the specified game's pbp data
 * 1. A promise for the specified game's shift data
 */
function fetchNhlData(gid) {
  const pbpUrl = `https://statsapi.web.nhl.com/api/v1/game/${gid}/feed/live`;
  const shiftUrl = `http://www.nhl.com/stats/rest/shiftcharts?cayenneExp=gameId=${gid}`;
  const promises = [pbpUrl, shiftUrl].map(url =>
    new Promise((resolve, reject) => {
      request(url, (err, res, body) => {
        if (err) {
          return reject(err);
        } else if (res.statusCode !== 200) {
          const rejErr = new Error(`Unexpected status code: ${res.statusCode}`);
          rejErr.res = res;
          return reject(rejErr);
        }
        return resolve(JSON.parse(body));
      });
    }) // eslint-disable-line comma-dangle
  );
  return Promise.all(promises);
}

/**
 * Given the nhl's pbp and shift data,
 * return an object containing the rows to be inserted
 */
function processData(pbpJson, shiftJson) {
  return {
    table1Rows: ['a', 'b', 'c', pbpJson.gamePk],
    table2Rows: ['x', 'y', 'z', shiftJson.data.length],
  };
}

/**
 * Scrape data for an array of game ids by:
 * 1. Fetching the nhl pbp and shift data for the game id at the specified index
 * 2. Generating database rows to be inserted
 * 3. Inserting the database rows
 * 4. Repeating for the next game id
 */
function scrapeGame(gids, idx) {
  fetchNhlData(gids[idx])
    .then((data) => {
      // Process the fetched data
      const rowsToInsert = processData(data[0], data[1]);
      return rowsToInsert;
    })
    .then((rowsToInsert) => {
      // Insert rows into database
      console.log(`Inserting rows for ${gids[idx]}`);
      console.log(rowsToInsert);
      return 'Rows inserted';
    })
    .then((insertResult) => {
      console.log(insertResult);

      // Scrape the next game
      if (idx < gids.length - 1) {
        scrapeGame(gids, idx + 1);
      } else {
        console.log('Finished scraping games');
      }
    });
}

// Specify game ids and start scraping from the first game id
const gids = [2016020001, 2016020002];
scrapeGame(gids, 0);
