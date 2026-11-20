'use strict';

// The pages an app shows when something is missing or fails: the not-found
// page (the app's own or the framework's default one), the error page an
// error boundary shows, the details of an error a production build keeps to
// itself, and the error overlay and tools of the development server.

const { Then } = require('@cucumber/cucumber');
const {
  budget,
  failure,
  shortUrl,
  requests,
  lastDocumentStatus,
  serverRenderErrors,
  consoleOf,
  appInfo,
  pageReady,
  devOverlay,
  eventually,
} = require('./nextjs-helpers');

/**
 * What the page says about being a not-found page: the status of its
 * document (or of the payload of the client-side navigation that showed it),
 * the robots "noindex" the framework adds to it, and the framework's default
 * page (its "404" heading and "This page could not be found.").
 */
async function notFoundState(world) {
  const state = requests(world.page);
  const here = world.page.url();
  const answer = [...state.answers].reverse().find((a) => a.kind === 'navigation' || a.kind === 'data');
  const navigationStatus = answer && answer.at > ((state.documents[state.documents.length - 1] || {}).at || 0) ? answer.status : 0;
  const page = await world.page.evaluate(() => {
    const robots = [...document.querySelectorAll('meta[name="robots"]')].map((m) => m.getAttribute('content') || '').join(' ');
    const h1 = document.querySelector('.next-error-h1');
    return {
      noindex: /noindex/i.test(robots),
      defaultPage: !!h1 && h1.textContent.trim() === '404' && /This page could not be found/i.test(document.body.textContent || ''),
    };
  }).catch(() => ({ noindex: false, defaultPage: false }));
  return { status: lastDocumentStatus(world.page), navigationStatus, here, ...page };
}

/**
 * The page is a not-found page: its document answered 404 (or, after a
 * client-side navigation, the payload of the new page did), or the page
 * carries the "noindex" and the default heading the framework gives a page it
 * cannot find. Error pages carry @js-off in a feature: the browser logs
 * "Failed to load resource" for the 404.
 *
 * Example #1: Then I should be on a 404 page
 * Example #2: And we should be on a 404 page
 * Example #3: Then I should not be on a 404 page
 * Example #4: And I should be on a 404 page
 * Example #5: Then we should not be on a 404 page
 */
Then(/^(I |we )*should( not)* be on a 404 page$/, async function (pronounCase, notCase) {
  await pageReady(this);
  const s = await notFoundState(this);
  const notFound = s.status === 404 || s.navigationStatus === 404 || (s.noindex && s.defaultPage);
  if (!notCase && !notFound) {
    throw failure(this, `Expected a 404 page, but ${shortUrl(s.here)} answered ${s.status || 'with no status the browser kept'}${s.navigationStatus ? ` (its payload ${s.navigationStatus})` : ''} and is not marked "noindex".`, 'An address the app has no route for, or a page that calls notFound(), answers 404 with its not-found page.');
  }
  if (notCase && notFound) {
    throw failure(this, `Expected a page that exists, but ${shortUrl(s.here)} is a 404 page (status ${s.status || s.navigationStatus}).`, 'Check the address, and that the record the page shows exists.');
  }
});

/**
 * The page is the framework's own not-found page (the app has no
 * not-found page of its own for this address): the heading "404" and "This
 * page could not be found.".
 *
 * Example #1: Then I should be on the default 404 page
 * Example #2: And we should be on the default 404 page
 * Example #3: Then I should not be on the default 404 page
 * Example #4: And I should be on the default 404 page
 * Example #5: Then we should not be on the default 404 page
 */
Then(/^(I |we )*should( not)* be on the default 404 page$/, async function (pronounCase, notCase) {
  await pageReady(this);
  const s = await notFoundState(this);
  if (!notCase && !s.defaultPage) {
    throw failure(this, `Expected the framework's default 404 page, but ${shortUrl(s.here)} shows ${s.status === 404 || s.noindex ? 'a not-found page of the app' : 'a page that is not a not-found page'}.`, 'The default page is the heading "404" (.next-error-h1) and "This page could not be found."; an app with its own not-found.js (or 404.js) shows that instead.');
  }
  if (notCase && s.defaultPage) {
    throw failure(this, `Expected a not-found page of the app's own, but ${shortUrl(s.here)} shows the framework's default 404 page.`, 'A not-found.js in the app folder (or pages/404.js) replaces the default page.');
  }
});

/**
 * The page shows the error page of an error boundary with the given words,
 * and an error did happen: the document answered with a server error, the
 * console reported the production error of a failed server render, a request
 * of the page failed on the server, or the page raised an error. With "not",
 * the words are not on the page. Error pages carry @js-off in a feature.
 *
 * Example #1: Then the error page should show "Something went wrong!"
 * Example #2: And the error page should show "Try again"
 * Example #3: Then the error page should not show "Something went wrong!"
 * Example #4: Then error page should show "Something went wrong!"
 * Example #5: And the error page should not show "Application error"
 */
Then(/^(?:the )?error page should( not)* show "([^"]*)?"$/, async function (notCase, text) {
  await pageReady(this);
  const visible = () => this.page.getByText(text, { exact: false }).filter({ visible: true }).count().then((n) => n > 0).catch(() => false);
  if (notCase) {
    if (await visible()) {
      throw failure(this, `Expected no error page with "${text}", but the page shows it (${shortUrl(this.page.url())}).`, 'An error boundary shows its page when a part of the page fails to render.');
    }
    return;
  }
  await eventually(this, visible, (ok) => ok, () => ({
    message: `Expected the error page to show "${text}", but it is not on the page (${shortUrl(this.page.url())}).`,
    hint: 'The words are those of the app\'s error.js (or the framework\'s default "Application error" page).',
  }));
  const status = lastDocumentStatus(this.page);
  const state = requests(this.page);
  const failedAnswers = state.answers.filter((a) => a.status >= 500);
  const rendered = serverRenderErrors(this.page);
  const raised = consoleOf(this.page).filter((e) => e.type === 'pageerror');
  if (status < 500 && !failedAnswers.length && !rendered.length && !raised.length) {
    throw failure(this, `The page shows "${text}", but nothing on it failed: the document answered ${status || 'with no status'}, no request failed on the server and the console reported no error.`, 'The words are on the page without an error behind them: the step expects the error page of an error that happened.');
  }
});

/**
 * Whether the page shows the details of an error to the visitor: a stack
 * trace, or the error overlay of the development server. A production build
 * keeps them to itself (the page and the console get a digest instead).
 *
 * Example #1: Then the page should not show the details of the error
 * Example #2: And the page should not show the details of the error
 * Example #3: Then the page should show the details of the error
 * Example #4: Then page should not show the details of the error
 * Example #5: And the page should show the details of the error
 */
Then(/^(?:the )?page should( not)* show the details of the error$/, async function (notCase) {
  await pageReady(this);
  const read = async () => {
    const overlay = await devOverlay(this);
    const stack = await this.page.evaluate(() => {
      const text = document.body ? document.body.innerText || '' : '';
      const m = text.match(/^\s+at .+\(?.+:\d+:\d+\)?$/m) || text.match(/\b[\w./-]+\.(?:js|ts|tsx|jsx):\d+:\d+\b/);
      return m ? m[0].trim().slice(0, 120) : '';
    }).catch(() => '');
    return { overlay: overlay.open ? `the development error overlay ("${overlay.label}: ${overlay.message.slice(0, 80)}")` : '', stack };
  };
  if (notCase) {
    const seen = await read();
    if (seen.overlay || seen.stack) {
      throw failure(this, `Expected the page to keep the details of the error to itself, but it shows ${seen.overlay || `a stack trace ("${seen.stack}")`}.`, 'A production build shows the error page and keeps the message and the stack on the server; the development server shows them on purpose.');
    }
    return;
  }
  await eventually(this, read, (seen) => !!(seen.overlay || seen.stack), () => ({
    message: `Expected the page to show the details of the error, but it shows neither a stack trace nor the development error overlay (${shortUrl(this.page.url())}).`,
    hint: 'Only the development server shows the details of an error.',
  }));
});

/**
 * Whether the development server's error overlay is shown over the page (a
 * dialog of the development tools). A production build never shows it.
 *
 * Example #1: Then the development error overlay should be shown
 * Example #2: Then the development error overlay should not be shown
 * Example #3: And the development error overlay should be shown
 * Example #4: And development error overlay should not be shown
 * Example #5: Then the development error overlay should not be shown
 */
Then(/^(?:the )?development error overlay should( not)* be shown$/, async function (notCase) {
  if (notCase) {
    await pageReady(this);
    const overlay = await devOverlay(this);
    if (overlay.open) {
      throw failure(this, `Expected no development error overlay, but it shows "${overlay.label}: ${overlay.message.slice(0, 120)}" (${overlay.count} error(s)).`, 'The overlay shows an error of the page or of its server render: read it, or look at the console.');
    }
    return;
  }
  const info = await appInfo(this);
  await eventually(this, () => devOverlay(this), (o) => o.open, (o) => ({
    message: `Expected the development error overlay, but ${o.present ? 'the development tools show no error' : 'the page has no development tools'} (${shortUrl(this.page.url())}).`,
    hint: info.development || o.present ? 'The overlay opens for an error of the page or of its server render.' : 'Only the development server (next dev) shows it: a production build has no development tools.',
  }), budget(this) * 2);
});

/**
 * The words of the development error overlay: its title (the kind of error)
 * and its message contain them.
 *
 * Example #1: Then the development error overlay should show "invalid input syntax for type uuid"
 * Example #2: And the development error overlay should show "PostgresError"
 * Example #3: Then development error overlay should show "Failed to fetch invoice."
 * Example #4: And the development error overlay should show "Server"
 * Example #5: Then the development error overlay should show "invalid input syntax"
 */
Then(/^(?:the )?development error overlay should show "([^"]*)?"$/, async function (text) {
  await eventually(this, () => devOverlay(this), (o) => o.open && o.text.toLowerCase().includes(String(text).toLowerCase()), (o) => ({
    message: o.open
      ? `Expected the development error overlay to show "${text}", but it shows "${o.label}: ${o.message.slice(0, 160)}".`
      : `Expected the development error overlay to show "${text}", but no overlay is shown (${shortUrl(this.page.url())}).`,
    hint: 'The overlay shows one error at a time; its header counts them.',
  }), budget(this) * 2);
});

/**
 * How many errors the development error overlay lists (the count in its
 * header).
 *
 * Example #1: Then the development error overlay should list 2 errors
 * Example #2: And the development error overlay should list 1 error
 * Example #3: Then development error overlay should list 3 errors
 * Example #4: And the development error overlay should list 2 errors
 * Example #5: Then the development error overlay should list 1 error
 */
Then(/^(?:the )?development error overlay should list (\d+) errors?$/, async function (count) {
  const wanted = Number(count);
  await eventually(this, () => devOverlay(this), (o) => o.open && o.count === wanted, (o) => ({
    message: o.open ? `Expected the development error overlay to list ${wanted} error(s), but it lists ${o.count}.` : `Expected the development error overlay to list ${wanted} error(s), but no overlay is shown.`,
    hint: 'The overlay counts the errors of the page and of its server render; one failure can log more than one.',
  }), budget(this) * 2);
});

/**
 * Whether the development tools of the development server are on the page
 * (their indicator in a corner). A production build has none.
 *
 * Example #1: Then the development tools should be on the page
 * Example #2: Then the development tools should not be on the page
 * Example #3: And the development tools should not be on the page
 * Example #4: And development tools should be on the page
 * Example #5: Then the development tools should not be on the page
 */
Then(/^(?:the )?development tools should( not)* be on the page$/, async function (notCase) {
  await pageReady(this);
  if (notCase) {
    const o = await devOverlay(this);
    if (o.present) {
      throw failure(this, `Expected no development tools on the page, but they are there (${shortUrl(this.page.url())}).`, 'The development server (next dev) puts them on every page; a production build has none.');
    }
    return;
  }
  await eventually(this, () => devOverlay(this), (o) => o.present && o.indicator, () => ({
    message: `Expected the development tools on the page, but there are none (${shortUrl(this.page.url())}).`,
    hint: 'Only the development server (next dev) puts them on the page.',
  }));
});

