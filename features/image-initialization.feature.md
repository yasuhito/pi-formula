# Feature: Load image processing components when rendering the first display formula

Loading or registering the extension and starting a session do not load MathJax or Resvg. They are loaded when display math is first converted to an image.

## Scenario: Neither MathJax nor Resvg is loaded before rendering math

- Given Pi has loaded and registered the extension in a fresh Node.js process
- When start an image path session in an isolated process
- And transform display math for the first time
- Then Neither MathJax nor Resvg is loaded before rendering math

## Scenario: Starting a session alone does not load MathJax or Resvg

- Given Pi has loaded and registered the extension in a fresh Node.js process
- When start an image path session in an isolated process
- And transform display math for the first time
- Then Starting a session alone does not load MathJax or Resvg

## Scenario: The first display formula loads MathJax and Resvg

- Given Pi has loaded and registered the extension in a fresh Node.js process
- When start an image path session in an isolated process
- And transform display math for the first time
- Then The first display formula loads MathJax and Resvg
