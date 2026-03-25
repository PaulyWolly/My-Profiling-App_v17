import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { IdlePromptDialogComponent } from '@app/shared/components/idle-prompt-dialog/idle-prompt-dialog.component';
import { AccountService } from './account.service';
import { Auth0Service } from './auth0.service';

/**
 * Idle timeout duration before showing the "still there?" modal.
 * TESTING: 30 seconds
 * PRODUCTION: 20 * 60 * 1000 (20 minutes)
 */
const IDLE_TIMEOUT_MS = 20 * 60 * 1000; //20 minutes

/**
 * After no user activity for {@link IDLE_MS}, shows a prompt to continue.
 * If the user chooses Continue, the idle window restarts. If they do nothing until
 * {@link PROMPT_MS} elapses (or choose Sign out), they are logged out.
 */
@Injectable({ providedIn: 'root' })
export class IdleTimeoutService implements OnDestroy {
  /** No activity for this long → show “still there?” prompt */
  private static readonly IDLE_MS = IDLE_TIMEOUT_MS;

  /** No response on the prompt for this long → logout */
  private static readonly PROMPT_MS = 2 * 60 * 1000;

  /** Avoid resetting the idle timer on every mousemove pixel */
  private static readonly ACTIVITY_THROTTLE_MS = 500;

  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private promptTimer: ReturnType<typeof setTimeout> | null = null;
  private promptAfterClosedSub: Subscription | null = null;
  private lastActivityHandledAt = 0;
  private listenersAttached = false;

  private readonly eventNames = [
    'mousemove',
    'mousedown',
    'click',
    'keydown',
    'touchstart',
    'scroll',
    'wheel'
  ] as const;

  private readonly boundActivity = () => this.onUserActivity();

  private promptDialogRef: MatDialogRef<IdlePromptDialogComponent, 'continue' | 'logout'> | null =
    null;

  constructor(
    private accountService: AccountService,
    private auth0Service: Auth0Service,
    private ngZone: NgZone,
    private dialog: MatDialog
  ) {}

  ngOnDestroy(): void {
    this.stop();
  }

  /** Attach listeners and start the idle countdown (call when user becomes authenticated). */
  start(): void {
    this.stop();
    if (!this.accountService.accountValue) {
      return;
    }

    this.lastActivityHandledAt = Date.now();
    this.attachActivityListeners();
    this.ngZone.run(() => this.scheduleIdleTimer());
  }

  /** Remove listeners, clear timers, close prompt if open (call on logout or when auth cleared). */
  stop(): void {
    this.clearIdleTimer();
    this.clearPromptTimer();
    this.disposePromptDialogSubscription();
    if (this.promptDialogRef) {
      const ref = this.promptDialogRef;
      this.promptDialogRef = null;
      ref.close();
    }
    this.detachActivityListeners();
  }

  private attachActivityListeners(): void {
    if (this.listenersAttached) {
      return;
    }
    this.listenersAttached = true;
    this.ngZone.runOutsideAngular(() => {
      for (const name of this.eventNames) {
        window.addEventListener(name, this.boundActivity, { passive: true, capture: true });
      }
    });
  }

  private detachActivityListeners(): void {
    if (!this.listenersAttached) {
      return;
    }
    this.listenersAttached = false;
    this.ngZone.runOutsideAngular(() => {
      for (const name of this.eventNames) {
        window.removeEventListener(name, this.boundActivity, true);
      }
    });
  }

  private onUserActivity(): void {
    const now = Date.now();
    if (now - this.lastActivityHandledAt < IdleTimeoutService.ACTIVITY_THROTTLE_MS) {
      return;
    }
    this.lastActivityHandledAt = now;
    this.ngZone.run(() => this.scheduleIdleTimer());
  }

  private scheduleIdleTimer(): void {
    if (!this.accountService.accountValue) {
      this.stop();
      return;
    }
    if (this.promptDialogRef) {
      // Prompt is open; idle extension is only via Continue
      return;
    }
    if (this.idleTimer != null) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      this.ngZone.run(() => this.onIdleWindowExpired());
    }, IdleTimeoutService.IDLE_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer != null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private clearPromptTimer(): void {
    if (this.promptTimer != null) {
      clearTimeout(this.promptTimer);
      this.promptTimer = null;
    }
  }

  private disposePromptDialogSubscription(): void {
    this.promptAfterClosedSub?.unsubscribe();
    this.promptAfterClosedSub = null;
  }

  /** 20 minutes idle: detach activity, show modal, start prompt countdown */
  private onIdleWindowExpired(): void {
    if (!this.accountService.accountValue || this.promptDialogRef) {
      return;
    }

    this.clearIdleTimer();
    this.detachActivityListeners();

    const promptSeconds = Math.ceil(IdleTimeoutService.PROMPT_MS / 1000);

    this.ngZone.run(() => {
      this.promptDialogRef = this.dialog.open(IdlePromptDialogComponent, {
        disableClose: true,
        // Gallery uses fixed overlays with z-index ~1000; bump ours via CSS.
        panelClass: 'idle-timeout-panel',
        width: '440px',
        maxWidth: '95vw',
        data: { promptSeconds }
      });

      this.promptTimer = setTimeout(() => {
        this.promptTimer = null;
        this.promptDialogRef?.close();
      }, IdleTimeoutService.PROMPT_MS);

      this.promptAfterClosedSub = this.promptDialogRef.afterClosed().subscribe((result) => {
        this.promptDialogRef = null;
        this.clearPromptTimer();
        this.disposePromptDialogSubscription();

        if (!this.accountService.accountValue) {
          return;
        }

        if (result === 'continue') {
          this.lastActivityHandledAt = Date.now();
          this.attachActivityListeners();
          this.scheduleIdleTimer();
        } else {
          this.performIdleLogout();
        }
      });
    });
  }

  private performIdleLogout(): void {
    if (!this.accountService.accountValue) {
      return;
    }
    console.log('[IdleTimeoutService] Session ended (idle / no prompt response)');
    this.stop();

    const account = this.accountService.accountValue;
    const isAuth0User =
      !!account &&
      (account.authProvider === 'google' ||
        account.authProvider === 'auth0' ||
        !!account.auth0Id);

    this.accountService.logout();
    if (isAuth0User) {
      this.auth0Service.logoutFromAuth0();
    }
  }
}
