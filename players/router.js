const express = require('express');
const player = require('./player-model');

const router = express.Router();

// Route that analyzes data and returns response
router.get('/', (req, res) => {
  const results = [];
  player.findPlayer(20001)
    .then((result) => {
      results.push(result);
      return player.findPlayer(20002);
    })
    .then((result) => {
      results.push(result);
      // Analyze results
      // ...
      return res.status(200).send(results);
    });
});

module.exports = router;
