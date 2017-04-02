const express = require('express');
const pool = require('../db');

const router = express.Router();

// Route that queries database
router.get('/', (req, res) => {
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

// Export router
module.exports = router;
