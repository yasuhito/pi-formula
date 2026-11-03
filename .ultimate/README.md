# Ultimate setup

Ultimate uses an isolated git worktree for each feature branch.

Before an agent starts, `.ultimate/settings.json` installs the locked npm dependencies with `npm ci`. This project needs no `.env` file or database copy.

The authoritative project checks remain in `package.json`. The lander runs `npm run check` before updating `main`, then pushes `main` to `origin` (never forced). Every landing is published to the public repository at once; npm releases still need an explicit decision. Run `npm run verify:display -- <corpus>` separately for a real terminal capture that must be inspected visually.
