# smart-debounce – Next-Gen Debounce & Throttle Utility

**Overview:** *smart-debounce* is a TypeScript-first utility library that provides advanced debounce and throttle functionality for both browser and Node.js environments. Debouncing delays execution of a function until a pause in activity, while throttling ensures a function runs at most once per time interval. These techniques optimize performance by reducing redundant calls (e.g. limiting API requests during user input). Unlike older utilities, *smart-debounce* natively handles **async/await** functions (returning a Promise when appropriate), and offers rich control features such as canceling, flushing, and conditional execution.

**Why Use smart-debounce?** Traditional debounce/throttle tools (like Lodash or Underscore) have useful features but also limitations. For example, Lodash’s `_.debounce` does provide `cancel()` and `flush()` methods, but it **does not return a Promise on the first call** of an async function, making async handling awkward. They also lack built-in support for *conditional triggers* (waiting until a condition is true) or *event-based cancellation* (e.g. aborting on an Escape keypress). *smart-debounce* solves these gaps with a modern, type-safe API. It lets your functions wait for conditions, auto-cancel on events, and seamlessly integrate async results, improving code clarity and efficiency for both frontend (UI) and backend (rate-limiting) scenarios.

## Key Features

- **Async & Sync Support:** Works with synchronous functions or async functions. If `fn` is async, the debounced result returns a `Promise<ReturnType>`. This avoids Lodash’s issue where the first async call returns `undefined`.
- **Cancel & Flush Methods:** Each debounced function includes `.cancel()` to abort pending calls and `.flush()` to immediately invoke with the last arguments (like Lodash’s methods, but integrated here for both debounce and throttle).
- **Conditional Execution:** Pass a `condition` function (sync or returning a Promise). Calls will be delayed until the condition resolves to `true`. E.g., only run when `navigator.onLine === true`.
- **Event-Based Cancellation:** Specify a key (e.g. `"Escape"`) via the `cancelOn` option. A matching keyboard event will automatically cancel any pending execution (useful for aborting search or form submissions).
- **Throttling (Roadmap):** v1.1 will introduce a `throttle()` function with the same advanced options (making it a unified debounce/throttle toolkit).
- **Cross-Environment:** Built in TypeScript, it compiles to both ESM and CommonJS so it runs in browsers, Node.js, and hybrid environments.
- **TypeScript-First:** Strongly-typed API with generic type inference. You get full IDE support and type-checking for function arguments and return values.

## Installation

Use npm or yarn to add *smart-debounce* to your project:

```bash
npm install smart-debounce
# or
yarn add smart-debounce
```

The package is open source (e.g. MIT-licensed), ready for your contributions and use in any project.

## Basic Usage

Import and wrap your function with `debounce()`, providing a delay (in milliseconds) and optional settings:

```ts
import { debounce } from 'smart-debounce';

// Example: Debounced async search request
const search = debounce(
  async (query: string) => {
    // This async function will only run after 300ms of no new calls
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    return res.json();
  },
  300,                     // Delay: 300ms
  { cancelOn: 'Escape' }   // Cancel if the user presses the Escape key
);

// Calling search multiple times within 300ms only invokes the fetch once:
search('apple');
search('apple pie');
// If needed, you can also cancel or flush manually:
search.cancel();  // Abort the pending API call
search.flush();   // Force immediate call with last arguments
```

## API Design

#### `debounce(fn, delay, options?)`

Creates and returns a debounced version of `fn`. The returned function has the same signature as `fn` and preserves type information.

- **Parameters:**

  - `fn` (`Function`): The function to debounce. Can be synchronous or return a `Promise`.
  - `delay` (`number`): The debounce interval in milliseconds.
  - `options` (`object`, optional): Configuration object (see below).

- **Options:**

  - `cancelOn` (`string`, default `null`): Name of a keyboard key (e.g. `"Escape"`). If that key event is detected, any pending call is canceled.
  - `maxWait` (`number`, default `null`): Maximum wait time (ms). Even if calls continue, `fn` is forced to run after this timeout (useful for throttling effect).
  - `condition` (`() => boolean | Promise<boolean>`, default `null`): A function to check before running `fn`. If it returns/pends `true`, the call proceeds; if `false`, execution is delayed (or skipped) until true.

- **Return Value:** The debounced function, which returns either `void` or a `Promise<ReturnType>` if `fn` is async. You can assign it just like the original function.

- **Instance Methods (on the returned function):**

  - `cancel()`: Cancels any pending invocation. (If `fn` has not yet started, it will be aborted.)
  - `flush()`: Immediately invokes `fn` with the most recent arguments, if one was pending.
  - `pending() -> boolean`: Returns `true` if there is a debounced call waiting to be executed; otherwise `false`.

## Advanced Example

```ts
import { debounce } from 'smart-debounce';

const saveDraft = debounce(
  async (data: { text: string }) => {
    console.log('Saving draft...');
    await fetch('/api/save-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    console.log('Draft saved!');
  },
  1000, // Wait 1 second after the last input before saving
  {
    maxWait: 5000,                // Force a save at most every 5 seconds
    condition: () => navigator.onLine, // Only run if online
    cancelOn: 'Escape'           // Abort save if Escape is pressed
  }
);

// Attach to a text editor input event
document.getElementById('editor')?.addEventListener('input', e => {
  const text = (e.target as HTMLInputElement).value;
  saveDraft({ text });
});
```

In this example, typing in an editor delays the save until the user pauses (debounce 1s). Even if the user keeps typing, a save is forced after 5s (`maxWait`). If the computer goes offline, `condition` prevents the save; it will retry automatically once online again. Pressing Escape aborts any pending save.

## Benefits for the Team

- **Modern & Unified:** Replaces older debounce utilities (like Lodash/Underscore) with a more powerful alternative, and consolidates debounce & throttle logic in one package (throttle coming soon).
- **Code Reuse:** Works in both front-end and back-end code, so you can use the same logic in browser UI and Node.js services.
- **Performance:** Reduces unnecessary function calls and network requests, leading to smoother UIs and more efficient APIs.
- **Type Safety:** Written in TypeScript, it provides full type inference, catching mistakes at compile time and improving maintainability.
- **Developer-Friendly:** Built-in methods and options (cancel, flush, condition, etc.) make it easy to handle complex cases without boilerplate. The API is small and intuitive.

## Roadmap

- **v1.0 – Core Debounce:** Initial release with debounce, async support, cancel/flush, conditions, and key-based cancellation. (Completed) ✅
- **v1.1 – Throttle:** Add a `throttle()` function with the same advanced features (maxWait, cancel, etc.). 🚀
- **v1.2 – Packaging:** Provide both ESM and CJS builds for maximum compatibility and modern module support. 📦
- **v1.3 – Auto-Event Helpers:** Introduce utilities like `debounceEvent` for easier integration (e.g. automatically debouncing DOM events). 🛠

Each version will be fully tested and documented. The code will be published on NPM under an open-source license, and contributions are welcome.

*smart-debounce* will empower your team with a robust, flexible debounce/throttle solution, improving application performance and developer productivity. You can now share this specification with your developers to guide the implementation of the NPM package.

**References:** For background, see Lodash’s documentation on debounce and discussions of debounce vs. throttle to understand the motivation behind these features. 