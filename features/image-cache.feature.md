# Feature: Manage the display math image cache

Display math images are cached. The cache can be cleared with `/formula clear` when needed.

Images with different theme colors or display widths are stored separately. Exceeding entry or byte limits evicts the least recently used entries first. Failure results are also cached.

Reusing cached math finishes faster than converting uncached math, excluding initial setup.

## Scenario: Cache display math images

- Given Pi is running in a terminal that can display PNG images
- And The global default display path is not configured
- When start a session
- And convert the formula "$$x$$" to an image
- Then The image cache contains at least one entry

## Scenario: Clear the image cache with formula clear

- Given Pi is running in a terminal that can display PNG images
- And The global default display path is not configured
- When start a session
- And convert the formula "$$x$$" to an image
- And run formula clear
- Then The image cache becomes empty

## Scenario: The theme and width comparison produces 3 image IDs

- Given Pi can render math through the image path
- When render the theme and width comparison formula at 80 columns
- And change the theme text color to RGB 10, 20, 30
- And render the theme and width comparison formula at 80 columns
- And restore the theme text color to RGB 212, 212, 212
- And render the theme and width comparison formula at 40 columns
- Then The theme and width comparison produces 3 image IDs

## Scenario: Each change to theme color or display width produces a separate cache entry

- Given Pi can render math through the image path
- When render the theme and width comparison formula at 80 columns
- And change the theme text color to RGB 10, 20, 30
- And render the theme and width comparison formula at 80 columns
- And restore the theme text color to RGB 212, 212, 212
- And render the theme and width comparison formula at 40 columns
- Then Each change to theme color or display width produces a separate cache entry

## Scenario: The oldest entry is recreated after exceeding the entry limit

- Given an image cache has a 3-entry limit
- When retrieve image a from the cache
- And retrieve image b from the cache
- And retrieve image c from the cache
- And retrieve image b from the cache
- And retrieve image d from the cache
- And retrieve image a from the cache
- Then The oldest entry is recreated after exceeding the entry limit

## Scenario: The recently used second cache entry is not recreated

- Given an image cache has a 3-entry limit
- When retrieve image a from the cache
- And retrieve image b from the cache
- And retrieve image c from the cache
- And retrieve image b from the cache
- And retrieve image d from the cache
- And retrieve image a from the cache
- Then The recently used second cache entry is not recreated

## Scenario: The image cache stays within 3 entries

- Given an image cache has a 3-entry limit
- When retrieve image a from the cache
- And retrieve image b from the cache
- And retrieve image c from the cache
- And retrieve image b from the cache
- And retrieve image d from the cache
- And retrieve image a from the cache
- Then The image cache stays within 3 entries

## Scenario: The oldest entry is recreated after exceeding the byte limit

- Given an image cache has a 300-byte limit
- When retrieve image a from the cache
- And retrieve image b from the cache
- And retrieve image a from the cache
- Then The oldest entry is recreated after exceeding the byte limit

## Scenario: Only the last entry remains after exceeding the cache byte limit

- Given an image cache has a 300-byte limit
- When retrieve image a from the cache
- And retrieve image b from the cache
- And retrieve image a from the cache
- Then Only the last entry remains after exceeding the cache byte limit

## Scenario: The image cache stays within 300 bytes

- Given an image cache has a 300-byte limit
- When retrieve image a from the cache
- And retrieve image b from the cache
- And retrieve image a from the cache
- Then The image cache stays within 300 bytes

## Scenario: Cache failure results

- Given a cache can count image result creation calls
- When retrieve the same failed entry from the cache
- And retrieve the same failed entry from the cache
- Then The same failed entry is processed as an image only once

## Scenario: There are 5 uncached formula measurements

- Given Pi has loaded and registered the extension in a fresh Node.js process
- When start an image path session in an isolated process
- And render the initialization formula in an isolated process
- And measure conversion times for 5 different uncached formulas
- And measure the last cached formula 10 times
- Then There are 5 uncached formula measurements

## Scenario: There are 10 cached formula measurements

- Given Pi has loaded and registered the extension in a fresh Node.js process
- When start an image path session in an isolated process
- And render the initialization formula in an isolated process
- And measure conversion times for 5 different uncached formulas
- And measure the last cached formula 10 times
- Then There are 10 cached formula measurements

## Scenario: The cached median ratio is finite

- Given Pi has loaded and registered the extension in a fresh Node.js process
- When start an image path session in an isolated process
- And render the initialization formula in an isolated process
- And measure conversion times for 5 different uncached formulas
- And measure the last cached formula 10 times
- Then The cached median ratio is finite

## Scenario: The cached median is less than 5 percent of the uncached median

- Given Pi has loaded and registered the extension in a fresh Node.js process
- When start an image path session in an isolated process
- And render the initialization formula in an isolated process
- And measure conversion times for 5 different uncached formulas
- And measure the last cached formula 10 times
- Then The cached median is less than 5 percent of the uncached median
