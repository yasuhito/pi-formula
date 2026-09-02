const DISPLAY_PROMPT_PREFIX = "pi-formula-verify-prompt:";

function transformDisplayPrompt(input) {
  if (!input.startsWith(DISPLAY_PROMPT_PREFIX)) return undefined;
  return {
    action: "transform",
    text: input.slice(DISPLAY_PROMPT_PREFIX.length),
  };
}

module.exports = { DISPLAY_PROMPT_PREFIX, transformDisplayPrompt };
