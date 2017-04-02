// Query database and provide data to the player routes for analysis

const pool = require('../db');

module.exports.findPlayer = function findPlayer(pid) {
  return pool.query('SELECT * FROM game_results WHERE game_id = $1', [pid])
    .then(result => {
      // Format and structure query results
      // ...
      return result.rows;
    });
};
