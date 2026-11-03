# ADR 0003: Publish CommonJS only

## Context

As a new package, pi-formula could choose ES Modules. However, qni-cli uses CommonJS and directly consumes pi-formula's public interface and the shared state that prevents duplicate registration. Shipping both CommonJS and ES Modules risks Node.js loading the same package as separate modules, splitting the shared state.

MathJax 4 provides both CommonJS and ES Modules, and Resvg is available as CommonJS. Node.js 22 officially supports CommonJS.

## Decision

pi-formula 0.1.0 ships CommonJS only. Do not publish dual CommonJS and ES Modules builds.

## Consequences

qni-cli can use it synchronously, keeping math rendering's shared state unified. There is no need to manage two sets of artifacts and export conditions.

ES Modules-only consumers cannot import it directly. If the need arises, redesign the boundary without breaking shared state or protection against duplicate loading.

## Alternatives considered

- Publish ES Modules only: natural for a new Node.js package, but rejected because it complicates consumption from CommonJS qni-cli.
- Publish both CommonJS and ES Modules: broadens consumption, but rejected because it risks duplicate loading and split shared state.
