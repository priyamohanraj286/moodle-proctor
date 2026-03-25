import { useState, useEffect } from "react";
import { FiX, FiPlus, FiCopy, FiCheck, FiLoader } from "react-icons/fi";

interface Exam {
  id: number;
  exam_name: string;
  course_name: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (room: { roomId: number; roomCode: string; inviteLink: string }) => void;
  apiUrl?: string;
}

export const RoomCreationModal = ({ isOpen, onClose, onRoomCreated, apiUrl = 'http://localhost:3000' }: Props) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingExams, setIsLoadingExams] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdRoom, setCreatedRoom] = useState<{ roomCode: string; inviteLink: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch available exams when modal opens
  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setSelectedExamId(null);
      setError(null);
      setCreatedRoom(null);
      setCopied(false);
      return;
    }

    const fetchExams = async () => {
      setIsLoadingExams(true);
      setError(null);

      try {
        const token = localStorage.getItem('token');
        // Note: This endpoint might need to be created if it doesn't exist
        const response = await fetch(`${apiUrl}/api/exams`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch exams');
        }

        const result = await response.json();

        if (result.success) {
          // Filter exams that don't have active rooms yet
          setExams(result.data || []);
        } else {
          throw new Error(result.error || 'Failed to fetch exams');
        }
      } catch (err) {
        console.error('[RoomCreation] Error fetching exams:', err);
        setError(err instanceof Error ? err.message : 'Failed to load exams');
      } finally {
        setIsLoadingExams(false);
      }
    };

    fetchExams();
  }, [isOpen, apiUrl]);

  // Handle room creation
  const handleCreateRoom = async () => {
    if (!selectedExamId) return;

    setIsCreating(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/room/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ examId: selectedExamId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create room');
      }

      const result = await response.json();

      if (result.success) {
        const { roomId, roomCode, inviteLink } = result.data;
        setCreatedRoom({ roomCode, inviteLink });

        // Notify parent component
        onRoomCreated({ roomId, roomCode, inviteLink });
      } else {
        throw new Error(result.error || 'Failed to create room');
      }
    } catch (err) {
      console.error('[RoomCreation] Error creating room:', err);
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  // Copy invite link to clipboard
  const handleCopyInviteLink = async () => {
    if (!createdRoom?.inviteLink) return;

    try {
      await navigator.clipboard.writeText(createdRoom.inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[RoomCreation] Failed to copy:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Create Proctoring Room</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              {createdRoom ? 'Room created successfully!' : 'Select an exam to monitor'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isCreating}
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {createdRoom ? (
            // Success state with invite link
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-medium text-green-800">
                  Room created successfully!
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Share the invite link with students
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invite Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={createdRoom.inviteLink}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono"
                  />
                  <button
                    onClick={handleCopyInviteLink}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    {copied ? <FiCheck className="h-4 w-4" /> : <FiCopy className="h-4 w-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room Code
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={createdRoom.roomCode}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono text-center text-lg font-bold"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdRoom.roomCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    {copied ? <FiCheck className="h-4 w-4" /> : <FiCopy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  <strong>Note:</strong> Students can join using the desktop app with the invite link or room code.
                </p>
              </div>
            </div>
          ) : (
            // Exam selection form
            <div className="space-y-4">
              {isLoadingExams ? (
                <div className="flex items-center justify-center py-8">
                  <FiLoader className="h-6 w-6 text-blue-600 animate-spin" />
                  <span className="ml-2 text-gray-600">Loading exams...</span>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-red-600">{error}</p>
                </div>
              ) : exams.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No exams available. Create an exam first.
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Exam
                  </label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {exams.map((exam) => (
                      <button
                        key={exam.id}
                        onClick={() => setSelectedExamId(exam.id)}
                        className={[
                          "w-full text-left p-3 rounded-lg border-2 transition-all",
                          selectedExamId === exam.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 bg-white hover:border-blue-300"
                        ].join(" ")}
                      >
                        <p className="font-medium text-gray-900">{exam.exam_name}</p>
                        <p className="text-sm text-gray-600">{exam.course_name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!createdRoom && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateRoom}
              disabled={!selectedExamId || isCreating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <FiLoader className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FiPlus className="h-4 w-4" />
                  Create Room
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
