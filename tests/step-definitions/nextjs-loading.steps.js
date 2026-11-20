'use strict';

// Streaming and loading states: the parts of a page that show their loading
// state while the server streams their content, a slow network that makes
// them visible, answers of the app held back to see what a page does while it
// waits (a pending navigation, a pending form), and a page load that does not
// wait for the end of the stream.

const { After, Given, Then, When } = require('@cucumber/cucumber');
const { gotoUrl } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  failure,
  shortUrl,
  siteUrl,
  pendingWork,
  pageReady,
  runningRequests,
  holdAnswers,
  releaseAnswers,
  slowNetwork,
  eventually,
} = require('./nextjs-helpers');

// Answers held back at the end of a scenario are let go, so the browser can close.
After(async function () {
  if (this.__heldAnswers) await releaseAnswers(this).catch(() => {});
});

/** The parts of the page that show their loading state, as pendingWork reports them. */
async function loadingParts(world) {
  const busy = await pendingWork(world);
  return busy.split('; ').filter((part) => /showing their loading state|still waiting for their content/.test(part));
}

/**
 * A slow network for the page, as on a slow mobile connection: every answer
 * comes slowly, so the parts the app streams arrive one after the other and
 * their loading states stay on the screen long enough to be seen. Chromium
 * only (its own network emulation). "is no longer slow" brings the speed back.
 *
 * Example #1: Given the network is slow
 * Example #2: And the network is slow
 * Example #3: When the network is no longer slow
 * Example #4: Given network is slow
 * Example #5: And the network is no longer slow
 */
Given(/^(?:the )?network is (no longer )?slow$/, async function (noLonger) {
  await slowNetwork(this, !noLonger);
});

/**
 * Start loading a page of the app and return as soon as the server starts to
 * answer, without waiting for the page to load: for the scenarios that look
 * at a page while its parts still stream in (a slow network shows them).
 *
 * Example #1: When I start to go to "/dashboard/invoices"
 * Example #2: And we start to go to "/dashboard"
 * Example #3: When I start to go to "/dashboard/customers"
 * Example #4: When I start to go to "/"
 * Example #5: And I start to go to "/dashboard/invoices?page=2"
 */
When(/^(I |we )*start to go to "([^"]*)?"$/, { timeout: 60000 }, async function (pronounCase, path) {
  const url = siteUrl(this, path);
  try {
    await this.page.goto(url, { waitUntil: 'commit', timeout: budget(this) * 2 });
  } catch (err) {
    if (!/ERR_NETWORK_CHANGED/.test(String(err && err.message))) throw failure(this, `Could not start to load ${url}: ${err.message}`, 'Check launchUrl in cucumber.js and that the app answers.');
    await gotoUrl(this.page, url);
  }
});

/**
 * Whether a part of the page shows its loading state: a part the server
 * streamed that still waits for its content (the HTML's own markers), or a
 * Suspense boundary of the app showing its fallback (a skeleton, a spinner, a
 * loading.js page). "a part … should show" waits for one to appear; "no part
 * … should show" waits for every one to be replaced by its content.
 *
 * Example #1: Then a part of the page should show its loading state
 * Example #2: Then no part of the page should show its loading state
 * Example #3: And a part of the page should show its loading state
 * Example #4: And no part of the page should show its loading state
 * Example #5: But no part of the page should show its loading state
 */
Then(/^(a|no) part of the page should show its loading state$/, { timeout: 60000 }, async function (which) {
  if (which === 'a') {
    await eventually(this, () => loadingParts(this), (parts) => parts.length > 0, () => ({
      message: `Expected a part of the page to show its loading state, but none did within ${budget(this)} ms (${this.page.url()}).`,
      hint: 'A part shows its loading state only while its content is on the way: on a fast network it can be over before the step looks. Slow the network down first ("Given the network is slow"), or hold the app\'s answers back.',
    }), budget(this) * 2);
    return;
  }
  await eventually(this, () => loadingParts(this), (parts) => parts.length === 0, (parts) => ({
    message: `Expected no part of the page to show its loading state, but ${parts.join('; ')} after ${budget(this) * 3} ms (${this.page.url()}).`,
    hint: 'A part stays in its loading state while the server has not sent its content: a slow query, an answer held back, or an error on the server (look at the server log).',
  }), budget(this) * 3);
});

/**
 * Hold back the app's answers from here on: the payload of a navigation, a
 * form action and the data of a page wait until "the server's answers come
 * through". For the scenarios that look at what a page shows while it waits:
 * the page it keeps, a form that says it is busy.
 *
 * Example #1: Given the server's answers are held back
 * Example #2: And the server's answers are held back
 * Example #3: When the server's answers are held back
 * Example #4: Given server's answers are held back
 * Example #5: And the server's answers are held back
 */
Given(/^(?:the )?server's answers are held back$/, async function () {
  await holdAnswers(this);
});

/**
 * Let the answers held back go, and wait for the page to be ready with them.
 *
 * Example #1: When the server's answers come through
 * Example #2: And the server's answers come through
 * Example #3: Then the server's answers come through
 * Example #4: When server's answers come through
 * Example #5: And the server's answers come through
 */
When(/^(?:the )?server's answers come through$/, { timeout: 60000 }, async function () {
  const held = await releaseAnswers(this);
  if (!held) {
    throw failure(this, 'Expected answers of the server held back, but none were: "Given the server\'s answers are held back" comes first.', 'Hold the answers back before the action whose answer the scenario waits for.');
  }
  await pageReady(this, { strict: true });
});

/**
 * Whether the page waits for the server: a request it needs is on the way (a
 * navigation's payload, a form action, a page's data, a request of the app).
 * "should be" waits for one to start; "should not be" for every one to end.
 *
 * Example #1: Then the page should be waiting for the server
 * Example #2: And the page should be waiting for the server
 * Example #3: Then the page should not be waiting for the server
 * Example #4: Then page should be waiting for the server
 * Example #5: And the page should not be waiting for the server
 */
Then(/^(?:the )?page should( not)* be waiting for the server$/, { timeout: 60000 }, async function (notCase) {
  if (notCase) {
    await eventually(this, () => runningRequests(this.page), (running) => running.length === 0, (running) => ({
      message: `Expected the page not to wait for the server, but ${running.length} request(s) still run: ${running.slice(0, 3).map((r) => `${r.kind} ${shortUrl(r.url)}`).join(', ')}.`,
      hint: this.__heldAnswers ? 'The answers are held back: "When the server\'s answers come through" lets them go.' : 'A request that never ends is a fault of the app or of its server.',
    }), budget(this) * 2);
    return;
  }
  await eventually(this, () => runningRequests(this.page), (running) => running.some((r) => r.kind !== 'background'), () => ({
    message: `Expected the page to wait for the server, but no request of a navigation, a form or a page's data is on the way (${this.page.url()}).`,
    hint: this.__heldAnswers ? 'The action before this step sent no request: a page the router had fetched ahead of the click shows at once.' : 'Hold the answers back first ("Given the server\'s answers are held back"): on a local app the answer comes before the step looks.',
  }));
});

/**
 * Wait until the page is ready; the alias a scenario reads after a page that
 * streams, where "finished loading" is what a person says.
 *
 * Example #1: When I wait for the page to finish loading
 * Example #2: And we wait for the page to finish loading
 * Example #3: Then I wait for the page to finish loading
 * Example #4: When we wait for the page to finish loading
 * Example #5: And I wait for the page to finish loading
 */
When(/^(I |we )*wait for the page to finish loading$/, { timeout: 120000 }, async function (pronounCase) {
  await pageReady(this, { strict: true, timeout: budget(this) * 6 });
});
