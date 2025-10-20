import { Component, Inject, Input, ViewChild, ElementRef, ViewEncapsulation, AfterViewInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-command-modal-input',
  template: `
    <div class="input-title-bar">
      <span>Command Window</span>
      <button class="input-close" (click)="close()" aria-label="Close">&times;</button>
    </div>
    <div class="input-command-window">
      <div class="input-script-name">Running: {{ scriptName }}</div>
      <div class="input-output-area" #outputArea>{{ output }}</div>
      <form (ngSubmit)="submitInput()" *ngIf="!done" class="input-form">
        <div class="input-prompt-row">
          <span class="input-prompt">C:\Users\pwelb&gt;</span>
          <div class="input-input-row">
            <input
              #cmdInput
              class="input-input"
              [(ngModel)]="userInput"
              name="userInput"
              autocomplete="off"
              required
              (keydown.enter)="submitInput()"
              type="text"
            />
            <button class="input-go-btn" type="submit">Go</button>
          </div>
        </div>
      </form>
      <div *ngIf="done" class="input-done-msg">Session complete.</div>
    </div>
  `,
  styles: [`
    :host ::ng-deep .mat-dialog-container,
    .input-title-bar,
    .input-command-window,
    .input-form {
      border-radius: 0 !important;
      border-top-left-radius: 0 !important;
      border-top-right-radius: 0 !important;
      border-bottom-left-radius: 0 !important;
      border-bottom-right-radius: 0 !important;
    }
    .input-title-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #222;
      color: #fff;
      font-family: Consolas, 'Courier New', monospace;
      font-size: 1.1rem;
      padding: 0.5rem 1rem;
    }
    .input-close {
      background: none;
      border: none;
      color: #fff;
      font-size: 1.5rem;
      cursor: pointer;
      line-height: 1;
      padding: 0 0.5rem;
      transition: color 0.2s;
    }
    .input-close:hover {
      color: #f44336;
    }
    .input-command-window {
      background: #111;
      color: #e0e0e0;
      padding: 0;
      min-width: 800px;
      min-height: 440px;
      max-width: 1200px;
      max-height: 800px;
      font-family: Consolas, 'Courier New', monospace;
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .input-script-name {
      color: #42a5f5;
      font-family: Consolas, 'Courier New', monospace;
      font-size: 1.1rem;
      padding: 0.5rem 1rem 0.25rem 1rem;
    }
    .input-output-area {
      background: #111;
      color: #90ee90;
      padding: 1rem;
      min-height: 60px;
      flex: 1 1 auto;
      margin-bottom: 0;
      white-space: pre-wrap;
      font-family: Consolas, 'Courier New', monospace;
      font-size: 1rem;
      overflow-y: scroll;
      border-bottom: 1px solid #222;
      max-height: 350px;
      scrollbar-width: thin;
      scrollbar-color: #888 #222;
    }
    .input-form {
      width: 100%;
      margin: 0;
      padding: 1rem;
      box-sizing: border-box;
      background: #111;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    .input-prompt-row {
      display: flex;
      align-items: center;
      width: 100%;
    }
    .input-prompt {
      color: #fff;
      font-family: Consolas, 'Courier New', monospace;
      font-size: 1rem;
      margin-right: 0.5rem;
      user-select: none;
    }
    .input-input-row {
      display: flex;
      align-items: center;
      width: 100%;
    }
    .input-input {
      background: #000;
      color: #fff;
      border: 1px solid #555;
      border-radius: 0;
      font-family: Consolas, 'Courier New', monospace;
      font-size: 1rem;
      padding: 0.25rem 0.5rem;
      flex: 1;
      width: 100%;
      height: 36px;
      outline: none;
      margin: 0;
    }
    .input-go-btn {
      margin-left: 0.5rem;
      min-width: 48px;
      height: 36px;
      background: #3f51b5;
      color: #fff;
      border: none;
      font-family: inherit;
      font-size: 1rem;
      cursor: pointer;
      border-radius: 0;
    }
    .input-go-btn:hover {
      background: #283593;
    }
    .input-done-msg { color: #90ee90; margin: 1rem 0 0 1rem; }
    .input-output-area::-webkit-scrollbar {
      width: 12px;
      background: #222;
    }
    .input-output-area::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 6px;
    }
  `],
  encapsulation: ViewEncapsulation.Emulated
})
export class CommandModalInputComponent implements AfterViewInit {
  @Input() output: string = '';
  @Input() sessionId: string = '';
  @Input() scriptName: string = '';
  @Input() scriptId: string = '';

  userInput: string = '';
  done: boolean = false;
  @ViewChild('cmdInput') cmdInputRef!: ElementRef<HTMLInputElement>;

  // Function to be set by parent for handling input
  onSubmitInput: (input: string, sessionId: string) => void = () => {};

  constructor(
    public dialogRef: MatDialogRef<CommandModalInputComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.output = data.output;
    this.sessionId = data.sessionId;
    this.scriptName = data.scriptName;
  }

  ngAfterViewInit() {
    this.focusInput();
  }

  submitInput() {
    if (this.onSubmitInput) {
      this.onSubmitInput(this.userInput, this.sessionId);
    }
  }

  updateOutput(newOutput: string, sessionId: string) {
    this.output = newOutput;
    this.sessionId = sessionId;
    this.userInput = '';
    setTimeout(() => {
      this.cmdInputRef?.nativeElement.focus();
    }, 0);
  }

  close() {
    this.dialogRef.close();
  }

  focusInput() {
    setTimeout(() => {
      if (this.cmdInputRef?.nativeElement) {
        console.log('Focusing input!');
        this.cmdInputRef.nativeElement.focus();
        this.cmdInputRef.nativeElement.setSelectionRange(0, 0);
      } else {
        console.log('Input ref not found');
      }
    }, 200);
  }
} 