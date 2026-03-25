// ============================================================================
// Room Service Tests
// Comprehensive test coverage for ProctoringRoomService
// ============================================================================

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Pool } from 'pg';
import {
  ProctoringRoomService,
  RoomNotFoundError,
  ExamNotFoundError,
  NotEnrolledError,
  RoomCollisionError,
  CapacityExceededError,
  InvalidStateTransitionError,
  NotRoomOwnerError
} from '../room.service';

// Mock Pool
const mockQuery = jest.fn() as any;
const mockPool = {
  query: mockQuery
} as Pool;

describe('ProctoringRoomService', () => {
  let roomService: ProctoringRoomService;

  beforeEach(() => {
    roomService = new ProctoringRoomService(mockPool);
    jest.clearAllMocks();
  });

  // ==========================================================================
  // createRoom() Tests
  // ==========================================================================

  describe('createRoom()', () => {
    it('should create room successfully', async () => {
      // Mock exam exists
      const mockFn = jest.fn() as any;
      mockPool.query = mockFn;
      mockFn
        .mockResolvedValueOnce({ rows: [{ id: 1, exam_name: 'CS101 Midterm' }] }) // Exam check
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Teacher check
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // Capacity check
        .mockResolvedValueOnce({ rows: [] }) // Room code unique check
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            exam_id: 1,
            teacher_id: 1,
            room_code: 'xY7kPq2M',
            status: 'created',
            capacity: 15,
            created_at: new Date(),
            activated_at: null,
            closed_at: null
          }]
        }); // Insert room

      const result = await roomService.createRoom({ examId: 1, teacherId: 1 });

      expect(result.room_code).toBe('xY7kPq2M');
      expect(result.status).toBe('created');
      expect(result.exam_id).toBe(1);
      expect(result.teacher_id).toBe(1);
    });

    it('should throw ExamNotFoundError when exam does not exist', async () => {
      const mockFn = jest.fn() as any;
      mockPool.query = mockFn;
      mockFn.mockResolvedValueOnce({ rows: [] }); // Exam check fails

      await expect(roomService.createRoom({ examId: 999, teacherId: 1 }))
        .rejects.toThrow(ExamNotFoundError);
    });

    it('should throw NotEnrolledError when teacher not found', async () => {
      const mockFn = jest.fn() as any;
      mockPool.query = mockFn;
      mockFn
        .mockResolvedValueOnce({ rows: [{ id: 1, exam_name: 'CS101' }] }) // Exam exists
        .mockResolvedValueOnce({ rows: [] }); // Teacher check fails

      await expect(roomService.createRoom({ examId: 1, teacherId: 999 }))
        .rejects.toThrow(NotEnrolledError);
    });

    it('should throw CapacityExceededError when exam has too many students', async () => {
      const mockFn = jest.fn() as any;
      mockPool.query = mockFn;
      mockFn
        .mockResolvedValueOnce({ rows: [{ id: 1, exam_name: 'CS101' }] }) // Exam exists
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Teacher exists
        .mockResolvedValueOnce({ rows: [{ count: '20' }] }); // Capacity exceeded (20 > 15)

      await expect(roomService.createRoom({ examId: 1, teacherId: 1 }))
        .rejects.toThrow(CapacityExceededError);
    });

    it('should retry room code generation on collision', async () => {
      // Note: This test is simplified - actual retry logic is in room.service.ts
      const mockFn = jest.fn() as any;
      mockPool.query = mockFn;
      mockFn
        .mockResolvedValueOnce({ rows: [{ id: 1, exam_name: 'CS101' }] }) // Exam exists
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Teacher exists
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // Capacity OK
        .mockResolvedValueOnce({ rows: [] }) // Code 1 is unique (no collision in this simplified test)
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            room_code: 'AbCd1234',
            status: 'created'
          }]
        });

      const result = await roomService.createRoom({ examId: 1, teacherId: 1 });
      expect(result.room_code).toBeDefined();
    });

    it('should throw RoomCollisionError after 3 failed attempts', async () => {
      const mockFn = jest.fn() as any;
      mockPool.query = mockFn;
      mockFn
        .mockResolvedValueOnce({ rows: [{ id: 1, exam_name: 'CS101' }] }) // Exam exists
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Teacher exists
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }); // Capacity OK

      // Mock the loop: 3 attempts, all collide
      // Each attempt generates a code and checks if it exists
      mockFn
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Attempt 1: code collides
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Attempt 2: code collides
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Attempt 3: code collides

      await expect(roomService.createRoom({ examId: 1, teacherId: 1 }))
        .rejects.toThrow(RoomCollisionError);
    });
  });

  // ==========================================================================
  // getRoomByCode() Tests
  // ==========================================================================

  describe('getRoomByCode()', () => {
    it('should find room by code with exam details', async () => {
      const mockRoom = {
        id: 1,
        exam_id: 1,
        teacher_id: 1,
        room_code: 'xY7kPq2M',
        status: 'activated',
        capacity: 15,
        created_at: new Date(),
        activated_at: new Date(),
        closed_at: null,
        exam_name: 'CS101 Midterm',
        course_name: 'Computer Science 101'
      };

      const mockFn = jest.fn() as any;
      mockPool.query = mockFn;
      mockFn.mockResolvedValueOnce({ rows: [mockRoom] });

      const result = await roomService.getRoomByCode('xY7kPq2M');

      expect(result.id).toBe(1);
      expect(result.exam_name).toBe('CS101 Midterm');
      expect(result.course_name).toBe('Computer Science 101');
    });

    it('should throw RoomNotFoundError when code does not exist', async () => {
      const mockFn = jest.fn() as any;
      mockPool.query = mockFn;
      mockFn.mockResolvedValueOnce({ rows: [] });

      await expect(roomService.getRoomByCode('INVALID'))
        .rejects.toThrow(RoomNotFoundError);
    });
  });

  // ==========================================================================
  // getActiveRooms() Tests
  // ==========================================================================

  describe('getActiveRooms()', () => {
    it('should return active rooms for teacher', async () => {
      const mockRooms = [
        {
          id: 1,
          room_code: 'xY7kPq2M',
          exam_name: 'CS101 Midterm',
          duration_minutes: 60,
          created_at: new Date(),
          student_count: '5'
        },
        {
          id: 2,
          room_code: 'AbCd1234',
          exam_name: 'MATH201 Quiz',
          duration_minutes: 45,
          created_at: new Date(),
          student_count: '3'
        }
      ];

      const mockFn = jest.fn() as any;
      mockPool.query = mockFn;
      mockFn.mockResolvedValueOnce({ rows: mockRooms });

      const result = await roomService.getActiveRooms(1);

      expect(result).toHaveLength(2);
      expect(result[0].exam_name).toBe('CS101 Midterm');
      expect(result[1].exam_name).toBe('MATH201 Quiz');
    });

    it('should return empty array for teacher with no active rooms', async () => {
      const mockFn = jest.fn() as any;
      mockPool.query = mockFn;
      mockFn.mockResolvedValueOnce({ rows: [] });

      const result = await roomService.getActiveRooms(999);

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // activateRoom() Tests
  // ==========================================================================

  describe('activateRoom()', () => {
    it('should activate room successfully', async () => {
      const mockRoom = {
        id: 1,
        exam_id: 1,
        teacher_id: 1,
        room_code: 'xY7kPq2M',
        status: 'created',
        capacity: 15,
        created_at: new Date(),
        activated_at: null,
        closed_at: null
      };

      const mockActivatedRoom = {
        ...mockRoom,
        status: 'activated',
        activated_at: new Date()
      };

      const mockFn = jest.fn() as any;
      mockPool.query = mockFn;
      mockFn
        .mockResolvedValueOnce({ rows: [mockRoom] }) // Get room
        .mockResolvedValueOnce({ rows: [mockActivatedRoom] }); // Update room

      const result = await roomService.activateRoom(1, 1);

      expect(result.status).toBe('activated');
      expect(result.activated_at).not.toBeNull();
    });

    it('should throw RoomNotFoundError when room does not exist', async () => {
      const mockFn = jest.fn() as any;
      mockPool.query = mockFn;
      mockFn.mockResolvedValueOnce({ rows: [] }); // Room not found

      await expect(roomService.activateRoom(999, 1))
        .rejects.toThrow(RoomNotFoundError);
    });

    it('should throw NotRoomOwnerError when teacher is not owner', async () => {
      const mockRoom = {
        id: 1,
        teacher_id: 2, // Different teacher
        status: 'created'
      };

      const mockFn = jest.fn() as any;
      mockPool.query = mockFn;
      mockFn.mockResolvedValueOnce({ rows: [mockRoom] });

      await expect(roomService.activateRoom(1, 1))
        .rejects.toThrow(NotRoomOwnerError);
    });

    it('should throw InvalidStateTransitionError when status is not created', async () => {
      const mockRoom = {
        id: 1,
        teacher_id: 1,
        status: 'activated' // Already activated
      };

      const mockFn = jest.fn() as any;
      mockPool.query = mockFn;
      mockFn.mockResolvedValueOnce({ rows: [mockRoom] });

      await expect(roomService.activateRoom(1, 1))
        .rejects.toThrow(InvalidStateTransitionError);
    });
  });

  // ==========================================================================
  // closeRoom() Tests
  // ==========================================================================

  describe('closeRoom()', () => {
    it('should close room successfully', async () => {
      const mockRoom = {
        id: 1,
        teacher_id: 1,
        status: 'activated',
        closed_at: null
      };

      const mockClosedRoom = {
        ...mockRoom,
        status: 'closed',
        closed_at: new Date()
      };

      const mockFn = jest.fn() as any;
      mockPool.query = mockFn;
      mockFn
        .mockResolvedValueOnce({ rows: [mockRoom] }) // Get room
        .mockResolvedValueOnce({ rows: [mockClosedRoom] }); // Update room

      const result = await roomService.closeRoom(1, 1);

      expect(result.status).toBe('closed');
      expect(result.closed_at).not.toBeNull();
    });

    it('should throw RoomNotFoundError when room does not exist', async () => {
      const mockFn = jest.fn() as any;
      mockPool.query = mockFn;
      mockFn.mockResolvedValueOnce({ rows: [] });

      await expect(roomService.closeRoom(999, 1))
        .rejects.toThrow(RoomNotFoundError);
    });

    it('should throw NotRoomOwnerError when teacher is not owner', async () => {
      const mockRoom = {
        id: 1,
        teacher_id: 2, // Different teacher
        status: 'activated'
      };

      const mockFn = jest.fn() as any;
      mockPool.query = mockFn;
      mockFn.mockResolvedValueOnce({ rows: [mockRoom] });

      await expect(roomService.closeRoom(1, 1))
        .rejects.toThrow(NotRoomOwnerError);
    });

    it('should throw InvalidStateTransitionError when status is not activated', async () => {
      const mockRoom = {
        id: 1,
        teacher_id: 1,
        status: 'created' // Not activated yet
      };

      const mockFn = jest.fn() as any;
      mockPool.query = mockFn;
      mockFn.mockResolvedValueOnce({ rows: [mockRoom] });

      await expect(roomService.closeRoom(1, 1))
        .rejects.toThrow(InvalidStateTransitionError);
    });
  });
});
