const STUDENT_ID_KEY = 'cp.studentId';

export function getStudentId(): string {
  const existingStudentId = window.localStorage.getItem(STUDENT_ID_KEY);
  if (existingStudentId) return existingStudentId;

  const generatedStudentId = window.crypto.randomUUID();
  window.localStorage.setItem(STUDENT_ID_KEY, generatedStudentId);
  return generatedStudentId;
}
