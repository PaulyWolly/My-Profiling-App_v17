# Scrollable Directive

The `appScrollable` directive provides enhanced scrolling functionality for Angular components, ensuring proper mouse wheel scrolling and consistent scrollbar appearance across browsers.

## Features

- Proper mouse wheel scrolling (prevents page scrolling when inside a scrollable area)
- Consistent scrollbar appearance across browsers
- Works with touch devices
- Includes multiple size variants
- Standalone and easy to use

## Installation

The directive is already installed in the shared module. Simply import the `SharedModule` in your feature module to use it.

```typescript
import { SharedModule } from '@app/shared/shared.module';

@NgModule({
  imports: [
    // other imports
    SharedModule
  ]
})
export class YourFeatureModule { }
```

## Usage

### Basic Usage

Add the `appScrollable` directive to any element you want to make scrollable:

```html
<div appScrollable>
  <!-- Content here -->
</div>
```

### With CSS Classes

For best results, combine the directive with the appropriate CSS classes:

```html
<!-- Basic scrollable area -->
<div class="app-scrollable" appScrollable>
  <!-- Content here -->
</div>

<!-- Scrollable area with preset height (XS: 200px) -->
<div class="app-scrollable app-scrollable-xs" appScrollable>
  <!-- Content here -->
</div>
```

### Available Size Classes

- `app-scrollable-xs`: 200px max height
- `app-scrollable-sm`: 300px max height
- `app-scrollable-md`: 400px max height
- `app-scrollable-lg`: 600px max height
- `app-scrollable-xl`: 800px max height
- `app-scrollable-full`: Dynamic height (calc(100vh - 120px))

### Custom Height

You can also set a custom height using inline styles:

```html
<div class="app-scrollable" appScrollable style="max-height: 350px;">
  <!-- Content here -->
</div>
```

## Demo

A demo component is available to showcase the different ways to use the scrollable directive. Import `ScrollableDemoComponent` in your routes:

```typescript
{
  path: 'scrollable-demo',
  component: () => import('@app/shared/components/scrollable-demo/scrollable-demo.component').then(m => m.ScrollableDemoComponent)
}
```

## How It Works

The directive:
1. Adds the `app-scrollable` class to the element
2. Sets necessary CSS properties for cross-browser compatibility
3. Captures wheel events to prevent the page from scrolling
4. Manually scrolls the element based on the wheel delta

## Browser Support

The directive is tested and works in:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS/Android) 