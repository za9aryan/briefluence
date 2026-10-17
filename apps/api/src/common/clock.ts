import { Injectable } from '@nestjs/common';

/** Injectable time source so jobs and tests can control "now". */
@Injectable()
export class Clock {
  private offsetMs = 0;
  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }
  /** Test-only: shift time forward. */
  advance(ms: number) {
    this.offsetMs += ms;
  }
  reset() {
    this.offsetMs = 0;
  }
}
