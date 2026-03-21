// ============================================================================
// StudentsGrid Component (Real Backend Integration)
// Displays active students with real-time updates
// ============================================================================

'use client';

import { useAttempts } from '@/hooks/useTeacherData';
import { useSSE, useAutoRefresh } from '@/hooks/useSSE';
import { StudentCard } from './StudentCard';
import { StatusBadge } from './StatusBadge';

export function StudentsGridReal() {
  // Fetch active attempts (students currently taking exams)
  const { attempts, isLoading, error, refetch } = useAttempts({
    status: 'in_progress',
    limit: 50,
  });

  // Connect to SSE for real-time updates
  const { isConnected } = useSSE();

  // Auto-refresh on SSE events
  useAutoRefresh(true, refetch, ['exam_start', 'exam_end', 'violation']);

  if (isLoading) {
    return (
      <section className="flex flex-col gap-6 px-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Monitoring Students</h2>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex flex-col gap-6 px-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Monitoring Students</h2>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Failed to load students: {error.message}</p>
        </div>
      </section>
    );
  }

  // Transform backend attempts to student format
  const students = attempts.map((attempt: any) => ({
    id: attempt.id.toString(),
    name: `${attempt.firstName} ${attempt.lastName}`,
    exam: attempt.examName,
    status: attempt.violationCount > 5 ? 'suspicious' : attempt.violationCount > 0 ? 'warning' : 'normal',
    connection: 'Good', // Would come from proctoring session data
    violationCount: attempt.violationCount,
    startedAt: attempt.startedAt,
  }));

  return (
    <section className="flex flex-col gap-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-gray-900">Monitoring Students</h2>
          <p className="text-sm text-gray-600 mt-1">
            Viewing {students.length} students in real-time
            {isConnected && <span className="ml-2 text-green-600">● Live</span>}
          </p>
        </div>

        {/* Status Legend */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Normal
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Warning
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Suspicious
          </span>
        </div>
      </div>

      {/* Students Grid */}
      {students.length === 0 ? (
        <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No active exams in progress</p>
        </div>
      ) : (
        <div className="grid [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))] gap-8">
          {students.map((student) => (
            <StudentCard key={student.id} student={student} />
          ))}
        </div>
      )}
    </section>
  );
}
