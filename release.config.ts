import type { GlobalConfig } from "semantic-release";

interface CommitType {
  readonly type: string;
  readonly release: "major" | "minor" | "patch";
  /** The heading this type's commits are listed under in the release notes and CHANGELOG.md. */
  readonly section: string;
}

/**
 * Every conventional-commit type this repository releases for, the level each one releases, and the section it is listed under. commit-analyzer's releaseRules and release-notes-generator's presetConfig.types both derive from it, so a release is never cut by a commit its own notes omit.
 */
const commitTypes: readonly CommitType[] = [
  { type: "feat", release: "minor", section: "Features" },
  { type: "fix", release: "patch", section: "Bug Fixes" },
  { type: "refactor", release: "patch", section: "Refactoring" },
  { type: "perf", release: "patch", section: "Performance" },
  { type: "docs", release: "patch", section: "Documentation" },
  { type: "style", release: "patch", section: "Styles" },
  { type: "test", release: "patch", section: "Tests" },
  { type: "build", release: "patch", section: "Build" },
  { type: "ci", release: "patch", section: "CI" },
  { type: "chore", release: "patch", section: "Chores" },
  { type: "revert", release: "patch", section: "Reverts" },
];

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
          ...commitTypes.map((t) => ({ type: t.type, release: t.release })),
          { breaking: true, release: "major" },
        ],
      },
    ],
    // conventional-changelog-conventionalcommits is a direct dependency pinned to 9.x: release-notes-generator loads conventional-changelog-writer 8, and the 10.x preset needs writer 9, so it renders a bare version header instead of notes. presetConfig.types lists every type in commitTypes, so a release is never cut by a commit its own notes omit.
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits",
        presetConfig: {
          types: commitTypes.map((t) => ({ type: t.type, section: t.section })),
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
