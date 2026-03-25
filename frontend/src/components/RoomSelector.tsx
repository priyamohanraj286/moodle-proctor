import { useState, useEffect } from "react";
import { FiX, FiUsers, FiClock, FiLoader } from "react-icons/fi";

interface Room {
  id: number;
  roomCode: string;
  examName: string;
  studentCount: number;
  durationMinutes: number;
  createdAt: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentRoomId?: number;
  onRoomSelect: (roomId: number) => void;
  apiUrl?: string;
}

export const RoomSelector = ({ isOpen, onClose, currentRoomId, onRoomSelect, apiUrl = 'http://localhost:3000' }: Props) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch active rooms when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchRooms = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${apiUrl}/api/room/active`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch rooms');
        }

        const result = await response.json();

        if (result.success) {
          setRooms(result.data);
        } else {
          throw new Error(result.error || 'Failed to fetch rooms');
        }
      } catch (err) {
        console.error('[RoomSelector] Error fetching rooms:', err);
        setError(err instanceof Error ? err.message : 'Failed to load rooms');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRooms();
  }, [isOpen, apiUrl]);

  // Handle room switch with 2-second debounce
  const handleRoomSelect = (roomId: number) => {
    if (roomId === currentRoomId) {
      onClose();
      return;
    }

    setIsSwitching(true);

    // 2-second debounce for smooth UX
    setTimeout(() => {
      onRoomSelect(roomId);
      setIsSwitching(false);
      onClose();
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Select Proctoring Room</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Choose a room to monitor
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSwitching}
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        {/* Room List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="h-8 w-8 text-blue-600 animate-spin" />
              <span className="ml-3 text-gray-600">Loading rooms...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600">{error}</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No active rooms found. Create a room to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {rooms.map((room) => {
                const isCurrentRoom = room.id === currentRoomId;

                return (
                  <button
                    key={room.id}
                    onClick={() => handleRoomSelect(room.id)}
                    disabled={isSwitching}
                    className={[
                      "w-full text-left p-4 rounded-lg border-2 transition-all",
                      isCurrentRoom
                        ? "border-blue-500 bg-blue-50 cursor-default"
                        : "border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50",
                      isSwitching ? "opacity-50 cursor-wait" : "cursor-pointer"
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-gray-900">
                            {room.examName}
                          </h3>
                          {isCurrentRoom && (
                            <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <FiUsers className="h-4 w-4" />
                            <span>{room.studentCount} students</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <FiClock className="h-4 w-4" />
                            <span>{room.durationMinutes} min</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            Code: <span className="font-mono font-medium">{room.roomCode}</span>
                          </div>
                        </div>
                      </div>
                      {isSwitching && !isCurrentRoom && (
                        <FiLoader className="h-5 w-5 text-blue-600 animate-spin" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          {isSwitching && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <FiLoader className="h-4 w-4 animate-spin" />
              <span>Switching rooms... (2 seconds)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
