# Feature: Create display math PNGs through the public API

Integration extensions can create PNGs from display math containing user and extra macros through the public API. Images reflecting theme and glyph differences are returned synchronously.

The PNG result contains image data and dimensions. Mutating the returned Buffer does not corrupt subsequent images of the same formula or Markdown images.

Invalid input and the text path return no PNG without throwing.

## Scenario: Read user macros from XDG settings and environment variables

- Given the XDG user macros are as follows

  | name | replacement | arity |
  | ---- | ---- | ---- |
  | configured | x | none |

- And the environment variable user macros are as follows

  | name | replacement | arity |
  | ---- | ---- | ---- |
  | temporary | y | none |

- And the image path public API is in use
- When create a PNG using both user macros through the public API
- Then User macros from XDG settings and environment variables can be used together

## Scenario: Prefer environment variable user macros

- Given the XDG user macros are as follows

  | name | replacement | arity |
  | ---- | ---- | ---- |
  | chosen | y | none |

- And the environment variable user macros are as follows

  | name | replacement | arity |
  | ---- | ---- | ---- |
  | chosen | x | none |

- And the image path public API is in use
- When create a PNG using the user macro of the same name through the public API
- And create a PNG of the reference formula "x" through the public API
- Then A PNG is created with the environment variable user macro

## Scenario: Use an empty-string user macro

- Given the XDG user macros are as follows

  | name | replacement | arity |
  | ---- | ---- | ---- |
  | empty |  | none |

- And the image path public API is in use
- When create a PNG using an empty-string user macro through the public API
- And create a PNG of the reference formula "x" through the public API
- Then An empty-string user macro can be used

## Scenario: Use an empty-string extra macro

- Given an empty-string extra macro exists
- When create a PNG using an empty-string extra macro through the public API
- And create a PNG of the reference formula "x" through the public API
- Then An empty-string extra macro can be used

## Scenario: Use an escaped hash sign in a user macro

- Given the XDG user macros are as follows

  | name | replacement | arity |
  | ---- | ---- | ---- |
  | hash | \\# | none |

- And the image path public API is in use
- When create a PNG using that user macro through the public API
- Then A PNG of the hash sign is created

## Scenario: A valid user macro produces a PNG

- Given the XDG user macros are as follows

  | name | replacement | arity |
  | ---- | ---- | ---- |
  | usable | x | none |
  | broken | #2 | 1 |

- And the image path public API is in use
- When create a PNG from a valid user macro
- And create a PNG from an invalid user macro
- Then A valid user macro produces a PNG

## Scenario: An invalid user macro returns no PNG

- Given the XDG user macros are as follows

  | name | replacement | arity |
  | ---- | ---- | ---- |
  | usable | x | none |
  | broken | #2 | 1 |

- And the image path public API is in use
- When create a PNG from a valid user macro
- And create a PNG from an invalid user macro
- Then An invalid user macro returns no PNG

## Scenario: Invalid environment variable definitions do not override XDG definitions

- Given the XDG user macros are as follows

  | name | replacement | arity |
  | ---- | ---- | ---- |
  | chosen | x | none |

- And the environment variable user macros are as follows

  | name | replacement | arity |
  | ---- | ---- | ---- |
  | chosen | #2 | 1 |

- And the image path public API is in use
- When create a PNG using the user macro of the same name through the public API
- And create a PNG of the reference formula "x" through the public API
- Then A PNG is created with valid XDG definitions

## Scenario: Disable only the configuration source whose entire JSON is invalid

- Given the XDG user macros are as follows

  | name | replacement | arity |
  | ---- | ---- | ---- |
  | configured | x | none |

- And the environment variable macro setting is invalid JSON
- And the image path public API is in use
- When create a PNG using the XDG user macro through the public API
- Then XDG user macros remain available despite an invalid environment variable

## Scenario: Protect extra macros from user settings

- Given the XDG user macros are as follows

  | name | replacement | arity |
  | ---- | ---- | ---- |
  | trial | wrong | none |

- And a test integration extension uses the image path
- When create a PNG using integration extension extra macros through the public API
- And create a PNG of the reference formula through the public API

  ```text
  \left|x\right\rangle
  ```
- Then User settings cannot override extra macros

## Scenario: register an extra macro named after an Object prototype member

- Given an extra macro has the same name as an Object prototype member
- When create a PNG using that extra macro through the public API
- And create a PNG of the reference formula "x" through the public API
- Then An extra macro named after an Object prototype member can be used

## Scenario: Expose the existing public API and image rendering API

- Given the pi-formula CommonJS public API exists
- When inspect the exported names
- Then The existing public API and image path API are exported

## Scenario Outline: Safely reject invalid LaTeX input to the public API

- Given a test integration extension uses the image path
- When pass <input> LaTeX input to the public API
- Then The public API returns no image without throwing

### Examples:

  | input |
  | --- |
  | null |
  | object |

## Scenario: The public PNG result contains only image data and dimensions

- Given a test integration extension uses the image path
- When The integration extension creates a PNG through the public API
- Then The public PNG result contains only image data and dimensions

## Scenario: The public PNG data is in PNG format

- Given a test integration extension uses the image path
- When The integration extension creates a PNG through the public API
- Then The public PNG data is in PNG format

## Scenario: The public PNG width is positive

- Given a test integration extension uses the image path
- When The integration extension creates a PNG through the public API
- Then The public PNG width is positive

## Scenario: The public PNG height is positive

- Given a test integration extension uses the image path
- When The integration extension creates a PNG through the public API
- Then The public PNG height is positive

## Scenario: A mutated Buffer does not corrupt the next public PNG

- Given a test integration extension uses the image path
- When create a public PNG before mutation
- And mutate the returned public PNG Buffer
- And create another public PNG of the same formula
- And render the same formula as Markdown display math
- Then A mutated Buffer does not corrupt the next public PNG

## Scenario: A mutated Buffer does not corrupt the Markdown image

- Given a test integration extension uses the image path
- When create a public PNG before mutation
- And mutate the returned public PNG Buffer
- And create another public PNG of the same formula
- And render the same formula as Markdown display math
- Then A mutated Buffer does not corrupt the Markdown image

## Scenario: Create PNGs with the current text color after a theme change

- Given a test integration extension uses the image path
- When create a public PNG before the theme change
- And change the theme text color to RGB 1, 2, 3
- And create a public PNG of the same formula after the theme change
- Then A new PNG is created with the changed text color

## Scenario Outline: Convert display math containing dynamic glyphs to an image

- Given a test integration extension uses the image path
- When create a PNG of display math containing "<latex>" through the public API
- Then A PNG of display math containing dynamic glyphs is returned

### Examples:

  | latex            |
  | ---------------- |
  | `\\mathcal{H}`  |
  | `\\mathscr{F}`  |
  | `\\mathbb{R}`   |
  | `\\mathfrak{g}` |
  | `\\mathsf{T}`   |
  | `\\mathtt{x}`   |

## Scenario Outline: Continue converting display math containing existing glyphs to images

- Given a test integration extension uses the image path
- When create a PNG of display math containing "<latex>" through the public API
- Then A PNG of display math containing existing glyphs is returned

### Examples:

  | latex                 |
  | --------------------- |
  | `\\mathbf{v}`        |
  | `\\mathrm{d}x`       |
  | `a^2 + b^2 = c^2`    |

## Scenario: Create display math PNGs synchronously

- Given a test integration extension uses the image path
- When create a PNG of display math containing dynamic glyphs through the public API
- Then The public API returns a PNG synchronously

## Scenario: The text path returns no PNG

- Given a test integration extension uses the text path
- When The integration extension creates a PNG through the public API
- Then The public API returns no image
