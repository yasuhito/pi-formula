# Feature: Respect display math safety limits and the image conversion execution boundary

Display math exceeding safety limits such as input characters, image rows, or scale falls back to source. Subsequent valid display math can still become images.

Image conversion runs in memory without file writes, external services, child processes, or browser modules.

## Scenario: The image processing safety limits contain the 7 defined fields

- Given read the pi-formula image processing settings
- When inspect the fixed limits
- Then The image processing safety limits contain the 7 defined fields

## Scenario: All image processing safety limits are finite positive integers

- Given read the pi-formula image processing settings
- When inspect the fixed limits
- Then All image processing safety limits are finite positive integers

## Scenario: No cache key is created for math exceeding the input character limit

- Given the environment fails when a cache key is created
- And Pi has loaded and registered the extension in a fresh Node.js process
- When start an image path session in an isolated process
- And transform display math exceeding the input limit
- Then No cache key is created for math exceeding the input character limit

## Scenario: Math exceeding the input character limit does not initialize image processing components

- Given the environment fails when a cache key is created
- And Pi has loaded and registered the extension in a fresh Node.js process
- When start an image path session in an isolated process
- And transform display math exceeding the input limit
- Then Math exceeding the input character limit does not initialize image processing components

## Scenario: Math exceeding the input character limit remains as source

- Given the environment fails when a cache key is created
- And Pi has loaded and registered the extension in a fresh Node.js process
- When start an image path session in an isolated process
- And transform display math exceeding the input limit
- Then Math exceeding the input character limit remains as source

## Scenario: Math exceeding the input character limit remains in the transformed output

- Given Pi can render math through the image path
- When transform over-limit and valid display math
- Then Math exceeding the input character limit remains in the transformed output

## Scenario: Math exceeding the image row limit remains in the transformed output

- Given Pi can render math through the image path
- When transform over-limit and valid display math
- Then Math exceeding the image row limit remains in the transformed output

## Scenario: One valid formula after an over-limit formula becomes an image

- Given Pi can render math through the image path
- When transform over-limit and valid display math
- Then One valid formula after an over-limit formula becomes an image

## Scenario: Math with unreadable scaling remains in the transformed output

- Given Pi can render math through the image path
- When transform display math scaled below half the baseline and valid display math
- Then Math with unreadable scaling remains in the transformed output

## Scenario: One valid formula after unreadably scaled math becomes an image

- Given Pi can render math through the image path
- When transform display math scaled below half the baseline and valid display math
- Then One valid formula after unreadably scaled math becomes an image

## Scenario: Fall back to text when exact RGB is unavailable

- Given Pi uses an image path that does not return exact RGB
- When transform display math
- Then Math without available RGB remains as source

## Scenario: Image conversion does not write files, call external services, or spawn child processes

- Given Pi can render math through the image path
- When transform display math while monitoring external side effects
- Then Image conversion does not write files, call external services, or spawn child processes

## Scenario: Image conversion does not load browser modules

- Given Pi can render math through the image path
- When transform display math while monitoring external side effects
- Then Image conversion does not load browser modules

## Scenario: One display formula can become an image even when external side effects are prohibited

- Given Pi can render math through the image path
- When transform display math while monitoring external side effects
- Then One display formula can become an image even when external side effects are prohibited
