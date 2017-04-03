const request = require('request');

const gids = [2016020001, 2016020002];

// Return a promise for a json object
function promisifyRequest(url) {
  return new Promise((resolve, reject) => {
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
  });
}

// Return a promise for both the pbp and shift json objects
function fetchNhlData(gid) {
  const pbpUrl = `https://statsapi.web.nhl.com/api/v1/game/${gid}/feed/live`;
  const pbpPromise = promisifyRequest(pbpUrl);
  const shiftUrl = `http://www.nhl.com/stats/rest/shiftcharts?cayenneExp=gameId=${gid}`;
  const shiftPromise = promisifyRequest(shiftUrl);
  return Promise.all([pbpPromise, shiftPromise]);
}

// Process the nhl data and write results to database
function processData(pbpData, shiftData) {
  console.log(pbpData);
  console.log(shiftData);
}

// Scrape data for the first game id in `gids`
// This function calls itself to iterate through an array of game ids
function scrapeFirstInArray() {
  fetchNhlData(gids[0]).then((responses) => {
    processData(responses[0], responses[1]);
    console.log(`Finished processing ${gids[0]} at ${new Date()}`);

    // Scrape next game by shifting the array (what was previously the 2nd element becomes the 1st)
    // Use a delay to space out api requests and database writes
    gids.shift();
    if (gids.length > 0) {
      console.log(`Started scraping ${gids[0]} at ${new Date()}`);
      setTimeout(() => scrapeFirstInArray(), 1000);
    } else {
      console.log('Scrape finished');
    }
  });
}

scrapeFirstInArray();
