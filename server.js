const express = require('express');

const server = express();
const port = 5000;

// Allow cross-origin requests for development
if (process.env.NODE_ENV === 'development') {
  console.log('Allowing cross-origin requests');
  server.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With');
    next();
  });
}

// Import routes
server.use('/api/skaters/', require('./skaters/router'));

// Listen for requests
server.listen(port, (error) => {
  if (error) throw error;
  console.log(`Listening on ${port}`);
});
