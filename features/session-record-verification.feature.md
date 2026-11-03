# Feature: Check session records for tool failures

Detect tools that did not work as expected in session records from Pi launched by the verification harness. Recorded capability limitations and failures must not be missed even when the display looks correct.

## Scenario: Extract symbolic execution capability limitations

- Given a session record contains `unsupported symbolic gate column`
- When run the session record check
- Then The capability limitation is reported with the corresponding qni command and context

## Scenario: Extract nonzero tool exits

- Given a session record contains `unsupported symbolic gate column`
- When run the session record check
- Then The nonzero qni exit is reported with the corresponding command

## Scenario: Extract interruptions among multiple commands

- Given a session record contains `unsupported symbolic gate column`
- When run the session record check
- Then The interrupted qni execution is reported with the interrupted command

## Scenario: Report the tool name that executed the single command

- Given a session record has a runner capability limitation in a single check command
- When run the session record check
- Then The capability-limited command is reported as runner check

## Scenario: Report the tool name that executed the interrupted command

- Given a session record has an interruption in the second runner deploy command
- When run the session record check
- Then The interrupted command is reported as runner deploy

## Scenario: Extract fallback transitions

- Given a session record has the model switch to a fallback after failure
- When run the session record check
- Then The fallback is reported with the preceding tool and command

## Scenario: Ignore ordinary alternative wording after a successful tool result

- Given an assistant body contains 「代わりに」 after a successful tool result
- When run the session record check
- Then Alternative wording after a successful result is not reported

## Scenario: Ignore unrelated fallback wording later than the immediate failure response

- Given the next assistant body after failure has no fallback wording but a later body mentions fallback
- When run the session record check
- Then Fallback wording later than the immediate failure response is not reported

## Scenario: Fail the check when matches are found

- Given a session record contains `unsupported symbolic gate column`
- When run the session record check
- Then The session record check returns exit code 1

## Scenario: The successful session record check returns exit code 0

- Given a session record has a successful tool result
- When run the session record check
- Then The successful session record check returns exit code 0

## Scenario: A successful session record reports no tool failures

- Given a session record has a successful tool result
- When run the session record check
- Then A successful session record reports no tool failures

## Scenario: Exclude known allowed patterns

- Given an ignore list allows known capability limitations
- When run the session record check with the ignore list
- Then Only allowed capability limitations are excluded from the report

## Scenario: Retain nonzero exits outside the ignore list

- Given an ignore list allows known capability limitations
- When run the session record check with the ignore list
- Then Nonzero exits outside the ignore list remain in the report

## Scenario: Fail the check on matches outside the ignore list

- Given an ignore list allows known capability limitations
- When run the session record check with the ignore list
- Then Matches outside the ignore list return exit code 1

## Scenario Outline: Reject empty ignore conditions

- Given an ignore list has an empty `<field>` field
- When run the session record check with the ignore list
- Then The invalid ignore list returns exit code 2

### Examples:

  | field   |
  | ------- |
  | kind    |
  | tool    |
  | command |
  | pattern |
