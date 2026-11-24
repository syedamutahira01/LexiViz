/** Trace contract: every algorithm returns its result plus an ordered step trace of plain data. */
export interface StepEvent {
  index: number;
  kind: string;
  payload: Record<string, unknown>;
}
export interface Traced<T> {
  result: T;
  steps: StepEvent[];
}

/** Small helper so every algorithm numbers its steps the same way. */
export class TraceRecorder {
  readonly steps: StepEvent[] = [];
  push(kind: string, payload: Record<string, unknown>): StepEvent {
    const event = { index: this.steps.length, kind, payload };
    this.steps.push(event);
    return event;
  }
}
