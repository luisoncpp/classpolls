import { describe, expect, it, vi } from 'vitest';

import { getStudentId } from './identity';

describe('getStudentId', () => {
  it('generates and persists a student id on first call', () => {
    const randomUuid = vi.spyOn(window.crypto, 'randomUUID');
    randomUuid.mockReturnValue('123e4567-e89b-42d3-a456-426614174000');

    const studentId = getStudentId();

    expect(studentId).toBe('123e4567-e89b-42d3-a456-426614174000');
    expect(window.localStorage.getItem('cp.studentId')).toBe(studentId);
  });

  it('reuses the persisted student id on later calls', () => {
    window.localStorage.setItem('cp.studentId', 'persisted-student-id');
    const randomUuid = vi.spyOn(window.crypto, 'randomUUID');

    const studentId = getStudentId();

    expect(studentId).toBe('persisted-student-id');
    expect(randomUuid).not.toHaveBeenCalled();
  });
});
