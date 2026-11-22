import { db, auth } from './firebase';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { trackedSetDoc, trackedWriteBatch } from './firestoreWriteTracker';

function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      cleaned[key] = sanitizeObject(val);
    }
  }
  return cleaned;
}

export async function syncLocalToFirestoreNow(): Promise<{ success: boolean; message: string; stats: Record<string, number> }> {
  if (!db) {
    return { success: false, message: 'Chưa khởi tạo kết nối Firestore', stats: {} };
  }

  // Require real teacher/admin Firebase Auth session (not null, not anonymous)
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    return {
      success: false,
      message: 'Cần đăng nhập Google để lưu dữ liệu lên Firestore. Vui lòng bấm Đăng nhập Google ở góc trên bên phải.',
      stats: {}
    };
  }

  const stats: Record<string, number> = {
    class_rosters: 0,
    classes: 0,
    students: 0,
    assignments: 0,
    questions: 0,
    exams: 0,
    student_results: 0,
    elearning_lessons: 0
  };

  try {
    let batch = trackedWriteBatch(db);
    let batchCount = 0;

    // 1. Sync classes & class_rosters and individual students in 'students' collection (docId = studentCode)
    const studentDbRaw = localStorage.getItem('eduplay_students_database');
    if (studentDbRaw) {
      try {
        const studentDb = JSON.parse(studentDbRaw) || {};
        for (const [className, students] of Object.entries(studentDb)) {
          if (Array.isArray(students) && students.length > 0) {
            const classKey = className.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const rosterRef = doc(db, 'class_rosters', classKey);
            const cleanedStudents = sanitizeObject(students);
            const maleCount = cleanedStudents.filter((s: any) => s.gender === 'Nam').length;
            const femaleCount = cleanedStudents.filter((s: any) => s.gender === 'Nữ').length;

            batch.set(rosterRef, sanitizeObject({
              className,
              classKey,
              totalStudents: cleanedStudents.length,
              male: maleCount,
              female: femaleCount,
              students: cleanedStudents,
              updatedAt: new Date().toISOString()
            }), { merge: true });
            stats.class_rosters++;
            batchCount++;

            // Save each student as a separate document in 'students' collection where docId = studentCode
            for (const st of cleanedStudents) {
              const code = st.code || st.id || st.studentCode || st.maHs;
              if (code && typeof code === 'string' && code.trim()) {
                const cleanCode = code.trim().toUpperCase();
                const studentRef = doc(db, 'students', cleanCode);
                batch.set(studentRef, sanitizeObject({
                  ...st,
                  code: cleanCode,
                  studentCode: cleanCode,
                  className,
                  updatedAt: new Date().toISOString()
                }), { merge: true });
                stats.students++;
                batchCount++;

                if (batchCount >= 450) {
                  await batch.commit();
                  batch = trackedWriteBatch(db);
                  batchCount = 0;
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('Sync studentDb warning:', e);
      }
    }

    // 2. Sync cached assignments
    const cachedAssignments = localStorage.getItem('eduplay_cached_assignments');
    if (cachedAssignments) {
      try {
        const assignments = JSON.parse(cachedAssignments) || [];
        for (const asg of assignments) {
          if (asg && asg.id) {
            const ref = doc(db, 'assignments', String(asg.id));
            batch.set(ref, sanitizeObject(asg), { merge: true });
            stats.assignments++;
            batchCount++;
            if (batchCount >= 450) {
              await batch.commit();
              batch = trackedWriteBatch(db);
              batchCount = 0;
            }
          }
        }
      } catch (e) {
        console.warn('Sync assignments warning:', e);
      }
    }

    // 3. Sync cached questions
    const cachedQuestions = localStorage.getItem('eduplay_cached_questions');
    if (cachedQuestions) {
      try {
        const questions = JSON.parse(cachedQuestions) || [];
        for (const q of questions) {
          if (q && q.id) {
            const ref = doc(db, 'questions', String(q.id));
            batch.set(ref, sanitizeObject(q), { merge: true });
            stats.questions++;
            batchCount++;
            if (batchCount >= 450) {
              await batch.commit();
              batch = trackedWriteBatch(db);
              batchCount = 0;
            }
          }
        }
      } catch (e) {
        console.warn('Sync questions warning:', e);
      }
    }

    // 4. Sync cached exams
    const cachedExams = localStorage.getItem('eduplay_cached_exams');
    if (cachedExams) {
      try {
        const exams = JSON.parse(cachedExams) || [];
        for (const ex of exams) {
          if (ex && ex.id) {
            const ref = doc(db, 'exams', String(ex.id));
            batch.set(ref, sanitizeObject(ex), { merge: true });
            stats.exams++;
            batchCount++;
            if (batchCount >= 450) {
              await batch.commit();
              batch = trackedWriteBatch(db);
              batchCount = 0;
            }
          }
        }
      } catch (e) {
        console.warn('Sync exams warning:', e);
      }
    }

    // 5. Sync elearning lessons
    const cachedLessons = localStorage.getItem('eduplay_5e_lessons');
    if (cachedLessons) {
      try {
        const lessons = JSON.parse(cachedLessons) || [];
        for (const les of lessons) {
          if (les && les.id) {
            const ref = doc(db, 'elearning_lessons', String(les.id));
            batch.set(ref, sanitizeObject(les), { merge: true });
            stats.elearning_lessons++;
            batchCount++;
            if (batchCount >= 450) {
              await batch.commit();
              batch = trackedWriteBatch(db);
              batchCount = 0;
            }
          }
        }
      } catch (e) {
        console.warn('Sync elearning lessons warning:', e);
      }
    }

    // 6. Sync student results
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('eduplay_student_submissions_') || key.startsWith('eduplay_student_exam_subs_') || key === 'eduplay_all_exam_submissions')) {
        const val = localStorage.getItem(key);
        if (val) {
          try {
            const items = JSON.parse(val);
            if (Array.isArray(items)) {
              for (const item of items) {
                const subId = item.id || `${item.studentCode || item.code || 'st'}_${item.examId || item.assignmentId || 'item'}`;
                const ref = doc(db, 'student_results', String(subId));
                batch.set(ref, sanitizeObject(item), { merge: true });
                stats.student_results++;
                batchCount++;
                if (batchCount >= 450) {
                  await batch.commit();
                  batch = trackedWriteBatch(db);
                  batchCount = 0;
                }
              }
            }
          } catch {}
        }
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    return {
      success: true,
      message: `Đã lưu lên Firestore thành công: ${stats.class_rosters} lớp, ${stats.students} học sinh, ${stats.assignments} bài tập, ${stats.questions} câu hỏi, ${stats.exams} đề thi, ${stats.elearning_lessons} bài giảng, ${stats.student_results} kết quả.`,
      stats
    };
  } catch (err: any) {
    const code = err?.code || 'unknown_code';
    const msg = err?.message || String(err);
    console.error(`Lỗi đồng bộ dữ liệu lên Firestore [${code}]:`, err);
    return {
      success: false,
      message: `Chỉ lưu tạm trong trình duyệt, CHƯA lên Firestore ([${code}] ${msg})`,
      stats
    };
  }
}
