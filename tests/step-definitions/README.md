# Step definitions

| File | Covers |
| --- | --- |
| `nextjs-pages.steps.js` | The wait for the page to be ready; a hydrated page and hydration errors; a production build; the router that serves the page; the release it runs on; prerendered pages. It puts the recorders on every page of the run. |
| `nextjs-navigation.steps.js` | A link followed and back and forward, each without a full page reload; the route announcer; the pages fetched ahead of a click. |
| `nextjs-loading.steps.js` | A slow network; a page load that does not wait for its end; a part of the page showing its loading state; the server's answers held back and let through; the page waiting for the server. |
| `nextjs-forms.steps.js` | A form sent with its button; sent without a full page reload; the error of a field; the message of a form; a busy button. |
| `nextjs-errors.steps.js` | A 404 page and the default one; the error page of an error boundary; the details of an error; the development error overlay and the development tools. |
| `nextjs-images.steps.js` | Lazy and preloaded images, the image optimizer and its format, the size of an image, an image loaded or not, an image brought into view. |
| `nextjs-session.steps.js` | Login by a handle of the users registry, through the form or with an address and a password; the login form filled in; logout; who is signed in; the login form and where it sends a person back to. |
| `nextjs-helpers.js` | Shared plumbing: the wait on the app's own signals, the requests of the app by kind, the console, friendly failures, the users registry and the session cache, the route announcer, images, the development overlay. It registers no step. |

## Rules for a new step

- Check `node_modules/webship-js/tests/step-definitions/` first: a step that the
  generic click, fill and see vocabulary already covers is not added here.
- No step phrase names the framework or its libraries. A name appears only as
  an argument a step asserts.
- The regular expression starts with the pronoun group `(I |we )*` where a
  person acts, and an assertion takes `should( not)*`, so one definition reads
  both polarities.
- A JSDoc block above the step holds at least five `Example #N:` lines. Run
  `npm run test:examples`: every example must match its own step and no step of
  webship-js.
- Find things the way a person does: a name, a label, a role, a text, the
  alternative text of an image. The framework's stable hooks are the fallback.
- Wait on the app's own signals (see `nextjs-helpers.js`), never on a clock.
- A failure says what was expected, what was found, and where to look (a
  `Hint:`); add a scenario to `tests/must-fail/` that proves it can fail.
