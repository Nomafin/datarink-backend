/**
 * db.js centralizes the public api's database access by creating a connection pool (with knex)
 * and exporting it. By default, knex's connection pool has a setting of {min: 2, max: 10}
 * Since the public api only makes GET requests, the db connection should use a read-only db role
 */
const config = require('./config');
const pg = require('pg');
const knex = require('knex')({
  client: 'pg',
  connection: {
    host: config.DB_HOST,
    database: config.DB_NAME,
    user: config.DB_USER_READER,
    password: config.DB_USER_READER_PASSWORD,
  },
});

/**
 * By default, node-postgres interprets incoming timestamps in the local timezone
 * Force node-postgres to interpret the incoming timestamps without any offsets,
 * since our queries will select timestamps in the desired timezone
 */
pg.types.setTypeParser(1114, stringValue => new Date(Date.parse(`${stringValue}+0000`)));

module.exports.knex = knex;
