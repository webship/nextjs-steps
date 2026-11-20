<p align="center"><img src="https://raw.githubusercontent.com/webship/nextjs-steps/2.0.x/assets/logo.svg" alt="Next.js logo" width="96"></p>

# nextjs-steps

Cucumber step definitions for testing apps built with Next.js, with
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation
harness built on Playwright and Cucumber-js.

A Next.js app has no user interface of its own, so `@webship-js/nextjs-steps`
targets what the framework does in every app, which is also what makes tests
flaky when a step does not wait for it: hydration; client-side navigation, the
browser's back and forward buttons and the route announcer; the pages the
router fetches ahead of a click; streaming and the loading states of the parts
of a page; form actions, their pending state and the errors they send back next
to each field; the not-found pages and the error pages of an error boundary,
with the details of an error kept from the visitor; the image component's lazy,
preloaded and optimized images; pages prerendered or rendered for each request;
the production build, and the error overlay and tools of the development server;
and a login form with its session. The steps are proven on the App Router and
the Pages Router, on 16.4.6 (the current release, the Active LTS line) and on
15.5.29 (the Maintenance LTS line).

No step phrase names the framework or its libraries: a scenario reads `When I
click the link "Invoices" without a full page reload` and `Then a part of the
page should show its loading state`.

Every step waits on the app's own signals, never on a clock: React's own marks
of a hydrated element and of a Suspense boundary showing its fallback, the
markers of the parts the server streams, the router's own requests and commits,
the Pages Router's events, and the requests the page sends. [How the steps find
things and wait](#how-the-steps-find-things-and-wait) says what each wait
relies on.

CI builds the apps with [DDEV](https://ddev.com) on the runner (the finished
app of the official Learn course on PostgreSQL, on both release lines and on the
development server; the app `create-next-app` makes with its defaults; the
official Pages Router example), runs the suite of each twice on every push and
pull request, then the assertions that must fail; see
[`.github/workflows/test.yml`](.github/workflows/test.yml).

## From nothing to a green run

What the machine needs: Docker, [DDEV](https://ddev.com), git, python3, and Node.js 20 or later with npm. The app, its Node.js 24 and its PostgreSQL run in DDEV's containers.

**1. The app.** The pack's own build script (the one CI runs) makes the app in a DDEV project of type `generic`: the finished app of the official Learn course (a dashboard of invoices and customers with a login), made with `create-next-app` from the course's example, moved to 16.4.6, its database (PostgreSQL 17, in a container of the project) seeded by the course's own seed, then the suite's own test data and the two accounts of [Test users](#test-users), then built for production and served by the web container. It takes about two minutes.

```bash
git clone https://github.com/webship/nextjs-steps.git
SITE_DIR="$PWD/learn-app" nextjs-steps/.github/scripts/build-ddev-site.sh
```

The app answers at `https://nextjssteps.ddev.site`. Its accounts are `administrator@example.com` and `editor@example.com`, each with the password `dD.123123ddd` (step 3 names them).

In the [Webship Workspace](https://github.com/webship/workspace), its Next.js plugin builds the same app instead, in a sites folder of the workspace (`dev/` here, the one `--with-needs` adds to a new workspace; `test/`, `sandboxes/` and `demos/` work the same):

```bash
bash core/scripts/plugins.sh --require nextjs --with-needs
bash core/scripts/plugins.sh --activate nextjs --with-needs
bash core/scripts/plugins.sh --install nextjs
bash dev/cmd-nextjs-project.sh nxlearn --install --add-users --example learn --test-data
```

That app answers at `https://nxlearn.ddev.site`. `--test-data` adds the same test data (the customers "Ivy Example" and "Oak Example" and their invoices). Its accounts are the plugin's, the same two with the workspace's shared password `dD.123123ddd`: `administrator@example.com` and `editor@example.com` (step 3 names them).

**2. A test project.**

```bash
mkdir nextjs-tests && cd nextjs-tests
npm init -y
npm install --save-dev webship-js @webship-js/nextjs-steps
npx init-webship-js
```

`npx init-webship-js` writes `cucumber.js`, `playwright.config.ts`, the `tests/` folders with a first feature and the `npm test` scripts, and installs Chromium. npm usually runs it already when it installs webship-js; a second run changes nothing.

**3. `cucumber.js`.** Replace the file with the wiring of the pack: the step files of webship-js and of the pack, the paths (a feature named on the command line runs alone, as in the file `npx init-webship-js` writes), the tags that keep the assertions that must fail out of a normal run, the address of the app, its login page and its session address, and the accounts (the JSON of [Test users](#test-users)).

```javascript
// A feature or a scenario named on the command line runs alone (cucumber-js 12 would add it to the
// paths below): `npx cucumber-js tests/features/first-run.feature`.
const OPTIONS_WITH_A_VALUE = new Set([
  '-c', '--config', '-f', '--format', '--format-options', '--i18n-keywords',
  '-i', '--import', '-l', '--loader', '--language', '--name', '--order',
  '-p', '--profile', '--parallel', '--plugin', '--plugin-options',
  '-r', '--require', '--require-module', '--retry', '--retry-tag-filter',
  '--shard', '-t', '--tags', '--world-parameters',
]);

function commandLinePaths() {
  if (!/cucumber(-js|\.js)?$/.test(String(process.argv[1] || ''))) return [];
  const args = process.argv.slice(2);
  const paths = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('-')) {
      if (OPTIONS_WITH_A_VALUE.has(args[i])) i += 1;
    } else {
      paths.push(args[i]);
    }
  }
  return paths;
}

module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',
      'node_modules/@webship-js/nextjs-steps/tests/step-definitions/*.js',
      'tests/step-definitions/**/*.js',
    ],
    paths: commandLinePaths().length ? [] : ['tests/features/**/*.feature'],
    // Work in progress and the assertions that must fail stay out of a normal run.
    tags: 'not @wip and not @must-fail',
    format: ['@cucumber/pretty-formatter', 'json:tests/reports/cucumber_report.json'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'https://nextjssteps.ddev.site',
      // The app's login page, and the address that answers with the session of the browser.
      loginPath: '/login',
      sessionPath: '/api/auth/session',
      // An account that logged in once keeps its session for the rest of the run.
      reuseSessions: true,
      // The browser logs "Failed to load resource: the server responded with a status of 404" (or 500)
      // for an error page: not a fault of the app. The scenarios that open one carry @js-off.
      javascript: { mode: 'warn', levels: ['error'] },
      // The waits webship-js adds around each page, scenario and step (milliseconds).
      minWaitTime: { page: 3000, before_scenario: 0, after_scenario: 0, before_step: 0, after_step: 0 },
      users: {
        administrator: { email: 'administrator@example.com', password: 'dD.123123ddd', name: 'Administrator' },
        editor: { email: 'editor@example.com', password: 'dD.123123ddd', name: 'Editor' },
      },
    },
  },
};
```

On an app from the Webship Workspace (step 1) the accounts are the same; its address goes in `LAUNCH_URL` (step 5).

**4. A first feature**, `tests/features/first-run.feature`:

```gherkin
Feature: First run
  Scenario: The dashboard opens its pages in the same document
    Given I am a logged in user with the "administrator" user
    When I click the link "Invoices" without a full page reload
    Then the route announcer should announce "Invoices"
    And the site should be served as a production build
    And there should be no hydration errors

  Scenario: A wrong password is refused
    When I log in with the email "administrator@example.com" and the password "wrong-password"
    Then the form should show the message "Invalid credentials."
    And I should not be logged in
```

**5. Run it.** Set `LAUNCH_URL` to the address of the app: `https://nextjssteps.ddev.site` for the build script's app, `https://nxlearn.ddev.site` for the Workspace's.

```bash
LAUNCH_URL=https://nextjssteps.ddev.site npm test
```

A green first run prints every step, then the summary (the starter feature of `npx init-webship-js` and the two scenarios above, passed) and the HTML report it wrote:

```
3 scenarios (3 passed)
11 steps (11 passed)
[webship-js] HTML report → …/nextjs-tests/tests/reports/cucumber_report.html
```

`npx cucumber-js tests/features/first-run.feature` runs that feature alone.

From there, copy the features of [`tests/features/`](tests/features/) (they also ship in the package, under `node_modules/@webship-js/nextjs-steps/tests/features/`): together they use every step of the pack. Each carries the tag of the app it runs on: `@learn` (the Learn app, on the app of either way of step 1), `@default-app` (an app `create-next-app` made with its defaults), `@pages-router` (the Pages Router example); `@development` runs on the development server. Run the ones of your app with `--tags`, for example `npx cucumber-js --tags "@learn and not @development"`. They read no file of their own.

### What the suite tests

The features of this repository run every step of the pack, twice in a row in CI on every change, then the assertions that must fail:

- **The session** (`@learn`): a visitor sent to the login form, which keeps the page asked for; each account logging in through the form; a wrong password and an unknown address refused with the form's message; the login button busy while its answer is held back; a session taken over; logging out.
- **Client-side navigation** (`@learn`, `@pages-router`): the links of the side navigation opening their pages without a full page reload, the route announcer saying each new title, back and forward, the pages fetched ahead of a click, a page opened from its address.
- **Search and pagination in the address** (`@learn`): a search put in the address and the list it gives, a search in the address filling in the search box, the pages of the list.
- **Forms and their actions** (`@learn`): the errors of the server next to each field and for the whole form, an error gone once its field is right, an invoice created, listed and deleted, an invoice changed and put back, each without a full page reload.
- **Loading states and streaming** (`@learn`): on a slow network, the list showing its loading state while a search streams in, a page whose parts stream in one after the other; the router keeping its page while the answer of a navigation is held back.
- **Not-found and error pages** (`@learn`, `@default-app`, `@pages-router`): the app's own not-found page for an invoice that does not exist, the default one for an address with no route, the error page of a part that fails without the details of the error, a page that exists being neither.
- **The production build** (`@learn`, `@default-app`, `@pages-router`): the router that serves the pages, a hydrated page with no hydration errors, no development tools, prerendered pages and pages rendered for each request.
- **Images** (`@learn`, `@default-app`): lazy and preloaded images, the image optimizer and the format it sends, the size of an image ahead of loading, the picture made for a small screen loading on one and the wide one not.
- **The development server** (`@learn @development`): its tools on the page, and its error overlay with the details of a part that fails.

Not tested: the framework's own tests (it has its own); the app's own business logic (an invoice's total); a hosted database or any account at a vendor; middleware other than the app's; internationalised routing; the Edge runtime; static exports; a site behind a CDN; Firefox and WebKit beyond what the steps need (the slow network is Chromium's own).

## Requirements

- Node.js 20 or later
- A webship-js 2.0 test project (webship-js 2.0.16 or later)
- An app of the 15.x or 16.x line (proven on 15.5.29 and 16.4.6), served as a production build (the development server for the `@development` steps); for the session steps, a login form and an address that answers with the session (see [Accounts](#accounts))

## Install

```bash
npm install --save-dev @webship-js/nextjs-steps
```

## Quick start

1. Add the step files to the `require` list of your webship-js `cucumber.js`:

   ```javascript
   require: [
     'node_modules/webship-js/tests/step-definitions/**/*.js',
     'node_modules/@webship-js/nextjs-steps/tests/step-definitions/*.js',
     'tests/step-definitions/**/*.js',
   ],
   ```

2. Point `launchUrl` at the app and, if your scenarios log in, name the login
   page, the session address and the accounts (see [Accounts](#accounts)):

   ```javascript
   worldParameters: {
     launchUrl: process.env.LAUNCH_URL || 'https://your-app.ddev.site',
     loginPath: '/login',                // the login page
     sessionPath: '/api/auth/session',   // the session of the browser as JSON
     users: {
       editor: { email: 'editor@example.com', password: process.env.EDITOR_PASSWORD, name: 'Editor' },
     },
   },
   ```

3. Copy a feature file from [`tests/features/`](tests/features/) into your
   project and replace the addresses, links, labels and texts with those of
   your app.

```gherkin
Feature: The list streams in

  Scenario: On a slow network the list shows its loading state, then its rows
    Given I am a logged in user with the "editor" user
    And I am on "/dashboard/invoices"
    And the network is slow
    When I fill in "Search invoices..." with "Oak"
    Then a part of the page should show its loading state
    When I wait for the page to finish loading
    Then no part of the page should show its loading state
```

## What is included

| File | Steps | Covers |
| --- | --- | --- |
| `nextjs-pages.steps.js` | 7 | The wait for the page to be ready; a hydrated page and hydration errors; a production build; the router that serves the page; the release it runs on; prerendered pages. It also puts the recorders on every page of the run (the identity of each document, the requests of the app by kind, the errors of the console). |
| `nextjs-navigation.steps.js` | 5 | A link followed and back and forward, each without a full page reload; the route announcer and what it says; the pages fetched ahead of a click. |
| `nextjs-loading.steps.js` | 7 | A slow network; a page load that does not wait for its end; a part of the page showing its loading state; the server's answers held back and let through; the page waiting for the server; the wait for the page to finish loading. |
| `nextjs-forms.steps.js` | 5 | A form sent with its button (in a table row too), sent without a full page reload; the error of a field; the message of a form; a busy button. |
| `nextjs-errors.steps.js` | 8 | A 404 page and the default one; the error page of an error boundary; the details of an error; the development error overlay, its words and how many errors it lists; the development tools. |
| `nextjs-images.steps.js` | 7 | Lazy and preloaded images; the image optimizer and the format it sends; the width and the height; an image loaded or not; an image brought into view. |
| `nextjs-session.steps.js` | 9 | Login by a handle of the users registry (a session taken over when the account already has one), through the form, with an address and a password; the login form filled in without sending it; logout; who is signed in; the login form, and where it sends a person back to. |
| `nextjs-helpers.js` | | Shared plumbing for the files above and for your own steps: the wait on the app's own signals, the requests of the app by kind, the console of the page, friendly errors (a request the browser cut says so), the users registry, the session cache and the login, the route announcer, the images, the development error overlay. It registers no step. |

Text, links, buttons, fields, the address and its parameters, the status code
of a page, network mocks and the accessibility audit are webship-js's own steps
(`I should see "..."`, `I press "..."`, `I fill in "..." with "..."`, `the path
should be "..."`, `current url should have the "..." parameter with the "..."
value`, `the response status code should be 404`): this pack adds only what the
framework decides.

## How the steps find things and wait

- **By what a person reads.** A link and a button by their name, a field by its
  label (a group of radio buttons by its legend), an image by its alternative
  text, a row by its text, a message by the live region it is announced in. The
  framework's stable hooks are the fallback: `data-nimg` of the image
  component, `#__next-route-announcer__` in `next-route-announcer`,
  `.next-error-h1` of the default not-found page, the `data-nextjs-*`
  attributes of the development tools.
- **Hydrated.** An element is in the hands of the app when it carries React's
  properties (`__reactProps$…`); the page is hydrated when its root carries
  React's fiber (`<html>` for the App Router, the child of `#__next` or the
  `Next.js-hydration` measure for the Pages Router) and no Suspense boundary is
  still dehydrated. A click waits for its element to be hydrated: on the Learn
  app's create page, the button is visible a moment before its form is.
- **A page ready.** After every action, a step waits until the document is
  loaded, the app has hydrated, no part of the page shows its loading state, the
  Pages Router is ready with no route change going on (its `routeChangeStart` and
  `routeChangeComplete` events), and no request of the app is running: the
  App Router's payload of a navigation (the header `rsc: 1`), a form action (the
  header `next-action`), the Pages Router's data (`/_next/data/…`), the app's
  own requests. Prefetches (the header `next-router-prefetch`) are left aside.
  All of that has to hold for 150 ms. `When I wait for the page to be ready` is
  that wait, for a project's own steps.
- **A part showing its loading state.** While the server streams a page, a part
  whose content is still on the way is marked in the HTML (`<!--$?-->`, and
  `<!--$~-->` while React holds its reveal back a moment); in the browser, a
  Suspense boundary of the current tree shows its fallback (a skeleton, a
  spinner, a `loading.js` page). Both count; a part the router keeps hidden for
  going back does not.
- **Navigation finished.** The router commits a new page to the address bar
  (`pushState`, with its own state) when the page is ready to show; a
  client-side navigation keeps the document, which a step checks by an
  identity it gives each document. While the answer of a navigation is on its
  way, the App Router keeps the old page and marks nothing as busy: the request
  is the only signal, which `the page should be waiting for the server` reads.
- **A form on its way.** A form action is the request with the header
  `next-action`; the step waits for its answer and for the page it sends the
  browser to (`x-action-redirect`). A button is busy when the app marks it from
  the form's pending state: disabled, `aria-disabled="true"` or
  `aria-busy="true"`.
- **The errors of a field.** The texts that the field's `aria-describedby` (or
  `aria-errormessage`) names, as a screen reader reads them with the field; the
  message of a form, its live regions (`aria-live`, `role="alert"`,
  `role="status"`).
- **Answers held back and a slow network.** `the server's answers are held
  back` holds the requests of a navigation, a form action and a page's data
  (Playwright routes) until `the server's answers come through`; `the network is
  slow` is Chromium's own network emulation (200 ms, 6 KB/s), so the parts of a
  page stream in one after the other.
- **Not-found and error pages.** A 404 page is a document (or a navigation's
  payload) that answered 404, or the "noindex" and the "404" heading the
  framework gives a page it cannot find; the error page of an error boundary
  counts only when an error did happen (a 500, the production error #441 of a
  server render, a request that failed on the server, an error the page raised).
- **The development server.** Its tools live in the `nextjs-portal` element
  (their indicator; the error overlay, a dialog with its title, its message and
  how many errors it lists). A production build has none of it.
- **The sticky parts of a page.** An element is brought to the middle of the
  window before a click, so a fixed header never covers it.
- **Failures say what was found.** `Expected the field "Choose customer" to
  show the error "Please choose somebody.", but it shows "Please select a
  customer.".` with a hint on where to look; a request the browser cut (the
  network of the machine changed) says so instead of blaming the scenario.

## Accounts

The suite never creates or deletes a user. Accounts are configuration: list
the ones the app has in `worldParameters.users`, by a handle the scenarios
use, each with the `email` (or `username`) it logs in with and its `password`,
and its `name`.

```javascript
users: {
  editor: { email: 'editor@example.com', password: process.env.EDITOR_PASSWORD, name: 'Editor' },
},
```

The login steps fill in the visible form with a password field at
`worldParameters.loginPath` (`/login`). Who is signed in is read from
`worldParameters.sessionPath` (`/api/auth/session`): the address an app's
authentication library answers with the session of the browser as JSON (`null`
when nobody is signed in), as it does when the app mounts its handlers.

An account that logged in once keeps its session for the rest of the run: a
later scenario that logs in as the same handle takes the session over instead
of filling in the login form again. `reuseSessions: false` in
`worldParameters` turns that off.

## Test users

The accounts this repository's suite logs in as, exactly as `cucumber.js`
lists them in `worldParameters.users` (the default values; the
`<HANDLE>_EMAIL`, `<HANDLE>_PASSWORD` and `<HANDLE>_NAME` variables replace
them, and `ACCOUNT_PASSWORD` every password at once).
[`.github/scripts/build-ddev-site.sh`](.github/scripts/build-ddev-site.sh)
creates them in the Learn app, and CI does the same on the runner. They are
placeholder credentials of that throwaway app, not of any real one.

```json
{
  "administrator": { "email": "administrator@example.com", "password": "dD.123123ddd", "name": "Administrator" },
  "editor": { "email": "editor@example.com", "password": "dD.123123ddd", "name": "Editor" }
}
```

The Learn app has no roles: both accounts can do everything. The course's own
account stays as its seed makes it; no feature logs in with it.

## A test app

[`.github/scripts/build-ddev-site.sh`](.github/scripts/build-ddev-site.sh)
builds the app the suite of this repository runs against, in a DDEV project of
type `generic` (`PROJECT_NAME`, `nextjssteps`): the app in `site/`, Node.js 24
and pnpm baked in the web image, the app served on port 3000 by a daemon of the
web container (`next start` of the production build, or `next dev` with
`SERVER_MODE=development`), the router sending ports 80 and 443 of the project's
address to it. `APP` chooses the app:

- `learn` (the default): the finished app of the official Learn course
  (`dashboard/final-example` of
  [github.com/vercel/next-learn](https://github.com/vercel/next-learn), MIT, at
  a pinned commit, `LEARN_REF`), made with `create-next-app --example` and
  pnpm, moved to `NEXT_VERSION` (16.4.6; the course's lockfile pins an older
  release). Its database is PostgreSQL 17 in a container of the project, with
  TLS on (the app connects with `ssl: 'require'`; the certificate is the
  self-signed one of the PostgreSQL image). The course's own `/seed` route
  seeds it, on the development server, before the production build (the
  dashboard's start page is prerendered with its data). Then
  [`site/test-app.cjs`](site/test-app.cjs) adds the suite's own customers
  ("Ivy Example" and "Oak Example", at example.com, each with a copy of a
  picture of the course) and their three invoices, with fixed ids, and the two
  accounts of [Test users](#test-users). The app gets one route of the pack's
  own, [`site/session-route.ts`](site/session-route.ts) at
  `/api/auth/session`: the session of the browser as JSON, which the app's
  authentication library answers itself in an app that mounts its handlers.
- `default`: the app `create-next-app` makes with its defaults (App Router).
- `pages`: the official `with-typescript` example (Pages Router), at the tag of
  the release.

The build adds the project's address to `allowedDevOrigins` in the app's
`next.config`, so the development server answers it (the release refuses its
development resources to another origin), and turns telemetry off
(`NEXT_TELEMETRY_DISABLED`). Nothing else of the apps is changed: the app runs
in production mode, as the course's own example ships it.

```bash
SITE_DIR="$PWD/../learn-app" .github/scripts/build-ddev-site.sh
npm test
```

`APP=default` or `APP=pages` builds the other apps (the default tags of
`cucumber.js` follow `APP`); `NEXT_VERSION=15.5.29` the Maintenance LTS line;
`SERVER_MODE=development` the development server (`SERVE_ONLY=1` switches an
app already built between the two).

## Steps

One example of each step; the JSDoc block above each definition holds five.

### `nextjs-errors.steps.js` (8)

- `I should be on a 404 page`
- `I should be on the default 404 page`
- `the error page should show "Something went wrong!"`
- `the page should not show the details of the error`
- `the development error overlay should be shown`
- `the development error overlay should show "invalid input syntax for type uuid"`
- `the development error overlay should list 2 errors`
- `the development tools should be on the page`

### `nextjs-forms.steps.js` (5)

- `I send the form with "Create Invoice"`
- `the form should have been sent without a full page reload`
- `the field "Choose customer" should show the error "Please select a customer."`
- `the form should show the message "Missing Fields. Failed to Create Invoice."`
- `the "Log in" button should be busy`

### `nextjs-images.steps.js` (7)

- `the image "Ivy Example's profile picture" should load lazily`
- `the image "logo" should be preloaded`
- `the image "Ivy Example's profile picture" should be optimized`
- `the image "Ivy Example's profile picture" should be served as "image/webp"`
- `the image "Ivy Example's profile picture" should have a width and a height`
- `the image "Ivy Example's profile picture" should have loaded`
- `I scroll the image "Oak Example's profile picture" into view`

### `nextjs-loading.steps.js` (7)

- `the network is slow`
- `I start to go to "/dashboard/invoices"`
- `a part of the page should show its loading state`
- `the server's answers are held back`
- `the server's answers come through`
- `the page should be waiting for the server`
- `I wait for the page to finish loading`

### `nextjs-navigation.steps.js` (5)

- `I click the link "Invoices" without a full page reload`
- `I go back without a full page reload`
- `the page should have a route announcer`
- `the route announcer should announce "Invoices | Acme Dashboard"`
- `the page "/dashboard/invoices" should be prefetched`

### `nextjs-pages.steps.js` (7)

- `I wait for the page to be ready`
- `I should see a hydrated page`
- `there should be no hydration errors`
- `the site should be served as a production build`
- `the page should be served by the app router`
- `the page should run on the release "16"`
- `the page should be prerendered`

### `nextjs-session.steps.js` (9)

- `I am a logged in user with the "administrator" user`
- `I log in as "administrator" with the login form`
- `I log in with the email "administrator@example.com" and the password "wrong-password"`
- `I fill in the login form as "administrator"`
- `I log out`
- `I should be logged in`
- `I should be logged in as "administrator"`
- `I should see the login form`
- `the login form should send me back to "/dashboard"`

## Testing this package

```bash
npm install
SITE_DIR="$PWD/../learn-app" .github/scripts/build-ddev-site.sh
npm run test:examples      # the examples and the features against the step patterns
npm run test:paths         # a feature or a scenario named on the command line runs alone
npx cucumber-js --dry-run  # no undefined and no ambiguous step
npm test                   # the suite, against the app
npm run test:must-fail     # assertions that must fail, each with its message
```

`LAUNCH_URL` points the suite at another app; `npx cucumber-js
tests/features/session.feature` runs one feature and `npx cucumber-js
tests/features/session.feature:<line>` one scenario (the line of its
`Scenario:`; the paths of `cucumber.js` are left out when the command line
names any); `FEATURES` runs a subset too
(`FEATURES=tests/features/session.feature npm test`); `CUCUMBER_TAGS=@critical`
runs the smoke lane; `HEADLESS=false` shows the browser.

`tests/must-fail/` holds scenarios that assert something that is not true on
the test app. `npm run test:must-fail` runs them and checks that each one
fails at its last step, with the message it announces and a hint: a step that
cannot fail proves nothing.

The suite leaves the app as it found it: an invoice a scenario creates, it
deletes; an amount it changes, it puts back. A run stopped half way can leave
something behind; the build script makes the suite's own customers and their
invoices again, and gives the accounts back their name and password, without
building anything else:

```bash
TEST_DATA_ONLY=1 SITE_DIR="$PWD/../learn-app" .github/scripts/build-ddev-site.sh
ACCOUNTS_ONLY=1 SITE_DIR="$PWD/../learn-app" .github/scripts/build-ddev-site.sh
```

On a machine where other containers start and stop, Chromium can lose a
request in flight (`net::ERR_NETWORK_CHANGED`): the failure then says the
request was cut. Run the suite again, or run it inside the project's container
(the Webship Workspace's `cmd-tools-testing.sh <project> --run` does).

## How the steps were written

Every page a step touches was opened in a real browser first, and the step was
written from what is there: the roles and names of the accessibility tree, the
stable attributes, what the page does while it loads, streams, navigates or
sends a form, the exact messages. The steps are proven on 16.4.6 and 15.5.29,
on the App Router and the Pages Router, in English, with Chromium.

Not covered: the parallel and intercepting routes, the `<Form>` component's
search forms, middleware rewrites, internationalised routing, the Edge runtime,
static exports, the `<Script>` component, the metadata files beyond the title,
React Server Components' caching options, the experimental features of the
framework.

## License

MIT

## Logo

The Next.js logo in this README comes from Simple Icons 16.37.0 (CC0-1.0), filled with the colour the set lists for the brand. The Next.js name and logo are trademarks of their owner; this pack is not affiliated with or endorsed by them.
