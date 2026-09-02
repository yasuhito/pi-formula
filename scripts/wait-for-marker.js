const fs = require("node:fs");

function readMarker(marker) {
  try {
    return fs.readFileSync(marker, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

function waitForMarker(
  marker,
  expected,
  timeoutMessage,
  deadline,
  cancellationMarker,
) {
  return new Promise((resolve, reject) => {
    const poll = () => {
      let value;
      try {
        value = readMarker(marker);
        if (
          value !== undefined &&
          (expected === undefined || value === expected)
        ) {
          resolve("acknowledged");
          return;
        }
        if (
          cancellationMarker &&
          readMarker(cancellationMarker) !== undefined
        ) {
          resolve("cancelled");
          return;
        }
      } catch (error) {
        reject(error);
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error(timeoutMessage));
        return;
      }
      setTimeout(poll, 25);
    };
    poll();
  });
}

module.exports = { waitForMarker };
