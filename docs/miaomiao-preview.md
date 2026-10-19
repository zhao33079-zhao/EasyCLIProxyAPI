# Miaomiao preview

`miaomiao` is a testing branch created from `dev`. To publish a test build,
Roomen opens a non-draft pull request targeting `miaomiao` in
`router-for-me/EasyCLIProxyAPI`. The workflow checks the current PR author,
target, state, and head commit, then merges it using GitHub's merge API.
Successful merging closes the PR. Drafts, other authors, and PRs targeting
other branches are not automatically merged. Conflicts and branch protection
are not bypassed; resolve them and update/reopen the PR to retry.

The merged commit is built for Windows, Linux, and macOS, on both amd64 and
aarch64. macOS uses the existing Apple signing and notarization secrets.
Roomen's eligible PRs are therefore trusted to run in the signed build pipeline;
keep this author allowlist narrow. Build jobs use read-only repository tokens,
and the merge job never checks out PR code.

Downloads are published at:

https://github.com/router-for-me/EasyCLIProxyAPI/releases/tag/miaomiao-preview

All six builds must pass before publishing. One rolling prerelease and tag are
updated, and older assets are removed after the new packages are uploaded.
This release is never marked Latest. Package versions include
`-miaomiao.<run number>.<attempt>` and release notes identify the exact commit.
The preview does not publish stable-channel update manifests.

Direct pushes to `miaomiao` also build a preview. Automatic merges explicitly
call the reusable build workflow because pushes made by `GITHUB_TOKEN` do not
trigger another workflow. A build for an outdated branch head does not publish
over a newer preview. Failed builds leave the previous preview available; fix
the branch or rerun the failed build in Actions. Build failures do not undo an
already merged PR.

The automation is installed on `miaomiao`; it does not need changes to `main`
or `dev`. The first branch push starts an initial preview build.
