# Ultimate setup

Ultimate uses an isolated git worktree for each feature branch.

Before an agent starts, `.ultimate/settings.json` installs the locked npm dependencies with `npm ci`. This project needs no `.env` file or database copy.

The authoritative project checks remain in `package.json`. Run `npm run check` for the full suite and `npm run verify:display -- <corpus>` for a real terminal capture that must be inspected visually.
