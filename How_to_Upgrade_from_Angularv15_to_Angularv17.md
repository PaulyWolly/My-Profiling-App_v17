# 🚀 Complete Guide: Upgrading Angular v15 to v17 with Signals

This guide provides a comprehensive, step-by-step process for upgrading an Angular 15 application to Angular 17 with Signals support, including Git workflow and GitHub repository setup.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Overview](#overview)
3. [Git Workflow Strategy](#git-workflow-strategy)
4. [Step 1: Prepare Your Environment](#step-1-prepare-your-environment)
5. [Step 2: Upgrade to Angular 16](#step-2-upgrade-to-angular-16)
6. [Step 3: Upgrade to Angular 17](#step-3-upgrade-to-angular-17)
7. [Step 4: Update Angular Material & CDK](#step-4-update-angular-material--cdk)
8. [Step 5: Modernize Configuration](#step-5-modernize-configuration)
9. [Step 6: Migrate to Standalone Components](#step-6-migrate-to-standalone-components)
10. [Step 7: Introduce Angular Signals](#step-7-introduce-angular-signals)
11. [Step 8: Test Your Application](#step-8-test-your-application)
12. [Step 9: Create New GitHub Repository](#step-9-create-new-github-repository)
13. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software Versions

- **Node.js**: 18.13+ or 20.x+ (Angular 17 requirement)
  - Check: `node --version`
  - Recommended: v18.19+ or v20.x or v22.x
  
- **npm**: 9.0+ (comes with Node.js)
  - Check: `npm --version`

- **Git**: Any recent version
  - Check: `git --version`

### Before You Start

- ✅ **Backup your application** (create a full backup or ensure git is clean)
- ✅ **Ensure all tests pass** on Angular 15
- ✅ **Close any running dev servers**
- ✅ **Commit all changes** to git

---

## Overview

### Why Incremental Upgrades?

Angular does not support skipping major versions. The upgrade path is:

```
Angular 15 → Angular 16 → Angular 17
```

### What's New in Angular 17?

- **Signals** 🎯 - New reactive primitive for state management
- **New Control Flow** - `@if`, `@for`, `@switch` syntax
- **Standalone Components** - Simplified module-less architecture
- **esbuild Builder** - Faster build times (up to 87% faster)
- **Deferrable Views** - `@defer` for lazy loading
- **View Transitions API** - Smooth page transitions
- **TypeScript 5.2+** - Latest TypeScript features

### Estimated Time

- **Total Duration**: 30-60 minutes
- Angular 15 → 16: ~5-10 minutes
- Angular 16 → 17: ~10-15 minutes
- Testing & Configuration: ~15-30 minutes
- Signals Migration: Variable (depends on app size)

---

## Git Workflow Strategy

### Best of Both Worlds Approach

This workflow gives you **full upgrade history** while keeping your repository organized and professional.

**Strategy:**
1. Commit meaningful changes at each major step
2. Keep local history complete
3. Create new GitHub repository after completion
4. Push all commits with full history

**Your commit history will look like:**
```
✨ Angular 15.2.11 baseline
⬆️ Upgrade to Angular 16.2.12 + TypeScript 5.1.6
⬆️ Upgrade to Angular 17.x + new features
🔧 Update to new application builder (esbuild)
📦 Migrate to standalone components
⚡ Introduce signals in core components
✅ Final testing and cleanup
```

---

## Step 1: Prepare Your Environment

### 1.1 Check Node.js Version

```bash
node --version
```

**Required:** v18.13+ (v20.x or v22.x recommended)

If you're on an older version, update Node.js first:
- Download from [nodejs.org](https://nodejs.org/)
- Or use [nvm](https://github.com/nvm-sh/nvm): `nvm install 20`

### 1.2 Verify Current Angular Version

```bash
ng version
```

Should show Angular CLI ~15.x.x

### 1.3 Create Baseline Commit

Ensure your git is clean:

```bash
git status
```

If you have uncommitted changes:

```bash
git add .
git commit -m "✨ Pre-upgrade baseline - Angular 15.2.11"
```

**✅ Checkpoint:** Clean working directory

---

## Step 2: Upgrade to Angular 16

### 2.1 Run Angular 16 Update

```bash
ng update @angular/core@16 @angular/cli@16
```

**What happens:**
- Updates all `@angular/*` packages to v16.2.x
- Updates TypeScript to v5.1.x
- Updates zone.js to v0.13.x
- Runs automated migration scripts
- May modify code (e.g., removes deprecated guard interfaces)

**Expected output:**
```
✔ Packages successfully installed.
** Executing migrations of package '@angular/cli' **
** Executing migrations of package '@angular/core' **
Migration completed (X files modified).
```

**Duration:** 2-5 minutes

### 2.2 Review Changes

Check what was updated:

```bash
git status
git diff package.json
```

**Expected changes:**
- `package.json` - Angular packages updated to ~16.2.x
- `package-lock.json` - Dependency tree updated
- TypeScript upgraded to ~5.1.6
- Possibly some `.ts` files (migration fixes)

### 2.3 Commit Angular 16 Upgrade

```bash
git add .
git commit -m "⬆️ Upgrade to Angular 16.2.12 + TypeScript 5.1.6"
```

**✅ Checkpoint:** Angular 16 installed successfully

### 2.4 Test the Application (Optional but Recommended)

```bash
npm start
```

- Navigate to `http://localhost:4200` (or your configured port)
- Do a quick smoke test
- Stop the server (`Ctrl+C`)

---

## Step 3: Upgrade to Angular 17

### 3.1 Run Angular 17 Update

```bash
ng update @angular/core@17 @angular/cli@17
```

**What happens:**
- Updates all `@angular/*` packages to v17.x
- Updates TypeScript to v5.2+
- Introduces new esbuild-based builder
- May prompt about control flow syntax migration
- Runs automated migrations

**Duration:** 3-7 minutes

### 3.2 Handle Migration Prompts

You may be asked about:

**Control Flow Syntax Migration:**
```
? Would you like to migrate to the new control flow syntax? (Y/n)
```

**Recommendation:** Answer `No` for now. We'll do this manually later if desired.

**Expected output:**
```
✔ Packages successfully installed.
** Executing migrations of package '@angular/cli' **
** Executing migrations of package '@angular/core' **
Migration completed.
```

### 3.3 Update Angular Material & CDK (if applicable)

If your project uses Angular Material:

```bash
ng update @angular/material@17
```

Or update manually in `package.json`:

```json
{
  "dependencies": {
    "@angular/cdk": "^17.3.10",
    "@angular/material": "^17.3.10"
  }
}
```

Then run:

```bash
npm install
```

### 3.4 Review Changes

```bash
git status
git diff package.json
```

**Expected changes:**
- All Angular packages → v17.x
- TypeScript → v5.2+
- Possibly `angular.json` (builder updates)
- New configurations added

### 3.5 Commit Angular 17 Upgrade

```bash
git add .
git commit -m "⬆️ Upgrade to Angular 17.x + TypeScript 5.2+"
```

**✅ Checkpoint:** Angular 17 installed successfully

---

## Step 4: Update Angular Material & CDK

### 4.1 Check Current Versions

```bash
npm list @angular/material @angular/cdk
```

### 4.2 Update to Angular 17 Compatible Versions

```bash
ng update @angular/material@17 @angular/cdk@17
```

Or manually update `package.json`:

```json
{
  "dependencies": {
    "@angular/cdk": "^17.3.10",
    "@angular/material": "^17.3.10"
  }
}
```

Then:

```bash
npm install
```

### 4.3 Commit Material Updates

```bash
git add .
git commit -m "⬆️ Update Angular Material & CDK to v17"
```

---

## Step 5: Modernize Configuration

### 5.1 Update to New Application Builder

Angular 17 introduces a faster esbuild-based builder. Update `angular.json`:

**Before:**
```json
{
  "architect": {
    "build": {
      "builder": "@angular-devkit/build-angular:browser",
      ...
    }
  }
}
```

**After:**
```json
{
  "architect": {
    "build": {
      "builder": "@angular-devkit/build-angular:application",
      "options": {
        "browser": "src/main.ts",
        ...
      }
    }
  }
}
```

Or use the migration command:

```bash
ng update @angular/cli --name use-application-builder
```

### 5.2 Update TypeScript Configuration

Verify `tsconfig.json` includes modern settings:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022", "dom"],
    "useDefineForClassFields": false
  }
}
```

### 5.3 Commit Configuration Updates

```bash
git add .
git commit -m "🔧 Update to new application builder and modern config"
```

**✅ Checkpoint:** Modern builder configured

---

## Step 6: Migrate to Standalone Components

### 6.1 Understanding Standalone Components

Standalone components eliminate the need for NgModules, making your app simpler and more modular.

**Benefits:**
- Reduced boilerplate
- Better tree-shaking
- Easier lazy loading
- More intuitive imports

### 6.2 Automated Migration

Angular CLI can automatically migrate your app:

```bash
ng generate @angular/core:standalone
```

**You'll be prompted:**
```
? Choose the type of migration: 
  ❯ Convert all components, directives and pipes to standalone
    Remove unnecessary NgModules
    Bootstrap the application using standalone APIs
```

**Recommended:** Select all three options in sequence.

### 6.3 Manual Migration Example

If you prefer manual control:

**Before (Module-based):**
```typescript
// app.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent {
  title = 'my-app';
}
```

```typescript
// app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule],
  bootstrap: [AppComponent]
})
export class AppModule {}
```

**After (Standalone):**
```typescript
// app.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html'
})
export class AppComponent {
  title = 'my-app';
}
```

```typescript
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    // Your providers here
  ]
});
```

### 6.4 Commit Standalone Migration

```bash
git add .
git commit -m "📦 Migrate to standalone components"
```

**✅ Checkpoint:** Standalone architecture implemented

---

## Step 7: Introduce Angular Signals

### 7.1 Understanding Signals

Signals are Angular's new reactive primitive for state management.

**Key Concepts:**
- `signal()` - Creates a writable signal
- `computed()` - Creates a derived signal
- `effect()` - Runs side effects when signals change
- `input()` - Signal-based component inputs
- `output()` - Signal-based component outputs

### 7.2 Signal Basics

**Creating a Signal:**
```typescript
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-counter',
  standalone: true,
  template: `
    <div>
      <p>Count: {{ count() }}</p>
      <button (click)="increment()">Increment</button>
    </div>
  `
})
export class CounterComponent {
  count = signal(0);

  increment() {
    this.count.update(value => value + 1);
  }
}
```

### 7.3 Computed Signals

**Derived State:**
```typescript
import { Component, signal, computed } from '@angular/core';

@Component({
  selector: 'app-user',
  standalone: true,
  template: `
    <p>{{ fullName() }}</p>
  `
})
export class UserComponent {
  firstName = signal('John');
  lastName = signal('Doe');
  
  fullName = computed(() => 
    `${this.firstName()} ${this.lastName()}`
  );
}
```

### 7.4 Signal Inputs (Angular 17.1+)

**Modern Input Declarations:**
```typescript
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-user-card',
  standalone: true,
  template: `
    <div>
      <h2>{{ name() }}</h2>
      <p>{{ email() }}</p>
    </div>
  `
})
export class UserCardComponent {
  // Signal-based inputs
  name = input.required<string>();
  email = input<string>('no-email@example.com');
}
```

**Usage:**
```html
<app-user-card [name]="userName" [email]="userEmail" />
```

### 7.5 Effects

**Side Effects:**
```typescript
import { Component, signal, effect } from '@angular/core';

@Component({
  selector: 'app-logger',
  standalone: true,
  template: `<p>{{ count() }}</p>`
})
export class LoggerComponent {
  count = signal(0);

  constructor() {
    effect(() => {
      console.log('Count changed:', this.count());
    });
  }
}
```

### 7.6 Migration Strategy

**Step-by-step approach:**

1. **Start with simple state** - Convert basic properties first
2. **Add computed values** - Replace getters with computed()
3. **Update inputs** - Migrate @Input() to input()
4. **Convert services** - Use signals in services for shared state
5. **Keep RxJS where appropriate** - Signals don't replace all RxJS

**Example Migration:**

**Before (Traditional):**
```typescript
export class UserProfileComponent {
  @Input() userId!: string;
  user: User | null = null;
  loading = false;

  get isAdmin(): boolean {
    return this.user?.role === 'admin';
  }

  constructor(private userService: UserService) {}

  ngOnInit() {
    this.loading = true;
    this.userService.getUser(this.userId).subscribe(user => {
      this.user = user;
      this.loading = false;
    });
  }
}
```

**After (Signals):**
```typescript
export class UserProfileComponent {
  userId = input.required<string>();
  user = signal<User | null>(null);
  loading = signal(false);
  
  isAdmin = computed(() => 
    this.user()?.role === 'admin'
  );

  constructor(private userService: UserService) {
    effect(() => {
      this.loading.set(true);
      this.userService.getUser(this.userId()).subscribe(user => {
        this.user.set(user);
        this.loading.set(false);
      });
    });
  }
}
```

### 7.7 Commit Signal Implementation

```bash
git add .
git commit -m "⚡ Migrate components to use Angular signals"
```

**✅ Checkpoint:** Signals implemented in key components

---

## Step 8: Test Your Application

### 8.1 Start Development Server

```bash
npm start
```

Or with your custom port:

```bash
ng serve --port 5000
```

### 8.2 Test Checklist

- [ ] Application builds without errors
- [ ] Home page loads correctly
- [ ] Navigation works
- [ ] Forms submit properly
- [ ] API calls function correctly
- [ ] Authentication flow works
- [ ] All major features operational
- [ ] No console errors
- [ ] Responsive design maintained

### 8.3 Run Unit Tests

```bash
npm test
```

Fix any failing tests related to:
- Import changes (standalone components)
- Signal usage
- Updated APIs

### 8.4 Build for Production

```bash
npm run build
```

Verify the build completes successfully.

### 8.5 Commit Test Fixes

If you made any fixes:

```bash
git add .
git commit -m "✅ Fix tests and verify application functionality"
```

**✅ Checkpoint:** Application fully tested and working

---

## Step 9: Create New GitHub Repository

### 9.1 Create Repository on GitHub

1. Go to [GitHub.com](https://github.com)
2. Click **"New repository"** or **"+"** → **"New repository"**
3. Fill in details:
   - **Repository name**: `my-angular17-app` (or your preferred name)
   - **Description**: "Angular 17 application with Signals support"
   - **Visibility**: Public or Private
   - **DO NOT** initialize with README, .gitignore, or license
4. Click **"Create repository"**

### 9.2 Update Remote URL (if needed)

If you want to replace your old remote:

```bash
# Check current remote
git remote -v

# Remove old remote (optional)
git remote remove origin

# Add new remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
```

Or add as a new remote:

```bash
git remote add new-origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
```

### 9.3 Push All Commits with Full History

```bash
# Push to new repository
git push -u origin dev

# Or if you renamed the remote:
git push -u new-origin dev
```

**Your complete upgrade history is now on GitHub!** 🎉

### 9.4 Create Main/Master Branch (if needed)

If you want to merge dev to main:

```bash
git checkout -b main
git merge dev
git push -u origin main
```

### 9.5 Add README

Create or update `README.md`:

```markdown
# My Angular 17 Application

Angular 17 application with Signals support, standalone components, and modern features.

## Features

- ⚡ Angular 17.x
- 🎯 Signals for reactive state management
- 📦 Standalone components architecture
- 🏗️ esbuild-based application builder
- 🎨 Angular Material UI components
- 🔐 Authentication with Auth0

## Prerequisites

- Node.js 18.13+ (20.x or 22.x recommended)
- npm 9.0+

## Installation

\`\`\`bash
npm install
\`\`\`

## Development

\`\`\`bash
npm start
\`\`\`

Navigate to `http://localhost:5000`

## Build

\`\`\`bash
npm run build
\`\`\`

## Upgrade History

This application was upgraded from Angular 15 to Angular 17. See commit history for detailed upgrade steps.
```

Commit and push:

```bash
git add README.md
git commit -m "📝 Update README for Angular 17"
git push
```

**✅ Checkpoint:** Repository created and pushed to GitHub!

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: "Repository is not clean"

**Solution:**
```bash
git add .
git commit -m "WIP: Current changes"
# Or use --allow-dirty flag
ng update @angular/core@17 @angular/cli@17 --allow-dirty
```

---

#### Issue: "Peer dependency conflicts"

**Error:**
```
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solution:**
```bash
# Use --force or --legacy-peer-deps
npm install --legacy-peer-deps

# Or during ng update:
ng update @angular/core@17 --force
```

---

#### Issue: "Cannot find module" after upgrade

**Solution:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Angular cache
rm -rf .angular/cache
```

---

#### Issue: "TypeScript version mismatch"

**Solution:**
```bash
# Install the correct TypeScript version
npm install typescript@~5.2.0 --save-dev
```

---

#### Issue: Build errors with new application builder

**Solution:**

Temporarily revert to old builder in `angular.json`:

```json
{
  "architect": {
    "build": {
      "builder": "@angular-devkit/build-angular:browser"
    }
  }
}
```

---

#### Issue: Signals not working

**Checklist:**
- ✅ Angular 17+ installed
- ✅ Using `signal()` from `@angular/core`
- ✅ Calling signal as function: `count()` not `count`
- ✅ Component has change detection enabled

---

#### Issue: Tests failing after migration

**Common fixes:**

1. **Update test imports for standalone:**
```typescript
// Before
TestBed.configureTestingModule({
  declarations: [MyComponent]
});

// After
TestBed.configureTestingModule({
  imports: [MyComponent]
});
```

2. **Mock signal inputs:**
```typescript
component.userId = signal('test-id');
```

---

## Additional Resources

### Official Documentation

- [Angular 17 Release Notes](https://blog.angular.io/introducing-angular-v17-4d7033312e4b)
- [Angular Signals Guide](https://angular.dev/guide/signals)
- [Angular Update Guide](https://update.angular.io/)
- [Standalone Components](https://angular.dev/guide/components/importing)

### Community Resources

- [Angular Discord](https://discord.gg/angular)
- [Stack Overflow - Angular](https://stackoverflow.com/questions/tagged/angular)
- [Angular GitHub Discussions](https://github.com/angular/angular/discussions)

---

## Actual Upgrade Session Log

### Session Details
- **Date:** October 8, 2025
- **Starting Version:** Angular 15.2.11
- **Final Version:** Angular 17.3.12
- **Node Version:** v22.14.0
- **Platform:** Windows (Git Bash)

### Step-by-Step Execution

#### 1. Initial Baseline Commit
```bash
git status
# On branch dev
# Your branch is up to date with 'origin/dev'.
# nothing to commit, working tree clean

git commit -m "✨ Pre-Angular 17 upgrade - v15.2.11 baseline"
```

#### 2. Upgrade to Angular 16

**Command:**
```bash
ng update @angular/core@16 @angular/cli@16
```

**Output:**
```
The installed Angular CLI version is outdated.
Installing a temporary Angular CLI versioned 16.2.16 to perform the update.
✔ Packages successfully installed.
Using package manager: npm
Collecting installed dependencies...
Found 18 dependencies.
Fetching dependency metadata from registry...
    Updating package.json with dependency @angular-devkit/build-angular @ "16.2.16" (was "15.2.9")
    Updating package.json with dependency @angular/cli @ "16.2.16" (was "15.2.9")
    Updating package.json with dependency @angular/compiler-cli @ "16.2.12" (was "15.2.9")
    Updating package.json with dependency typescript @ "5.1.6" (was "4.8.4")
    Updating package.json with dependency @angular/animations @ "16.2.12" (was "15.2.9")
    Updating package.json with dependency @angular/common @ "16.2.12" (was "15.2.9")
    Updating package.json with dependency @angular/compiler @ "16.2.12" (was "15.2.9")
    Updating package.json with dependency @angular/core @ "16.2.12" (was "15.2.9")
    Updating package.json with dependency @angular/forms @ "16.2.12" (was "15.2.9")
    Updating package.json with dependency @angular/platform-browser @ "16.2.12" (was "15.2.10")
    Updating package.json with dependency @angular/platform-browser-dynamic @ "16.2.12" (was "15.2.9")
    Updating package.json with dependency @angular/router @ "16.2.12" (was "15.2.9")
    Updating package.json with dependency zone.js @ "0.13.3" (was "0.12.0")
UPDATE package.json (1882 bytes)
✔ Packages successfully installed.

** Executing migrations of package '@angular/cli' **
> Remove 'defaultProject' option from workspace configuration.
  Migration completed (No changes made).
> Replace removed 'defaultCollection' option in workspace configuration with 'schematicCollections'.
  Migration completed (No changes made).
> Update the '@angular-devkit/build-angular:server' builder configuration.
  Migration completed (No changes made).

** Executing migrations of package '@angular/core' **
> In Angular version 15.2, the guard and resolver interfaces (CanActivate, Resolve, etc) were deprecated.
  This migration removes imports and 'implements' clauses that contain them.
UPDATE src/app/_helpers/auth.guard.ts (2181 bytes)
  Migration completed (1 file modified).
> As of Angular v16, the `moduleId` property of `@Component` is deprecated.
  Migration completed (No changes made).
```

**Result:**
- ✅ Angular 16.2.12 installed
- ✅ TypeScript 5.1.6 installed
- ✅ 1 file modified (auth.guard.ts - deprecated interfaces removed)
- ✅ No breaking changes requiring manual fixes

**Commit:**
```bash
git add .
git commit -m "⬆️ Upgrade to Angular 16.2.12 + TypeScript 5.1.6"
# [dev 054a9cc] ⬆️ Upgrade to Angular 16.2.12 + TypeScript 5.1.6
# 3 files changed, 2610 insertions(+), 1752 deletions(-)
```

#### 3. Upgrade to Angular 17

**Command:**
```bash
ng update @angular/core@17 @angular/cli@17
```

**Output:**
```
The installed Angular CLI version is outdated.
Installing a temporary Angular CLI versioned 17.3.17 to perform the update.
✔ Packages successfully installed.
Using package manager: npm
Collecting installed dependencies...
Found 36 dependencies.
Fetching dependency metadata from registry...
    Updating package.json with dependency @angular-devkit/build-angular @ "17.3.17" (was "16.2.16")
    Updating package.json with dependency @angular/cli @ "17.3.17" (was "16.2.16")
    Updating package.json with dependency @angular/compiler-cli @ "17.3.12" (was "16.2.12")
    Updating package.json with dependency typescript @ "5.4.5" (was "5.1.6")
    Updating package.json with dependency @angular/animations @ "17.3.12" (was "16.2.12")
    Updating package.json with dependency @angular/common @ "17.3.12" (was "16.2.12")
    Updating package.json with dependency @angular/compiler @ "17.3.12" (was "16.2.12")
    Updating package.json with dependency @angular/core @ "17.3.12" (was "16.2.12")
    Updating package.json with dependency @angular/forms @ "17.3.12" (was "16.2.12")
    Updating package.json with dependency @angular/platform-browser @ "17.3.12" (was "16.2.12")
    Updating package.json with dependency @angular/platform-browser-dynamic @ "17.3.12" (was "16.2.12")
    Updating package.json with dependency @angular/router @ "17.3.12" (was "16.2.12")
    Updating package.json with dependency zone.js @ "0.14.10" (was "0.13.3")
UPDATE package.json (1883 bytes)
✔ Packages successfully installed.

** Executing migrations of package '@angular/cli' **
> Replace usages of '@nguniversal/builders' with '@angular-devkit/build-angular'.
  Migration completed (No changes made).
> Replace usages of '@nguniversal/' packages with '@angular/ssr'.
  Migration completed (No changes made).
> Replace deprecated options in 'angular.json'.
UPDATE angular.json (3708 bytes)
  Migration completed (1 file modified).
> Add 'browser-sync' as dev dependency when '@angular-devkit/build-angular:ssr-dev-server' is used.
  Migration completed (No changes made).

** Executing migrations of package '@angular/core' **
> Angular v17 introduces a new control flow syntax that uses the @ and } characters.
  This migration replaces the existing usages with their corresponding HTML entities.
  Migration completed (No changes made).
> Updates `TransferState`, `makeStateKey`, `StateKey` imports from '@angular/platform-browser' to '@angular/core'.
  Migration completed (No changes made).
> CompilerOption.useJit and CompilerOption.missingTranslation are unused under Ivy.
  This migration removes their usage
  Migration completed (No changes made).
> Updates two-way bindings that have an invalid expression to use the longform expression instead.
  Migration completed (No changes made).
```

**Result:**
- ✅ Angular 17.3.12 installed
- ✅ TypeScript 5.4.5 installed
- ✅ angular.json updated (deprecated options replaced)
- ✅ Control flow syntax prepared
- ✅ No manual code changes required

**Commit:**
```bash
git add .
git commit -m "⬆️ Upgrade to Angular 17.3.12 + TypeScript 5.4.5"
# [dev 8c3636c] ⬆️ Upgrade to Angular 17.3.12 + TypeScript 5.4.5
# 4 files changed, 3270 insertions(+), 2925 deletions(-)
# create mode 100644 How_to_Upgrade_from_Angularv15_to_Angularv17.md
```

#### 4. Next Steps (In Progress)

**Remaining tasks:**
- [ ] Update Angular Material & CDK to v17
- [ ] Migrate to standalone components (optional)
- [ ] Introduce Signals in components
- [ ] Test application thoroughly
- [ ] Create and push to new GitHub repository

### Key Takeaways from This Session

1. **Smooth upgrade process** - Both upgrades completed without errors
2. **Minimal manual changes** - Only 1 file auto-migrated in v16 upgrade
3. **Version compatibility** - Node v22.14.0 worked perfectly
4. **Total time** - ~10 minutes for core upgrades
5. **Clean git history** - Each major step committed separately

---

## Summary

Congratulations! 🎉 You've successfully upgraded your Angular application from v15 to v17 with Signals support.

**What you accomplished:**
- ✅ Upgraded Angular 15 → 16 → 17
- ✅ Updated TypeScript to 5.2+
- ✅ Migrated to standalone components
- ✅ Implemented Angular Signals
- ✅ Modernized build configuration
- ✅ Maintained full upgrade history in Git
- ✅ Pushed to new GitHub repository

**Next Steps:**
- Continue migrating more components to use signals
- Explore new control flow syntax (`@if`, `@for`)
- Implement deferrable views (`@defer`)
- Optimize with the new esbuild builder
- Share your upgrade experience!

---

**Created:** October 8, 2025  
**Angular Version:** 15.2.11 → 17.x  
**Author:** Upgrade Guide  
**License:** MIT

