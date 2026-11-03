# Feature: Plan a build of pinned libghostty-vt at the specified location

The build plan uses libghostty-vt at a pinned commit and places the header, library, and vt-pty under the specified native prefix. The Zig build command also references this prefix.

## Scenario: The libghostty-vt build plan succeeds

- Given a native prefix setting exists in the home directory
- When print the libghostty-vt build plan
- Then The libghostty-vt build plan succeeds

## Scenario: The libghostty-vt build plan uses the pinned commit

- Given a native prefix setting exists in the home directory
- When print the libghostty-vt build plan
- Then The libghostty-vt build plan uses the pinned commit

## Scenario: The libghostty-vt build plan uses the specified prefix

- Given a native prefix setting exists in the home directory
- When print the libghostty-vt build plan
- Then The libghostty-vt build plan uses the specified prefix

## Scenario: The build plan header is under include in the specified prefix

- Given a native prefix setting exists in the home directory
- When print the libghostty-vt build plan
- Then The build plan header is under include in the specified prefix

## Scenario: The build plan library is under lib in the specified prefix

- Given a native prefix setting exists in the home directory
- When print the libghostty-vt build plan
- Then The build plan library is under lib in the specified prefix

## Scenario: The build plan vt-pty is under bin in the specified prefix

- Given a native prefix setting exists in the home directory
- When print the libghostty-vt build plan
- Then The build plan vt-pty is under bin in the specified prefix

## Scenario: The Zig build command uses only the specified prefix

- Given a native prefix setting exists in the home directory
- When print the libghostty-vt build plan
- Then The Zig build command uses only the specified prefix
