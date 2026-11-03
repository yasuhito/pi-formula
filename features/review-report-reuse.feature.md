# Feature: Reuse the independent review verdict for the current HEAD

The PR reviewer can reuse a completed independent review verdict for the current HEAD. Identify why a report is unusable and avoid launching duplicate review workers for the same HEAD.

## Scenario: Resolving a valid independent review succeeds

- Given a valid PASS report for the current HEAD remains
- When resolve the review verdict flow
- Then Resolving a valid independent review succeeds

## Scenario: The valid independent review report is retained

- Given a valid PASS report for the current HEAD remains
- When resolve the review verdict flow
- Then The valid independent review report is retained

## Scenario: The valid report for the current HEAD is considered valid

- Given a valid PASS report for the current HEAD remains
- When resolve the review verdict flow
- Then The valid report for the current HEAD is considered valid

## Scenario: A valid independent review does not require terminal creation

- Given a valid PASS report for the current HEAD remains
- When resolve the review verdict flow
- Then A valid independent review does not require terminal creation

## Scenario: The next stage for a valid independent review is 6.2

- Given a valid PASS report for the current HEAD remains
- When resolve the review verdict flow
- Then The next stage for a valid independent review is 6.2

## Scenario Outline: Resolving an invalid independent review succeeds

- Given the current HEAD report has defect "<defect>"
- When resolve the review verdict flow
- Then Resolving an invalid independent review succeeds

### Examples:

  | defect |
  | --- |
  | missing file |
  | HEAD mismatch |
  | missing VERDICT |
  | missing COMPLETE |

## Scenario Outline: The invalid independent review report is deleted

- Given the current HEAD report has defect "<defect>"
- When resolve the review verdict flow
- Then The invalid independent review report is deleted

### Examples:

  | defect |
  | --- |
  | missing file |
  | HEAD mismatch |
  | missing VERDICT |
  | missing COMPLETE |

## Scenario Outline: The defective report is considered invalid

- Given the current HEAD report has defect "<defect>"
- When resolve the review verdict flow
- Then The defective report is considered invalid

### Examples:

  | defect |
  | --- |
  | missing file |
  | HEAD mismatch |
  | missing VERDICT |
  | missing COMPLETE |

## Scenario Outline: An invalid independent review requires terminal creation

- Given the current HEAD report has defect "<defect>"
- When resolve the review verdict flow
- Then An invalid independent review requires terminal creation

### Examples:

  | defect |
  | --- |
  | missing file |
  | HEAD mismatch |
  | missing VERDICT |
  | missing COMPLETE |

## Scenario: Allow reused PASS verdicts to proceed to the merge gate

- Given a valid PASS report for the current HEAD remains
- When resolve the review verdict flow
- Then The reused PASS verdict proceeds to 7.5
