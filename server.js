const express = require('express');
const pool = require('./db');

const server = express();
const port = 5000;

// Route that queries database
server.get('/api', (req, res) => {
  const jsonResult = {};
  pool.query('SELECT * FROM game_results WHERE game_id = 20001', [])
    .then((result) => {
      jsonResult.game1 = result.rows;
      return pool.query('SELECT * FROM game_results WHERE game_id = 20002', []);
    })
    .then((result) => {
      jsonResult.game2 = result.rows;
      return res.status(200).send(jsonResult);
    });
});

// Listen for requests
server.listen(port, (error) => {
  if (error) throw error;
  console.log(`Listening on ${port}`);
});
