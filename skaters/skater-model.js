const db = require('../db');
const constants = require('../helpers/analysis-constants');

// Export function that queries and returns skater list
module.exports.skaters = function skaters(conditions) {
  // Create 'select' entries for adjusted cf and ca
  let adjCfQuery = Object.keys(constants.cfWeights).reduce((result, key) =>
    `${result} when score_sit = ${key} then cast(${constants.cfWeights[key]} * (sf + msf + bsf) as real)`,
    'case ');
  adjCfQuery += 'end';
  let adjCaQuery = Object.keys(constants.caWeights).reduce((result, key) =>
    `${result} when score_sit = ${key} then cast(${constants.caWeights[key]} * (sa + msa + bsa) as real)`,
    'case ');
  adjCaQuery += 'end';

  // Create subquery for player stats
  const statsQuery = db.knex.select('s.player_id',
    db.knex.raw('SUM(toi) as toi'), db.knex.raw('SUM(ig) as ig'),
    db.knex.raw('SUM(isog) as isog'), db.knex.raw('SUM(isog + ibs + ims) as ic'),
    db.knex.raw('SUM(ia1) as ia1'), db.knex.raw('SUM(ia2) as ia2'),
    db.knex.raw('SUM(i_blocked) as i_blocked'),
    db.knex.raw('SUM(i_ofo_won + i_dfo_won + i_nfo_won) as i_fo_won'),
    db.knex.raw('SUM(i_ofo_lost + i_dfo_lost + i_nfo_lost) as i_fo_lost'),
    db.knex.raw('SUM(i_eff_pen_drawn) as i_eff_pen_drawn'),
    db.knex.raw('SUM(i_eff_pen_taken) as i_eff_pen_taken'),
    db.knex.raw('SUM(gf) as gf'), db.knex.raw('SUM(ga) as ga'),
    db.knex.raw('SUM(sf) as sf'), db.knex.raw('SUM(sa) as sa'),
    db.knex.raw('SUM(sf + bsf + msf) as cf'), db.knex.raw('SUM(sa + bsa + msa) as ca'),
    db.knex.raw(`SUM(${adjCfQuery}) as adj_cf`), db.knex.raw(`SUM(${adjCaQuery}) as adj_ca`),
    db.knex.raw('SUM(i_otf) as otf'), db.knex.raw('SUM(nfo_won + nfo_lost) as nfo'),
    db.knex.raw('SUM(ofo_won + ofo_lost) as ofo'), db.knex.raw('SUM(dfo_won + dfo_lost) as dfo'))
    .from('game_player_stats as s')
    .join(
      db.knex.select('*')
        .from('games')
        .whereBetween('games.game_date', [conditions.start, conditions.end])
        .as('g'), {
          'g.game_id': 's.game_id',
        });

  if (conditions.strSits) {
    statsQuery.whereIn('s.strength_sit', conditions.strSits);
  }

  if (conditions.scoreSits) {
    statsQuery.whereIn('s.score_sit', conditions.scoreSits);
  }

  if (conditions.playoffs && ['only', 'exclude'].indexOf(conditions.playoffs) >= 0) {
    statsQuery.where('g.is_playoff', conditions.playoffs === 'only');
  }

  statsQuery.groupBy('s.player_id');

  // Create subquery for teams and positions played per player, one array element per game
  const positionsTeamsQuery = db.knex.select('player_id',
    db.knex.raw('string_agg(position, \',\') as positions'),
    db.knex.raw('string_agg(abbreviation, \',\') as teams'))
    .from('game_players')
    .join(
      'games', {
        'game_players.game_id': 'games.game_id',
      })
    .join(
      'teams', {
        'game_players.team_id': 'teams.team_id',
      })
    .whereBetween('games.game_date', [conditions.start, conditions.end]);

  if (conditions.playoffs && ['only', 'exclude'].indexOf(conditions.playoffs) >= 0) {
    positionsTeamsQuery.where('games.is_playoff', conditions.playoffs === 'only');
  }

  positionsTeamsQuery.groupBy('player_id');

  // Create full query
  const query = db.knex.select('s.*', 'p.first_name', 'p.last_name',
    'r.positions', 'r.teams')
    .from('players as p')
    .join(
      statsQuery.as('s'), {
        's.player_id': 'p.player_id',
      })
    .join(
      positionsTeamsQuery.as('r'), {
        'r.player_id': 'p.player_id',
      });

  // Run query and process results
  return query
    .then(rows => rows.map((r) => {
      // Count the occurrence of each position, excluding 'na'
      r.positions = r.positions.split(',').filter(p => p !== 'na');
      const posCount = {};
      r.positions.forEach((p) => {
        posCount[p] = Object.hasOwnProperty.call(posCount, p) ? posCount[p] + 1 : 1;
      });

      // Get unique teams
      r.teams = r.teams.split(',').reduce((result, cur) => {
        if (result.indexOf(cur) < 0) {
          result.push(cur);
        }
        return result;
      }, []);

      // Return the most common position
      r.position = Object.keys(posCount).reduce((max, cur) => {
        if (!max) {
          return cur;
        }
        return posCount[cur] >= posCount[max] ? cur : max;
      });

      // Get games played based on the positions array, saving us a count(distinct game_id) query
      r.gp = r.positions.length;

      // Get unique positions
      r.positions = r.positions.reduce((result, cur) => {
        if (result.indexOf(cur) < 0) {
          result.push(cur);
        }
        return result;
      }, []);

      // Cast summed values
      Object.keys(r)
        .filter(key =>
          ['player_id', 'first_name', 'last_name', 'position', 'positions', 'teams'].indexOf(key) < 0
          && typeof r[key] === 'string')
        .forEach(key => (r[key] = parseInt(r[key], 10)));

      return r;
    }))
    // Remove goalies from response
    .then(rows => rows.filter(r => r.position !== 'g'))
    // Structure response
    .then(rows => ({ skaters: rows }));
};
