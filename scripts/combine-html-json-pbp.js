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
  const json = JSON.parse(jsonPbp);

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
      time: parseTime($(tds[3]).html()),
      type: typeMap[$(tds[4]).text().toLowerCase()],

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

  // Get [away, home] team abbreviations from the '### On Ice' table headings
  const tds = $('td.heading.bborder[width="10%"]');
  const teams = [tds[0], tds[1]].map(td => $(td).text().split(' On Ice')[0].toLowerCase());

  /**
   * Attribute event to a team
   * Don't make adjustments for blocked shots - scrape-games.js will do it
   */
  htmlPlays.forEach((ev) => {
    const firstWord = ev.desc.split(' ')[0].toLowerCase();
    if (teams.includes(firstWord)) {
      ev.team = firstWord;
    }
  });

  // Append zones to each event
  htmlPlays.forEach((ev) => {
    let zone;
    if (ev.desc.includes('Def. Zone')) {
      zone = 'd';
    } else if (ev.desc.includes('Off. Zone')) {
      zone = 'o';
    } else if (ev.desc.includes('Neu. Zone')) {
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

    // html plays list the zone from the blocker's perspective - flip this
    if (ev.type === 'block') {
      ev.zones.reverse();
    }
  });

  // Get players from json
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

  // Get roles for each event
  htmlPlays.forEach((ev) => {
    if (!['hit', 'faceoff', 'penalty', 'goal', 'shot', 'missed_shot', 'blocked_shot']
      .includes(ev.type)) {
      return;
    }

    // Regex to find entries like 'tor #3', 'ott #51', 'l.a #2'
    const re = /... #\d+/gi;

    // Get players for each event - players are stored as 'tor #3'
    ev.players = [];
    if (ev.type === 'hit') {
      // The hitter is listed first, the hittee second
      const substrs = ev.desc.toLowerCase().split(' hit ');
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
      const substrs = ev.desc.toLowerCase().split(' blocked by ');
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
        player: ev.desc.toLowerCase().match(re)[0],
      });
    } else if (ev.type === 'shot') {
      const jerseyRe = /#\d+/gi;
      const jersey = ev.desc.toLowerCase().match(jerseyRe)[0];
      ev.players.push({
        playerType: 'shooter',
        player: `${ev.team} ${jersey}`,
      });
    } else if (ev.type === 'faceoff') {
      // Away player is always listed first
      const substrs = ev.desc.toLowerCase().split(' vs ');
      ev.players.push({
        playerType: ev.team === teams[0] ? 'winner' : 'loser',
        player: substrs[0].match(re)[0],
      });
      ev.players.push({
        playerType: ev.team === teams[1] ? 'winner' : 'loser',
        player: substrs[1].match(re)[0],
      });
    } else if (ev.type === 'goal') {
      const substrs = ev.desc.toLowerCase().split(' assists: ');
      ev.players.push({
        playerType: 'scorer',
        player: ev.desc.toLowerCase().match(re)[0],
      });

      // Get assisters
      if (substrs.length === 2) {
        const jerseyRe = /#\d+/gi;
        substrs[1].match(jerseyRe).forEach((jer, i) => (ev.players.push({
          playerType: `assist${i + 1}`,
          player: `${ev.team} ${jer}`,
        })));
      }
    } else if (ev.type === 'penalty') {
      /**
       * Get the content between the 1st and 2nd spaces
       * If a player took the penalty, then it will return '#XX'
       * If a team took the penalty, then it will return 'TEAM'
       */
      const testStr = ev.desc.toLowerCase().split(' ')[1];
      if (testStr.includes('#')) {
        ev.players.push({
          playerType: 'penaltyon',
          player: `${ev.team} ${testStr}`,
        });
      }

      // Get player who served penalty
      const servedRe = / served by: #\d+/gi;
      const servedMatch = ev.desc.toLowerCase().match(servedRe);
      if (servedMatch) {
        const servedBy = servedMatch[0].replace('served by: ', '').trim();
        ev.players.push({
          playerType: 'servedby',
          player: `${ev.team} ${servedBy}`,
        });
      }

      // Get player who drew penalty
      const drewRe = / drawn by: #\d+/gi;
      const drewMatch = ev.desc.toLowerCase().match(drewRe);
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
  htmlPlays
    .filter(ev => Object.hasOwnProperty.call(ev, 'players'))
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

  // TODO: Penalty type, severity, minutes
}

Promise.all(promises)
  .then(fetched => createJsonPlays(fetched[0], fetched[1]));
