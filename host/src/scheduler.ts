/**
 * Placeholder scheduler surface for future queue/executor wiring.
 */
export interface ScheduledJob {
  name: string;
  run: () => Promise<void> | void;
}

export function schedule(job: ScheduledJob): void {
  // Placeholder: in a real host, enqueue to a durable scheduler.
  void job;
}
