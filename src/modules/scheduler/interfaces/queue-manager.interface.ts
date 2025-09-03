import { JobData } from '../../queues/interfaces/job.interface';
import { Job } from 'bull';

export interface IQueueManager {
  addJob(jobData: JobData, delay?: number, priority?: number): Promise<Job>;
  getAllQueueStats(): Promise<any[]>;
}