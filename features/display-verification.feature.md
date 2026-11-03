# Feature: Prepare a verification corpus and capture the real display in an independent session

Real display verification runs in an independent session without disrupting the user's screen or work. It verifies that the response matches the corpus and keeps captures before and after redraw for visual inspection.

Prepare reproduction corpora and extra macros for verification and confirm that saved display math can be typeset. Report why extra macro definitions differ from qni-cli or cannot be found.

## Scenario: obtain captures for visual inspection

- Given an executable real display verification test environment exists
- When run the real display verification interface
- Then Captures for visual inspection are returned

## Scenario: Reject response mismatches before capture

- Given an executable real display verification test environment exists
- And the response differs from the corpus
- When run the real display verification interface
- Then A response verification stage failure is returned

## Scenario: Keep captures before and after redraw

- Given an executable real display verification test environment exists
- And redraw at 100 columns
- When run the real display verification interface
- Then Captures before and after the change are returned

## Scenario: Use the Issue 21 reproduction corpus

- Given an Issue 21 reproduction corpus exists
- When Read saved reproduction corpora
- Then The corpus contains the final display formula from Issue 21

## Scenario: The Issue 26 corpus contains 3 display formulas

- Given an Issue 26 reproduction corpus exists
- When Read saved reproduction corpora
- And typeset corpus display math to create a display plan
- Then The Issue 26 corpus contains 3 display formulas

## Scenario: Display math containing Issue 26 extra macros can produce image rows

- Given an Issue 26 reproduction corpus exists
- When Read saved reproduction corpora
- And typeset corpus display math to create a display plan
- Then Display math containing Issue 26 extra macros can produce image rows

## Scenario: typeset the Issue 48 Grover corpus

- Given an Issue 48 Grover corpus exists
- When Read saved reproduction corpora
- And typeset corpus display math to create a display plan
- Then Display math containing bra and braket can be typeset

## Scenario: Separate the term immediately after braket

- Given display math contains braket immediately followed by ket
- When expand display math using verification extra macros
- Then braket and the immediately following ket expand into separate terms

## Scenario: Preserve the bra definition

- Given display math uses bra
- When expand display math using verification extra macros
- Then bra expands to an angle bracket and a vertical bar

## Scenario: Preserve the ket definition

- Given display math uses ket
- When expand display math using verification extra macros
- Then ket expands to a vertical bar and an angle bracket

## Scenario: The Issue 52 corpus contains 7 display formulas

- Given an Issue 52 width-sweep corpus exists
- When Read saved reproduction corpora
- And typeset corpus display math to create a display plan
- Then The Issue 52 corpus contains 7 display formulas

## Scenario: The width-sweep corpus contains display math with 3 terms

- Given an Issue 52 width-sweep corpus exists
- When Read saved reproduction corpora
- And typeset corpus display math to create a display plan
- Then The width-sweep corpus contains display math with 3 terms

## Scenario: The width-sweep corpus contains display math with 15 terms

- Given an Issue 52 width-sweep corpus exists
- When Read saved reproduction corpora
- And typeset corpus display math to create a display plan
- Then The width-sweep corpus contains display math with 15 terms

## Scenario: Align verification harness extra macros with qni-cli

- Given qni-cli extra macro definitions differ only in formatting from the verification harness
- When read the qni-cli extra macro definitions
- Then The verification harness extra macros match qni-cli

## Scenario: Detect changes to qni-cli extra macros

- Given qni-cli extra macro definitions differ in value from the verification harness
- When read the qni-cli extra macro definitions
- Then The verification harness detects qni-cli definition differences

## Scenario: Explain why qni-cli extra macro definitions cannot be found

- Given qni-cli source has no extra macro definitions
- When read the qni-cli extra macro definitions
- Then Read failures identify the affected file
