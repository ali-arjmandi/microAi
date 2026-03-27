import { isIncomingEventApplicable } from './search-event-merge.util';

describe('isIncomingEventApplicable', () => {
  it('applies when no prior timestamp exists', () => {
    expect(
      isIncomingEventApplicable('2026-03-27T12:00:00.000Z', undefined),
    ).toBe(true);
    expect(isIncomingEventApplicable('2026-03-27T12:00:00.000Z', '')).toBe(
      true,
    );
  });

  it('applies when incoming is newer than the stored timestamp', () => {
    expect(
      isIncomingEventApplicable(
        '2026-03-27T13:00:00.000Z',
        '2026-03-27T12:00:00.000Z',
      ),
    ).toBe(true);
  });

  it('applies when incoming equals the stored timestamp', () => {
    expect(
      isIncomingEventApplicable(
        '2026-03-27T12:00:00.000Z',
        '2026-03-27T12:00:00.000Z',
      ),
    ).toBe(true);
  });

  it('rejects when incoming is strictly older than the stored timestamp', () => {
    expect(
      isIncomingEventApplicable(
        '2026-03-27T11:00:00.000Z',
        '2026-03-27T12:00:00.000Z',
      ),
    ).toBe(false);
  });

  it('applies when either timestamp fails to parse', () => {
    expect(
      isIncomingEventApplicable('not-a-date', '2026-03-27T12:00:00.000Z'),
    ).toBe(true);
    expect(
      isIncomingEventApplicable('2026-03-27T12:00:00.000Z', 'not-a-date'),
    ).toBe(true);
  });
});
