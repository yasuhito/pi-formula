# Feature: Clean up only completed terminals in the automation precheck

The Orca automation precheck does not close a terminal while its agent is still working, even if the corresponding run is marked complete. Cleanup determines terminal state from the last output.

## Scenario Outline: The precheck has no child process launch error

- Given the terminal last output is "<state>"
- When run the "<precheck>" precheck
- Then The precheck has no child process launch error

### Examples:

  | state | precheck | call |
  | --- | --- | --- |
  | recent | PR reviewer | none |
  | quiet | PR reviewer | worker-terminal |
  | missing | PR reviewer | worker-terminal |
  | recent | issue coordinator | none |
  | quiet | issue coordinator | worker-terminal |
  | missing | issue coordinator | worker-terminal |

## Scenario Outline: The precheck returns exit code 0

- Given the terminal last output is "<state>"
- When run the "<precheck>" precheck
- Then The precheck returns exit code 0

### Examples:

  | state | precheck | call |
  | --- | --- | --- |
  | recent | PR reviewer | none |
  | quiet | PR reviewer | worker-terminal |
  | missing | PR reviewer | worker-terminal |
  | recent | issue coordinator | none |
  | quiet | issue coordinator | worker-terminal |
  | missing | issue coordinator | worker-terminal |

## Scenario Outline: The precheck does not exit due to a signal

- Given the terminal last output is "<state>"
- When run the "<precheck>" precheck
- Then The precheck does not exit due to a signal

### Examples:

  | state | precheck | call |
  | --- | --- | --- |
  | recent | PR reviewer | none |
  | quiet | PR reviewer | worker-terminal |
  | missing | PR reviewer | worker-terminal |
  | recent | issue coordinator | none |
  | quiet | issue coordinator | worker-terminal |
  | missing | issue coordinator | worker-terminal |

## Scenario Outline: The precheck writes nothing to stdout

- Given the terminal last output is "<state>"
- When run the "<precheck>" precheck
- Then The precheck writes nothing to stdout

### Examples:

  | state | precheck | call |
  | --- | --- | --- |
  | recent | PR reviewer | none |
  | quiet | PR reviewer | worker-terminal |
  | missing | PR reviewer | worker-terminal |
  | recent | issue coordinator | none |
  | quiet | issue coordinator | worker-terminal |
  | missing | issue coordinator | worker-terminal |

## Scenario Outline: The precheck writes nothing to stderr

- Given the terminal last output is "<state>"
- When run the "<precheck>" precheck
- Then The precheck writes nothing to stderr

### Examples:

  | state | precheck | call |
  | --- | --- | --- |
  | recent | PR reviewer | none |
  | quiet | PR reviewer | worker-terminal |
  | missing | PR reviewer | worker-terminal |
  | recent | issue coordinator | none |
  | quiet | issue coordinator | worker-terminal |
  | missing | issue coordinator | worker-terminal |

## Scenario Outline: terminal close is called only with the specified value

- Given the terminal last output is "<state>"
- When run the "<precheck>" precheck
- Then terminal close is called only with "<call>"

### Examples:

  | state | precheck | call |
  | --- | --- | --- |
  | recent | PR reviewer | none |
  | quiet | PR reviewer | worker-terminal |
  | missing | PR reviewer | worker-terminal |
  | recent | issue coordinator | none |
  | quiet | issue coordinator | worker-terminal |
  | missing | issue coordinator | worker-terminal |
