# Repair GitHub sync for the Android project

## Verified current state

- The local project has **no GitHub remote**. Its `origin` points to Lovable's private internal repository, with a secondary internal backup remote.
- The current synchronized commit is `ecc83ea` (`Targeted Android API 36`), and internal `origin/main` points to that commit.
- Both the GitHub web URL and public GitHub API return **404** for `miaivanova4887-stack/meat-mastery`.
- No GitHub App connector is linked to this project. The App connector is separate from Lovable's built-in Git sync, so it cannot repair the Settings → Git connection.
- A 404 proves the repository is not publicly reachable. It does not by itself distinguish a missing repository from a private repository inaccessible to the current GitHub login.

## Repair sequence

1. In **Settings → Git → GitHub**, disconnect the displayed `miaivanova4887-stack/meat-mastery` Git sync reference.
2. Reconnect GitHub from the same Git settings screen.
3. Complete the GitHub authorization prompt for the `miaivanova4887-stack` account. If GitHub shows repository-access options, grant Lovable access to the new repository or the required account scope.
4. Create a **new repository from Lovable** for this project. Use `meat-mastery` only if GitHub confirms the name is available; otherwise choose an explicit Android-only name such as `carnivorex-android`.
5. Allow the initial sync to finish, then make/re-trigger one Lovable sync so the current `main` commit is exported.
6. Verify the resulting repository in two independent ways:
   - Open the exact GitHub URL while signed into the authorized account and confirm the files and commit are visible.
   - Run `git ls-remote <exact-repo-url>` (or clone it) from the Mac while authenticated to GitHub.
7. Compare the visible GitHub `main` commit with the project state, including the Android API 36 changes, before building the AAB.

## Final report

Report only after verification, including:

- Whether the old repository was missing or merely private/inaccessible.
- Whether the root cause was a stale Lovable reference, revoked/incomplete GitHub App authorization, or failed repository creation.
- The exact confirmed GitHub repository URL.
- The visible pushed commit SHA/title and confirmation that `main` can be cloned.

## Required user-authorized action

Disconnecting/reconnecting GitHub and granting GitHub App access are account-level actions that must be completed in the Lovable/GitHub authorization UI. They cannot be performed through the app preview or the GitHub REST connector. Once that authorization flow is completed, the repository URL and pushed commit can be independently verified.
