const express = require('express');

const server = express();
const port = 5000;

// Route
server.get('/api', (req, res) => {
  const resObj = {
    data: 'Hello from the back-end!',
  };
  return res.status(200).send(resObj);
});

// Listen for requests
server.listen(port, (error) => {
  if (error) throw error;
  console.log(`Listening on ${port}`);
});
