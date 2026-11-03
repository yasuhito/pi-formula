# Feature: Safely inspect math display diagnostics

Diagnostics show detection results when math display has problems.

Diagnostics show the display path, selection reason, and other details in printable English characters.

Only the user macro count is shown, without secret contents.

## Scenario: Display diagnostic fields in a fixed order

- Given Pi is running in the `Kitty` terminal
- And one user macro is configured
- And the macro contents include a secret string
- When start a session
- And run formula status
- Then Diagnostics contain only the following fields in this order

  | field |
  | ---- |
  | version |
  | path |
  | reason |
  | terminal |
  | serif |
  | macros |
  | color |
  | cache |
  | last failure |

## Scenario: Display diagnostics in printable English characters

- Given Pi is running in the `Kitty` terminal
- And one user macro is configured
- And the macro contents include a secret string
- When start a session
- And run formula status
- Then Diagnostics contain only printable ASCII characters

## Scenario: Show the user macro count in diagnostics

- Given Pi is running in the `Kitty` terminal
- And one user macro is configured
- And the macro contents include a secret string
- When start a session
- And run formula status
- Then The user macro count shown in diagnostics is 1

## Scenario: Exclude secret macro contents from diagnostics

- Given Pi is running in the `Kitty` terminal
- And one user macro is configured
- And the macro contents include a secret string
- When start a session
- And run formula status
- Then Diagnostics do not contain secret macro contents
