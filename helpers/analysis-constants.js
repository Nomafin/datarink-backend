// Corsi weights for the team who shot the puck
module.exports.cfWeights = {
  '-3': 0.841,
  '-2': 0.884,
  '-1': 0.932,
  0: 1,
  1: 1.068,
  2: 1.116,
  3: 1.159,
};

// Corsi weights for the team who was shot against
module.exports.caWeights = {
  '-3': module.exports.cfWeights[3],
  '-2': module.exports.cfWeights[2],
  '-1': module.exports.cfWeights[1],
  0: module.exports.cfWeights[0],
  1: module.exports.cfWeights[-1],
  2: module.exports.cfWeights[-2],
  3: module.exports.cfWeights[-3],
};

