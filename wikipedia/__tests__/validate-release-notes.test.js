import {
  extractMarkdownSections,
  validateReleaseManifest,
  validateReleaseNoteMarkdown,
  validateReleaseNotes,
} from '../../scripts/validate-release-notes.js';

describe('validate-release-notes', () => {
  test('extractMarkdownSections reads second-level release sections', () => {
    const sections = extractMarkdownSections(`# v1.0.0

## Summary

Stable release.

## Data Changes

- Updated data.
`);

    expect(sections.get('Summary')).toBe('Stable release.');
    expect(sections.get('Data Changes')).toBe('- Updated data.');
  });

  test('validateReleaseNoteMarkdown requires core sections with real content', () => {
    const errors = validateReleaseNoteMarkdown(
      `# v1.0.0

## Summary

Ready.

## Data Changes

None.

## Validation

- Passed checks.
`,
      { tag: 'v1.0.0' }
    );

    expect(errors).toContain('Release note section ## Data Changes must include real content.');
  });

  test('validateReleaseNoteMarkdown allows optional sections to be omitted', () => {
    const errors = validateReleaseNoteMarkdown(
      `# v1.0.0

## Summary

Ready.

## Data Changes

- Rebuilt season data.

## Validation

- Passed checks.
`,
      { tag: 'v1.0.0' }
    );

    expect(errors).toEqual([]);
  });

  test('validateReleaseManifest requires a matching release entry', () => {
    expect(
      validateReleaseManifest(
        [
          {
            tag: 'v1.0.0',
            title: 'Stable release',
            summary: 'Validated data release.',
          },
        ],
        { requiredTag: 'v1.0.0' }
      )
    ).toEqual([]);

    expect(validateReleaseManifest([], { requiredTag: 'v1.0.0' })).toContain(
      'Release manifest must include v1.0.0.'
    );
  });

  test('validateReleaseNotes can validate every manifest release', () => {
    const result = validateReleaseNotes({ all: true });

    expect(result.tag).toBe('all releases');
    expect(result.errors).toEqual([]);
  });
});
