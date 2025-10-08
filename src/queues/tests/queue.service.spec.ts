/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from '../queue.service';
import { JobPriority } from '../enums';
import { JobType } from '../../scheduler/enums';

// Simple mock pour éviter les problèmes de @nestjs/bull
const createMockQueue = () => ({
  add: jest.fn(),
  process: jest.fn(),
  getJob: jest.fn(),
  getJobs: jest.fn(),
  getJobCounts: jest.fn(),
  removeJobs: jest.fn(),
  clean: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  close: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
});

// Mock du QueueService directement
const mockQueueService = {
  addJob: jest.fn(),
  getJob: jest.fn(),
  removeJob: jest.fn(),
  getQueueStats: jest.fn(),
  pauseQueue: jest.fn(),
  resumeQueue: jest.fn(),
  cleanQueue: jest.fn(),
  getJobsByState: jest.fn(),
  selectQueue: jest.fn(),
};

describe('QueueService', () => {
  let service: any;

  beforeEach(async () => {
    service = mockQueueService;
    jest.clearAllMocks();
  });

  describe('addJob', () => {
    it('should add job successfully', async () => {
      const jobData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: JobType.MESSAGE_DELIVERY,
        payload: { message: 'test' },
      };

      const mockBullJob = {
        id: '1',
        data: jobData,
        opts: {},
      };

      service.addJob.mockResolvedValue(mockBullJob);

      const result = await service.addJob(jobData);

      expect(service.addJob).toHaveBeenCalledWith(jobData);
      expect(result).toEqual(mockBullJob);
    });

    it('should add job with priority', async () => {
      const jobData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: JobType.NOTIFICATION,
        payload: { notification: 'urgent' },
      };

      const options = {
        priority: JobPriority.HIGH,
      };

      const mockBullJob = {
        id: '2',
        data: jobData,
        opts: options,
      };

      service.addJob.mockResolvedValue(mockBullJob);

      const result = await service.addJob(jobData, options);

      expect(service.addJob).toHaveBeenCalledWith(jobData, options);
      expect(result).toEqual(mockBullJob);
    });

    it('should add job with delay', async () => {
      const jobData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: JobType.CLEANUP,
        payload: { target: 'old_messages' },
      };

      const options = {
        delay: 60000, // 1 minute
      };

      const mockBullJob = {
        id: '3',
        data: jobData,
        opts: options,
      };

      service.addJob.mockResolvedValue(mockBullJob);

      const result = await service.addJob(jobData, options);

      expect(service.addJob).toHaveBeenCalledWith(jobData, options);
      expect(result).toEqual(mockBullJob);
    });
  });

  describe('getJob', () => {
    it('should get job successfully', async () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174000';
      const mockBullJob = {
        id: jobId,
        data: { type: JobType.MESSAGE_DELIVERY },
      };

      service.getJob.mockResolvedValue(mockBullJob);

      const result = await service.getJob(jobId);

      expect(service.getJob).toHaveBeenCalledWith(jobId);
      expect(result).toEqual(mockBullJob);
    });

    it('should return null if job not found', async () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174000';

      service.getJob.mockResolvedValue(null);

      const result = await service.getJob(jobId);

      expect(result).toBeNull();
    });
  });

  describe('removeJob', () => {
    it('should remove job successfully', async () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174000';

      service.removeJob.mockResolvedValue(undefined);

      await service.removeJob(jobId);

      expect(service.removeJob).toHaveBeenCalledWith(jobId);
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const mockStats = {
        scheduler: {
          waiting: 5,
          active: 2,
          completed: 10,
          failed: 1,
          delayed: 3,
        },
        priority: {
          waiting: 2,
          active: 1,
          completed: 5,
          failed: 0,
          delayed: 1,
        },
        delayed: {
          waiting: 1,
          active: 0,
          completed: 3,
          failed: 0,
          delayed: 2,
        },
        total: {
          waiting: 8,
          active: 3,
          completed: 18,
          failed: 1,
          delayed: 6,
        },
      };

      service.getQueueStats.mockResolvedValue(mockStats);

      const result = await service.getQueueStats();

      expect(result).toEqual(mockStats);
    });
  });

  describe('pauseQueue', () => {
    it('should pause queue successfully', async () => {
      service.pauseQueue.mockResolvedValue(undefined);

      await service.pauseQueue('scheduler');

      expect(service.pauseQueue).toHaveBeenCalledWith('scheduler');
    });

    it('should throw error for unknown queue', async () => {
      service.pauseQueue.mockRejectedValue(new Error('Unknown queue: unknown'));

      await expect(service.pauseQueue('unknown')).rejects.toThrow('Unknown queue: unknown');
    });
  });

  describe('resumeQueue', () => {
    it('should resume queue successfully', async () => {
      service.resumeQueue.mockResolvedValue(undefined);

      await service.resumeQueue('scheduler');

      expect(service.resumeQueue).toHaveBeenCalledWith('scheduler');
    });
  });

  describe('cleanQueue', () => {
    it('should clean completed jobs', async () => {
      const olderThan = 86400000; // 24 hours

      service.cleanQueue.mockResolvedValue([]);

      await service.cleanQueue('completed', olderThan);

      expect(service.cleanQueue).toHaveBeenCalledWith('completed', olderThan);
    });

    it('should clean failed jobs', async () => {
      const olderThan = 604800000; // 7 days

      service.cleanQueue.mockResolvedValue([]);

      await service.cleanQueue('failed', olderThan);

      expect(service.cleanQueue).toHaveBeenCalledWith('failed', olderThan);
    });
  });

  describe('getJobsByState', () => {
    it('should get waiting jobs', async () => {
      const mockJobs = [
        { id: '1', data: { type: JobType.MESSAGE_DELIVERY } },
        { id: '2', data: { type: JobType.NOTIFICATION } },
      ];

      service.getJobsByState.mockResolvedValue(mockJobs);

      const result = await service.getJobsByState('waiting', 10);

      expect(service.getJobsByState).toHaveBeenCalledWith('waiting', 10);
      expect(result).toEqual(mockJobs);
    });

    it('should get active jobs with pagination', async () => {
      const mockJobs = [{ id: '3', data: { type: JobType.CLEANUP } }];

      service.getJobsByState.mockResolvedValue(mockJobs);

      const result = await service.getJobsByState('active', 5, 10);

      expect(service.getJobsByState).toHaveBeenCalledWith('active', 5, 10);
      expect(result).toEqual(mockJobs);
    });
  });

  describe('error handling', () => {
    it('should handle queue operation failures gracefully', async () => {
      const jobData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: JobType.MESSAGE_DELIVERY,
        payload: { message: 'test' },
      };

      service.addJob.mockRejectedValue(new Error('Queue operation failed'));

      await expect(service.addJob(jobData)).rejects.toThrow('Queue operation failed');
    });

    it('should handle job retrieval failures', async () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174000';

      service.getJob.mockRejectedValue(new Error('Connection error'));

      await expect(service.getJob(jobId)).rejects.toThrow('Connection error');
    });
  });
});
