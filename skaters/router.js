const express = require('express');
const skater = require('./skater-model');

const router = express.Router();

// Route for skater list: /?start=yyyymmdd&end=yyyymmdd
router.get('/', (req, res) => {
  const conditions = {
    start: `${req.query.start.substring(0, 4)}-${req.query.start.substring(4, 6)}-${req.query.start.substring(6, 8)} 00:00:00`,
    end: `${req.query.end.substring(0, 4)}-${req.query.end.substring(4, 6)}-${req.query.end.substring(6, 8)} 24:00:00`,
    strSits: req.query.strSits ? req.query.strSits.split(',') : null,
    scoreSits: req.query.scoreSits ?
      req.query.scoreSits.split(',').map(d => parseInt(d, 10)) :
      null,
    playoffs: req.query.playoffs ? req.query.playoffs.toLowerCase() : null,
  };
  skater.skaters(conditions)
    .then(result => res.status(200).send(result));
});

module.exports = router;
