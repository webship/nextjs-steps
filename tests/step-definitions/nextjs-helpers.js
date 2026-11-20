'use strict';

// Shared helpers for the step files of this pack.
//
// Not a step file: it registers no step definitions and no hooks. It holds the
// plumbing the steps use and that a project can require for its own steps:
// the wait on the app's own signals, the requests the app sends and their
// kinds, the console of the page, the paths of the app, the users registry,
// the session cache and the login, the route announcer, the images, the
// development error overlay, and the friendly failures.
//
// Waiting: the page is ready when
//   - the document is loaded;
//   - the app has hydrated: the root of the page carries React's fiber, and no
//     part the server rendered is still waiting to be hydrated (a Suspense
//     boundary still "dehydrated");
//   - no part of the page shows its loading state any more: no boundary the
//     server streamed is waiting for its content (the <!--$?--> and <!--$~-->
//     markers of the HTML) and no Suspense boundary shows its fallback;
//   - the router of the Pages Router is ready and no route change is going on;
//   - no request of the app is running (a navigation's RSC payload, a form
//     action, a page's data, the app's own fetches), prefetches left aside;
//   - and all of that has held for a moment (150 ms).
// No step sleeps.
//
// Every lookup starts with what a person reads (a label, a role, a text, the
// alternative text of an image) and falls back to the framework's stable
// hooks (`data-nimg` of the image component, `#__next-route-announcer__`,
// `.next-error-h1`, the `data-nextjs-*` attributes of the development overlay).

const { gotoUrl, friendly } = require('webship-js/tests/step-definitions/webship');

/**
 * The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least
 * 10 seconds. Kept below webship-js's 45 second step timeout.
 */
function budget(world) {
  return Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, 10000);
}

/** Escape a literal string for use in a RegExp. */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** White space collapsed and trimmed. */
function clean(text) {
  return String(text === null || text === undefined ? '' : text).replace(/\s+/g, ' ').trim();
}

/** Letter case and white space ignored. */
function same(a, b) {
  return clean(a).toLowerCase() === clean(b).toLowerCase();
}

/** A list for an error message: `"a", "b", "c"` or `(none)`. */
function listed(values) {
  const items = [...new Set((values || []).map(clean).filter(Boolean))];
  return items.length ? items.map((item) => `"${item}"`).join(', ') : '(none)';
}

/** The app's root without a trailing slash. */
function siteRoot(world) {
  return String(world.launchUrl || (world.parameters && world.parameters.launchUrl) || '').replace(/\/+$/, '');
}

/** Join the app's root and a path with exactly one slash. Absolute URLs pass through. */
function siteUrl(world, url) {
  if (!url) return siteRoot(world) + '/';
  if (/^https?:\/\//i.test(url)) return url;
  return siteRoot(world) + '/' + String(url).replace(/^\/+/, '');
}

/** The path of the page the browser shows, without the query and the fragment. */
function currentPath(world) {
  try {
    return new URL(world.page.url()).pathname.replace(/\/+$/, '') || '/';
  } catch {
    return '';
  }
}

/** The path and the query of the page the browser shows. */
function currentAddress(world) {
  try {
    const url = new URL(world.page.url());
    return (url.pathname.replace(/\/+$/, '') || '/') + url.search;
  } catch {
    return '';
  }
}

/** The path of an address, without the query, the fragment and a trailing slash. */
function pathOf(url) {
  try {
    return new URL(url, 'https://x.invalid').pathname.replace(/\/+$/, '') || '/';
  } catch {
    return String(url || '');
  }
}

// ---------------------------------------------------------------------------
// A request the browser cut
// ---------------------------------------------------------------------------

/**
 * A sentence for a failure when the browser shows its own error page
 * (`chrome-error://…`) instead of the app's answer, or when a request of the
 * app failed with net::ERR_NETWORK_CHANGED: the request was cut before the app
 * answered, as Chromium does to every request in flight when the network of
 * the machine changes (a container starting or stopping on it). An empty
 * string otherwise.
 */
function cutRequest(world) {
  const url = world && world.page ? world.page.url() : '';
  if (/^chrome-error:/.test(url)) return `the browser shows its own error page (${url}): the request was cut before the app answered`;
  const state = world && world.page ? TRACKED.get(world.page) : null;
  const cut = state && state.failures.find((f) => /ERR_NETWORK_CHANGED|ERR_NETWORK_IO_SUSPENDED|ERR_INTERNET_DISCONNECTED/.test(f.error) && Date.now() - f.at < 60000);
  if (cut) return `a request of the app (${shortUrl(cut.url)}) was cut by the browser (${cut.error})`;
  return '';
}

/** The hint of a failure `cutRequest` explains. */
const CUT_REQUEST_HINT = 'Nothing is wrong with the scenario: Chromium cuts every request in flight when the network of the machine changes (a container starting or stopping on it). Run the scenario again, or run the suite inside the project\'s container.';

/** A failure, or the one that says a request was cut when the browser cut one. */
function failure(world, message, hint) {
  const cut = cutRequest(world);
  if (cut) return friendly({ message: `${message} But ${cut}.`, hint: CUT_REQUEST_HINT });
  return friendly({ message, hint });
}

/** An address without the app's origin, shortened for a message. */
function shortUrl(url) {
  return String(url || '').replace(/^https?:\/\/[^/]+/, '').slice(0, 90);
}

// ---------------------------------------------------------------------------
// The requests of the app, by kind
// ---------------------------------------------------------------------------

/**
 * The kind of a request the page sends in the background (fetch or XHR):
 *   'prefetch'    the router fetching a page ahead of a click (a header
 *                 next-router-prefetch, or purpose: prefetch);
 *   'action'      a form action (a header next-action);
 *   'navigation'  the App Router fetching the payload of a page (rsc: 1, or
 *                 an _rsc= parameter);
 *   'data'        the Pages Router fetching a page's data (/_next/data/…);
 *   'background'  any other request of the app;
 * or null for what is not a background request.
 */
function kindOf(request) {
  const type = request.resourceType();
  if (type !== 'fetch' && type !== 'xhr') return null;
  const h = request.headers();
  const url = request.url();
  if (h['next-router-prefetch'] || h['purpose'] === 'prefetch' || h['x-middleware-prefetch']) return 'prefetch';
  if (h['next-action']) return 'action';
  if (h['rsc'] === '1' || /[?&]_rsc=/.test(url)) return 'navigation';
  if (h['x-nextjs-data'] || /\/_next\/data\//.test(url)) return 'data';
  return 'background';
}

const TRACKED = new WeakMap();

/**
 * The requests of a page, kept from the moment it opens: those still running
 * (with their kind), how many of each kind started, the answers (newest
 * last), the main documents and the failures. The tracker is attached once
 * per page (onNewPage in nextjs-pages.steps.js attaches it to every page).
 *
 * @returns {{pending: Map, started: object, answers: Array, documents: Array, failures: Array}}
 */
function requests(page) {
  let state = TRACKED.get(page);
  if (!state) {
    state = {
      pending: new Map(),
      started: { prefetch: 0, action: 0, navigation: 0, data: 0, background: 0 },
      answers: [],
      documents: [],
      failures: [],
      prefetched: [],
    };
    TRACKED.set(page, state);
    page.on('request', (request) => {
      const kind = kindOf(request);
      if (!kind) return;
      state.pending.set(request, kind);
      state.started[kind] += 1;
      if (kind === 'prefetch') {
        state.prefetched.push(request.url());
        if (state.prefetched.length > 200) state.prefetched.shift();
      }
    });
    page.on('response', (response) => {
      const request = response.request();
      if (request.resourceType() === 'document' && request.frame() === page.mainFrame()) {
        state.documents.push({ url: response.url(), status: response.status(), at: Date.now() });
        if (state.documents.length > 20) state.documents.shift();
        return;
      }
      const kind = kindOf(request);
      if (!kind || kind === 'prefetch') return;
      const h = response.headers();
      state.answers.push({ url: response.url(), kind, method: request.method(), status: response.status(), redirect: h['x-action-redirect'] || '', at: Date.now() });
      if (state.answers.length > 100) state.answers.shift();
    });
    const done = (request) => { state.pending.delete(request); };
    page.on('requestfinished', done);
    page.on('requestfailed', (request) => {
      state.pending.delete(request);
      const error = (request.failure() && request.failure().errorText) || 'failed';
      state.failures.push({ url: request.url(), error, at: Date.now() });
      if (state.failures.length > 20) state.failures.shift();
    });
    // A new document drops the requests of the page it replaces.
    page.on('framenavigated', (frame) => {
      if (frame !== page.mainFrame()) return;
      for (const [request, kind] of state.pending) {
        if (kind !== 'action') state.pending.delete(request);
      }
    });
  }
  return state;
}

/** The requests still running that the page waits for (every kind but prefetches). */
function runningRequests(page) {
  const state = requests(page);
  return [...state.pending.entries()].filter(([, kind]) => kind !== 'prefetch').map(([request, kind]) => ({ url: request.url(), kind }));
}

/** The status of the last main document the page loaded, or 0. */
function lastDocumentStatus(page) {
  const docs = requests(page).documents;
  return docs.length ? docs[docs.length - 1].status : 0;
}

// ---------------------------------------------------------------------------
// The console of the page
// ---------------------------------------------------------------------------

const CONSOLES = new WeakMap();

/**
 * The errors of the page's console and its uncaught errors, kept from the
 * moment it opens (onNewPage attaches the recorder to every page), with the
 * address of the page they belong to. Cleared when the main document changes.
 */
function consoleOf(page) {
  let list = CONSOLES.get(page);
  if (!list) {
    list = [];
    CONSOLES.set(page, list);
    const keep = (entry) => {
      list.push(entry);
      if (list.length > 300) list.shift();
    };
    page.on('console', (message) => {
      const type = message.type();
      if (type === 'error' || type === 'warning') keep({ type, text: message.text(), at: Date.now() });
    });
    page.on('pageerror', (error) => keep({ type: 'pageerror', text: String((error && error.message) || error), at: Date.now() }));
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) list.splice(0, list.length);
    });
  }
  return list;
}

/**
 * The hydration errors of the console: React's own words in development
 * ("Hydration failed", "hydration mismatch", "did not match", "error while
 * hydrating") and its error codes in production (#418, #423, #425: the
 * server's HTML and the first render in the browser differ).
 */
function hydrationErrors(page) {
  return consoleOf(page)
    .filter((entry) => entry.type !== 'warning')
    .map((entry) => entry.text)
    .filter((text) => /hydrat|did not match|didn't match|Minified React error #(418|423|425)\b/i.test(text));
}

/**
 * The errors the page reported for a render that failed on the server, in
 * production: React's error #441 (the message is left out on purpose, and a
 * digest stands for it), or an error with a `digest`.
 */
function serverRenderErrors(page) {
  return consoleOf(page)
    .filter((entry) => entry.type !== 'warning')
    .map((entry) => entry.text)
    .filter((text) => /Minified React error #441\b|Server Components render|digest/i.test(text));
}

// ---------------------------------------------------------------------------
// The script every document of the run carries
// ---------------------------------------------------------------------------

/**
 * Put into every document before the app's own scripts (addInitScript): an
 * identity of the document (a full page load gives a new one, a client-side
 * navigation keeps it), and the commits of the router to the address bar
 * (pushState, replaceState, popstate).
 */
function documentScript() {
  if (window.__webshipNextjs) return;
  const state = {
    document: Math.random().toString(36).slice(2) + Date.now().toString(36),
    commits: [],
    routeChanges: 0,
    routeEvents: false,
  };
  Object.defineProperty(window, '__webshipNextjs', { value: state, enumerable: false });
  const remember = (how, url) => {
    try {
      state.commits.push({ how, url: new URL(url === undefined || url === null ? location.href : String(url), location.href).href, at: Date.now() });
      if (state.commits.length > 50) state.commits.shift();
    } catch (e) { /* an address the page cannot read is not a commit */ }
  };
  for (const name of ['pushState', 'replaceState']) {
    const original = history[name];
    history[name] = function (data, unused, url) {
      const result = original.apply(this, arguments);
      remember(name, url);
      return result;
    };
  }
  window.addEventListener('popstate', () => remember('popstate', location.href));
}

/** The identity of the document the page shows (see documentScript). */
async function documentId(world) {
  return world.page.evaluate(() => (window.__webshipNextjs ? window.__webshipNextjs.document : '')).catch(() => '');
}

// ---------------------------------------------------------------------------
// Which router, and the app's own signals
// ---------------------------------------------------------------------------

/**
 * What the page says about the app: `router` is 'app' (the App Router),
 * 'pages' (the Pages Router) or '' (no app of the framework on this page),
 * `version` the release the page runs, `development` whether it is served by
 * the development server.
 */
async function appInfo(world) {
  return world.page.evaluate(() => {
    const next = window.next;
    const data = window.__NEXT_DATA__;
    const router = next && next.appDir ? 'app' : (data || (next && next.router && next.router.events) ? 'pages' : '');
    const development = !!document.querySelector('nextjs-portal')
      || (data && data.buildId === 'development')
      || typeof window.__nextHmrInitialVersion !== 'undefined'
      || typeof window.TURBOPACK_CHUNK_UPDATE_LISTENERS !== 'undefined'
      || typeof window.__NEXT_HMR_CB !== 'undefined';
    return { router, version: (next && next.version) || '', development: !!development, buildId: data ? data.buildId : '' };
  }).catch(() => ({ router: '', version: '', development: false, buildId: '' }));
}

/**
 * What the page still has to do, as the page says it: '' when it is ready.
 * See the head of this file.
 */
async function pendingWork(world) {
  let busy;
  try {
    busy = await world.page.evaluate(() => {
      const out = [];
      // While the document still loads, the parts it streamed so far are read too (below).
      if (document.readyState !== 'complete') out.push('the document is still loading');
      const next = window.next;
      const data = window.__NEXT_DATA__;
      const own = window.__webshipNextjs;
      const reactKey = (node, prefix) => !!node && Object.keys(node).some((k) => k.startsWith(prefix));
      const pagesRoot = document.getElementById('__next');

      // Hydration: the root element carries React's fiber.
      if (next && next.appDir) {
        if (!reactKey(document.documentElement, '__reactFiber$')) out.push('the page is not hydrated yet');
      } else if (data || (next && next.router && next.router.events)) {
        const hydrated = performance.getEntriesByName('Next.js-hydration').length > 0
          || reactKey(pagesRoot && pagesRoot.firstElementChild, '__reactFiber$');
        if (!hydrated) out.push('the page is not hydrated yet');
        const router = next && next.router;
        if (router && router.isReady === false) out.push('the router is not ready');
        if (own && router && router.events && !own.routeEvents) {
          own.routeEvents = true;
          const done = () => { own.routeChanges = Math.max(0, own.routeChanges - 1); };
          router.events.on('routeChangeStart', () => { own.routeChanges += 1; });
          router.events.on('routeChangeComplete', done);
          router.events.on('routeChangeError', done);
        }
        if (own && own.routeChanges > 0) out.push('a route change is going on');
      } else if (Array.isArray(self.__next_f) || pagesRoot) {
        out.push('the app has not started yet');
      }

      // Parts the server streamed and that still wait for their content.
      const walker = document.createNodeIterator(document.body || document.documentElement, NodeFilter.SHOW_COMMENT);
      let node;
      let waiting = 0;
      while ((node = walker.nextNode())) {
        if (node.data === '$?' || node.data === '$~') waiting += 1;
      }
      if (waiting) out.push(`${waiting} streamed part(s) of the page still waiting for their content`);

      // Suspense boundaries, from the current tree of React: one showing its
      // fallback (a loading state), one still waiting to be hydrated. A hidden
      // part (a page the router keeps for going back) is left out.
      const start = [document.documentElement, document.body, pagesRoot && pagesRoot.firstElementChild].find((el) => reactKey(el, '__reactFiber$'));
      if (start) {
        const key = Object.keys(start).find((k) => k.startsWith('__reactFiber$'));
        let fiber = start[key];
        while (fiber && fiber.return) fiber = fiber.return;
        if (fiber && fiber.stateNode && fiber.stateNode.current) fiber = fiber.stateNode.current;
        let fallbacks = 0;
        let dehydrated = 0;
        const stack = fiber ? [fiber] : [];
        let visited = 0;
        while (stack.length && visited < 50000) {
          const f = stack.pop();
          visited += 1;
          if (f.tag === 22 && f.memoizedState !== null) {
            if (f.sibling) stack.push(f.sibling);
            continue;
          }
          if (f.tag === 13 && f.memoizedState !== null) {
            if (f.memoizedState.dehydrated) dehydrated += 1;
            else fallbacks += 1;
          }
          if (f.sibling) stack.push(f.sibling);
          if (f.child) stack.push(f.child);
        }
        if (fallbacks) out.push(`${fallbacks} part(s) of the page showing their loading state`);
        if (dehydrated) out.push(`${dehydrated} part(s) of the page not hydrated yet`);
      }
      return out;
    });
  } catch (err) {
    // A navigation replaced the document while it was read: not ready yet.
    return /Execution context was destroyed|navigation|Target closed|has been closed/i.test(String(err && err.message)) ? 'a new page is loading' : '';
  }
  const running = runningRequests(world.page);
  if (running.length) {
    busy.push(`${running.length} request(s) running: ${running.slice(0, 3).map((r) => `${r.kind} ${shortUrl(r.url)}`).join(', ')}`);
  }
  return busy.join('; ');
}

/**
 * Why the page is not hydrated yet, or '' when it is: the document is still
 * loading, the app has not started, its root has no fiber yet, or a part the
 * server rendered still waits to be hydrated. The parts of pendingWork that
 * are about hydration only.
 */
async function hydrationProblem(world) {
  const busy = await pendingWork(world);
  return busy.split('; ').filter((part) => /document is still loading|not hydrated yet|has not started yet|router is not ready|new page is loading/.test(part)).join('; ');
}

/**
 * Wait until the page is ready (see the head of this file) and stays so for a
 * moment (150 ms). Returns '' when it is, else what it was still doing when
 * the time ran out; `strict` makes that a failure.
 */
async function pageReady(world, { timeout, strict = false } = {}) {
  const limit = timeout || budget(world) * 2;
  const deadline = Date.now() + limit;
  requests(world.page);
  let busy = '';
  let quietSince = 0;
  for (;;) {
    busy = await pendingWork(world);
    if (!busy) {
      if (!quietSince) quietSince = Date.now();
      if (Date.now() - quietSince >= 150) return '';
    } else {
      quietSince = 0;
    }
    if (Date.now() > deadline) break;
    await world.page.waitForTimeout(40);
  }
  if (strict) {
    throw failure(world, `The page did not get ready within ${limit} ms (${world.page.url()}): ${busy}.`, 'The page is ready when it is loaded and hydrated, no part of it shows a loading state, and no request of the app is running. A request that never ends, or a part that never stops loading, is a fault of the app: check its server and the browser console.');
  }
  return busy;
}

/**
 * Run an action that may make the app work (a click, a key, a form), and wait
 * for that work to finish: for a request, a commit of the router or a new
 * document to start (a moment at most), then for the page to be ready.
 */
async function afterAction(world, fn) {
  const state = requests(world.page);
  const before = Object.values(state.started).reduce((a, b) => a + b, 0) - state.started.prefetch;
  const url = world.page.url();
  const docs = state.documents.length;
  const result = await fn();
  const startBy = Date.now() + 1000;
  while (Date.now() < startBy) {
    const now = Object.values(state.started).reduce((a, b) => a + b, 0) - state.started.prefetch;
    if (now !== before || world.page.url() !== url || state.documents.length !== docs) break;
    await world.page.waitForTimeout(25);
  }
  await world.page.waitForLoadState('domcontentloaded', { timeout: budget(world) }).catch(() => {});
  await pageReady(world);
  return result;
}

/** Open an address of the app and wait for the page to be ready. */
async function open(world, url) {
  requests(world.page);
  await gotoUrl(world.page, siteUrl(world, url));
  await world.page.waitForLoadState('load', { timeout: budget(world) }).catch(() => {});
  await pageReady(world);
}

// ---------------------------------------------------------------------------
// Elements: hydrated, brought into view, clicked the way a person does
// ---------------------------------------------------------------------------

/**
 * Is the element in the hands of the app yet: does it carry React's
 * properties (its event handlers)? An element of a page that no React tree
 * owns counts as ready.
 */
async function elementHydrated(locator) {
  return locator.evaluate((el) => {
    const owned = (node) => !!node && Object.keys(node).some((k) => k.startsWith('__reactProps$') || k.startsWith('__reactFiber$'));
    if (owned(el)) return true;
    // An element no React tree owns at all (none of its ancestors carries a fiber) is plain HTML.
    for (let node = el.parentElement; node; node = node.parentElement) {
      if (owned(node)) return false;
    }
    return !document.querySelector('[id="__next"]') && !(window.next && window.next.appDir);
  }).catch(() => false);
}

/**
 * Wait until the element is attached, visible and hydrated (see
 * elementHydrated); fail with a message that says which of them it is not.
 */
async function waitHydrated(world, locator, label) {
  const deadline = Date.now() + budget(world);
  try {
    await locator.waitFor({ state: 'visible', timeout: budget(world) });
  } catch {
    throw failure(world, `Expected to see ${label}, but it did not appear within ${budget(world)} ms (${world.page.url()}).`, 'Check its words on the page: a link, a button and a field are found by the name a person reads (their text, label or accessible name).');
  }
  while (!(await elementHydrated(locator))) {
    if (Date.now() > deadline) {
      throw failure(world, `${label[0].toUpperCase()}${label.slice(1)} is on the page but the app has not taken it over (it has no React properties) within ${budget(world)} ms: a click now would do what plain HTML does, not what the app does.`, 'The page has not finished hydrating: look for an error in the browser console, or a script that did not load.');
    }
    await world.page.waitForTimeout(40);
  }
}

/**
 * Click an element the way a person does: brought to the middle of the
 * window (a sticky header never covers it), hydrated, then clicked.
 */
async function personClick(world, locator, label) {
  await waitHydrated(world, locator, label);
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' })).catch(() => {});
  await locator.click({ timeout: budget(world) });
}

/**
 * A link by its name (its text or accessible name, exactly, then containing
 * the words), the visible one first.
 */
function linkByName(world, name) {
  const exact = world.page.getByRole('link', { name, exact: true });
  const loose = world.page.getByRole('link', { name });
  return { exact: exact.filter({ visible: true }), loose: loose.filter({ visible: true }) };
}

/** The first locator of a list that has a match, else the last one. */
async function firstPresent(locators) {
  for (const locator of locators) {
    if ((await locator.count().catch(() => 0)) > 0) return locator.first();
  }
  return locators[locators.length - 1].first();
}

/** The names of the visible links of the page, for a failure message. */
async function visibleLinkNames(world) {
  return world.page.evaluate(() => [...document.querySelectorAll('a[href]')]
    .filter((a) => a.offsetWidth || a.offsetHeight)
    .map((a) => (a.getAttribute('aria-label') || a.textContent || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 15)).catch(() => []);
}

// ---------------------------------------------------------------------------
// Answers held back, and a slow network
// ---------------------------------------------------------------------------

/**
 * Hold back the app's answers: every request of the kinds the app waits for
 * (a navigation's payload, a form action, a page's data) is held until
 * releaseAnswers. Prefetches and other requests go through.
 */
async function holdAnswers(world) {
  if (world.__heldAnswers) return world.__heldAnswers;
  const held = { urls: [], open: null, handler: null };
  const gate = new Promise((resolve) => { held.open = resolve; });
  held.handler = async (route) => {
    const kind = kindOf(route.request());
    if (kind !== 'navigation' && kind !== 'action' && kind !== 'data') return route.fallback();
    held.urls.push(route.request().url());
    await gate;
    return route.continue().catch(() => {});
  };
  await world.page.route('**/*', held.handler);
  world.__heldAnswers = held;
  return held;
}

/** Let the answers held back go, and stop holding. */
async function releaseAnswers(world) {
  const held = world.__heldAnswers;
  if (!held) return null;
  world.__heldAnswers = null;
  held.open();
  await world.page.unroute('**/*', held.handler).catch(() => {});
  return held;
}

/**
 * A slow network for the page (Chromium's own network emulation): every
 * answer comes slowly, so the parts the app streams arrive one after the
 * other, as on a slow mobile connection. `false` brings the speed back.
 */
async function slowNetwork(world, on) {
  const browser = world.page.context().browser();
  const name = browser ? browser.browserType().name() : 'chromium';
  if (name !== 'chromium') {
    throw friendly({
      message: `Only Chromium can slow the network of a page; this run uses ${name}.`,
      hint: 'Run this scenario with BROWSER=chromium (the default of the pack).',
    });
  }
  if (!world.__cdp || world.__cdpPage !== world.page) {
    world.__cdp = await world.page.context().newCDPSession(world.page);
    world.__cdpPage = world.page;
    await world.__cdp.send('Network.enable');
  }
  await world.__cdp.send('Network.emulateNetworkConditions', on
    ? { offline: false, latency: 200, downloadThroughput: 6 * 1024, uploadThroughput: 6 * 1024 }
    : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  world.__slowNetwork = !!on;
}

// ---------------------------------------------------------------------------
// The route announcer
// ---------------------------------------------------------------------------

/**
 * The route announcer of the page (the live region the router fills with the
 * title of each new page): whether it is there, and what it says now.
 */
async function announcer(world) {
  return world.page.evaluate(() => {
    const host = document.querySelector('next-route-announcer');
    const inShadow = host && host.shadowRoot ? host.shadowRoot.getElementById('__next-route-announcer__') || host.shadowRoot.querySelector('[aria-live]') : null;
    const region = inShadow || document.getElementById('__next-route-announcer__');
    if (!region) return { present: false, text: '', live: '' };
    return { present: true, text: (region.textContent || '').replace(/\s+/g, ' ').trim(), live: region.getAttribute('aria-live') || '' };
  }).catch(() => ({ present: false, text: '', live: '' }));
}

// ---------------------------------------------------------------------------
// Accounts and the session
// ---------------------------------------------------------------------------

/**
 * An account of the users registry in cucumber.js (`worldParameters.users`),
 * by the handle a scenario names it with: the address (or user name) it logs
 * in with, its password, and its name.
 *
 * @returns {{handle: string, login: string, password: string, email: (string|undefined), name: (string|undefined)}}
 */
function resolveUser(world, handle) {
  const users = (world.parameters && world.parameters.users) || {};
  const entry = users[handle];
  if (!entry) {
    throw friendly({
      message: `The user "${handle}" is not in the users registry. Known users: ${Object.keys(users).join(', ') || '(none)'}.`,
      hint: `Add it to worldParameters.users in cucumber.js: users: { ${handle}: { email: '${handle}@example.com', password: process.env.${String(handle).toUpperCase()}_PASSWORD, name: 'Name' } }. The account itself is created once by the build of the app, never by a feature.`,
    });
  }
  const login = entry.email || entry.username;
  if (!login || !entry.password) {
    throw friendly({
      message: `The user "${handle}" has no ${login ? 'password' : 'email address'} in the users registry.`,
      hint: `Set worldParameters.users.${handle}.email and .password in cucumber.js.`,
    });
  }
  return { handle, login, password: entry.password, email: entry.email, name: entry.name };
}

/** The login page (`worldParameters.loginPath`, /login). */
function loginPath(world) {
  return '/' + String((world.parameters && world.parameters.loginPath) || '/login').replace(/^\/+/, '');
}

/**
 * The address that answers with the session of the browser
 * (`worldParameters.sessionPath`, /api/auth/session, the one of the app's
 * authentication library), or '' when the app has none.
 */
function sessionPath(world) {
  const configured = world.parameters ? world.parameters.sessionPath : undefined;
  if (configured === '' || configured === false) return '';
  return '/' + String(configured || '/api/auth/session').replace(/^\/+/, '');
}

/** The login form: the visible form with a password field. */
function loginForm(world) {
  return world.page.locator('form:has(input[type="password"])').filter({ visible: true }).first();
}

/**
 * Who the app says is signed in: the session address answers with the
 * session of the browser's cookies (`{user: {name, email}}`, or null).
 *
 * @returns {Promise<{known: boolean, user: (object|null), status: number}>}
 */
async function currentSession(world) {
  const path = sessionPath(world);
  if (!path) return { known: false, user: null, status: 0 };
  try {
    const response = await world.page.context().request.get(siteUrl(world, path), { headers: { accept: 'application/json' }, failOnStatusCode: false, maxRedirects: 0 });
    const status = response.status();
    if (status !== 200) return { known: false, user: null, status };
    const body = await response.json().catch(() => undefined);
    if (body === undefined) return { known: false, user: null, status };
    return { known: true, user: body && body.user ? body.user : null, status };
  } catch {
    return { known: false, user: null, status: 0 };
  }
}

const LOGIN_HINT = 'The login form is the visible form with a password field at worldParameters.loginPath (/login). Check launchUrl in cucumber.js, and that the build of the app created the account.';

// The sessions of the accounts that logged in during this run, by app and
// login: the cookies of the browser after a login through the form. A
// scenario that logs in as an account that already has a session takes it
// over instead of filling in the login form again.
// `worldParameters.reuseSessions: false` in cucumber.js turns it off.
const SESSIONS = new Map();

function sessionKey(world, login) {
  return `${siteRoot(world)}|${String(login).toLowerCase()}`;
}

function reuseSessions(world) {
  return !(world.parameters && world.parameters.reuseSessions === false);
}

/**
 * The text of the messages of a form or of the page: live regions (the
 * places an app announces what happened), alerts and status messages, the
 * route announcer left out.
 */
async function formMessages(world, scope) {
  const root = scope || world.page.locator('body');
  return root.evaluate((el) => {
    const nodes = [...el.querySelectorAll('[aria-live], [role="alert"], [role="status"]')]
      .filter((n) => !n.closest('next-route-announcer') && n.id !== '__next-route-announcer__');
    return nodes.map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  }).catch(() => []);
}

/**
 * Open the login page as a new visitor: the page the browser showed is left
 * first, then the cookies of the browser are cleared.
 */
async function openLoginForm(world) {
  await world.page.goto('about:blank').catch(() => {});
  await world.page.context().clearCookies();
  world.__sessionKey = null;
  await open(world, loginPath(world));
  try {
    await loginForm(world).waitFor({ state: 'visible', timeout: budget(world) });
  } catch {
    throw failure(world, `The login form did not appear at ${siteUrl(world, loginPath(world))} (${world.page.url()}).`, LOGIN_HINT);
  }
}

/**
 * Fill in and send the login form, and read its outcome: the page the app
 * sends a signed-in account to, or the message of the login form.
 *
 * @returns {Promise<{error: string, cut: (boolean|undefined)}>}
 */
async function submitLogin(world, login, password) {
  await openLoginForm(world);
  const form = loginForm(world);
  const field = form.locator('input[type="email"], input[name="email"], input[name="username"], input[autocomplete="username"], input[type="text"]').first();
  await waitHydrated(world, field, 'the address field of the login form');
  await field.fill(login);
  await form.locator('input[type="password"]').first().fill(password);
  const submit = form.locator('button[type="submit"], input[type="submit"], button:not([type])').first();
  await afterAction(world, () => personClick(world, submit, 'the button of the login form'));
  if (cutRequest(world)) return { error: cutRequest(world), cut: true };
  if (currentPath(world) !== pathOf(loginPath(world))) return { error: '' };
  const messages = await formMessages(world, loginForm(world));
  return { error: messages.join(' ') || `the login page came back with no message (${world.page.url()})` };
}

/** Take over the session an account opened earlier in this run. */
async function restoreSession(world, user) {
  const key = sessionKey(world, user.login);
  const saved = SESSIONS.get(key);
  if (!saved || !reuseSessions(world)) return false;
  const context = world.page.context();
  await world.page.goto('about:blank').catch(() => {});
  await context.clearCookies();
  await context.addCookies(saved.cookies);
  const session = await currentSession(world);
  if (!session.known || (session.user && same(session.user.email || '', user.email || user.login))) {
    world.__sessionKey = key;
    world.__signedInAs = user.handle;
    // The browser ends on a page of the app, as after a login through the form: its front page,
    // which an app sends a signed-in account on from (the dashboard of the test app).
    await open(world, '/');
    return true;
  }
  // The session ended since (a logout, an expiry): log in again.
  SESSIONS.delete(key);
  await context.clearCookies();
  return false;
}

/**
 * Log in as an account of the users registry, by its handle: take over its
 * session when it has one from earlier in the run, else log in through the
 * form and keep the session for the next scenario.
 */
async function logInAs(world, handle) {
  const user = resolveUser(world, handle);
  if (await restoreSession(world, user)) return user;
  let outcome = await submitLogin(world, user.login, user.password);
  if (outcome.error && outcome.cut) outcome = await submitLogin(world, user.login, user.password);
  if (outcome.error) {
    throw friendly({
      message: `Could not log in as "${handle}" (${user.login}): ${outcome.error}`,
      hint: outcome.cut ? CUT_REQUEST_HINT : 'Check the address and the password of the account in worldParameters.users, and that the build of the app created the account.',
    });
  }
  if (reuseSessions(world)) {
    const key = sessionKey(world, user.login);
    SESSIONS.set(key, { cookies: await world.page.context().cookies() });
    world.__sessionKey = key;
  }
  world.__signedInAs = handle;
  return user;
}

/** Forget the session of the browser in the session cache: it ended (a logout). */
function forgetSession(world) {
  if (world.__sessionKey) SESSIONS.delete(world.__sessionKey);
  world.__sessionKey = null;
  world.__signedInAs = null;
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/**
 * An image by its alternative text: the exact text first, then an image whose
 * text has the words as whole words; the visible one first.
 */
async function imageByAlt(world, alt) {
  const exact = world.page.locator(`img[alt="${String(alt).replace(/"/g, '\\"')}"]`);
  // The words of the text as whole words: "logo" finds "Company logo", not "logomark".
  const loose = world.page.getByRole('img', { name: new RegExp(`(^|\\W)${escapeRegExp(alt)}($|\\W)`, 'i') });
  const visibleExact = exact.filter({ visible: true });
  return firstPresent([visibleExact, exact, loose.filter({ visible: true }), loose]);
}

/** The images of the page by their alternative text, for a failure message. */
async function imageNames(world) {
  return world.page.evaluate(() => [...document.images].map((img) => img.alt).filter(Boolean).slice(0, 15)).catch(() => []);
}

/** What the page says of an image: how it loads, where from, and whether it has. */
async function imageInfo(locator) {
  return locator.evaluate((img) => ({
    alt: img.alt,
    loading: img.getAttribute('loading') || '',
    decoding: img.getAttribute('decoding') || '',
    fetchPriority: img.getAttribute('fetchpriority') || '',
    component: img.hasAttribute('data-nimg'),
    src: img.getAttribute('src') || '',
    srcset: img.getAttribute('srcset') || '',
    currentSrc: img.currentSrc || '',
    complete: img.complete,
    naturalWidth: img.naturalWidth,
    visible: !!(img.offsetWidth || img.offsetHeight),
    preloaded: [...document.querySelectorAll('link[rel="preload"][as="image"]')].some((link) => {
      const href = link.getAttribute('href') || '';
      const set = link.getAttribute('imagesrcset') || '';
      const src = img.getAttribute('src') || '';
      return (href && (href === src || img.currentSrc.endsWith(href))) || (set && set === (img.getAttribute('srcset') || ''));
    }),
  }));
}

/** An image whose address goes through the image optimizer of the app. */
function optimizedAddress(url) {
  return /\/_next\/image\?/.test(String(url || ''));
}

// ---------------------------------------------------------------------------
// The development error overlay
// ---------------------------------------------------------------------------

/**
 * What the development tools of the page show: whether they are on the page
 * at all (only the development server puts them there), the indicator, and
 * the error overlay (its title, its message and how many errors it lists).
 */
async function devOverlay(world) {
  return world.page.evaluate(() => {
    const host = document.querySelector('nextjs-portal');
    const root = host && host.shadowRoot;
    if (!root) return { present: false, indicator: false, open: false, label: '', message: '', count: 0, text: '' };
    const dialog = root.querySelector('[data-nextjs-dialog], [role="dialog"][aria-labelledby="nextjs__container_errors_label"]');
    const label = root.getElementById('nextjs__container_errors_label');
    const desc = root.getElementById('nextjs__container_errors_desc');
    const total = root.querySelector('[data-nextjs-dialog-header-total-count]');
    const indicator = root.querySelector('[data-nextjs-dev-tools-button], #devtools-indicator, [data-nextjs-toast]');
    const text = dialog ? (dialog.textContent || '').replace(/\s+/g, ' ').trim() : '';
    return {
      present: true,
      indicator: !!indicator,
      open: !!dialog,
      label: label ? label.textContent.replace(/\s+/g, ' ').trim() : '',
      message: desc ? desc.textContent.replace(/\s+/g, ' ').trim() : '',
      count: total ? parseInt(total.textContent, 10) || (dialog ? 1 : 0) : (dialog ? 1 : 0),
      text,
    };
  }).catch(() => ({ present: false, indicator: false, open: false, label: '', message: '', count: 0, text: '' }));
}

/**
 * Poll a reading until it satisfies a check, or fail with the last reading.
 *
 * @param {object} world
 * @param {Function} read - async () => value
 * @param {Function} check - (value) => boolean
 * @param {Function} explain - (value) => {message, hint}
 */
async function eventually(world, read, check, explain, timeout) {
  const deadline = Date.now() + (timeout || budget(world));
  let value;
  for (;;) {
    value = await read();
    if (check(value)) return value;
    if (Date.now() > deadline) {
      const why = explain(value);
      throw failure(world, why.message, why.hint);
    }
    await world.page.waitForTimeout(100);
  }
}

module.exports = {
  budget,
  escapeRegExp,
  clean,
  same,
  listed,
  siteRoot,
  siteUrl,
  currentPath,
  currentAddress,
  pathOf,
  shortUrl,
  cutRequest,
  CUT_REQUEST_HINT,
  failure,
  kindOf,
  requests,
  runningRequests,
  lastDocumentStatus,
  consoleOf,
  hydrationErrors,
  serverRenderErrors,
  documentScript,
  documentId,
  appInfo,
  pendingWork,
  hydrationProblem,
  pageReady,
  afterAction,
  open,
  elementHydrated,
  waitHydrated,
  personClick,
  linkByName,
  firstPresent,
  visibleLinkNames,
  holdAnswers,
  releaseAnswers,
  slowNetwork,
  announcer,
  resolveUser,
  loginPath,
  sessionPath,
  loginForm,
  currentSession,
  LOGIN_HINT,
  SESSIONS,
  reuseSessions,
  formMessages,
  openLoginForm,
  submitLogin,
  restoreSession,
  logInAs,
  forgetSession,
  imageByAlt,
  imageNames,
  imageInfo,
  optimizedAddress,
  devOverlay,
  eventually,
};
