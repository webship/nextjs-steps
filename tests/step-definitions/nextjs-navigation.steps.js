'use strict';

// Client-side navigation: a link followed and the browser's back and forward
// buttons, each without a full page reload; the route announcer that tells a
// screen reader about the new page; and the pages the router fetches ahead of
// a click.

const { Then, When } = require('@cucumber/cucumber');
const {
  budget,
  clean,
  same,
  listed,
  failure,
  pathOf,
  shortUrl,
  requests,
  documentId,
  appInfo,
  pageReady,
  afterAction,
  waitHydrated,
  linkByName,
  firstPresent,
  visibleLinkNames,
  announcer,
  eventually,
} = require('./nextjs-helpers');

/**
 * The address a link leads to, as the browser resolves it.
 */
async function linkTarget(locator) {
  return locator.evaluate((a) => a.href || '').catch(() => '');
}

/**
 * Wait for a client-side navigation to finish: the page is ready and its
 * document is the one it was before (no full page reload).
 */
async function finishWithoutReload(world, before, what) {
  await pageReady(world);
  const after = await documentId(world);
  if (!after || after !== before) {
    throw failure(world, `Expected ${what} without a full page reload, but the browser loaded a new document (${world.page.url()}).`, 'The router handles a click on one of its links in the page: a full reload means the link is a plain <a> (not the framework\'s Link), the page was not hydrated yet, or the router fell back to a hard navigation after an error.');
  }
}

/**
 * Click a link by its name and let the router show the new page in the same
 * document: the step waits for the link to be hydrated, then for the
 * navigation to finish, and fails if the browser loaded a new document.
 *
 * Example #1: When I click the link "Invoices" without a full page reload
 * Example #2: And we click the link "Customers" without a full page reload
 * Example #3: When I click the link "Home" without a full page reload
 * Example #4: When I click the link "Users List" without a full page reload
 * Example #5: And I click the link "About" without a full page reload
 */
When(/^(I |we )*click the link "([^"]*)?" without a full page reload$/, { timeout: 60000 }, async function (pronounCase, name) {
  await pageReady(this);
  const { exact, loose } = linkByName(this, name);
  const link = await firstPresent([exact, loose]);
  if (!(await link.count())) {
    throw failure(this, `Expected a link "${name}" on ${this.page.url()}, but there is none. Links on the page: ${listed(await visibleLinkNames(this))}.`, 'A link is found by the name a person reads: its text or its accessible name (aria-label).');
  }
  await waitHydrated(this, link, `the link "${name}"`);
  const target = await linkTarget(link);
  const before = await documentId(this);
  await afterAction(this, async () => {
    await link.evaluate((a) => a.scrollIntoView({ block: 'center', inline: 'nearest' })).catch(() => {});
    await link.click({ timeout: budget(this) });
  });
  if (target) {
    await eventually(this, () => this.page.url(), (url) => pathOf(url) === pathOf(target), (url) => ({
      message: `Expected the link "${name}" to lead to ${shortUrl(target)}, but the page is still ${shortUrl(url)} after ${budget(this)} ms.`,
      hint: 'The router changes the address when the new page is ready to show; a request that never answers keeps the old page.',
    }));
  }
  await finishWithoutReload(this, before, `the link "${name}" to open its page`);
});

/**
 * Go back (or forward) one page with the browser's own button, the router
 * showing that page again in the same document.
 *
 * Example #1: When I go back without a full page reload
 * Example #2: And we go back without a full page reload
 * Example #3: When I go forward without a full page reload
 * Example #4: And I go forward without a full page reload
 * Example #5: When we go forward without a full page reload
 */
When(/^(I |we )*go (back|forward) without a full page reload$/, { timeout: 60000 }, async function (pronounCase, direction) {
  await pageReady(this);
  const before = await documentId(this);
  const from = this.page.url();
  await afterAction(this, async () => {
    if (direction === 'back') await this.page.goBack({ waitUntil: 'commit', timeout: budget(this) }).catch(() => null);
    else await this.page.goForward({ waitUntil: 'commit', timeout: budget(this) }).catch(() => null);
  });
  if (this.page.url() === from) {
    throw failure(this, `Expected going ${direction} to change the page, but it is still ${shortUrl(from)}.`, `The history of the browser has no page ${direction === 'back' ? 'before' : 'after'} this one in this scenario.`);
  }
  await finishWithoutReload(this, before, `going ${direction}`);
});

/**
 * The route announcer: the live region the router fills with the title of
 * each new page (an empty region after the first load, as a screen reader
 * reads that page itself).
 *
 * Example #1: Then the page should have a route announcer
 * Example #2: And page should have a route announcer
 * Example #3: Then the page should not have a route announcer
 * Example #4: Then the page should have a route announcer
 * Example #5: And the page should have a route announcer
 */
Then(/^(?:the )?page should( not)* have a route announcer$/, async function (notCase) {
  await pageReady(this);
  const state = await announcer(this);
  if (!notCase && !state.present) {
    throw failure(this, `Expected a route announcer on ${this.page.url()}, but the page has none.`, 'The router puts it on every page it serves (#__next-route-announcer__ in the next-route-announcer element); a page the framework does not serve has none.');
  }
  if (notCase && state.present) {
    throw failure(this, `Expected no route announcer on ${this.page.url()}, but the page has one (aria-live="${state.live}").`, 'The router puts one on every page it serves.');
  }
});

/**
 * What the route announcer says: the title of the page the router just
 * showed, or its start (the words before the rest of a title template:
 * "Invoices" for "Invoices | Acme Dashboard"); letter case and white space
 * ignored.
 *
 * Example #1: Then the route announcer should announce "Invoices | Acme Dashboard"
 * Example #2: And route announcer should announce "Customers | Acme Dashboard"
 * Example #3: Then the route announcer should not announce "Invoices | Acme Dashboard"
 * Example #4: Then the route announcer should announce "Users List"
 * Example #5: And the route announcer should announce "About"
 */
Then(/^(?:the )?route announcer should( not)* announce "([^"]*)?"$/, async function (notCase, text) {
  await pageReady(this);
  if (notCase) {
    const state = await announcer(this);
    if (state.present && (same(state.text, text) || state.text.toLowerCase().startsWith(`${clean(text).toLowerCase()} `))) {
      throw failure(this, `Expected the route announcer not to announce "${text}", but it does.`, 'It announces the title of the last page the router showed.');
    }
    return;
  }
  // The whole announcement, or its start: "Invoices" for "Invoices | Acme Dashboard" (a title template).
  const says = (state) => state.present && (same(state.text, text) || state.text.toLowerCase().startsWith(`${clean(text).toLowerCase()} `));
  await eventually(this, () => announcer(this), says, (state) => ({
    message: state.present
      ? `Expected the route announcer to announce "${text}", but it announces "${state.text}".`
      : `Expected the route announcer to announce "${text}", but the page has no route announcer.`,
    hint: 'The router announces the document title of the new page (else its first heading, else its path) after a client-side navigation; the first page of a visit is announced by the screen reader itself, so the region starts empty.',
  }));
});

/**
 * The router fetched a page ahead of a click (a link of it in the window): the
 * App Router fetches the page's payload (header next-router-prefetch), the
 * Pages Router its data or its code. Production builds prefetch; the
 * development server does not.
 *
 * Example #1: Then the page "/dashboard/invoices" should be prefetched
 * Example #2: And the page "/dashboard/customers" should be prefetched
 * Example #3: Then the page "/login" should not be prefetched
 * Example #4: Then page "/users" should be prefetched
 * Example #5: And the page "/about" should be prefetched
 */
Then(/^(?:the )?page "([^"]*)?" should( not)* be prefetched$/, async function (path, notCase) {
  await pageReady(this);
  const wanted = pathOf(path);
  const state = requests(this.page);
  // The page a prefetch was for: the path of an App Router payload, or the page of a Pages Router data file.
  const pageOf = (url) => {
    const p = pathOf(url);
    if (!p.startsWith('/_next/data/')) return p;
    return p.replace(/^\/_next\/data\/[^/]+/, '').replace(/\.json$/, '').replace(/\/index$/, '') || '/';
  };
  const read = async () => state.prefetched.some((url) => pageOf(url) === wanted);
  if (notCase) {
    if (await read()) {
      throw failure(this, `Expected the page "${path}" not to be prefetched, but the router fetched it ahead of a click.`, 'A link with prefetch={false}, or the development server, does not prefetch.');
    }
    return;
  }
  const info = await appInfo(this);
  await eventually(this, read, (ok) => ok, () => ({
    message: `Expected the page "${path}" to be prefetched, but the router did not fetch it ahead of a click within ${budget(this)} ms. Pages it fetched: ${listed(state.prefetched.map(shortUrl).slice(-8))}.`,
    hint: info.development ? 'The development server does not prefetch: run a production build.' : 'The router prefetches the pages of the links in the window, in a production build: is a link to that page visible, and is it the framework\'s Link?',
  }));
});
