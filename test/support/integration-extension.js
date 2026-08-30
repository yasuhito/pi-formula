const formula = require('../..');

const additionalMacros = {
  trial: ['\\left|#1\\right\\rangle', 1]
};

function registerIntegrationExtension(pi) {
  formula.registerFormula(pi, additionalMacros);
  return {
    createPng(latex, availableWidth = 80) {
      return formula.createFormulaPng(pi, latex, availableWidth);
    }
  };
}

module.exports = { additionalMacros, registerIntegrationExtension };
