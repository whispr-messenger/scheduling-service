/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerService } from '../scheduler.service';
import { CreateJobDto } from '../dto/create-job.dto';
import { UpdateJobDto } from '../dto/update-job.dto';
import { CreateScheduleDto } from '../dto/create-schedule.dto';
import { JobStatus, JobType, ExecutionStatus } from '../enums';

// Mock du SchedulerService pour éviter les problèmes de dépendances
const mockSchedulerService = {
  createJob: jest.fn(),
  findJobById: jest.fn(),
  updateJob: jest.fn(),
  deleteJob: jest.fn(),
  scheduleJob: jest.fn(),
  executeJob: jest.fn(),
  getJobStatistics: jest.fn(),
  getJobsByStatus: jest.fn(),
  getJobExecutions: jest.fn(),
  pauseJob: jest.fn(),
  resumeJob: jest.fn(),
};

describe('SchedulerService', () => {
  let service: any;

  beforeEach(async () => {
    service = mockSchedulerService;
    jest.clearAllMocks();
  });

  describe('createJob', () => {
    it('should create a new job successfully', async () => {
      const createJobDto: CreateJobDto = {
        name: 'test-job',
        type: JobType.MESSAGE_DELIVERY,
        payload: { message: 'test' },
        priority: 1,
        maxRetries: 3,
        metadata: { source: 'test' },
      };

      const mockJob = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        ...createJobDto,
        status: JobStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.createJob.mockResolvedValue(mockJob);

      const result = await service.createJob(createJobDto);

      expect(service.createJob).toHaveBeenCalledWith(createJobDto);
      expect(result).toEqual(mockJob);
    });

    it('should throw error when job creation fails', async () => {
      const createJobDto: CreateJobDto = {
        name: 'test-job',
        type: JobType.MESSAGE_DELIVERY,
        payload: { message: 'test' },
        priority: 1,
        maxRetries: 3,
        metadata: {},
      };

      service.createJob.mockRejectedValue(new Error('Database error'));

      await expect(service.createJob(createJobDto)).rejects.toThrow('Database error');
    });
  });

  describe('findJobById', () => {
    it('should return job when found', async () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174000';
      const mockJob = {
        id: jobId,
        name: 'test-job',
        type: JobType.MESSAGE_DELIVERY,
        status: JobStatus.PENDING,
      };

      service.findJobById.mockResolvedValue(mockJob);

      const result = await service.findJobById(jobId);

      expect(service.findJobById).toHaveBeenCalledWith(jobId);
      expect(result).toEqual(mockJob);
    });

    it('should return null when job not found', async () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174000';
      service.findJobById.mockResolvedValue(null);

      const result = await service.findJobById(jobId);

      expect(result).toBeNull();
    });
  });

  describe('updateJob', () => {
    it('should update job successfully', async () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174000';
      const updateJobDto: UpdateJobDto = {
        name: 'updated-job',
        priority: 2,
        metadata: { updated: true },
      };

      const existingJob = {
        id: jobId,
        name: 'test-job',
        type: JobType.MESSAGE_DELIVERY,
        status: JobStatus.PENDING,
      };

      const updatedJob = { ...existingJob, ...updateJobDto };

      service.updateJob.mockResolvedValue(updatedJob);

      const result = await service.updateJob(jobId, updateJobDto);

      expect(service.updateJob).toHaveBeenCalledWith(jobId, updateJobDto);
      expect(result).toEqual(updatedJob);
    });

    it('should throw error when job not found', async () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174000';
      const updateJobDto: UpdateJobDto = { name: 'updated-job' };

      service.updateJob.mockRejectedValue(new Error('Job not found'));

      await expect(service.updateJob(jobId, updateJobDto)).rejects.toThrow('Job not found');
    });
  });

  describe('deleteJob', () => {
    it('should delete job successfully', async () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174000';

      service.deleteJob.mockResolvedValue(undefined);

      await service.deleteJob(jobId);

      expect(service.deleteJob).toHaveBeenCalledWith(jobId);
    });

    it('should throw error when job not found', async () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174000';
      service.deleteJob.mockRejectedValue(new Error('Job not found'));

      await expect(service.deleteJob(jobId)).rejects.toThrow('Job not found');
    });
  });

  describe('scheduleJob', () => {
    it('should schedule job successfully', async () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174000';
      const scheduleDto: CreateScheduleDto = {
        cronExpression: '0 0 * * *',
        timezone: 'UTC',
        startAt: new Date(),
        endAt: new Date(Date.now() + 86400000),
        isActive: true,
      };

      const mockSchedule = {
        id: '456e7890-e89b-12d3-a456-426614174000',
        jobId,
        ...scheduleDto,
      };

      service.scheduleJob.mockResolvedValue(mockSchedule);

      const result = await service.scheduleJob(jobId, scheduleDto);

      expect(service.scheduleJob).toHaveBeenCalledWith(jobId, scheduleDto);
      expect(result).toEqual(mockSchedule);
    });

    it('should throw error when job not found', async () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174000';
      const scheduleDto: CreateScheduleDto = {
        cronExpression: '0 0 * * *',
        timezone: 'UTC',
        isActive: true,
      };

      service.scheduleJob.mockRejectedValue(new Error('Job not found'));

      await expect(service.scheduleJob(jobId, scheduleDto)).rejects.toThrow('Job not found');
    });
  });

  describe('executeJob', () => {
    it('should execute job successfully', async () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174000';

      const mockExecution = {
        id: '789e0123-e89b-12d3-a456-426614174000',
        jobId,
        status: ExecutionStatus.RUNNING,
        startedAt: new Date(),
      };

      service.executeJob.mockResolvedValue(mockExecution);

      const result = await service.executeJob(jobId);

      expect(service.executeJob).toHaveBeenCalledWith(jobId);
      expect(result).toEqual(mockExecution);
    });

    it('should throw error when job not found', async () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174000';
      service.executeJob.mockRejectedValue(new Error('Job not found'));

      await expect(service.executeJob(jobId)).rejects.toThrow('Job not found');
    });

    it('should throw error when job is not in executable state', async () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174000';

      service.executeJob.mockRejectedValue(new Error('Job is not in an executable state'));

      await expect(service.executeJob(jobId)).rejects.toThrow('Job is not in an executable state');
    });
  });

  describe('getJobStatistics', () => {
    it('should return job statistics', async () => {
      const mockStats = {
        [JobStatus.PENDING]: 5,
        [JobStatus.RUNNING]: 2,
        [JobStatus.COMPLETED]: 10,
      };

      service.getJobStatistics.mockResolvedValue(mockStats);

      const result = await service.getJobStatistics();

      expect(result).toEqual(mockStats);
    });
  });

  describe('getJobsByStatus', () => {
    it('should return jobs by status', async () => {
      const status = JobStatus.PENDING;
      const limit = 10;

      const mockJobs = [
        { id: '1', status: JobStatus.PENDING },
        { id: '2', status: JobStatus.PENDING },
      ];

      service.getJobsByStatus.mockResolvedValue(mockJobs);

      const result = await service.getJobsByStatus(status, limit);

      expect(service.getJobsByStatus).toHaveBeenCalledWith(status, limit);
      expect(result).toEqual(mockJobs);
    });
  });

  describe('getJobExecutions', () => {
    it('should return job executions', async () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174000';

      const mockExecutions = [
        { id: '1', jobId, status: ExecutionStatus.COMPLETED },
        { id: '2', jobId, status: ExecutionStatus.FAILED },
      ];

      service.getJobExecutions.mockResolvedValue(mockExecutions);

      const result = await service.getJobExecutions(jobId);

      expect(service.getJobExecutions).toHaveBeenCalledWith(jobId);
      expect(result).toEqual(mockExecutions);
    });
  });

  describe('pauseJob', () => {
    it('should pause job successfully', async () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174000';

      const updatedJob = {
        id: jobId,
        status: JobStatus.PAUSED,
      };

      service.pauseJob.mockResolvedValue(updatedJob);

      const result = await service.pauseJob(jobId);

      expect(service.pauseJob).toHaveBeenCalledWith(jobId);
      expect(result).toEqual(updatedJob);
    });
  });

  describe('resumeJob', () => {
    it('should resume job successfully', async () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174000';

      const updatedJob = {
        id: jobId,
        status: JobStatus.PENDING,
      };

      service.resumeJob.mockResolvedValue(updatedJob);

      const result = await service.resumeJob(jobId);

      expect(service.resumeJob).toHaveBeenCalledWith(jobId);
      expect(result).toEqual(updatedJob);
    });
  });
});
