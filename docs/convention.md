# Git Conventions

These conventions help keep our branches, commits, and pull requests consistent and
easy to understand.

## 1. Branch Name Convention

### For Features and General Tasks

Format:

```
<keyword>/<issue-code>
```

Example:

```
feat/CORE-1
```

### For Bug Fixes

For bug fixes, use the issue number followed by a short description of the bug.

Format:

```
fix/<issue-number>-<brief-name>
```

Examples:

```
fix/12-login-error
fix/25-invalid-input
fix/31-ship-collision
```

### Common Keywords

- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation
- `chore` — Maintenance/configuration
- `refactor` — Code restructuring
- `test` — Add test case

## 2. Commit Name Convention

Format:

```
<keyword>(<field>): <what you did>
```

Example:

```
feat(core): implement ship class
```

The keyword describes the type of change, the field describes which part of the
project you changed, and the final part briefly describes what you did.

Examples:

```
feat(core): implement ship class
fix(core): prevent ship from going out of bounds
docs(readme): add setup instructions
refactor(game): simplify turn handling
test(core): add ship collision tests
chore(config): update eslint configuration
```

Try to describe what your contribution does, rather than describing the
implementation in too much detail.

## 3. Pull Request (PR) Name Convention

The PR name should be the same as the issue name that the PR is solving.

Format:

```
<issue name>
```

Example:

```
[CORE-1] Ship: track hits and sunk state
```

This makes it easy to identify which issue the PR is related to.

## Example

If the issue is:

```
[CORE-1] Ship: track hits and sunk state
```

Your branch would be:

```
feat/CORE-1
```

Your commits could be:

```
feat(core): implement ship hit tracking
feat(core): implement ship sunk state
test(core): add ship state tests
```

And your PR would be:

```
[CORE-1] Ship: track hits and sunk state
```

## Overall Flow

```
Issue
  ↓
Branch
  ↓
Commits
  ↓
Pull Request
```

This keeps every change traceable back to the original issue.
