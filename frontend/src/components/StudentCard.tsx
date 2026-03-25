import type { Student } from "@app-types/index";
import { StatusBadge } from "./StatusBadge";
import { FiAlertTriangle, FiCamera, FiSlash } from "react-icons/fi";
import { useState } from "react";

interface Props {
  student: Student;
  violationCount?: number; // Number of violations in last 5 minutes
  onWarn?: (studentId: string) => void;
  onScreenshot?: (studentId: string) => void;
  onKick?: (studentId: string) => void;
}

export const StudentCard = ({ student, violationCount = 0, onWarn, onScreenshot, onKick }: Props) => {
  const [showKickConfirm, setShowKickConfirm] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  const hasRecentViolations = violationCount > 0;

  const handleWarn = () => {
    if (onWarn) {
      onWarn(student.id);
    }
    setIsActionsOpen(false);
  };

  const handleScreenshot = () => {
    if (onScreenshot) {
      onScreenshot(student.id);
    }
    setIsActionsOpen(false);
  };

  const handleKick = () => {
    if (onKick) {
      onKick(student.id);
    }
    setShowKickConfirm(false);
    setIsActionsOpen(false);
  };

  return (
    <div
      className={[
        "bg-white rounded-lg overflow-hidden flex flex-col border transition-all relative",
        hasRecentViolations
          ? "border-red-500 shadow-lg shadow-red-100" // Pulsing red border for violations
          : "border-gray-200 shadow-sm hover:shadow-md"
      ].join(" ")}
    >
      {/* Violation badge */}
      {hasRecentViolations && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="bg-red-600 text-white px-3 py-1.5 rounded-full font-bold text-sm shadow-lg animate-pulse flex items-center gap-1.5">
            <FiAlertTriangle className="h-4 w-4" />
            {violationCount}
          </div>
        </div>
      )}

      <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 text-sm font-semibold">Video Feed</div>
        </div>
        <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-green-500 text-white text-[10px] font-semibold flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          Live
        </div>
        <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-gray-700 text-white text-[10px]">
          {student.exam}
        </div>
      </div>

      <div className="px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-gray-600 text-xs uppercase tracking-wide">Student</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{student.name}</p>
          </div>
          <StatusBadge status={student.status} />
        </div>

        <div className="flex items-center justify-between text-xs text-gray-600 border-t border-gray-100 pt-2">
          <span>ID: <span className="font-medium text-gray-900">{student.id}</span></span>
          <span
            className={[
              "font-medium",
              student.connection === "Excellent"
                ? "text-green-600"
                : student.connection === "Good"
                ? "text-green-500"
                : student.connection === "Fair"
                ? "text-amber-600"
                : "text-red-600"
            ].join(" ")}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {student.connection}
          </span>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
          <button
            onClick={handleWarn}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
            title="Send warning"
          >
            <FiAlertTriangle className="h-3 w-3" />
            Warn
          </button>
          <button
            onClick={handleScreenshot}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors"
            title="Take screenshot"
          >
            <FiCamera className="h-3 w-3" />
            Screenshot
          </button>
          <button
            onClick={() => setShowKickConfirm(true)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors"
            title="Remove student"
          >
            <FiSlash className="h-3 w-3" />
            Kick
          </button>
        </div>
      </div>

      {/* Kick confirmation dialog */}
      {showKickConfirm && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 rounded-lg">
          <div className="bg-white rounded-lg p-4 max-w-xs mx-4 shadow-xl">
            <p className="text-sm font-medium text-gray-900 mb-1">
              Remove from exam?
            </p>
            <p className="text-xs text-gray-600 mb-3">
              This will terminate {student.name}'s exam and close their connection.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowKickConfirm(false)}
                className="flex-1 px-3 py-1.5 rounded border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleKick}
                className="flex-1 px-3 py-1.5 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

