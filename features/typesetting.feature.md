# Feature: Typeset display math containing Japanese in a consistent serif font

Users can read Japanese text in display math in a serif font consistent with the formula. Available fonts are selected with a fallback when no candidate is available, while ASCII-only display math continues to be typeset.

## Scenario: Japanese display math using the preferred candidate becomes an image

- Given an image path with priority serif font candidates
- When typeset display math containing Japanese text through Resvg
- Then Japanese display math using the preferred candidate becomes an image

## Scenario: The Japanese image using the preferred candidate has a PNG signature

- Given an image path with priority serif font candidates
- When typeset display math containing Japanese text through Resvg
- Then The Japanese image using the preferred candidate has a PNG signature

## Scenario: The preferred serif font settings are passed to Resvg for Japanese typesetting

- Given an image path with priority serif font candidates
- When typeset display math containing Japanese text through Resvg
- Then The preferred serif font settings are passed to Resvg for Japanese typesetting

## Scenario: The Japanese SVG using the preferred candidate contains 19 paths

- Given an image path with priority serif font candidates
- When typeset display math containing Japanese text through Resvg
- Then The Japanese SVG using the preferred candidate contains 19 paths

## Scenario: Japanese text content and scale are passed to Resvg

- Given an image path with priority serif font candidates
- When typeset display math containing Japanese text through Resvg
- Then Japanese text content and scale are passed to Resvg

## Scenario: Diagnostics show the preferred serif font selected for Japanese

- Given an image path with priority serif font candidates
- When typeset display math containing Japanese text through Resvg
- Then Diagnostics show the preferred serif font selected for Japanese

## Scenario: ASCII display math becomes an image

- Given an image path with priority serif font candidates
- When typeset display math containing ASCII text through Resvg
- Then ASCII display math becomes an image

## Scenario: The ASCII image has a PNG signature

- Given an image path with priority serif font candidates
- When typeset display math containing ASCII text through Resvg
- Then The ASCII image has a PNG signature

## Scenario: The preferred serif font settings are passed to Resvg for ASCII typesetting

- Given an image path with priority serif font candidates
- When typeset display math containing ASCII text through Resvg
- Then The preferred serif font settings are passed to Resvg for ASCII typesetting

## Scenario: The ASCII SVG contains 26 paths

- Given an image path with priority serif font candidates
- When typeset display math containing ASCII text through Resvg
- Then The ASCII SVG contains 26 paths

## Scenario: The typeset ASCII contains no SVG text

- Given an image path with priority serif font candidates
- When typeset display math containing ASCII text through Resvg
- Then The typeset ASCII contains no SVG text

## Scenario: Diagnostics show the serif font selected for ASCII

- Given an image path with priority serif font candidates
- When typeset display math containing ASCII text through Resvg
- Then Diagnostics show the serif font selected for ASCII

## Scenario Outline: Select an installed serif font in candidate priority order

- Given an image path with <inventory> serif font candidates
- When typeset display math containing Japanese text through Resvg
- Then "<family>" is selected as the display math serif font

### Examples:

  | inventory | family              |
  | ---------- | ------------------- |
  | priority   | Noto Serif CJK JP   |
  | source-jp  | Source Han Serif JP |
  | source     | Source Han Serif    |
  | ipa        | IPAexMincho         |

## Scenario: Japanese display math becomes an image even without serif font candidates

- Given an image path without a CJK-capable serif font
- When typeset display math containing Japanese text through Resvg
- Then Japanese display math becomes an image even without serif font candidates

## Scenario: The Japanese image without serif font candidates also has a PNG signature

- Given an image path without a CJK-capable serif font
- When typeset display math containing Japanese text through Resvg
- Then The Japanese image without serif font candidates also has a PNG signature

## Scenario: Typesetting without serif font candidates uses system fonts

- Given an image path without a CJK-capable serif font
- When typeset display math containing Japanese text through Resvg
- Then Typesetting without serif font candidates uses system fonts

## Scenario: The Japanese SVG without serif font candidates contains 19 paths

- Given an image path without a CJK-capable serif font
- When typeset display math containing Japanese text through Resvg
- Then The Japanese SVG without serif font candidates contains 19 paths

## Scenario: Japanese text content and scale are passed to Resvg even with system fonts

- Given an image path without a CJK-capable serif font
- When typeset display math containing Japanese text through Resvg
- Then Japanese text content and scale are passed to Resvg even with system fonts

## Scenario: Diagnostics show the fallback to system fonts

- Given an image path without a CJK-capable serif font
- When typeset display math containing Japanese text through Resvg
- Then Diagnostics show the fallback to system fonts
