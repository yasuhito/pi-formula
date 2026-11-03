# Feature: Place images in responses and update incrementally

Display math images are emitted to the terminal with corresponding transfer chunks, image IDs, placement IDs, and placeholder row counts. This correspondence is preserved when the same formula is placed in multiple locations.

During incremental response updates, newly closed display math becomes images and only necessary images are transferred. Previously displayed tool results are preserved.

## Scenario: The transformed output image transfer counts are 1, 2, 3, and 4 in order

- Given Pi can render math through the image path
- When render reproduction body frames through frame 1
- And render reproduction body frames through frame 2
- And render reproduction body frames through frame 3
- And render reproduction body frames through frame 4
- Then The transformed output image transfer counts are 1, 2, 3, and 4 in order

## Scenario: The terminal render transfer line counts are 1, 2, 3, and 4 in order

- Given Pi can render math through the image path
- When render reproduction body frames through frame 1
- And render reproduction body frames through frame 2
- And render reproduction body frames through frame 3
- And render reproduction body frames through frame 4
- Then The terminal render transfer line counts are 1, 2, 3, and 4 in order

## Scenario: Each transfer line contains only one image transfer

- Given Pi can render math through the image path
- When render reproduction body frames through frame 1
- And render reproduction body frames through frame 2
- And render reproduction body frames through frame 3
- And render reproduction body frames through frame 4
- Then Each transfer line contains only one image transfer

## Scenario: Each frame transfer chunks are complete

- Given Pi can render math through the image path
- When render reproduction body frames through frame 1
- And render reproduction body frames through frame 2
- And render reproduction body frames through frame 3
- And render reproduction body frames through frame 4
- Then Each frame transfer chunks are complete

## Scenario: Each frame image ID matches its placement ID

- Given Pi can render math through the image path
- When render reproduction body frames through frame 1
- And render reproduction body frames through frame 2
- And render reproduction body frames through frame 3
- And render reproduction body frames through frame 4
- Then Each frame image ID matches its placement ID

## Scenario: Each frame placeholder row count corresponds to its image transfer

- Given Pi can render math through the image path
- When render reproduction body frames through frame 1
- And render reproduction body frames through frame 2
- And render reproduction body frames through frame 3
- And render reproduction body frames through frame 4
- Then Each frame placeholder row count corresponds to its image transfer

## Scenario: Each frame placement is adjacent to its transfer

- Given Pi can render math through the image path
- When render reproduction body frames through frame 1
- And render reproduction body frames through frame 2
- And render reproduction body frames through frame 3
- And render reproduction body frames through frame 4
- Then Each frame placement is adjacent to its transfer

## Scenario: Preserve preceding tool rendering during incremental updates

- Given Pi can render math through the image path
- And the Issue 26 corpus and ket extra macro exist
- When transform incomplete bodies through body 1 from Issue 26
- And transform incomplete bodies through body 2 from Issue 26
- And transform incomplete bodies through body 3 from Issue 26
- And transform the final body from Issue 26
- And render the preceding qni tool call and result in the TUI
- And update the TUI with incomplete body 1 from Issue 26
- And update the TUI with incomplete body 2 from Issue 26
- And update the TUI with incomplete body 3 from Issue 26
- And update the TUI with the final body from Issue 26
- Then The preceding tool rendering remains

## Scenario: Convert closed display math to images during incremental updates

- Given Pi can render math through the image path
- And the Issue 26 corpus and ket extra macro exist
- When transform incomplete bodies through body 1 from Issue 26
- And transform incomplete bodies through body 2 from Issue 26
- And transform incomplete bodies through body 3 from Issue 26
- And transform the final body from Issue 26
- And render the preceding qni tool call and result in the TUI
- And update the TUI with incomplete body 1 from Issue 26
- And update the TUI with incomplete body 2 from Issue 26
- And update the TUI with incomplete body 3 from Issue 26
- And update the TUI with the final body from Issue 26
- Then The number of display formulas rendered through the image path increases one at a time

## Scenario: Transfer only new display math in incremental differential renders

- Given Pi can render math through the image path
- And the Issue 26 corpus and ket extra macro exist
- When transform incomplete bodies through body 1 from Issue 26
- And transform incomplete bodies through body 2 from Issue 26
- And transform incomplete bodies through body 3 from Issue 26
- And transform the final body from Issue 26
- And render the preceding qni tool call and result in the TUI
- And update the TUI with incomplete body 1 from Issue 26
- And update the TUI with incomplete body 2 from Issue 26
- And update the TUI with incomplete body 3 from Issue 26
- And update the TUI with the final body from Issue 26
- Then Each differential render transfers one new display formula

## Scenario: Incremental update image IDs match the image IDs of each transfer

- Given Pi can render math through the image path
- And the Issue 26 corpus and ket extra macro exist
- When transform incomplete bodies through body 1 from Issue 26
- And transform incomplete bodies through body 2 from Issue 26
- And transform incomplete bodies through body 3 from Issue 26
- And transform the final body from Issue 26
- And render the preceding qni tool call and result in the TUI
- And update the TUI with incomplete body 1 from Issue 26
- And update the TUI with incomplete body 2 from Issue 26
- And update the TUI with incomplete body 3 from Issue 26
- And update the TUI with the final body from Issue 26
- Then Incremental update image IDs match the image IDs of each transfer

## Scenario: Incremental update placeholder rows match the declared rows of each transfer

- Given Pi can render math through the image path
- And the Issue 26 corpus and ket extra macro exist
- When transform incomplete bodies through body 1 from Issue 26
- And transform incomplete bodies through body 2 from Issue 26
- And transform incomplete bodies through body 3 from Issue 26
- And transform the final body from Issue 26
- And render the preceding qni tool call and result in the TUI
- And update the TUI with incomplete body 1 from Issue 26
- And update the TUI with incomplete body 2 from Issue 26
- And update the TUI with incomplete body 3 from Issue 26
- And update the TUI with the final body from Issue 26
- Then Incremental update placeholder rows match the declared rows of each transfer

## Scenario: Transfer chunks for each incremental update placement are complete

- Given Pi can render math through the image path
- And the Issue 26 corpus and ket extra macro exist
- When transform incomplete bodies through body 1 from Issue 26
- And transform incomplete bodies through body 2 from Issue 26
- And transform incomplete bodies through body 3 from Issue 26
- And transform the final body from Issue 26
- And render the preceding qni tool call and result in the TUI
- And update the TUI with incomplete body 1 from Issue 26
- And update the TUI with incomplete body 2 from Issue 26
- And update the TUI with incomplete body 3 from Issue 26
- And update the TUI with the final body from Issue 26
- Then Transfer chunks for each incremental update placement are complete

## Scenario: Each incremental update placement is adjacent to its transfer

- Given Pi can render math through the image path
- And the Issue 26 corpus and ket extra macro exist
- When transform incomplete bodies through body 1 from Issue 26
- And transform incomplete bodies through body 2 from Issue 26
- And transform incomplete bodies through body 3 from Issue 26
- And transform the final body from Issue 26
- And render the preceding qni tool call and result in the TUI
- And update the TUI with incomplete body 1 from Issue 26
- And update the TUI with incomplete body 2 from Issue 26
- And update the TUI with incomplete body 3 from Issue 26
- And update the TUI with the final body from Issue 26
- Then Each incremental update placement is adjacent to its transfer

## Scenario: The same response contains 2 image placements

- Given Pi can render math through the image path
- When place the same multiline display formula twice in one final response
- Then The same response contains 2 image placements

## Scenario: Each placement in the same response uses the same image ID

- Given Pi can render math through the image path
- When place the same multiline display formula twice in one final response
- Then Each placement in the same response uses the same image ID

## Scenario: Each placement in the same response spans multiple rows

- Given Pi can render math through the image path
- When place the same multiline display formula twice in one final response
- Then Each placement in the same response spans multiple rows

## Scenario: Cached image IDs match the image IDs of each transfer

- Given Pi can render math through the image path
- When place the same multiline display formula twice in one final response
- Then Cached image IDs match the image IDs of each transfer

## Scenario: Cached image placeholder rows match the declared rows of each transfer

- Given Pi can render math through the image path
- When place the same multiline display formula twice in one final response
- Then Cached image placeholder rows match the declared rows of each transfer

## Scenario: Transfer chunks for each cached image placement are complete

- Given Pi can render math through the image path
- When place the same multiline display formula twice in one final response
- Then Transfer chunks for each cached image placement are complete

## Scenario: Each cached image placement is adjacent to its transfer

- Given Pi can render math through the image path
- When place the same multiline display formula twice in one final response
- Then Each cached image placement is adjacent to its transfer
