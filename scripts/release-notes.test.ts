import { describe, expect, it } from 'vitest';
import { releaseNotes } from './release-notes.mjs';

const CHANGELOG = `# Changelog

## Unreleased

- Next thing.

## 1.3.0-beta.1

A beta for testers.

- One.
- Two.

## 1.2.0

The release before.
`;

describe('releaseNotes', () => {
  it('takes the section of the version, without its heading', () => {
    expect(releaseNotes(CHANGELOG, '1.3.0-beta.1')).toBe('A beta for testers.\n\n- One.\n- Two.');
    expect(releaseNotes(CHANGELOG, '1.2.0')).toBe('The release before.');
  });

  // Tagging without writing the notes first would publish a release with an empty body.
  it('refuses a version the changelog does not describe', () => {
    expect(() => releaseNotes(CHANGELOG, '1.4.0')).toThrow(/CHANGELOG/);
  });
});
