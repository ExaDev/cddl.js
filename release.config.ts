import type { GlobalConfig } from "semantic-release";

const config: GlobalConfig = {
  branches: ["main"],
  repositoryUrl: "https://github.com/ExaDev/cddl.js.git",
  tagFormat: "v${version}",
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [
          { type: "feat", release: "minor" },
          { type: "fix", release: "patch" },
          { type: "refactor", release: "patch" },
          { type: "perf", release: "patch" },
          { type: "docs", release: "patch" },
          { type: "style", release: "patch" },
          { type: "test", release: "patch" },
          { type: "build", release: "patch" },
          { type: "ci", release: "patch" },
          { type: "chore", release: "patch" },
          { breaking: true, release: "major" },
        ],
      },
    ],
    // conventional-changelog-conventionalcommits is a direct dependency pinned to 9.x: release-notes-generator loads conventional-changelog-writer 8, and the 10.x preset needs writer 9, so it renders a bare version header instead of notes. presetConfig.types lists every type commit-analyzer's releaseRules accepts, so a release is never cut by a commit its own notes omit.
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits",
        presetConfig: {
          types: [
            { type: "feat", section: "Features" },
            { type: "fix", section: "Bug Fixes" },
            { type: "refactor", section: "Refactoring" },
            { type: "perf", section: "Performance" },
            { type: "docs", section: "Documentation" },
            { type: "style", section: "Styles" },
            { type: "test", section: "Tests" },
            { type: "build", section: "Build" },
            { type: "ci", section: "CI" },
            { type: "chore", section: "Chores" },
            { type: "revert", section: "Reverts" },
          ],
        },
      },
    ],
    "@semantic-release/changelog",
    "@semantic-release/npm",
    [
      "@semantic-release/git",
      {
        assets: ["package.json", "pnpm-lock.yaml", "CHANGELOG.md"],
        message: "chore(release): v${nextRelease.version} [skip ci]",
      },
    ],
    "@semantic-release/github",
  ],
};

export default config;
