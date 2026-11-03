# Feature: Save display path selections

Manual display path selections are recorded in the current session.

Default settings can be saved when needed. Only selections with `--default` are saved to the global settings file, and `/formula auto --default` removes a settings file containing only the display path.

## Scenario: Record manual selections in the current session in order

- Given Pi is running in a terminal that can display PNG images
- And The global default display path is not configured
- When start a session
- And run formula image
- And run formula text
- And run formula auto
- Then Display path selections are recorded in the following order

  | selection |
  | ---- |
  | image |
  | text |
  | auto |

## Scenario: A selection without default does not create global settings

- Given Pi is running in a terminal that can display PNG images
- And the global settings file does not exist
- When start a session
- And run formula text
- Then No global settings file is created

## Scenario: Save the global default with the default option

- Given Pi is running in a terminal that can display PNG images
- And the global settings file does not exist
- When start a session
- And run formula text
- And run formula image --default
- Then The global default display path is saved as the image path

## Scenario: Remove global settings containing only the display path with auto default

- Given Pi is running in a terminal that can display PNG images
- And the global settings file does not exist
- When start a session
- And run formula text
- And run formula image --default
- And run formula auto --default
- Then The global settings file containing only the display path is deleted
