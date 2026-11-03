# ADR 0002: Make pi-formula the single source of truth for math rendering

## Context

Math rendering originated as part of qni-cli, but most rendering does not depend on the quantum circuit CLI. Keeping it inside qni-cli prevents Pi users who do not use quantum computing from installing it independently, and mixes math rendering with qni-specific tool responsibilities. Duplicating code between a standalone version and qni-cli would cause fixes, tests, and specifications to diverge.

## Decision

Keep the canonical math rendering code only in the pi-formula repository.

- pi-formula includes no field-specific macros by default.
- Provide a small public interface through which another Pi extension can pass additional macros and generate display math PNGs.
- qni-cli uses this public interface to pass quantum macros as additional macros.
- qni-cli bundles a verified version of pi-formula, preserving the existing single-install experience.
- Even when both standalone pi-formula and qni-cli are installed, register math rendering and `/formula` only once.
- Publish pi-formula 0.1.0 before qni-cli 0.1.0.

## Consequences

Pi users who do not use quantum computing can install math rendering alone. qni-cli can focus on quantum circuits and computation results without duplicating math rendering.

Independent versioning, Linux and macOS verification, and coordination of dual installations are required. When integrating pi-formula into qni-cli, pin the dependency version and verify it in real terminals on the qni-cli side as well.

## Alternatives considered

- Keep it only inside qni-cli: rejected because it confines a general-purpose feature to quantum computing and leaves responsibilities mixed.
- Duplicate the code in both repositories: rejected because fixes, tests, and specifications would diverge.
- Require qni-cli users to install pi-formula separately: rejected because it breaks Qni CoResearcher's single-install experience.
