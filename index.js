const crypto = require("crypto");
const queue = require("async/queue");
const micro = require("micro");
const { send } = micro;
const rateLimit = require("micro-ratelimit");

const AVAILABLE_CHARACTERS = "9ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAX_ENTROPY_ARRAY = new Uint8Array(65536);

const generateSeedArray = callback => {
  crypto.randomBytes(MAX_ENTROPY_ARRAY.length, (err, buf) => {
    if (err) {
      callback(err);
      return;
    }

    MAX_ENTROPY_ARRAY.set(buf);

    callback(
      null,
      Array.from(MAX_ENTROPY_ARRAY.filter(n => n < 27).slice(0, 81)).map(
        n => AVAILABLE_CHARACTERS[n]
      )
    );
  });
};

const generateSeedString = callback => {
  generateSeedArray((err, seedArray) => {
    if (err) {
      callback(err);
      return;
    }
    callback(seedArray.join(""));
  });
};

const generateSeedDistribution = callback => {
  const distribution = {};
  const n = 1000;
  const concurrency = 1;
  let processedCount = 0;

  var q = queue((seedGenerator, seedGeneratorCallback) => {
    seedGenerator(seedString => {
      const seedChars = seedString.split("");
      seedChars.forEach(
        seedChar =>
          (distribution[seedChar] = distribution[seedChar]
            ? distribution[seedChar] + 1
            : 1)
      );
      processedCount++;
      seedGeneratorCallback();
    });
  }, concurrency);

  q.drain = () => callback(distribution);
  q.push(Array(n).fill(generateSeedString), err => {
    if (err) console.error(err);
  });
};

// // GENERATE A SEED
// generateSeedString((seedString) => {
//   console.log(seedString);
// });

// // GENERATE A DISTRIBUTION (it should be normal, not skewed)
// generateSeedDistribution(distribution => {
//   console.log(distribution);
// });
//

const server = micro(
  rateLimit({ window: 5000, limit: 50 }, async (req, res) => {
    generateSeedString(seedString => {
      send(res, 200, { seed: seedString });
    });
  })
);

server.listen(process.env.PORT || 3000);
