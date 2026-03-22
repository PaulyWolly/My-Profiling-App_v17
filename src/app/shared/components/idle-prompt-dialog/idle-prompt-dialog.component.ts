import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface IdlePromptDialogData {
  /** Seconds until auto sign-out if the user does nothing */
  promptSeconds: number;
}

@Component({
  selector: 'app-idle-prompt-dialog',
  templateUrl: './idle-prompt-dialog.component.html',
  styleUrls: ['./idle-prompt-dialog.component.scss']
})
export class IdlePromptDialogComponent implements OnInit, OnDestroy {
  /** Whole seconds remaining until auto sign-out (counts down every second). */
  secondsLeft: number;

  /** Below this, show “Logging you out in X seconds”; above it, show m:ss. */
  readonly secondsCountdownThreshold = 60;

  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    public dialogRef: MatDialogRef<IdlePromptDialogComponent, 'continue' | 'logout'>,
    @Inject(MAT_DIALOG_DATA) public data: IdlePromptDialogData
  ) {
    this.secondsLeft = Math.max(0, data.promptSeconds);
  }

  /** Remaining time as m:ss while more than {@link secondsCountdownThreshold}s left. */
  get timeMmSs(): string {
    const m = Math.floor(this.secondsLeft / 60);
    const s = this.secondsLeft % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  ngOnInit(): void {
    this.intervalId = setInterval(() => {
      this.secondsLeft = Math.max(0, this.secondsLeft - 1);
      if (this.secondsLeft <= 0 && this.intervalId != null) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  onContinue(): void {
    this.dialogRef.close('continue');
  }

  onLogout(): void {
    this.dialogRef.close('logout');
  }
}
