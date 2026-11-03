# Feature: Plan output width and height including display math before rendering

The display planning tool calculates math image rows and Markdown wrapping from a corpus and returns the required output width and height. The plan includes display path differences and dimensions after redraw.

Math that cannot be typeset is planned as text. Unreadable input or required height exceeding the limit returns an exit code and diagnostics before rendering.

## Scenario: Output height planning with typesetting failures succeeds

- Given a corpus contains formulas that can and cannot be typeset
- When plan output height including display math image rows
- Then Output height planning with typesetting failures succeeds

## Scenario: A display plan containing typesetting failures and remaining image rows is returned

- Given a corpus contains formulas that can and cannot be typeset
- When plan output height including display math image rows
- Then A display plan containing typesetting failures and remaining image rows is returned

## Scenario: The verification display plan with typesetting failures succeeds

- Given a corpus contains formulas that can and cannot be typeset
- When run the real display verification display plan boundary
- Then The verification display plan with typesetting failures succeeds

## Scenario: The verification display plan counts one typesetting failure

- Given a corpus contains formulas that can and cannot be typeset
- When run the real display verification display plan boundary
- Then The verification display plan counts one typesetting failure

## Scenario: Verification display plan diagnostics show one typesetting failure

- Given a corpus contains formulas that can and cannot be typeset
- When run the real display verification display plan boundary
- Then Verification display plan diagnostics show one typesetting failure

## Scenario: The verification display plan without image rows succeeds

- Given a corpus contains only display math that cannot be typeset
- When run the real display verification display plan boundary
- Then The verification display plan without image rows succeeds

## Scenario: A text display plan is returned even after all formulas fail typesetting

- Given a corpus contains only display math that cannot be typeset
- When run the real display verification display plan boundary
- Then A text display plan is returned even after all formulas fail typesetting

## Scenario: Diagnostics show one failure even after all formulas fail typesetting

- Given a corpus contains only display math that cannot be typeset
- When run the real display verification display plan boundary
- Then Diagnostics show one failure even after all formulas fail typesetting

## Scenario: The text path display plan succeeds

- Given a corpus contains only display math that cannot be typeset
- When run the text path display plan boundary
- Then The text path display plan succeeds

## Scenario: The text path display plan contains no image rows

- Given a corpus contains only display math that cannot be typeset
- When run the text path display plan boundary
- Then The text path display plan contains no image rows

## Scenario: The text path display plan contains no image typesetting failures

- Given a corpus contains only display math that cannot be typeset
- When run the text path display plan boundary
- Then The text path display plan contains no image typesetting failures

## Scenario: The text display plan at 100 columns succeeds

- Given a corpus wraps onto more lines when reflowed to 100 columns
- When run the display plan boundary at 100 columns through the text path
- Then The text display plan at 100 columns succeeds

## Scenario: The planned height including reflow to 100 columns is 8856px

- Given a corpus wraps onto more lines when reflowed to 100 columns
- When run the display plan boundary at 100 columns through the text path
- Then The planned height including reflow to 100 columns is 8856px

## Scenario: The planned width before reflow is 1920px

- Given a corpus wraps onto more lines when reflowed to 100 columns
- When run the display plan boundary at 100 columns through the text path
- Then The planned width before reflow is 1920px

## Scenario: The planned width after reflow to 100 columns is 816px

- Given a corpus wraps onto more lines when reflowed to 100 columns
- When run the display plan boundary at 100 columns through the text path
- Then The planned width after reflow to 100 columns is 816px

## Scenario: A display plan that does not fit after reflow returns exit code 2

- Given a corpus exceeds the limit only after reflow to 100 columns
- When run the display plan boundary at 100 columns through the text path
- Then A display plan that does not fit after reflow returns exit code 2

## Scenario: Height overflow diagnostics show the text path

- Given a corpus exceeds the limit only after reflow to 100 columns
- When run the display plan boundary at 100 columns through the text path
- Then Height overflow diagnostics show the text path

## Scenario: Height overflow diagnostics show reflow to 100 columns

- Given a corpus exceeds the limit only after reflow to 100 columns
- When run the display plan boundary at 100 columns through the text path
- Then Height overflow diagnostics show reflow to 100 columns

## Scenario: Height overflow diagnostics show the required height of 16056px

- Given a corpus exceeds the limit only after reflow to 100 columns
- When run the display plan boundary at 100 columns through the text path
- Then Height overflow diagnostics show the required height of 16056px

## Scenario: Include Markdown wrapping in the display plan

- Given a corpus contains a Markdown table with full-width characters and spaces
- When run the display plan boundary at 100 columns through the text path
- Then The display plan includes Markdown table wrapping

## Scenario: The display plan containing unreadably scaled math succeeds

- Given display math becomes unreadably scaled at 100 columns
- When run the display plan boundary at 100 columns through the image path
- Then The display plan containing unreadably scaled math succeeds

## Scenario: Unreadably scaled math is planned as one typesetting failure

- Given display math becomes unreadably scaled at 100 columns
- When run the display plan boundary at 100 columns through the image path
- Then Unreadably scaled math is planned as one typesetting failure

## Scenario: Diagnostics show one typesetting failure for unreadably scaled math

- Given display math becomes unreadably scaled at 100 columns
- When run the display plan boundary at 100 columns through the image path
- Then Diagnostics show one typesetting failure for unreadably scaled math

## Scenario: A display plan exceeding the height limit due to image transfer rows returns exit code 2

- Given a corpus contains 11 tall display formulas
- When run the real display verification display plan boundary
- Then A display plan exceeding the height limit due to image transfer rows returns exit code 2

## Scenario: Transfer row height overflow diagnostics show the image path

- Given a corpus contains 11 tall display formulas
- When run the real display verification display plan boundary
- Then Transfer row height overflow diagnostics show the image path

## Scenario: Transfer row height overflow diagnostics show the 16000px limit

- Given a corpus contains 11 tall display formulas
- When run the real display verification display plan boundary
- Then Transfer row height overflow diagnostics show the 16000px limit

## Scenario: The unreadable corpus display plan returns exit code 2

- Given an unreadable corpus path exists
- When run the real display verification display plan boundary
- Then The unreadable corpus display plan returns exit code 2

## Scenario: Display plan diagnostics show the unreadable corpus filename

- Given an unreadable corpus path exists
- When run the real display verification display plan boundary
- Then Display plan diagnostics show the unreadable corpus filename

## Scenario: Read failure diagnostics do not show a height overflow

- Given an unreadable corpus path exists
- When run the real display verification display plan boundary
- Then Read failure diagnostics do not show a height overflow

## Scenario: The display plan containing an input character limit failure succeeds

- Given a corpus that fits contains display math exceeding the character limit
- When plan output height including display math image rows
- Then The display plan containing an input character limit failure succeeds

## Scenario: A display plan counting long math as text exactly once is returned

- Given a corpus that fits contains display math exceeding the character limit
- When plan output height including display math image rows
- Then A display plan counting long math as text exactly once is returned

## Scenario: The tall display math plan returns exit code 2 before rendering

- Given a short corpus contains display math taller than 16000px
- When run the real display verification display plan boundary
- Then The tall display math plan returns exit code 2 before rendering

## Scenario: Tall display math diagnostics show the 16000px limit

- Given a short corpus contains display math taller than 16000px
- When run the real display verification display plan boundary
- Then Tall display math diagnostics show the 16000px limit

## Scenario: Tall display math diagnostics do not show a read failure

- Given a short corpus contains display math taller than 16000px
- When run the real display verification display plan boundary
- Then Tall display math diagnostics do not show a read failure
