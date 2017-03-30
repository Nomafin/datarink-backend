const express = require('express');
const db = require('./db.js');

const server = express();
const port = 5000;

// Simple route
server.get('/api/hello', (req, res) => {
  const resObj = {
    data: 'Hello from the back-end!',
  };
  return res.status(200).send(resObj);
});

// Route that queries database
server.get('/api/games', (req, res) => {
  const query = 'SELECT * FROM game_results';
  db.query(query, [], (err, rows) => {
    if (err) { return res.status(500).send(err); }
    return res.status(200).send(rows);
  });
});

// Listen for requests
server.listen(port, (error) => {
  if (error) throw error;
  console.log(`Listening on ${port}`);
});
