const express = require('express');

const server = express();
const port = 5000;

// A simple route
server.get('/api', (req, res) => res.status(200).send('Hello world!'));

// An imported router
server.use('/api/players/', require('./players/router'));

// Listen for requests
server.listen(port, (error) => {
  if (error) throw error;
  console.log(`Listening on ${port}`);
});
