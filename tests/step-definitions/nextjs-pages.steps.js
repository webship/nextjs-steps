'use strict';

// The page as the framework serves it: the wait for the page to be ready,
// hydration and its errors, the production build, the router that serves the
// page, the release it runs on, and pages prerendered or rendered for each
// request.
//
// This file also puts the recorders on every page of the run (see
// nextjs-helpers.js): the identity of each document and the commits of the
// router, the requests of the app by kind, and the errors of the console.

const { Then, When } = require('@cucumber/cucumber');
const { onNewPage } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  failure,
  listed,
  requests,
  consoleOf,
  hydrationErrors,
  documentScript,
  appInfo,
  hydrationProblem,
  pageReady,
  eventually,
} = require('./nextjs-helpers');

onNewPage(async (world, page) => {
  await page.addInitScript(documentScript);
  // The requests and the console of a page are kept from the moment it opens.
  requests(page);
  consoleOf(page);
});

/**
 * Wait until the page is ready: loaded and hydrated, no part of it showing a
 * loading state, and no request of the app running (see nextjs-helpers.js).
 * Fails with what the page was still doing when the time ran out.
 *
 * Example #1: When I wait for the page to be ready
 * Example #2: And I wait for the page to be ready
 * Example #3: When we wait for the page to be ready
 * Example #4: Then I wait for the page to be ready
 * Example #5: Given we wait for the page to be ready
 */
When(/^(I |we )*wait for the page to be ready$/, { timeout: 60000 }, async function (pronounCase) {
  await pageReady(this, { strict: true });
});

/**
 * The page has hydrated: the app took over the HTML the server sent (its root
 * carries React's fiber) and no part of it is still waiting to be hydrated.
 * With "not", the page shows only the server's HTML.
 *
 * Example #1: Then I should see a hydrated page
 * Example #2: And we should see a hydrated page
 * Example #3: Then I should not see a hydrated page
 * Example #4: And I should see a hydrated page
 * Example #5: Then we should not see a hydrated page
 */
Then(/^(I |we )*should( not)* see a hydrated page$/, async function (pronounCase, notCase) {
  const hydrated = async () => !(await hydrationProblem(this));
  if (notCase) {
    if (await hydrated()) {
      throw failure(this, `Expected the page not to be hydrated, but the app has taken it over (${this.page.url()}).`, 'A page shows only its server HTML when JavaScript is off or its scripts did not load.');
    }
    return;
  }
  await eventually(this, hydrated, (ok) => ok, () => ({
    message: `Expected a hydrated page, but the app did not take over the page within ${budget(this)} ms (${this.page.url()}).`,
    hint: 'Look at the browser console for an error, and check that the scripts of the page (/_next/static/…) load.',
  }));
});

/**
 * No hydration error on this page: the HTML of the server and the first render
 * in the browser were the same (React reports a mismatch in the console: in
 * words in development, as the errors #418, #423 and #425 in production).
 *
 * Example #1: Then there should be no hydration errors
 * Example #2: And there should be no hydration errors
 * Example #3: Then there should be hydration errors
 * Example #4: But there should be no hydration errors
 * Example #5: Then there should be no hydration errors
 */
Then(/^there should be (no )?hydration errors$/, async function (noCase) {
  await pageReady(this);
  const errors = hydrationErrors(this.page);
  if (noCase && errors.length) {
    throw failure(this, `Expected no hydration errors, but the console reported ${errors.length}: ${listed(errors.map((e) => e.slice(0, 160)))}.`, 'The server rendered something the browser renders differently: a date, a random value, or a check of window or localStorage during render.');
  }
  if (!noCase && !errors.length) {
    throw failure(this, `Expected hydration errors, but the console reported none (${this.page.url()}).`, 'Hydration errors appear in the console of the page while it hydrates.');
  }
});

/**
 * The app is served as a production build: no development tools on the page,
 * no development server behind it. With "not", it is the development server.
 *
 * Example #1: Then the site should be served as a production build
 * Example #2: And the site should be a production build
 * Example #3: Then the site should not be served as a production build
 * Example #4: Then site should be served as a production build
 * Example #5: And the site should not be a production build
 */
Then(/^(?:the )?site should( not)* be (?:served as )?a production build$/, async function (notCase) {
  await pageReady(this);
  const info = await appInfo(this);
  if (!info.router) {
    throw failure(this, `Expected a page of the app, but this page is not served by the framework (${this.page.url()}).`, 'Open a page of the app first; the steps read what the framework puts on every page.');
  }
  if (!notCase && info.development) {
    throw failure(this, `Expected a production build, but the development server serves this page (its development tools are on it) at ${this.page.url()}.`, 'Serve the app with `next build` then `next start`, not `next dev`.');
  }
  if (notCase && !info.development) {
    throw failure(this, `Expected the development server, but a production build serves this page (${this.page.url()}).`, 'Serve the app with `next dev` to see its development tools.');
  }
});

/**
 * The router that serves the page: the App Router (the app/ folder) or the
 * Pages Router (the pages/ folder).
 *
 * Example #1: Then the page should be served by the app router
 * Example #2: Then the page should be served by the pages router
 * Example #3: And page should be served by the app router
 * Example #4: And the page should be served by the pages router
 * Example #5: Then the page should be served by the app router
 */
Then(/^(?:the )?page should be served by the (app|pages) router$/, async function (router) {
  await pageReady(this);
  const info = await appInfo(this);
  if (info.router !== router) {
    throw failure(this, `Expected the ${router} router to serve ${this.page.url()}, but ${info.router ? `the ${info.router} router does` : 'the framework does not serve this page'}.`, 'The App Router serves the routes of the app/ folder; the Pages Router those of the pages/ folder.');
  }
});

/**
 * The release of the framework the page runs on: "16" for any 16.x release,
 * "16.4" for any 16.4.x, "16.4.6" for exactly that one.
 *
 * Example #1: Then the page should run on the release "16"
 * Example #2: And the page should run on the release "16.4.6"
 * Example #3: Then the page should not run on the release "14"
 * Example #4: Then page should run on the release "15.5"
 * Example #5: And the page should run on the release "16.4"
 */
Then(/^(?:the )?page should( not)* run on the release "([^"]*)"$/, async function (notCase, release) {
  await pageReady(this);
  const info = await appInfo(this);
  const matches = !!info.version && (info.version === release || info.version.startsWith(`${release}.`));
  if (!notCase && !matches) {
    throw failure(this, `Expected the page to run on the release ${release}, but it runs on ${info.version || 'no release the page says'} (${this.page.url()}).`, 'The page says its release in window.next.version.');
  }
  if (notCase && matches) {
    throw failure(this, `Expected the page not to run on the release ${release}, but it runs on ${info.version}.`, 'The page says its release in window.next.version.');
  }
});

/**
 * Whether the server sends the page from what it prerendered (at build time or
 * by revalidation) or renders it for each request: the headers of its answer
 * (x-nextjs-prerender, x-nextjs-cache, a shared cache time in Cache-Control)
 * and, for the Pages Router, the page's own data (a page optimized to static
 * HTML, or one with getStaticProps; getServerSideProps renders for each
 * request).
 *
 * Example #1: Then the page should be prerendered
 * Example #2: Then the page should not be prerendered
 * Example #3: And the page should be prerendered
 * Example #4: And page should not be prerendered
 * Example #5: Then the page should be prerendered
 */
Then(/^(?:the )?page should( not)* be prerendered$/, async function (notCase) {
  await pageReady(this);
  const url = this.page.url();
  let headers = {};
  let status = 0;
  let body = '';
  try {
    const response = await this.page.context().request.get(url, { failOnStatusCode: false, maxRedirects: 0 });
    headers = response.headers();
    status = response.status();
    body = await response.text().catch(() => '');
  } catch (err) {
    throw failure(this, `Could not ask the server for ${url} again: ${err.message}`, 'The step reads the headers of the page\'s answer.');
  }
  let data = null;
  const script = body.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (script) {
    try { data = JSON.parse(script[1]); } catch { data = null; }
  }
  const fromHeaders = /^1\b/.test(headers['x-nextjs-prerender'] || '') || /^(HIT|STALE|PRERENDER)/i.test(headers['x-nextjs-cache'] || '') || /s-maxage=\d+/.test(headers['cache-control'] || '');
  const fromData = !!data && !data.gssp && !!(data.autoExport || data.nextExport || data.gsp);
  const prerendered = fromHeaders || fromData;
  const seen = `status ${status}, x-nextjs-prerender: ${headers['x-nextjs-prerender'] || '(none)'}, x-nextjs-cache: ${headers['x-nextjs-cache'] || '(none)'}, cache-control: ${headers['cache-control'] || '(none)'}${data ? `, page data: ${['autoExport', 'gsp', 'gssp'].filter((k) => data[k]).join(', ') || 'none of autoExport, gsp, gssp'}` : ''}`;
  if (!notCase && !prerendered) {
    throw failure(this, `Expected ${url} to be prerendered, but the server rendered it for this request (${seen}).`, 'A page that reads cookies, headers or the search parameters, or that opts out of caching, is rendered for each request (getServerSideProps in the Pages Router). A development server prerenders nothing.');
  }
  if (notCase && prerendered) {
    throw failure(this, `Expected ${url} to be rendered for each request, but the server sent what it prerendered (${seen}).`, 'A page with no dynamic input is prerendered at build time.');
  }
});
