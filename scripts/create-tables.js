/**
 * Creates all database tables - a table is created only if it does not already exist
 * Usage: node create-tables.js
 */
const config = require('../config');
const knex = require('knex')({
  client: 'pg',
  connection: {
    host: config.DB_HOST,
    database: config.DB_NAME,
    user: config.DB_USER_MASTER,
    password: config.DB_USER_MASTER_PASSWORD,
  },
});

const playersPromise = knex.schema.createTableIfNotExists('players', (tbl) => {
  tbl.integer('player_id').notNullable().primary();
  tbl.string('first_name').notNullable();
  tbl.string('last_name').notNullable();
});

const teamsPromise = knex.schema.createTableIfNotExists('teams', (tbl) => {
  tbl.integer('team_id', 'smallint').notNullable().primary();
  tbl.string('abbreviation').notNullable();
  tbl.string('team_name').notNullable();
});

const gamesPromise = knex.schema.createTableIfNotExists('games', (tbl) => {
  tbl.specificType('season', 'smallint').notNullable();
  tbl.integer('game_id').notNullable();
  tbl.timestamp('game_date').notNullable();
  tbl.specificType('periods', 'smallint').notNullable();
  tbl.boolean('is_playoff').notNullable();
  tbl.boolean('has_shootout').notNullable();

  // Relationships
  tbl.primary(['season', 'game_id']);
});

const gameTeamsPromise = knex.schema.createTableIfNotExists('game_teams', (tbl) => {
  tbl.specificType('season', 'smallint').notNullable();
  tbl.integer('game_id').notNullable();
  tbl.integer('team_id', 'smallint').notNullable();
  tbl.string('venue').notNullable();
  tbl.specificType('score', 'smallint').notNullable();

  // Relationships
  tbl.primary(['season', 'game_id', 'team_id']);
  tbl.foreign('team_id').references('teams.team_id');
  tbl.foreign(['season', 'game_id']).references(['games.season', 'games.game_id']);
});

const gameRostersPromise = knex.schema.createTableIfNotExists('game_players', (tbl) => {
  tbl.specificType('season', 'smallint').notNullable();
  tbl.integer('game_id').notNullable();
  tbl.integer('player_id').notNullable();
  tbl.integer('team_id', 'smallint').notNullable();

  // Allow nulls in case scratched players don't have these properties
  tbl.specificType('jersey', 'smallint');
  tbl.string('position');

  // Relationships
  tbl.primary(['season', 'game_id', 'player_id']);
  tbl.foreign('player_id').references('players.player_id');
  tbl.foreign('team_id').references('teams.team_id');
  tbl.foreign(['season', 'game_id']).references(['games.season', 'games.game_id']);
});

const gameEventsPromise = knex.schema.createTableIfNotExists('game_events', (tbl) => {
  tbl.specificType('season', 'smallint').notNullable();
  tbl.integer('game_id').notNullable();
  tbl.integer('event_id').notNullable();
  tbl.specificType('period', 'smallint');
  tbl.string('period_type').notNullable();
  tbl.specificType('event_time', 'smallint');
  tbl.string('event_desc');
  tbl.string('event_type');
  tbl.string('event_subtype');
  tbl.string('pen_severity');
  tbl.integer('pen_mins');
  tbl.boolean('pen_is_effective');
  tbl.integer('team_id', 'smallint');
  tbl.string('venue');
  tbl.specificType('loc_x', 'smallint');
  tbl.specificType('loc_y', 'smallint');
  tbl.string('a_zone');
  tbl.string('h_zone');
  tbl.specificType('a_def_side', 'smallint');
  tbl.specificType('h_def_side', 'smallint');
  tbl.string('a_strength_sit');
  tbl.string('h_strength_sit');
  tbl.specificType('a_score_sit', 'smallint');
  tbl.specificType('h_score_sit', 'smallint');
  tbl.specificType('a_score', 'smallint');
  tbl.specificType('h_score', 'smallint');
  tbl.specificType('a_skaters', 'smallint');
  tbl.specificType('h_skaters', 'smallint');
  tbl.specificType('a_goalies', 'smallint');
  tbl.specificType('h_goalies', 'smallint');

  // Relationships
  tbl.primary(['season', 'game_id', 'event_id']);
  tbl.foreign('team_id').references('teams.team_id');
  tbl.foreign(['season', 'game_id']).references(['games.season', 'games.game_id']);
});

const gameEventPlayersPromise = knex.schema.createTableIfNotExists('game_event_players', (tbl) => {
  tbl.specificType('season', 'smallint').notNullable();
  tbl.integer('game_id').notNullable();
  tbl.integer('event_id').notNullable();
  tbl.integer('player_id').notNullable();
  tbl.boolean('on_ice').notNullable();
  tbl.string('role');

  // Relationships
  tbl.primary(['season', 'game_id', 'event_id', 'player_id']);
  tbl.foreign('player_id').references('players.player_id');
  tbl.foreign(['season', 'game_id', 'event_id'])
    .references(['game_events.season', 'game_events.game_id', 'game_events.event_id']);
});

const gamePlayerStatsPromise = knex.schema.createTableIfNotExists('game_player_stats', (tbl) => {
  tbl.specificType('season', 'smallint').notNullable();
  tbl.integer('game_id').notNullable();
  tbl.integer('player_id').notNullable();
  tbl.string('strength_sit').notNullable();
  tbl.specificType('score_sit', 'smallint').notNullable();
  tbl.specificType('toi', 'smallint');
  tbl.specificType('ig', 'smallint');
  tbl.specificType('isog', 'smallint');
  tbl.specificType('ibs', 'smallint');
  tbl.specificType('ims', 'smallint');
  tbl.specificType('ia1', 'smallint');
  tbl.specificType('ia2', 'smallint');
  tbl.specificType('i_blocked', 'smallint');
  tbl.specificType('i_ofo_won', 'smallint');
  tbl.specificType('i_ofo_lost', 'smallint');
  tbl.specificType('i_dfo_won', 'smallint');
  tbl.specificType('i_dfo_lost', 'smallint');
  tbl.specificType('i_nfo_won', 'smallint');
  tbl.specificType('i_nfo_lost', 'smallint');
  tbl.specificType('i_otf', 'smallint');
  tbl.specificType('i_pen_taken', 'smallint');
  tbl.specificType('i_pen_drawn', 'smallint');
  tbl.specificType('i_eff_pen_taken', 'smallint');
  tbl.specificType('i_eff_pen_drawn', 'smallint');
  tbl.specificType('ihf', 'smallint');
  tbl.specificType('iha', 'smallint');
  tbl.specificType('i_give', 'smallint');
  tbl.specificType('i_take', 'smallint');
  tbl.specificType('gf', 'smallint');
  tbl.specificType('ga', 'smallint');
  tbl.specificType('sf', 'smallint');
  tbl.specificType('sa', 'smallint');
  tbl.specificType('bsf', 'smallint');
  tbl.specificType('bsa', 'smallint');
  tbl.specificType('msf', 'smallint');
  tbl.specificType('msa', 'smallint');
  tbl.specificType('ofo_won', 'smallint');
  tbl.specificType('ofo_lost', 'smallint');
  tbl.specificType('dfo_won', 'smallint');
  tbl.specificType('dfo_lost', 'smallint');
  tbl.specificType('nfo_won', 'smallint');
  tbl.specificType('nfo_lost', 'smallint');
  tbl.specificType('pen_taken', 'smallint');
  tbl.specificType('pen_drawn', 'smallint');
  tbl.specificType('eff_pen_taken', 'smallint');
  tbl.specificType('eff_pen_drawn', 'smallint');
  tbl.specificType('hf', 'smallint');
  tbl.specificType('ha', 'smallint');
  tbl.specificType('give', 'smallint');
  tbl.specificType('take', 'smallint');
  tbl.specificType('icing_taken', 'smallint');
  tbl.specificType('icing_drawn', 'smallint');

  // Relationships
  tbl.primary(['season', 'game_id', 'player_id', 'strength_sit', 'score_sit']);
  tbl.foreign('player_id').references('players.player_id');
  tbl.foreign(['season', 'game_id']).references(['games.season', 'games.game_id']);
});

const gameTeamStatsPromise = knex.schema.createTableIfNotExists('game_team_stats', (tbl) => {
  tbl.specificType('season', 'smallint').notNullable();
  tbl.integer('game_id').notNullable();
  tbl.integer('team_id', 'smallint').notNullable();
  tbl.string('strength_sit').notNullable();
  tbl.specificType('score_sit', 'smallint').notNullable();
  tbl.specificType('toi', 'smallint');
  tbl.specificType('gf', 'smallint');
  tbl.specificType('ga', 'smallint');
  tbl.specificType('sf', 'smallint');
  tbl.specificType('sa', 'smallint');
  tbl.specificType('bsf', 'smallint');
  tbl.specificType('bsa', 'smallint');
  tbl.specificType('msf', 'smallint');
  tbl.specificType('msa', 'smallint');
  tbl.specificType('ofo_won', 'smallint');
  tbl.specificType('ofo_lost', 'smallint');
  tbl.specificType('dfo_won', 'smallint');
  tbl.specificType('dfo_lost', 'smallint');
  tbl.specificType('nfo_won', 'smallint');
  tbl.specificType('nfo_lost', 'smallint');
  tbl.specificType('pen_taken', 'smallint');
  tbl.specificType('pen_drawn', 'smallint');
  tbl.specificType('eff_pen_taken', 'smallint');
  tbl.specificType('eff_pen_drawn', 'smallint');
  tbl.specificType('hf', 'smallint');
  tbl.specificType('ha', 'smallint');
  tbl.specificType('give', 'smallint');
  tbl.specificType('take', 'smallint');
  tbl.specificType('icing_taken', 'smallint');
  tbl.specificType('icing_drawn', 'smallint');

  // Relationships
  tbl.primary(['season', 'game_id', 'team_id', 'strength_sit', 'score_sit']);
  tbl.foreign('team_id').references('teams.team_id');
  tbl.foreign(['season', 'game_id']).references(['games.season', 'games.game_id']);
});

const gameShiftsPromise = knex.schema.createTableIfNotExists('game_shifts', (tbl) => {
  tbl.specificType('season', 'smallint').notNullable();
  tbl.integer('game_id').notNullable();
  tbl.integer('player_id').notNullable();
  tbl.specificType('period', 'smallint').notNullable();

  // Use integer[][2] because node-pg returns a 2d array; int4range[] gives a string
  tbl.specificType('shifts', 'integer[][2]').notNullable();

  // Relationships
  tbl.primary(['season', 'game_id', 'player_id', 'period']);
  tbl.foreign('player_id').references('players.player_id');
  tbl.foreign(['season', 'game_id']).references(['games.season', 'games.game_id']);
});

const gameSituationsPromise = knex.schema.createTableIfNotExists('game_situations', (tbl) => {
  tbl.specificType('season', 'smallint').notNullable();
  tbl.integer('game_id').notNullable();
  tbl.integer('team_id', 'smallint').notNullable();
  tbl.string('strength_sit').notNullable();
  tbl.specificType('score_sit', 'smallint').notNullable();
  tbl.specificType('period', 'smallint').notNullable();

  // Use integer[][2] because node-pg returns a 2d array; int4range[] gives a string
  tbl.specificType('timeranges', 'integer[][2]').notNullable();

  // Relationships
  tbl.primary(['season', 'game_id', 'team_id', 'strength_sit', 'score_sit', 'period']);
  tbl.foreign('team_id').references('teams.team_id');
  tbl.foreign(['season', 'game_id']).references(['games.season', 'games.game_id']);
});

/**
 * Create a table and use callback to modify the table's struture
 * The creation query is executed with .then()
 */
playersPromise
  .then(() => teamsPromise)
  .then(() => gamesPromise)
  .then(() => gameTeamsPromise)
  .then(() => gameRostersPromise)
  .then(() => gameEventsPromise)
  .then(() => gameEventPlayersPromise)
  .then(() => gameTeamStatsPromise)
  .then(() => gamePlayerStatsPromise)
  .then(() => gameShiftsPromise)
  .then(() => gameSituationsPromise)
  .then(() => {
    // Destroy connection pool
    knex.destroy(() => {
      console.log('Finished creating tables');
      process.exit();
    });
  });
