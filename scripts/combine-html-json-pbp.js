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

// Use the html pbp to append plays to json pbp
function createJsonPlays(htmlPbp, jsonPbp) {
  const $ = cheerio.load(htmlPbp);
  const json = JSON.parse(jsonPbp);

  // Get players from rosters in json
  const players = [];
  ['away', 'home'].forEach((ven) => {
    const team = json.liveData.boxscore.teams[ven].team.abbreviation.toLowerCase();
    Object.keys(json.liveData.boxscore.teams[ven].players).forEach((key) => {
      const rawPlayer = json.liveData.boxscore.teams[ven].players[key];
      const player = {
        team,
        id: rawPlayer.person.id,
        name: rawPlayer.person.fullName,
        position: rawPlayer.position.code.toLowerCase().replace('/', ''),
      };

      if (Object.hasOwnProperty.call(rawPlayer, 'jerseyNumber')) {
        player.jersey = parseInt(rawPlayer.jerseyNumber, 10);
      }

      players.push(player);
    });
  });

  // Get [away, home] team abbreviations from the '### On Ice' table headings
  const teamTds = $('td.heading.bborder[width="10%"]');
  const teams = [teamTds[0], teamTds[1]]
    .map(td => $(td).text().split(' On Ice')[0].toLowerCase());

  // Map html play types -> json play types
  const typeMap = {
    pstr: 'period_start',
    pend: 'period_end',
    gend: 'game_end',
    fac: 'faceoff',
    stop: 'stop',
    goal: 'goal',
    shot: 'shot',
    block: 'blocked_shot',
    miss: 'missed_shot',
    take: 'takeaway',
    give: 'giveaway',
    hit: 'hit',
    penl: 'penalty',
  };

  // For each tr element, add a play object to htmlPlays
  const htmlPlays = [];
  const trs = $('tr.evenColor');
  trs.each((i, tr) => {
    const tds = $(tr).children('td.bborder');
    htmlPlays.push({
      id: parseInt($(tds[0]).text(), 10),
      period: parseInt($(tds[1]).text(), 10),

      type: typeMap[$(tds[4]).text().toLowerCase()],

      // Get the elapsed time from a '0:00<br>20:00' string
      time: $(tds[3]).html().split('<br>')[0],

      /**
       * Clean up whitespace
       * cheerio turns &nbsp; into &#xA0;
       * replace multiple spaces with a single space
       */
      desc: $(tds[5]).html()
        .split('<br>')
        .join(' ')
        .split('&#xA0;')
        .join(' ')
        .replace(/ +/g, ' ')
        .trim(),
    });
  });

  // Store lowercase description for searches
  htmlPlays.forEach(ev => (ev.descLow = ev.desc.toLowerCase()));

  // Get period type: regular, overtime, shootout
  htmlPlays.forEach((ev) => {
    if (ev.period <= 3) {
      ev.periodType = 'regular';
    } else if (ev.period === 4) {
      ev.periodType = 'overtime';
    } else {
      ev.periodType = gid < 30000 ? 'shootout' : 'overtime';
    }
  });

  /**
   * Attribute event to a team
   * Don't make adjustments for blocked shots - scrape-games.js will do it
   */
  htmlPlays.forEach((ev) => {
    const firstWord = ev.descLow.split(' ')[0];
    if (teams.includes(firstWord)) {
      ev.team = firstWord;
    }

    // Use json team abbreviations
    if (ev.team === 'n.j') {
      ev.team = 'njd';
    } else if (ev.team === 's.j') {
      ev.team = 'sjs';
    } else if (ev.team === 'l.a') {
      ev.team = 'lak';
    } else if (ev.team === 't.b') {
      ev.team = 'tbl';
    }
  });

  // Append zones to each event
  htmlPlays.forEach((ev) => {
    let zone = '';
    if (ev.descLow.includes('def. zone')) {
      zone = 'd';
    } else if (ev.descLow.includes('off. zone')) {
      zone = 'o';
    } else if (ev.descLow.includes('neu. zone')) {
      zone = 'n';
    }

    if (!zone || !Object.hasOwnProperty.call(ev, 'team')) {
      return;
    }

    const flipZone = {
      o: 'd',
      d: 'o',
      n: 'n',
    };
    if (ev.team === teams[0]) {
      ev.zones = [zone, flipZone[zone]];
    } else if (ev.team === teams[1]) {
      ev.zones = [flipZone[zone], zone];
    }

    // For blocked shots, the html uses the blocker's perspective - we want the shooter's
    if (ev.type === 'block') {
      ev.zones.reverse();
    }
  });

  // Get roles for each event - store players as 'tor #3'
  htmlPlays.filter(ev =>
    ['hit', 'faceoff', 'penalty', 'goal', 'shot', 'missed_shot', 'blocked_shot'].includes(ev.type))
    .forEach((ev) => {
      // Regular expression to match 'tor #3', 'ott #51', 'l.a #2', etc.
      const re = /... #\d+/g;
      ev.players = [];
      if (ev.type === 'hit') {
        // The hitter is listed first, the hittee second
        const substrs = ev.descLow.split(' hit ');
        ev.players.push({
          playerType: 'hitter',
          player: substrs[0].match(re)[0],
        });
        ev.players.push({
          playerType: 'hittee',
          player: substrs[1].match(re)[0],
        });
      } else if (ev.type === 'blocked_shot') {
        // The shooter is listed first, the blocker second
        const substrs = ev.descLow.split(' blocked by ');
        ev.players.push({
          playerType: 'shooter',
          player: substrs[0].match(re)[0],
        });
        ev.players.push({
          playerType: 'blocker',
          player: substrs[1].match(re)[0],
        });
      } else if (ev.type === 'missed_shot') {
        ev.players.push({
          playerType: 'shooter',
          player: ev.descLow.match(re)[0],
        });
      } else if (ev.type === 'shot') {
        const jersey = ev.descLow.match(/#\d+/g)[0];
        ev.players.push({
          playerType: 'shooter',
          player: `${ev.team} ${jersey}`,
        });
      } else if (ev.type === 'faceoff') {
        // Away player is always listed first
        const substrs = ev.descLow.split(' vs ');
        ev.players.push({
          playerType: ev.team === teams[0] ? 'winner' : 'loser',
          player: substrs[0].match(re)[0],
        });
        ev.players.push({
          playerType: ev.team === teams[1] ? 'winner' : 'loser',
          player: substrs[1].match(re)[0],
        });
      } else if (ev.type === 'goal') {
        const substrs = ev.descLow.split(' assists: ');
        ev.players.push({
          playerType: 'scorer',
          player: ev.descLow.match(re)[0],
        });

        // Get assisters
        if (substrs.length === 2) {
          substrs[1].match(/#\d+/g)
            .forEach((jer, i) => (ev.players.push({
              playerType: `assist${i + 1}`,
              player: `${ev.team} ${jer}`,
            })));
        }
      } else if (ev.type === 'penalty') {
        /**
         * The content between the 1st and 2nd spaces will be '#XX' if a player took the penalty;
         * the content will be 'TEAM' if a team took the penalty
         */
        const testStr = ev.descLow.split(' ')[1];
        if (testStr.includes('#')) {
          ev.players.push({
            playerType: 'penaltyon',
            player: `${ev.team} ${testStr}`,
          });
        }

        // Get player who served penalty
        const servedMatch = ev.descLow.match(/ served by: #\d+/g);
        if (servedMatch) {
          const servedBy = servedMatch[0].replace('served by: ', '').trim();
          ev.players.push({
            playerType: 'servedby',
            player: `${ev.team} ${servedBy}`,
          });
        }

        // Get player who drew penalty
        const drewMatch = ev.descLow.match(/ drawn by: #\d+/g);
        if (drewMatch) {
          const drewBy = drewMatch[0].replace('drawn by: ', '').trim();
          ev.players.push({
            playerType: 'drewby',
            player: `${ev.team} ${drewBy}`,
          });
        }
      }
    });

  // Replace players ('tor #3') with player ids
  htmlPlays.filter(ev => Object.hasOwnProperty.call(ev, 'players'))
    .forEach((ev) => {
      ev.players = ev.players.map((p) => {
        const pTeam = p.player.split(' ')[0];
        const pJersey = parseInt(p.player.split('#')[1], 10);
        const jsonPlayer = players.find(d => d.team === pTeam && d.jersey === pJersey);
        return {
          playerType: p.playerType,
          pid: jsonPlayer.id,
        };
      });
    });

  // Append penalty properties
  htmlPlays.filter(ev => ev.type === 'penalty')
    .forEach((ev) => {
      // Get penalty duration (penalty shots have 0)
      const penMins = ev.descLow.match(/\(\d+ min\)/g)[0]
        .replace('(', '')
        .replace(' min)', '');
      ev.penMins = parseInt(penMins, 10);

      // Get penalty severity
      if (ev.penMins === 0) {
        ev.penSeverity = 'penalty shot';
      } else if (ev.penMins === 2) {
        ev.penSeverity = ev.descLow.includes('(bench') ? 'bench minor' : 'minor';
      } else if (ev.penMins === 4) {
        ev.penSeverity = 'minor';
      } else if (ev.penMins === 5) {
        ev.penSeverity = 'major';
      } else if (ev.penMins === 10) {
        if (ev.descLow.includes('game misconduct')) {
          ev.penSeverity = 'game misconduct';
        } else if (ev.descLow.includes('misconduct')) {
          ev.penSeverity = 'misconduct';
        } else if (ev.descLow.includes('match penalty')) {
          ev.penSeverity = 'match';
        }
      }
    });
}

Promise.all(promises)
  .then(fetched => createJsonPlays(fetched[0], fetched[1]));
