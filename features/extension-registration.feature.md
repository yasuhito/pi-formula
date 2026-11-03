# Feature: Reregister extensions and use standalone and bundled versions together

Reregistering the extension does not duplicate Markdown renderer or command registrations and allows new user macros.

Loading both standalone and bundled versions does not duplicate registrations regardless of load order, and integration extension extra macros remain available.

## Scenario: The reregistered runtime has only one Markdown renderer registered

- Given an extension runtime reads user macros
- When end the original runtime session
- And change the XDG user macro definition for reloading
- And change the environment variable user macro definition for reloading
- And load and register another runtime
- And start an image path session in the new runtime
- And create a PNG with the new runtime user macro
- Then The reregistered runtime has only one Markdown renderer registered

## Scenario: The reregistered runtime has only one command registered

- Given an extension runtime reads user macros
- When end the original runtime session
- And change the XDG user macro definition for reloading
- And change the environment variable user macro definition for reloading
- And load and register another runtime
- And start an image path session in the new runtime
- And create a PNG with the new runtime user macro
- Then The reregistered runtime has only one command registered

## Scenario: The formula command is available in the reregistered runtime

- Given an extension runtime reads user macros
- When end the original runtime session
- And change the XDG user macro definition for reloading
- And change the environment variable user macro definition for reloading
- And load and register another runtime
- And start an image path session in the new runtime
- And create a PNG with the new runtime user macro
- Then The formula command is available in the reregistered runtime

## Scenario: New user macros are available in the reregistered runtime

- Given an extension runtime reads user macros
- When end the original runtime session
- And change the XDG user macro definition for reloading
- And change the environment variable user macro definition for reloading
- And load and register another runtime
- And start an image path session in the new runtime
- And create a PNG with the new runtime user macro
- Then New user macros are available in the reregistered runtime

## Scenario: Loading the standalone version first registers only one Markdown renderer across both versions

- Given the load order puts the standalone version before the bundled version
- When load the first extension in the load order
- And load the next extension in the load order
- And register the first extension in the load order
- And register the next extension in the load order
- And start an image path session in the first registered Pi
- And create an integration extension PNG in the runtime with both registered
- And inspect both extension registrations
- Then The standalone and bundled versions register only one Markdown renderer

## Scenario: Loading the standalone version first registers only one command across both versions

- Given the load order puts the standalone version before the bundled version
- When load the first extension in the load order
- And load the next extension in the load order
- And register the first extension in the load order
- And register the next extension in the load order
- And start an image path session in the first registered Pi
- And create an integration extension PNG in the runtime with both registered
- And inspect both extension registrations
- Then The standalone and bundled versions register only one command

## Scenario: Loading the standalone version first preserves integration extension extra macros with both versions loaded

- Given the load order puts the standalone version before the bundled version
- When load the first extension in the load order
- And load the next extension in the load order
- And register the first extension in the load order
- And register the next extension in the load order
- And start an image path session in the first registered Pi
- And create an integration extension PNG in the runtime with both registered
- And inspect both extension registrations
- Then Integration extension extra macros remain available with both standalone and bundled versions loaded

## Scenario: Loading the standalone version first registers both versions with different Pi APIs

- Given the load order puts the standalone version before the bundled version
- When load the first extension in the load order
- And load the next extension in the load order
- And register the first extension in the load order
- And register the next extension in the load order
- And start an image path session in the first registered Pi
- And create an integration extension PNG in the runtime with both registered
- And inspect both extension registrations
- Then The standalone and bundled versions are registered with different Pi APIs

## Scenario: Loading the bundled version first registers only one Markdown renderer across both versions

- Given the load order puts the bundled version before the standalone version
- When load the first extension in the load order
- And load the next extension in the load order
- And register the first extension in the load order
- And register the next extension in the load order
- And start an image path session in the first registered Pi
- And create an integration extension PNG in the runtime with both registered
- And inspect both extension registrations
- Then The standalone and bundled versions register only one Markdown renderer

## Scenario: Loading the bundled version first registers only one command across both versions

- Given the load order puts the bundled version before the standalone version
- When load the first extension in the load order
- And load the next extension in the load order
- And register the first extension in the load order
- And register the next extension in the load order
- And start an image path session in the first registered Pi
- And create an integration extension PNG in the runtime with both registered
- And inspect both extension registrations
- Then The standalone and bundled versions register only one command

## Scenario: Loading the bundled version first preserves integration extension extra macros with both versions loaded

- Given the load order puts the bundled version before the standalone version
- When load the first extension in the load order
- And load the next extension in the load order
- And register the first extension in the load order
- And register the next extension in the load order
- And start an image path session in the first registered Pi
- And create an integration extension PNG in the runtime with both registered
- And inspect both extension registrations
- Then Integration extension extra macros remain available with both standalone and bundled versions loaded

## Scenario: Loading the bundled version first registers both versions with different Pi APIs

- Given the load order puts the bundled version before the standalone version
- When load the first extension in the load order
- And load the next extension in the load order
- And register the first extension in the load order
- And register the next extension in the load order
- And start an image path session in the first registered Pi
- And create an integration extension PNG in the runtime with both registered
- And inspect both extension registrations
- Then The standalone and bundled versions are registered with different Pi APIs
