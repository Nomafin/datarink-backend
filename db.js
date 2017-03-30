'use strict'

//
// db.js contains everything needed to connect to and query the database
//

var dbConfig = require('./db-config.json');
var pg = require('pg');
var url = require('url');
var WORKERS = 1;

// By default, node-postgres interprets incoming timestamps in the local timezone
// Force node-postgres to interpret the incoming timestamps without any offsets,
// since our queries will select timestamps in the desired timezone
pg.types.setTypeParser(1114, function(stringValue) {
	return new Date(Date.parse(stringValue + '+0000'));
});

// Configure and initialize the Postgres connection pool
// Get the DATABASE_URL config var and parse it into its components
var params = url.parse(dbConfig.DATABASE_URL);
var authParams = params.auth.split(':');
var pgConfig = {
	user: authParams[0],
	password: authParams[1],
	host: params.hostname,
	port: params.port,
	database: params.pathname.split('/')[1],
	ssl: true,
	max: 16 / WORKERS,
	idleTimeoutMillis: 30000,
};
var pool = new pg.Pool(pgConfig);

module.exports = {
	// Query the database and return result rows in json format
	// 'values' is an array of values for parameterized queries
	query: function(text, values, cb) {
		pool.connect(function(err, client, done) {
			client.query(text, values, function(err, result) {
				done();
				// result.rows is is an array of Anonymous objects
				// Convert it to json using stringify and parse before returning it
				var returnedRows = err ? [] : JSON.parse(JSON.stringify(result.rows));
				cb(err, returnedRows);
			});
		});
	}
}
