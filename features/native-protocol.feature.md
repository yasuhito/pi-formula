# Feature: Check image path protocol state with libghostty-vt

Protocol checks observe storage, placements, and incremental updates from the encoder and Pi image path using libghostty-vt. Environments without native dependencies report a skipped check and exit successfully.

Checks using real vt-pty can be selected separately from ordinary checks with a dedicated tag.

## Scenario: The protocol check succeeds without vt-pty

- Given an environment without vt-pty exists
- When run the protocol check entry point
- Then The protocol check succeeds without vt-pty

## Scenario: The protocol check reports a skip because vt-pty is unavailable

- Given an environment without vt-pty exists
- When run the protocol check entry point
- Then The protocol check reports a skip because vt-pty is unavailable

## Scenario: The Pi protocol check succeeds without vt-pty

- Given an environment without vt-pty exists
- When run the protocol check through Pi
- Then The Pi protocol check succeeds without vt-pty

## Scenario: The Pi protocol check reports a skip because vt-pty is unavailable

- Given an environment without vt-pty exists
- When run the protocol check through Pi
- Then The Pi protocol check reports a skip because vt-pty is unavailable

## Scenario: The vt-pty specified by the environment variable succeeds

- Given vt-pty is specified by an environment variable
- When run the protocol check entry point
- Then The vt-pty specified by the environment variable succeeds

## Scenario: The output of the vt-pty specified by the environment variable is returned

- Given vt-pty is specified by an environment variable
- When run the protocol check entry point
- Then The output of the vt-pty specified by the environment variable is returned

## Scenario: The encoder check succeeds without vt-pty

- Given an environment without vt-pty exists
- When run the encoder-layer protocol check
- Then The encoder check succeeds without vt-pty

## Scenario: The encoder check reports a skip because vt-pty is unavailable

- Given an environment without vt-pty exists
- When run the encoder-layer protocol check
- Then The encoder check reports a skip because vt-pty is unavailable

`@native-vt`
## Scenario: The encoder storage check succeeds

- When check encoder-layer storage
- Then The protocol check exit code is 0

`@native-vt`
## Scenario: Storage contains one PNG image matching the plan

- When check encoder-layer storage
- Then Storage contains one PNG image matching the plan

`@native-vt`
## Scenario: The documented encoder check in an unbuilt checkout succeeds

- Given a test checkout has no build artifacts
- And user settings select the text path in a tmux terminal environment
- When run the documented encoder-layer check entry point
- Then The protocol check exit code is 0

`@native-vt`
## Scenario: The isolated encoder storage check is reported

- Given a test checkout has no build artifacts
- And user settings select the text path in a tmux terminal environment
- When run the documented encoder-layer check entry point
- Then The isolated encoder storage check is reported

`@native-vt`
## Scenario: Extension build artifacts are created in the isolated checkout

- Given a test checkout has no build artifacts
- And user settings select the text path in a tmux terminal environment
- When run the documented encoder-layer check entry point
- Then Extension build artifacts are created in the isolated checkout

`@native-vt`
## Scenario: The encoder virtual placement check succeeds

- When check encoder-layer virtual placements
- Then The protocol check exit code is 0

`@native-vt`
## Scenario: Virtual placement columns and rows match the plan

- When check encoder-layer virtual placements
- Then Virtual placement columns and rows match the plan

`@native-vt`
## Scenario: The encoder placeholder image ID check succeeds

- When check encoder-layer placeholder image IDs
- Then The protocol check exit code is 0

`@native-vt`
## Scenario: The image ID decoded from foreground RGB matches the plan

- When check encoder-layer placeholder image IDs
- Then The image ID decoded from foreground RGB matches the plan

`@native-vt`
## Scenario: The encoder placeholder coordinate check succeeds

- When check encoder-layer placeholder coordinates
- Then The protocol check exit code is 0

`@native-vt`
## Scenario: Coordinates decoded from diacritics have no gaps or extras

- When check encoder-layer placeholder coordinates
- Then Coordinates decoded from diacritics have no gaps or extras

`@native-vt`
## Scenario: The encoder placeholder underline color tag check succeeds

- When check encoder-layer placeholder underline color tags
- Then The protocol check exit code is 0

`@native-vt`
## Scenario: All placeholder cell underline color tags are RGB

- When check encoder-layer placeholder underline color tags
- Then All placeholder cell underline color tags are RGB

`@native-vt`
## Scenario: The second encoder output check for the same Markdown succeeds

- When check the second encoder output for the same Markdown
- Then The protocol check exit code is 0

`@native-vt`
## Scenario: Storage contains the image on the second pass too

- When check the second encoder output for the same Markdown
- Then Storage contains the image on the second pass too

`@native-vt`
## Scenario: The encoder output check without image transfers returns exit code 1

- When check encoder output with image transfers omitted
- Then The encoder output check without image transfers returns exit code 1

`@native-vt`
## Scenario: The encoder check reports that the placeholder ID has no virtual placement

- When check encoder output with image transfers omitted
- Then The encoder check reports that the placeholder ID has no virtual placement

`@native-vt`
## Scenario: The text-emitting child process settle check succeeds

- Given a child process command outputs text through vt-pty
- When wait for child process output to settle
- Then The protocol check exit code is 0

`@native-vt`
## Scenario: The protocol body cells report hello

- Given a child process command outputs text through vt-pty
- When wait for child process output to settle
- Then The protocol body cells report hello

`@native-vt`
## Scenario: The protocol reports zero image placements

- Given a child process command outputs text through vt-pty
- When wait for child process output to settle
- Then The protocol reports zero image placements

`@native-vt`
## Scenario: The protocol reports zero APC leaks

- Given a child process command outputs text through vt-pty
- When wait for child process output to settle
- Then The protocol reports zero APC leaks

`@native-vt`
## Scenario: The check waiting for delayed virtual placements succeeds

- Given a child process emits virtual placements after the vt-pty settle interval
- When wait for child process output to settle
- Then The protocol check exit code is 0

`@native-vt`
## Scenario: Protocol state is printed after receiving the required virtual placements

- Given a child process emits virtual placements after the vt-pty settle interval
- When wait for child process output to settle
- Then Protocol state is printed after receiving the required virtual placements

`@native-vt`
## Scenario: The check of continued output after virtual placements succeeds

- Given a child process continues output after the required virtual placements
- When wait for child process output to settle
- Then The protocol check exit code is 0

`@native-vt`
## Scenario: Protocol state is printed without waiting for output to settle

- Given a child process continues output after the required virtual placements
- When wait for child process output to settle
- Then Protocol state is printed without waiting for output to settle

`@native-vt`
## Scenario: Waiting for child process exit detects abnormal exits after virtual placements

- Given a child process exits abnormally after a virtual placement
- When wait for child process output to settle
- Then The protocol check exit code is nonzero

`@native-vt`
## Scenario: The check of placeholders and body text arriving separately after virtual placements succeeds

- Given a child process keeps emitting placeholders and body text separately after virtual placements
- When wait for child process output to settle
- Then The protocol check exit code is 0

`@native-vt`
## Scenario: The image IDs and coordinates of delayed placeholders are reported

- Given a child process keeps emitting placeholders and body text separately after virtual placements
- When wait for child process output to settle
- Then The image IDs and coordinates of delayed placeholders are reported

`@native-vt`
## Scenario: The after-placement body text following a virtual placement is reported

- Given a child process keeps emitting placeholders and body text separately after virtual placements
- When wait for child process output to settle
- Then The after-placement body text following a virtual placement is reported

`@native-vt`
## Scenario: The check waiting for missing virtual placements does not succeed

- Given a child process continues output after emitting some virtual placements
- When wait for child process output to settle
- Then The protocol check exit code is nonzero

`@native-vt`
## Scenario: The virtual placement count at timeout is printed

- Given a child process continues output after emitting some virtual placements
- When wait for child process output to settle
- Then The virtual placement count at timeout is printed

`@native-vt`
## Scenario: The long grapheme cluster output check succeeds

- Given a child process command outputs a long grapheme cluster through vt-pty
- When wait for child process output to settle
- Then The protocol check exit code is 0

`@native-vt`
## Scenario: The long grapheme cluster body cells report a

- Given a child process command outputs a long grapheme cluster through vt-pty
- When wait for child process output to settle
- Then The long grapheme cluster body cells report a

`@native-vt`
## Scenario: The long grapheme cluster reports zero APC leaks

- Given a child process command outputs a long grapheme cluster through vt-pty
- When wait for child process output to settle
- Then The long grapheme cluster reports zero APC leaks

`@native-vt`
## Scenario: The check of a child process exceeding the deadline does not succeed

- Given a child process runs beyond the vt-pty deadline
- When run the protocol check entry point
- Then The protocol check exit code is nonzero

`@native-vt`
## Scenario: A timeout is not treated as success

- Given a child process runs beyond the vt-pty deadline
- When run the protocol check entry point
- Then A timeout is not treated as success

`@native-vt`
## Scenario: The check of an unlaunchable child process does not succeed

- Given a child process cannot be launched from vt-pty
- When run the protocol check entry point
- Then The protocol check exit code is nonzero

`@native-vt`
## Scenario: A child process launch failure is not treated as success

- Given a child process cannot be launched from vt-pty
- When run the protocol check entry point
- Then A child process launch failure is not treated as success

## Scenario: The Pi check detecting body APC fragments returns exit code 1

- Given vt-pty returns APC fragments in body cells
- When run the protocol check through Pi
- Then The protocol check exit code is 1

## Scenario: The check fails on APC fragments in body cells

- Given vt-pty returns APC fragments in body cells
- When run the protocol check through Pi
- Then The check fails on APC fragments in body cells

## Scenario: The unsettled Pi protocol check returns exit code 2

- Given vt-pty rendering does not settle
- When run the protocol check through Pi
- Then The unsettled Pi protocol check returns exit code 2

## Scenario: The Pi protocol check reports the render timeout reason

- Given vt-pty rendering does not settle
- When run the protocol check through Pi
- Then The Pi protocol check reports the render timeout reason

## Scenario: The streaming check succeeds without vt-pty

- Given an environment without vt-pty exists
- When run the streaming protocol check
- Then The streaming check succeeds without vt-pty

## Scenario: The streaming check reports a skip because vt-pty is unavailable

- Given an environment without vt-pty exists
- When run the streaming protocol check
- Then The streaming check reports a skip because vt-pty is unavailable

`@native-vt`
## Scenario: The streaming frame order check succeeds

- Given a check renders incomplete and final Pi body text in order
- When run the streaming protocol check
- Then The protocol check exit code is 0

`@native-vt`
## Scenario: Multiple frames are reported as checked in chronological order

- Given a check renders incomplete and final Pi body text in order
- When run the streaming protocol check
- Then Multiple frames are reported as checked in chronological order

`@native-vt`
## Scenario: The differential render check preserving preceding tool output succeeds

- Given a check renders incomplete and final Pi body text in order
- When run the streaming protocol check
- Then The protocol check exit code is 0

`@native-vt`
## Scenario: Three differential renders preserving preceding tool output are reported

- Given a check renders incomplete and final Pi body text in order
- When run the streaming protocol check
- Then Three differential renders preserving preceding tool output are reported

`@native-vt`
## Scenario: The completed frame virtual placement and image ID correspondence check succeeds

- Given a check renders incomplete and final Pi body text in order
- When run the streaming protocol check
- Then The protocol check exit code is 0

`@native-vt`
## Scenario: Each completed frame reports matching virtual placement and placeholder image IDs

- Given a check renders incomplete and final Pi body text in order
- When run the streaming protocol check
- Then Each completed frame reports matching virtual placement and placeholder image IDs

`@native-vt`
## Scenario: The intermediate streaming APC fragment check succeeds

- Given a check renders incomplete and final Pi body text in order
- When run the streaming protocol check
- Then The protocol check exit code is 0

`@native-vt`
## Scenario: No intermediate frame is reported as having APC fragments

- Given a check renders incomplete and final Pi body text in order
- When run the streaming protocol check
- Then No intermediate frame is reported as having APC fragments

`@native-vt`
## Scenario: The final frame display formula and virtual placement count check succeeds

- Given a check renders incomplete and final Pi body text in order
- When run the streaming protocol check
- Then The protocol check exit code is 0

`@native-vt`
## Scenario: The final frame display formula and virtual placement counts match

- Given a check renders incomplete and final Pi body text in order
- When run the streaming protocol check
- Then The final frame display formula and virtual placement counts match

## Scenario: The Pi check detecting missing placeholders returns exit code 1

- Given vt-pty returns a virtual placement without placeholders
- When run the protocol check through Pi
- Then The protocol check exit code is 1

## Scenario: The check fails on missing placeholders for virtual placements

- Given vt-pty returns a virtual placement without placeholders
- When run the protocol check through Pi
- Then The check fails on missing placeholders for virtual placements

`@native-vt`
## Scenario: The saved Pi session placeholder cleanliness check succeeds

- Given a saved corpus session can be opened in Pi
- When run the protocol check through Pi
- Then The protocol check exit code is 0

`@native-vt`
## Scenario: Placeholder cells are reported as clean

- Given a saved corpus session can be opened in Pi
- When run the protocol check through Pi
- Then Placeholder cells are reported as clean

`@native-vt`
## Scenario: The saved Pi session body APC fragment check succeeds

- Given a saved corpus session can be opened in Pi
- When run the protocol check through Pi
- Then The protocol check exit code is 0

`@native-vt`
## Scenario: Body cells are reported as having no APC fragments

- Given a saved corpus session can be opened in Pi
- When run the protocol check through Pi
- Then Body cells are reported as having no APC fragments

`@native-vt`
## Scenario: The saved Pi session formula and storage-backed virtual placement count check succeeds

- Given a saved corpus session can be opened in Pi
- When run the protocol check through Pi
- Then The protocol check exit code is 0

`@native-vt`
## Scenario: Display formula and storage-backed virtual placement counts match

- Given a saved corpus session can be opened in Pi
- When run the protocol check through Pi
- Then Display formula and storage-backed virtual placement counts match

`@native-vt`
## Scenario: The Pi check detecting semicolon underline color syntax returns exit code 1

- Given pi-formula has underline colors reverted to semicolon syntax
- When run the protocol check through Pi
- Then The protocol check exit code is 1

`@native-vt`
## Scenario: The check fails on dirty placeholder cells

- Given pi-formula has underline colors reverted to semicolon syntax
- When run the protocol check through Pi
- Then The check fails on dirty placeholder cells

`@native-vt`
## Scenario: Return the terminal default foreground color to the child process

- Given a child process queries the vt-pty default foreground color
- When wait for child process output to settle
- Then The child process receives the default foreground color response

`@native-vt`
## Scenario: Return the terminal default background color to the child process

- Given a child process queries the vt-pty default background color
- When wait for child process output to settle
- Then The child process receives the default background color response
