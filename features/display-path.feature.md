# Feature: Select the display path for the terminal

Formula for Pi displays math as images or text according to terminal image support and user settings. Automatic detection is used by default, with manual switching available when needed.

Pi noninteractive mode avoids querying terminal image capabilities and waiting for a response.

This feature defines automatic selection and manual switching of math display paths. The current path can also be queried through the public API.

## Scenario: Query the current image path

- Given a test integration extension uses the image path
- When query the current display path through the public API
- Then The current display path is the image path

## Scenario: Query the current text path

- Given a test integration extension uses the text path
- When query the current display path through the public API
- Then The current display path is the text path

## Scenario Outline: Select a path based on terminal PNG display support

- Given Pi is running in the `<terminal>` terminal
- When start a session
- Then The `<path>` path is selected

### Examples:

  | terminal | path |
  | -------- | ---- |
  | Ghostty | 画像 |
  | Kitty | 画像 |
  | Alacritty | テキスト |

## Scenario: Select the text path inside tmux even when the terminal supports images

- Given Pi is running in a terminal
- And the terminal responds that it can display PNG images
- And the terminal type is "xterm-kitty"
- And Pi is running inside tmux
- When start a session
- Then The text path is selected

## Scenario: Select the text path for a screen terminal type even when the terminal supports images

- Given Pi is running in a terminal
- And the terminal responds that it can display PNG images
- And the terminal type is "screen-256color"
- When start a session
- Then The text path is selected

## Scenario: Select the text path when the terminal rejects PNG display

- Given Pi is running in a terminal
- And the terminal type is "xterm-kitty"
- And the terminal returns an error to the PNG display query
- When start a session
- Then The text path is selected

## Scenario: Select the text path when the terminal does not respond to the PNG display query

- Given Pi is running in a terminal
- And the terminal type is "xterm-kitty"
- And the terminal does not respond to the PNG display query
- When start a session
- Then The text path is selected

## Scenario: Select the text path in noninteractive mode

- Given Pi is running in noninteractive RPC mode
- And the terminal type is "xterm-kitty"
- When start a session
- Then The text path is selected

## Scenario: Switch to the image path with image

- Given Pi is running in a terminal that can display PNG images
- And The global default display path is not configured
- When start a session
- And run formula image
- Then The image path is selected

## Scenario: Switch from the image path to the text path with text

- Given Pi is running in a terminal that can display PNG images
- And The global default display path is not configured
- When start a session
- And run formula image
- And run formula text
- Then The text path is selected

## Scenario: Switch from the text path back to automatic terminal detection with auto

- Given Pi is running in a terminal that can display PNG images
- And The global default display path is not configured
- When start a session
- And run formula image
- And run formula text
- And run formula auto
- Then The image path is selected

## Scenario: Override the global default with a session auto selection

- Given Pi is running in a terminal that can display PNG images
- And the global default display path is the text path
- When start a session
- And run formula auto
- Then The image path is selected

## Scenario: Auto uses the PNG display check at session start as the selection reason

- Given Pi is running in a terminal that can display PNG images
- And the global default display path is the text path
- When start a session
- And run formula auto
- Then The selection reason is a successful PNG display query

## Scenario: No terminal query is sent in noninteractive mode

- Given Pi is running in noninteractive RPC mode
- And the terminal responds that it can display PNG images
- When start a session
- Then The terminal image display capability is not queried
