// db.js centralizes access to the database by:
// 1. Creating a global pool of database clients
// 2. Exporting a method for passing queries to the pool

const config = require('./config');
const pg = require('pg');
const url = require('url');

// By default, node-postgres interprets incoming timestamps in the local timezone
// Force node-postgres to interpret the incoming timestamps without any offsets,
// since our queries will select timestamps in the desired timezone
pg.types.setTypeParser(1114, stringValue => new Date(Date.parse(`${stringValue}+0000`)));

// Configure and initialize the Postgres connection pool
// Get the DATABASE_URL config var and parse it into its components
const params = url.parse(config.DATABASE_URL);
const authParams = params.auth.split(':');
const pgConfig = {
  user: authParams[0],
  password: authParams[1],
  host: params.hostname,
  port: params.port,
  database: params.pathname.split('/')[1],
  ssl: true,
  max: 10,
  idleTimeoutMillis: 30000,
};

// Initialize a global connection pool
const pool = new pg.Pool(pgConfig);

// Export query method for passing queries to the pool
// `values` is an array of values for parameterized queries
module.exports.query = (text, values) => pool.query(text, values);
