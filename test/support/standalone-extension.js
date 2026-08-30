function loadStandaloneExtension() {
  const apiPath = require.resolve('../..');
  const extensionPath = require.resolve('../../dist/extension.js');
  delete require.cache[apiPath];
  delete require.cache[extensionPath];
  const register = require(extensionPath).default;
  const formula = require(apiPath);
  return { register, formula };
}

module.exports = { loadStandaloneExtension };
