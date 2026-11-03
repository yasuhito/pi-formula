# Feature: Render prebuilt PNGs to the terminal through the public API

Integration extensions can render prebuilt PNG Buffers or files to the terminal through the public API. Image transfers and placeholders correspond, and rendering leaves no background color or dim state behind.

When the image path is unavailable or image format, dimensions, or decompressed size fail the requirements, return a rejection reason without rendering.

## Scenario: Rendering the prebuilt PNG succeeds

- Given a test integration extension uses the image path
- When render a prebuilt PNG Buffer through the public API
- Then Rendering the prebuilt PNG succeeds

## Scenario: Successful prebuilt PNG rendering has no rejection reason

- Given a test integration extension uses the image path
- When render a prebuilt PNG Buffer through the public API
- Then Successful prebuilt PNG rendering has no rejection reason

## Scenario: The prebuilt PNG render result contains an image transfer

- Given a test integration extension uses the image path
- When render a prebuilt PNG Buffer through the public API
- Then The prebuilt PNG render result contains an image transfer

## Scenario: The prebuilt PNG render result contains placeholders

- Given a test integration extension uses the image path
- When render a prebuilt PNG Buffer through the public API
- Then The prebuilt PNG render result contains placeholders

## Scenario: The prebuilt PNG placement fits within 8 columns

- Given a test integration extension uses the image path
- When render a prebuilt PNG Buffer through the public API
- Then The prebuilt PNG placement fits within 8 columns

## Scenario: The prebuilt PNG placement uses at least one row

- Given a test integration extension uses the image path
- When render a prebuilt PNG Buffer through the public API
- Then The prebuilt PNG placement uses at least one row

## Scenario: The prebuilt PNG image ID preserves the 3 bytes in the unsafe range

- Given a prebuilt PNG produces an image ID containing bytes in the unsafe range
- When render a prebuilt PNG Buffer through the public API
- Then The prebuilt PNG image ID preserves the 3 bytes in the unsafe range

## Scenario: Placeholder underline colors use colon syntax

- Given a prebuilt PNG produces an image ID containing bytes in the unsafe range
- When render a prebuilt PNG Buffer through the public API
- Then Placeholder underline colors use colon syntax

## Scenario: Background color does not remain after placeholder output

- Given a prebuilt PNG produces an image ID containing bytes in the unsafe range
- When render a prebuilt PNG Buffer through the public API
- And read the SGR state after placeholder output
- Then Background color does not remain after placeholder output

## Scenario: Dim does not remain after placeholder output

- Given a prebuilt PNG produces an image ID containing bytes in the unsafe range
- When render a prebuilt PNG Buffer through the public API
- And read the SGR state after placeholder output
- Then Dim does not remain after placeholder output

## Scenario: The prebuilt PNG file is rendered

- Given a test integration extension uses the image path
- When render a prebuilt PNG file through the public API
- Then The prebuilt PNG file is rendered

## Scenario: The prebuilt PNG file transfers a PNG image

- Given a test integration extension uses the image path
- When render a prebuilt PNG file through the public API
- Then The prebuilt PNG file transfers a PNG image

## Scenario: Do not render prebuilt PNGs in terminals without image support

- Given a test integration extension uses the text path
- When render a prebuilt PNG Buffer through the public API
- Then Do not render prebuilt PNGs in terminals without image support

## Scenario: The prebuilt PNG is not rendered because the image path is unavailable

- Given a test integration extension uses the text path
- When render a prebuilt PNG Buffer through the public API
- Then The prebuilt PNG is not rendered because the image path is unavailable

## Scenario: A text path rejection contains only render status and rejection reason

- Given a test integration extension uses the text path
- When render a prebuilt PNG Buffer through the public API
- Then The rejection result contains only render status and rejection reason

## Scenario: A PNG exceeding dimension safety limits is not rendered

- Given a test integration extension uses the image path
- When render a prebuilt PNG exceeding safety limits through the public API
- Then A prebuilt PNG exceeding safety limits is not rendered

## Scenario: The rejection reason for a PNG exceeding dimension safety limits is the safety limit

- Given a test integration extension uses the image path
- When render a prebuilt PNG exceeding safety limits through the public API
- Then The prebuilt PNG rejection reason is the safety limit

## Scenario: A PNG dimension safety limit rejection contains only render status and rejection reason

- Given a test integration extension uses the image path
- When render a prebuilt PNG exceeding safety limits through the public API
- Then The rejection result contains only render status and rejection reason

## Scenario: An invalid prebuilt PNG is not rendered

- Given a test integration extension uses the image path
- When render a truncated prebuilt PNG through the public API
- Then An invalid prebuilt PNG is not rendered

## Scenario: The prebuilt PNG rejection reason is invalid PNG format

- Given a test integration extension uses the image path
- When render a truncated prebuilt PNG through the public API
- Then The prebuilt PNG rejection reason is invalid PNG format

## Scenario: A truncated PNG rejection contains only render status and rejection reason

- Given a test integration extension uses the image path
- When render a truncated prebuilt PNG through the public API
- Then The rejection result contains only render status and rejection reason

## Scenario: A PNG exceeding decompression limits is not rendered

- Given a test integration extension uses the image path
- When render a prebuilt PNG exceeding decompression limits through the public API
- Then A prebuilt PNG exceeding safety limits is not rendered

## Scenario: The rejection reason for a PNG exceeding decompression limits is the safety limit

- Given a test integration extension uses the image path
- When render a prebuilt PNG exceeding decompression limits through the public API
- Then The prebuilt PNG rejection reason is the safety limit

## Scenario: A PNG decompression limit rejection contains only render status and rejection reason

- Given a test integration extension uses the image path
- When render a prebuilt PNG exceeding decompression limits through the public API
- Then The rejection result contains only render status and rejection reason
