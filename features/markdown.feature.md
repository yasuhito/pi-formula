# Feature: Preserve ordinary Markdown and render inline and display math separately

Users can read ordinary prose, URLs, and code unchanged, inline math as text, and closed display math as images. Invalid delimiters or macros do not cause body text to be lost.

Display math whose dynamic glyphs cannot be loaded falls back to its source, while math without dynamic glyphs continues to become images.

## Scenario: Display math with unavailable dynamic glyphs falls back to its source

- Given an image path with unavailable dynamic glyphs
- When render display math containing dynamic glyphs
- And render display math without dynamic glyphs in the same runtime
- Then Display math with unavailable dynamic glyphs falls back to its source

## Scenario: Display math without dynamic glyphs still becomes an image

- Given an image path with unavailable dynamic glyphs
- When render display math containing dynamic glyphs
- And render display math without dynamic glyphs in the same runtime
- Then Display math without dynamic glyphs still becomes an image

## Scenario: Dollar-delimited inline math remains in the transformed output

- Given Pi can render math through the image path
- When transform body text containing all four math delimiters
- Then Dollar-delimited inline math remains in the transformed output

## Scenario: Parenthesis-delimited inline math remains in the transformed output

- Given Pi can render math through the image path
- When transform body text containing all four math delimiters
- Then Parenthesis-delimited inline math remains in the transformed output

## Scenario: The two display formulas among the four delimiter types become images

- Given Pi can render math through the image path
- When transform body text containing all four math delimiters
- Then The two display formulas among the four delimiter types become images

## Scenario: Use the ket extra macro in dollar-delimited inline math

- Given Pi can render math through the image path
- And register the ket and braket extra macros
- When render dollar-delimited inline math containing the ket extra macro
- Then The ket extra macro is rendered as Unicode

## Scenario: Render display math immediately after a colon

- Given Pi can render math through the image path
- When transform display math immediately after a colon
- Then Display math immediately after a colon becomes an image

## Scenario: Render inline math immediately after a colon

- Given Pi can render math through the image path
- And register the ket and braket extra macros
- When render the ket extra macro immediately after a colon
- Then The ket extra macro immediately after a colon is rendered as Unicode

## Scenario: Render inline math after a shell variable in a URL

- Given Pi can render math through the image path
- And register the ket and braket extra macros
- When render a shell variable in a URL followed by the ket extra macro
- Then The shell variable in the URL remains and the following ket extra macro is rendered as Unicode

## Scenario: Protect inline math in scheme URLs and www URLs

- Given Pi can render math through the image path
- And register the ket and braket extra macros
- When transform ket-like extra macro strings in scheme URLs and www URLs
- Then Scheme URLs and www URLs are unchanged

## Scenario: Protect inline math in scheme URLs without slashes

- Given Pi can render math through the image path
- And register the ket and braket extra macros
- When transform ket-like extra macro strings in scheme URLs without slashes
- Then Scheme URLs without slashes are unchanged

## Scenario: Use the braket extra macro in parenthesis-delimited inline math

- Given Pi can render math through the image path
- And register the ket and braket extra macros
- When render parenthesis-delimited inline math containing the braket extra macro
- Then The braket extra macro is rendered as Unicode

## Scenario: Use the braket user macro in dollar-delimited inline math

- Given Pi uses the image path with a braket user macro configured
- When render dollar-delimited inline math containing the braket user macro
- Then The braket user macro is rendered as Unicode

## Scenario: Treat Object prototype names as unregistered macros

- Given Pi can render math through the image path
- And register the ket and braket extra macros
- When transform body text containing Object prototype names and the ket extra macro
- Then Object prototype names remain and only the ket extra macro is expanded

## Scenario: Render inline math after currency amounts and shell variables

- Given Pi can render math through the image path
- And register the ket and braket extra macros
- When render body text with the ket extra macro after currency amounts and shell variables
- Then Currency amounts and shell variables remain and the following ket extra macro is rendered as Unicode

## Scenario: Do not transform macro-like strings in relative Markdown URLs

- Given Pi can render math through the image path
- And register the ket and braket extra macros
- When transform body text containing ket-like extra macro strings in relative Markdown URLs
- Then Relative Markdown URLs are unchanged

## Scenario: Do not transform macro-like strings in URLs without schemes

- Given Pi can render math through the image path
- And register the ket and braket extra macros
- When transform body text containing ket-like extra macro strings in URLs without schemes
- Then URLs without schemes are unchanged

## Scenario: Place a letter immediately after an extra macro with arguments

- Given Pi uses the image path with extra macros for testing substitution boundaries
- When render inline math with a letter immediately after the ket extra macro
- Then The ket extra macro and following letter are rendered as Unicode

## Scenario: Expand arguments according to the extra macro replacement body

- Given Pi uses the image path with extra macros for testing substitution boundaries
- When transform a squaring extra macro without grouping
- Then The squaring extra macro argument is not automatically grouped

## Scenario: Handle whitespace after a zero-argument extra macro like TeX

- Given Pi uses the image path with extra macros for testing substitution boundaries
- When render inline math with whitespace and a letter after a zero-argument extra macro
- Then The zero-argument extra macro and following letter are rendered as Unicode

## Scenario: Do not expand text after a control symbol as an extra macro

- Given Pi uses the image path with extra macros for testing substitution boundaries
- When transform body text with the letters ket after a backslash control symbol
- Then Text after a backslash control symbol is unchanged

## Scenario: Do not transform macro-like strings in reference link definitions

- Given Pi can render math through the image path
- And register the ket and braket extra macros
- When transform body text containing ket-like extra macro strings in reference link definitions
- Then Reference link definitions are unchanged

## Scenario: Do not transform macro-like strings in relative Markdown URLs containing parentheses

- Given Pi can render math through the image path
- And register the ket and braket extra macros
- When transform body text containing ket-like extra macro strings in relative Markdown URLs with parentheses
- Then Relative Markdown URLs containing parentheses are unchanged

## Scenario: Use the ket extra macro in inline math in a Markdown table

- Given Pi uses the image path with extra macros for testing substitution boundaries
- When render a Markdown table containing the ket extra macro
- Then The ket extra macro is rendered as Unicode while preserving table columns

## Scenario: Nest the same extra macro inside its argument

- Given Pi uses the image path with extra macros for testing substitution boundaries
- When render inline math containing nested ket extra macros
- Then Nested ket extra macros are rendered as Unicode

## Scenario: Preserve self-referencing extra macros as source

- Given Pi uses the image path with extra macros for testing substitution boundaries
- When transform inline math containing a self-referencing extra macro
- Then Recursive extra macros remain as source

## Scenario: Preserve user macros that expand to empty strings as source

- Given Pi uses the image path with an empty-string user macro configured
- When transform inline math containing an empty-string user macro
- Then The source remains instead of becoming empty inline math

## Scenario: Do not transform bare URLs containing parenthesis delimiters

- Given Pi uses the image path with extra macros for testing substitution boundaries
- When transform a bare URL containing a parenthesis-delimited ket-like extra macro string
- Then Bare URLs containing parenthesis delimiters are unchanged

## Scenario: Leave inline math unchanged without extra macros

- Given Pi can render math through the image path
- When transform inline math containing an unregistered ket macro
- Then An unregistered ket macro remains as source

## Scenario: Leave inline math unchanged when it cannot be rendered after expansion

- Given Pi can render math through the image path
- And register the ket and braket extra macros
- When transform inline math containing commands that cannot be rendered even after expansion
- Then Unrenderable inline math remains as source

## Scenario: Leave protected content unchanged even with extra macros

- Given Pi can render math through the image path
- And register the ket and braket extra macros
- When transform body text with extra macros in code, currency amounts, URLs, and shell variables
- Then Protected content containing extra macros is unchanged

## Scenario: Do not transform math inside code

- Given Pi can render math through the image path
- When transform body text containing math in code fences and inline code
- Then Body text inside code is unchanged

## Scenario: Display math inside long backtick fences remains

- Given Pi can render math through the image path
- When transform code fences with long delimiters, indentation, and trailing whitespace
- Then Display math inside long backtick fences remains

## Scenario: Display math inside long tilde fences remains

- Given Pi can render math through the image path
- When transform code fences with long delimiters, indentation, and trailing whitespace
- Then Display math inside long tilde fences remains

## Scenario: One display formula after long fences becomes an image

- Given Pi can render math through the image path
- When transform code fences with long delimiters, indentation, and trailing whitespace
- Then One display formula after long fences becomes an image

## Scenario: Backtick lines containing metacharacters do not close a fence

- Given Pi can render math through the image path
- When transform code fences containing lines with regex metacharacters
- Then Backtick lines containing metacharacters do not close a fence

## Scenario: Tilde lines containing metacharacters do not close a fence

- Given Pi can render math through the image path
- When transform code fences containing lines with regex metacharacters
- Then Tilde lines containing metacharacters do not close a fence

## Scenario: One display formula after fences containing metacharacters becomes an image

- Given Pi can render math through the image path
- When transform code fences containing lines with regex metacharacters
- Then One display formula after fences containing metacharacters becomes an image

## Scenario: Do not transform thinking

- Given Pi can render math through the image path
- When transform thinking body text
- Then Thinking body text is unchanged

## Scenario: Do not mistake ordinary dollar signs for math

- Given Pi can render math through the image path
- When transform body text containing currency amounts, URLs, shell variables, and escaped dollar signs
- Then Body text containing ordinary dollar signs is unchanged

## Scenario: Prefer source text for ambiguous dollar signs

- Given Pi can render math through the image path
- When transform body text containing ambiguous dollar signs
- Then Body text containing ambiguous dollar signs is unchanged

## Scenario: Preserve display math in lists

- Given Pi can render math through the image path
- When transform display math in a list
- Then The image retains the list indentation

## Scenario: Preserve display math in blockquotes

- Given Pi can render math through the image path
- When transform display math in a blockquote
- Then The image retains the blockquote nesting

## Scenario: Render closed math as images while streaming

- Given Pi can render math through the image path
- When transform streaming body text received through a closed formula
- Then Closed display math is rendered through the image path

## Scenario: Do not transform incomplete math while streaming

- Given Pi can render math through the image path
- When transform streaming body text received through an incomplete formula
- Then Incomplete math remains as source

## Scenario: Render display math after non-math $$

- Given Pi can render math through the image path
- When transform body text containing non-math $$ followed by display math
- Then Only the following display math becomes an image

## Scenario: Do not duplicate body text containing non-math $$

- Given Pi can render math through the image path
- When transform body text containing non-math $$ followed by display math
- Then Skipped body text remains exactly once as supplied

## Scenario: Do not mistake currency amounts containing $$ for display math

- Given Pi can render math through the image path
- When transform currency amounts containing $$
- Then Currency amounts remain as supplied

## Scenario: Render display math after rescanned currency amounts

- Given Pi can render math through the image path
- When first render reference display formula 1
- And transform body text containing rescanned currency amounts followed by display math
- Then Only x = 1 is rendered through the image path

## Scenario Outline: Only x = 1 becomes an image after currency amounts with colons

- Given Pi can render math through the image path
- When first render the reference x = 1
- And transform body text containing rescanned currency amounts with the colon label "<label>" followed by display math
- Then Only x = 1 becomes an image after currency amounts with colons

### Examples:

  | label |
  | ------ |
  | 価格:  |
  | 価格： |

## Scenario Outline: Currency amounts with colon labels remain exactly once

- Given Pi can render math through the image path
- When first render the reference x = 1
- And transform body text containing rescanned currency amounts with the colon label "<label>" followed by display math
- Then Currency amounts with colon labels remain exactly once

### Examples:

  | label |
  | ------ |
  | 価格:  |
  | 価格： |

## Scenario: Only x = 1 becomes an image in body text containing currency amounts and shell text

- Given Pi can render math through the image path
- When first render reference display formula 2
- And transform rescanned currency amounts, display math, and trailing shell $$
- Then Only x = 1 becomes an image in body text containing currency amounts and shell text

## Scenario: Currency amounts in body text containing display math and shell text remain exactly once

- Given Pi can render math through the image path
- When first render reference display formula 2
- And transform rescanned currency amounts, display math, and trailing shell $$
- Then Currency amounts in body text containing display math and shell text remain exactly once

## Scenario: Shell $ in body text containing display math and currency amounts remains exactly once

- Given Pi can render math through the image path
- When first render reference display formula 2
- And transform rescanned currency amounts, display math, and trailing shell $$
- Then Shell $$ in body text containing display math and currency amounts remains exactly once

## Scenario: Only x = 1 becomes an image with standalone delimiter lines

- Given Pi can render math through the image path
- When first render reference display formula 3
- And transform body text containing rescanned currency amounts and display math with standalone delimiter lines
- Then Only x = 1 becomes an image with standalone delimiter lines

## Scenario: Currency amounts before standalone display math remain exactly once

- Given Pi can render math through the image path
- When first render reference display formula 3
- And transform body text containing rescanned currency amounts and display math with standalone delimiter lines
- Then Currency amounts before standalone display math remain exactly once

## Scenario: Render numeric-only display math after non-math $$

- Given Pi can render math through the image path
- When first render reference display formula 4
- And transform body text containing non-math $$ followed by numeric-only display math
- Then Only 100 is rendered through the image path

## Scenario: Render numeric display math with multiline delimiters after non-math $$

- Given Pi can render math through the image path
- When first render reference display formula 5
- And transform non-math $$ and numeric display math whose closing delimiter is on a later line
- Then Only multiline-delimited 100 is rendered through the image path

## Scenario: Render labeled numeric display math after non-math $$

- Given Pi can render math through the image path
- When first render reference display formula 6
- And transform non-math $$ and numeric display math with an inline label
- Then Only labeled 100 is rendered through the image path

## Scenario: Only numeric math and the following y = 1 become images

- Given Pi can render math through the image path
- When first render the reference number 100
- And next render the reference y = 1
- And transform non-math $$, numeric display math, a single letter, and following display math
- Then Only numeric math and the following y = 1 become images

## Scenario: The single letter between two display formulas remains exactly once

- Given Pi can render math through the image path
- When first render the reference number 100
- And next render the reference y = 1
- And transform non-math $$, numeric display math, a single letter, and following display math
- Then The single letter between two display formulas remains exactly once

## Scenario: Only 100 before the incomplete delimiter becomes an image

- Given Pi can render math through the image path
- When first render reference display formula 7
- And transform non-math $$, numeric display math, a single letter, and unclosed $$
- Then Only 100 before the incomplete delimiter becomes an image

## Scenario: The single letter between the incomplete delimiter and numeric math remains exactly once

- Given Pi can render math through the image path
- When first render reference display formula 7
- And transform non-math $$, numeric display math, a single letter, and unclosed $$
- Then The single letter between the incomplete delimiter and numeric math remains exactly once

## Scenario: The incomplete delimiter after numeric math remains

- Given Pi can render math through the image path
- When first render reference display formula 7
- And transform non-math $$, numeric display math, a single letter, and unclosed $$
- Then The incomplete delimiter after numeric math remains

## Scenario: Render ordinary display math

- Given Pi can render math through the image path
- When transform ordinary display math
- Then One display formula becomes an image

## Scenario: Do not mistake URLs containing $$ for display math

- Given Pi can render math through the image path
- When transform URLs containing $$
- Then URLs remain as supplied

## Scenario: Preserve ordinary body text containing shell $$

- Given Pi can render math through the image path
- When transform body text containing shell $$ followed by display math
- Then Ordinary shell body text remains as supplied

## Scenario: One display formula after single-line shell text becomes an image

- Given Pi can render math through the image path
- When transform body text containing shell $$ followed by display math
- Then One display formula following shell text becomes an image

## Scenario: The LaTeX for x = 1 following single-line shell text does not remain in the transformed output

- Given Pi can render math through the image path
- When transform body text containing shell $$ followed by display math
- Then The LaTeX for x = 1 following shell text does not remain in the transformed output

## Scenario: Preserve multiline shell $$ as ordinary body text

- Given Pi can render math through the image path
- When transform body text containing multiline shell $$ followed by display math
- Then Ordinary multiline shell body text remains as supplied

## Scenario: One display formula following multiline shell text becomes an image

- Given Pi can render math through the image path
- When transform body text containing multiline shell $$ followed by display math
- Then One display formula following shell text becomes an image

## Scenario: The LaTeX for x = 1 following multiline shell text does not remain in the transformed output

- Given Pi can render math through the image path
- When transform body text containing multiline shell $$ followed by display math
- Then The LaTeX for x = 1 following shell text does not remain in the transformed output

## Scenario: Preserve ordinary body text containing $$ at the start of a line

- Given Pi can render math through the image path
- When transform ordinary body text containing $$ at the start of a line followed by display math
- Then Ordinary body text containing $$ at the start of a line remains as supplied

## Scenario: One display formula after non-math $$ following ordinary line-start text becomes an image

- Given Pi can render math through the image path
- When transform ordinary body text containing $$ at the start of a line followed by display math
- Then One display formula following non-math $$ becomes an image

## Scenario: The LaTeX for x = 1 after non-math $$ following ordinary line-start text does not remain in the transformed output

- Given Pi can render math through the image path
- When transform ordinary body text containing $$ at the start of a line followed by display math
- Then The LaTeX for x = 1 following non-math $$ does not remain in the transformed output

## Scenario: One labeled display formula following non-math $$ becomes an image

- Given Pi can render math through the image path
- When transform body text containing non-math $$ and labeled display math
- Then One display formula following non-math $$ becomes an image

## Scenario: The LaTeX for labeled x = 1 following non-math $$ does not remain in the transformed output

- Given Pi can render math through the image path
- When transform body text containing non-math $$ and labeled display math
- Then The LaTeX for x = 1 following non-math $$ does not remain in the transformed output

## Scenario: Do not duplicate body text before labeled display math

- Given Pi can render math through the image path
- When transform body text containing non-math $$ and labeled display math
- Then Body text before labeled display math remains exactly once as supplied

## Scenario: Skip many non-math $$ within a practical time

- Given Pi can render math through the image path
- When transform body text containing ten thousand non-math $$
- Then Scanning finishes within one second

## Scenario: Invalid display math remains in the transformed output

- Given Pi can render math through the image path
- When transform body text containing invalid and valid display math
- Then Invalid display math remains in the transformed output

## Scenario: Body text following invalid display math remains in the transformed output

- Given Pi can render math through the image path
- When transform body text containing invalid and valid display math
- Then Body text following invalid display math remains in the transformed output

## Scenario: One valid formula after invalid display math becomes an image

- Given Pi can render math through the image path
- When transform body text containing invalid and valid display math
- Then One valid formula after invalid display math becomes an image
