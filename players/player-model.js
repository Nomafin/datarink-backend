// Query database and provide data to the player routes for analysis

const db = require('../db');

module.exports.findPlayer = function findPlayer(pid) {
  return db.knex.select('name').from('test')
    .then((rows) => {
      // Format and structure query results
      console.log(`Formatting and structuring querying results for ${pid}`);
      return rows;
    });
};
