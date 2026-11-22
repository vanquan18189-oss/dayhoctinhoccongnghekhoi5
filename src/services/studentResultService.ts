import { doc, setDoc, getDocFromServer, getDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { normalizeStudentCode } from './studentCode';
import { getStudentsFromLocalStorage, generateDefaultClassRoster } from './studentStorageService';
import { StudentRecord } from '../types';

export const STUDENT_RESULTS_COLLECTION = 'student_results';

function cleanPayload<T>(obj: T): T {
  if (obj === undefined) return '' as any;
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => cleanPayload(item)) as any;
  }
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanPayload(value);
      }
    }
    return cleaned;
  }
  return obj;
}

export interface StudentResultDocument {
  studentCode: string;
  updatedAt: string;
  exams?: Record<string, any>;
  assignments?: Record<string, any>;
  lessons?: Record<string, any>;
  games?: Record<string, any>;
  hocba?: Record<string, any>;
}

// Định nghĩa chính sách lưu trữ lần làm bài cho bài tập
type KeepAttemptPolicy = 'last' | 'best' | 'all';

interface AssignmentSubmissionPayload {
  assignmentId: string;
  score: number;
  maxScore: number;
  submittedAt: string;
  attemptNumber?: number;
  answers?: Record<string, any>;
  keepAttempts?: KeepAttemptPolicy;
}

/**
 * Dịch vụ quản lý kết quả học tập tập trung theo studentCode
 */
export const studentResultService = {
  /**
   * Lưu kết quả làm bài tập của học sinh
   * Nếu cấu hình keepAttempts là 'last' (lần cuối), hệ thống ghi đè kết quả mới nhất.
   */
  async saveAssignmentResult(
    rawStudentCode: string, 
    payload: AssignmentSubmissionPayload
  ): Promise<boolean> {
    try {
      const studentCode = normalizeStudentCode(rawStudentCode);
      if (!studentCode) throw new Error('Mã học sinh không hợp lệ');

      const docRef = doc(db, STUDENT_RESULTS_COLLECTION, studentCode);
      const policy: KeepAttemptPolicy = payload.keepAttempts || 'last';

      const assignmentData: any = {
        score: payload.score,
        maxScore: payload.maxScore,
        submittedAt: payload.submittedAt,
        attemptNumber: payload.attemptNumber || 1,
      };

      // Nếu chính sách là 'last', chỉ lưu câu trả lời hoặc chi tiết của lần nộp mới nhất
      if (policy === 'last') {
        assignmentData.lastAttempt = {
          score: payload.score,
          submittedAt: payload.submittedAt,
          answers: payload.answers || {},
        };
      } else if (policy === 'best') {
        assignmentData.bestScore = payload.score;
      }

      // Cập nhật cấu trúc lồng nhau dùng dot notation qua { merge: true } để không ghi đè dữ liệu môn khác
      const updatePayload = {
        studentCode,
        [`assignments.${payload.assignmentId}`]: assignmentData,
        updatedAt: new Date().toISOString(),
      };

      // Thực hiện ghi an toàn bằng setDoc merge
      await setDoc(docRef, updatePayload, { merge: true });

      // Xác thực ghi thành công bằng cách đọc lại trực tiếp từ server
      const verifySnap = await getDocFromServer(docRef);
      if (verifySnap.exists()) {
        return true;
      }
      return false;
    } catch (error) {
      console.error('Lỗi khi lưu kết quả bài tập:', error);
      throw error;
    }
  },

  /**
   * Lưu kết quả bài kiểm tra (Exams)
   */
  async saveExamResult(
    rawStudentCode: string,
    examId: string,
    resultData: { score: number; maxScore: number; submittedAt: string; type?: string }
  ): Promise<boolean> {
    try {
      const studentCode = normalizeStudentCode(rawStudentCode);
      if (!studentCode) throw new Error('Mã học sinh không hợp lệ');

      const docRef = doc(db, STUDENT_RESULTS_COLLECTION, studentCode);

      const updatePayload = {
        studentCode,
        [`exams.${examId}`]: {
          ...resultData,
          updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      };

      await setDoc(docRef, updatePayload, { merge: true });
      return true;
    } catch (error) {
      console.error('Lỗi khi lưu kết quả kiểm tra:', error);
      throw error;
    }
  },

  /**
   * Lưu kết quả trò chơi / đấu trường (Games)
   */
  async saveGameResult(
    rawStudentCode: string,
    gameId: string,
    resultData: {
      score: number;
      maxScore: number;
      rank: number | 'unranked';
      submittedAt: string;
      completed?: boolean;
      questionsAnswered?: number;
      totalQuestions?: number;
      studentName?: string;
      className?: string;
      roomId?: string;
      roomTitle?: string;
    }
  ): Promise<boolean> {
    try {
      const studentCode = normalizeStudentCode(rawStudentCode);
      if (!studentCode) throw new Error('Mã học sinh không hợp lệ');

      const docRef = doc(db, STUDENT_RESULTS_COLLECTION, studentCode);

      const updatePayload = {
        studentCode,
        [`games.${gameId}`]: {
          ...resultData,
          updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      };

      await setDoc(docRef, updatePayload, { merge: true });
      return true;
    } catch (error) {
      console.error('Lỗi khi lưu kết quả trò chơi:', error);
      throw error;
    }
  },

  /**
   * Tải kết quả bài kiểm tra (Exams) từ Firestore
   */
  async getExamSubmission(rawStudentCode: string, examId: string): Promise<any | null> {
    try {
      const studentCode = normalizeStudentCode(rawStudentCode);
      if (!studentCode) return null;
      // Fetch from: student_results/{studentCode}/exams/{examId}
      const docRef = doc(db, STUDENT_RESULTS_COLLECTION, studentCode, 'exams', examId);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() : null;
    } catch (error) {
      console.error('Lỗi khi tải bài kiểm tra từ Firestore:', error);
      return null;
    }
  },

  /**
   * Lưu toàn bộ kết quả bài kiểm tra (Exams) lên Firestore
   */
  async saveFullExamSubmission(
    rawStudentCode: string,
    examId: string,
    submissionData: any
  ): Promise<boolean> {
    try {
      const studentCode = normalizeStudentCode(rawStudentCode);
      if (!studentCode) throw new Error('Mã học sinh không hợp lệ');

      // Save to: student_results/{studentCode}/exams/{examId}
      const docRef = doc(db, STUDENT_RESULTS_COLLECTION, studentCode, 'exams', examId);
      await setDoc(docRef, cleanPayload({
        ...submissionData,
        updatedAt: new Date().toISOString(),
      }), { merge: true });
      return true;
    } catch (error) {
      console.error('Lỗi khi lưu bài kiểm tra vào Firestore:', error);
      throw error;
    }
  },

  /**
   * Lưu toàn bộ kết quả bài tập (Assignments) lên Firestore
   */
  async saveFullAssignmentSubmission(
    rawStudentCode: string,
    assignmentId: string,
    submissionData: any
  ): Promise<boolean> {
    try {
      const studentCode = normalizeStudentCode(rawStudentCode);
      if (!studentCode) throw new Error('Mã học sinh không hợp lệ');

      // Save to: student_results/{studentCode}/assignments/{assignmentId}
      const docRef = doc(db, STUDENT_RESULTS_COLLECTION, studentCode, 'assignments', assignmentId);
      await setDoc(docRef, cleanPayload({
        ...submissionData,
        updatedAt: new Date().toISOString(),
      }), { merge: true });
      return true;
    } catch (error) {
      console.error('Lỗi khi lưu bài tập vào Firestore:', error);
      throw error;
    }
  },

  /**
   * Đọc kết quả bài tập của một lớp học từ collection student_results
   */
  async getAssignmentResults(
    assignmentId: string,
    classRosterOrClassName: StudentRecord[] | string
  ): Promise<{
    roster: StudentRecord[];
    matched: Map<string, any>;
    unmatched: Map<string, any>;
    matchedByCode: Map<string, any>;
    submittedCount: number;
    unmatchedCount: number;
    totalStudents: number;
    firestoreReadsCount: number;
    storageBreakdown: Record<string, any>;
  }> {
    try {
      let roster: StudentRecord[] = [];
      if (typeof classRosterOrClassName === 'string') {
        roster = getStudentsFromLocalStorage(classRosterOrClassName) || generateDefaultClassRoster(classRosterOrClassName, 38);
      } else if (Array.isArray(classRosterOrClassName)) {
        roster = classRosterOrClassName;
      }

      const rosterNormCodes = new Set<string>();
      const rosterNormIds = new Set<string>();
      roster.forEach(st => {
        const c = normalizeStudentCode(st.code);
        if (c) rosterNormCodes.add(c);
        const id = normalizeStudentCode(st.id);
        if (id) rosterNormIds.add(id);
      });

      const resultsRef = collection(db, STUDENT_RESULTS_COLLECTION);
      const snapshot = await getDocs(resultsRef);
      let firestoreReadsCount = snapshot.size;

      const matched = new Map<string, any>();
      const matchedByCode = new Map<string, any>();
      const unmatched = new Map<string, any>();

      snapshot.forEach(docSnap => {
        const data = docSnap.data() as StudentResultDocument;
        const studentCode = normalizeStudentCode(data.studentCode || docSnap.id);
        const assignmentsMap = data.assignments || {};

        const subData = assignmentsMap[assignmentId] || (data as any)[`assignments.${assignmentId}`];
        if (subData) {
          const submissionItem = {
            ...subData,
            studentCode: studentCode || docSnap.id,
            studentId: studentCode || docSnap.id,
          };

          if (rosterNormCodes.has(studentCode) || rosterNormIds.has(studentCode)) {
            matched.set(studentCode, submissionItem);
            matchedByCode.set(studentCode, submissionItem);
          } else {
            unmatched.set(studentCode || docSnap.id, submissionItem);
          }
        }
      });

      const submittedCount = matched.size;
      const unmatchedCount = unmatched.size;

      return {
        roster,
        matched,
        unmatched,
        matchedByCode,
        submittedCount,
        unmatchedCount,
        totalStudents: roster.length,
        firestoreReadsCount,
        storageBreakdown: {
          totalDocsRead: firestoreReadsCount,
          matchedCount: submittedCount,
          unmatchedCount: unmatchedCount
        }
      };
    } catch (error) {
      console.error('Lỗi khi tải kết quả bài tập từ Firestore:', error);
      return {
        roster: [],
        matched: new Map(),
        unmatched: new Map(),
        matchedByCode: new Map(),
        submittedCount: 0,
        unmatchedCount: 0,
        totalStudents: 0,
        firestoreReadsCount: 0,
        storageBreakdown: {}
      };
    }
  },

  /**
   * Xem trước gán lại bài nộp chưa khớp
   */
  async previewReassignUnmatchedSubmissions(
    unmatchedMap: Map<string, any>,
    roster: StudentRecord[]
  ): Promise<Array<{ oldCode: string; newCode: string; studentName: string; submission: any }>> {
    const previews: Array<{ oldCode: string; newCode: string; studentName: string; submission: any }> = [];
    const rosterMap = new Map<string, StudentRecord>();
    roster.forEach(st => {
      const nameNorm = (st.name || '').trim().toLowerCase();
      if (nameNorm) rosterMap.set(nameNorm, st);
    });

    unmatchedMap.forEach((sub, oldCode) => {
      const subNameNorm = (sub.studentName || sub.name || '').trim().toLowerCase();
      const matchedSt = rosterMap.get(subNameNorm);
      if (matchedSt) {
        previews.push({
          oldCode,
          newCode: normalizeStudentCode(matchedSt.code),
          studentName: matchedSt.name,
          submission: sub
        });
      }
    });

    return previews;
  },

  /**
   * Thực thi gán lại hàng loạt bài nộp chưa khớp lên Firestore qua writeBatch
   */
  async executeReassignUnmatchedSubmissionsBatch(
    reassignments: Array<{ oldCode: string; newCode: string; submission: any }>,
    assignmentId: string
  ): Promise<boolean> {
    try {
      const batch = writeBatch(db);
      for (const item of reassignments) {
        const newDocRef = doc(db, STUDENT_RESULTS_COLLECTION, item.newCode);
        batch.set(newDocRef, {
          studentCode: item.newCode,
          [`assignments.${assignmentId}`]: item.submission,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
      await batch.commit();
      return true;
    } catch (error) {
      console.error('Lỗi khi gán lại bài nộp:', error);
      throw error;
    }
  }
};
