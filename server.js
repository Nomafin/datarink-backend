'use strict'

var express = require('express');
var server = express();

// Route
server.get("/api", function(req, res) {
	return res.status(200).send({
		data: "Hello from the back-end!"
	});
});

// Start listening for requests
server.listen(5000, function(error) {
	if (error) {
		throw error;
	}
	console.log('Listening on ' + 5000);
});
