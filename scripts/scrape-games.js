/**
 * scrape-games.js scrapes raw NHL data, processes it, and writes the results to the database
 * 2010020001 is the earliest game with populated pbp and shift json files
 * Usage: node scrape-games.js season gid1[-gid2] [local or save]
 * season: the year in which a season started; the 2016-2017 season would be specified as 2016
 * gid1[-gid2]: 5 digit game id; scrape a range by specifying both gids separated by '-'
 * local or save: use local json files, or save downloaded json files locally
 *    if local is specified, but the files don't exist, then the files will be downloaded and saved
 *
 * game ids for the first game of playoff series:
 * round 1: 30111 (game 2 would be 30112), 30121, 30131, 30141, 30151, 30161, 30171, 30181
 * round 2: 30211, 30221, 30231, 30241
 * round 3: 30311, 30321
 * finals: 30411
 */

const request = require('request');
const fs = require('fs');
const transform = require('./transform-scraped-data');
const config = require('../config');
const knex = require('knex')({
  client: 'pg',
  connection: {
    host: config.DB_HOST,
    database: config.DB_NAME,
    user: config.DB_USER_WRITER,
    password: config.DB_USER_WRITER_PASSWORD,
  },
});

/**
 * Global variables
 * userArgs: user arguments
 * gids: game ids to scrape
 */
const userArgs = {
  season: parseInt(process.argv[2], 10),
  gidRange: process.argv[3].split('-')
    .map(d => parseInt(d, 10)),
  useLocal: process.argv[4] === 'local',
  saveDownloads: process.argv[4] === 'save',
};
const gids = [];

// Sanitize season argument
if (isNaN(userArgs.season) || userArgs.season < 2010 || userArgs.season > 2020) {
  console.log('Invalid season');
  process.exit(1);
}

// Sanitize gidRange argument
if (userArgs.gidRange.length > 2) {
  console.log('Invalid gidRange: Too many gids specified');
  process.exit(1);
} else if (userArgs.gidRange.filter(d => isNaN(d) || d <= 20000 || d >= 40000).length > 0) {
  console.log('Invalid gidRange: Invalid gid specified');
  process.exit(1);
}

// If only 1 gid was specified, reuse it for the second gidRange element
userArgs.gidRange[1] = userArgs.gidRange[1] || userArgs.gidRange[0];

// Create array of gids
for (let i = userArgs.gidRange[0]; i <= userArgs.gidRange[1]; i += 1) {
  gids.push((userArgs.season * 1000000) + i);
}

/**
 * Return a Promise.all whose iterable contains:
 * 0. A promise for the specified game's pbp data
 * 1. A promise for the specified game's shift data
 */
function fetchNhlData(gid) {
  const pbpUrl = `https://statsapi.web.nhl.com/api/v1/game/${gid}/feed/live`;
  const shiftUrl = `http://www.nhl.com/stats/rest/shiftcharts?cayenneExp=gameId=${gid}`;
  const pbpPath = `raw-data/${gid}-pbp.json`;
  const shiftPath = `raw-data/${gid}-shifts.json`;

  // Check if local files exist if we want to use them
  let useLocalForGid = userArgs.useLocal;
  let saveForGid = userArgs.saveDownloads;
  if (userArgs.useLocal) {
    try {
      fs.statSync(pbpPath);
      fs.statSync(shiftPath);
    } catch (e) {
      console.log(`[${gid}] Unable to find local files`);
      useLocalForGid = false;
      saveForGid = true;
    }
  }

  // Create promises for json files
  let promises = [];
  if (useLocalForGid) {
    console.log(`[${gid}] Using local files`);
    promises = [pbpPath, shiftPath].map(path => (
      new Promise((resolve, reject) => {
        fs.readFile(path, (err, body) => (
          err ? reject(err) : resolve(JSON.parse(body))
        ));
      })
    ));
  } else {
    console.log(`[${gid}] Downloading files`);
    promises = [pbpUrl, shiftUrl].map(url => (
      new Promise((resolve, reject) => {
        request(url, (err, res, body) => {
          if (err) {
            return reject(err);
          } else if (res.statusCode !== 200) {
            const rejErr = new Error(`Unexpected status code: ${res.statusCode}`);
            rejErr.res = res;
            return reject(rejErr);
          } else if (url === shiftUrl && JSON.parse(body).data.length === 0) {
            // Skip game if shift data is empty
            return reject(new Error('Shift data is empty'));
          }

          // Save downloaded files
          if (saveForGid) {
            const savePath = url === pbpUrl ? pbpPath : shiftPath;
            console.log(`[${gid}] Saving ${savePath}`);
            fs.writeFile(savePath, body, (writeErr) => {
              const msg = writeErr ?
                `Error saving ${savePath}: ${writeErr}` :
                `Saved ${savePath}`;
              console.log(`[${gid}] ${msg}`);
            });
          }

          return resolve(JSON.parse(body));
        });
      })
    ));
  }

  return Promise.all(promises);
}

/**
 * Given an object whose properties match table names, and each property's value
 * is an array of row objects, insert the rows into the database
 */
function insertToDb(tblData) {
  if (Object.keys(tblData).length === 0) {
    return 'No data to insert';
  }

  // Set the conditions for deleting this game's rows from a table
  const delConditions = {
    season: tblData.games[0].season,
    game_id: tblData.games[0].game_id,
  };

  // Create raw query for players table, since knex doesn't have ON CONFLICT built in
  const playersQuery = `${knex('players').insert(tblData.players).toString()} \
    ON CONFLICT (player_id) DO UPDATE \
    SET first_name = EXCLUDED.first_name, \
      last_name = EXCLUDED.last_name;`;

  // Create raw query for teams table, since knex doesn't have ON CONFLICT built in
  const teamsQuery = `${knex('teams').insert(tblData.teams).toString()} \
    ON CONFLICT (team_id) DO UPDATE \
    SET abbreviation = EXCLUDED.abbreviation, \
      team_name = EXCLUDED.team_name;`;

  return knex('games').where(delConditions).del()
    .then(() => knex.raw(teamsQuery))
    .then(() => knex('games').insert(tblData.games))
    .then(() => knex('game_teams').where(delConditions).del())
    .then(() => knex('game_teams').insert(tblData.game_teams))
    .then(() => knex('game_team_stats').where(delConditions).del())
    .then(() => knex('game_team_stats').insert(tblData.game_team_stats))
    .then(() => knex.raw(playersQuery))
    .then(() => knex('game_players').where(delConditions).del())
    .then(() => knex('game_players').insert(tblData.game_players))
    .then(() => knex('game_player_stats').where(delConditions).del())
    .then(() => knex('game_player_stats').insert(tblData.game_player_stats))
    .then(() => knex('game_events').where(delConditions).del())
    .then(() => knex('game_events').insert(tblData.game_events))
    .then(() => knex('game_event_players').where(delConditions).del())
    .then(() => knex('game_event_players').insert(tblData.game_event_players))
    .then(() => knex('game_shifts').where(delConditions).del())
    .then(() => knex('game_shifts').insert(tblData.game_shifts))
    .then(() => knex('game_situations').where(delConditions).del())
    .then(() => knex('game_situations').insert(tblData.game_situations))
    .then(() => 'Rows inserted');
}

/**
 * Scrape data for an array of game ids by:
 * 1. Fetching the nhl pbp and shift data for the game id at the specified index
 * 2. Generating database rows to be inserted
 * 3. Inserting the database rows
 * 4. Repeating for the next game id
 */
function scrapeGame(idx) {
  console.log(`[${gids[idx]}] Starting scrape`);
  fetchNhlData(gids[idx])
    .then(
      fetched => transform.transformData(fetched[0], fetched[1]),
      () => {
        console.log(`[${gids[idx]}] Error fetching data. Skipping game`);
        return {};
      })
    .then(rowsToInsert => insertToDb(rowsToInsert))
    .then((insertResult) => {
      // Scrape the next game
      console.log(`[${gids[idx]}] ${insertResult}`);
      if (idx < gids.length - 1) {
        scrapeGame(idx + 1);
      } else {
        console.log('Finished scraping games');
        process.exit();
      }
    })
    .catch(err => console.log(err));
}

// Start scraping from the first gid
scrapeGame(0);
