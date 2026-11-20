'use strict';

// Images of the image component, found by their alternative text: lazy or
// preloaded, optimized by the app's image optimizer (sizes for each screen, a
// modern format), sized ahead of loading, loaded or not yet, and brought into
// view so that a lazy one loads.

const { Then, When } = require('@cucumber/cucumber');
const {
  budget,
  listed,
  failure,
  shortUrl,
  siteUrl,
  pageReady,
  imageByAlt,
  imageNames,
  imageInfo,
  optimizedAddress,
  eventually,
} = require('./nextjs-helpers');

/** The image named by its alternative text, or a failure that lists the images of the page. */
async function theImage(world, alt) {
  const image = await imageByAlt(world, alt);
  if (!(await image.count())) {
    throw failure(world, `Expected an image "${alt}" on ${shortUrl(world.page.url())}, but there is none. Images on the page: ${listed(await imageNames(world))}.`, 'An image is found by its alternative text (alt), as a screen reader names it.');
  }
  return image;
}

/**
 * Whether the image loads lazily (loading="lazy": the browser fetches it when
 * it comes near the window), as the image component makes every image that is
 * not marked as a priority.
 *
 * Example #1: Then the image "Ivy Example's profile picture" should load lazily
 * Example #2: And the image "logomark" should load lazily
 * Example #3: Then the image "logo" should not load lazily
 * Example #4: Then image "Screenshots of the dashboard project showing desktop version" should load lazily
 * Example #5: And the image "Oak Example's profile picture" should load lazily
 */
Then(/^(?:the )?image "([^"]*)?" should( not)* load lazily$/, async function (alt, notCase) {
  await pageReady(this);
  const info = await imageInfo(await theImage(this, alt));
  const lazy = info.loading === 'lazy';
  if (!notCase && !lazy) {
    throw failure(this, `Expected the image "${alt}" to load lazily, but its loading is "${info.loading || 'eager (no loading attribute)'}".`, 'The image component makes an image lazy unless it is marked as a priority (preload, or loading="eager").');
  }
  if (notCase && lazy) {
    throw failure(this, `Expected the image "${alt}" to load at once, but it loads lazily (loading="lazy").`, 'An image above the fold (a logo, a hero image) is marked as a priority so that it does not wait.');
  }
});

/**
 * Whether the page asks for the image ahead of time: a <link rel="preload"
 * as="image"> for it in the head, as the image component adds for an image
 * marked as a priority.
 *
 * Example #1: Then the image "logo" should be preloaded
 * Example #2: And the image "logomark" should not be preloaded
 * Example #3: Then image "logo" should be preloaded
 * Example #4: Then the image "Ivy Example's profile picture" should not be preloaded
 * Example #5: And the image "logo" should be preloaded
 */
Then(/^(?:the )?image "([^"]*)?" should( not)* be preloaded$/, async function (alt, notCase) {
  await pageReady(this);
  const info = await imageInfo(await theImage(this, alt));
  if (!notCase && !info.preloaded) {
    throw failure(this, `Expected the image "${alt}" to be preloaded, but the page has no <link rel="preload" as="image"> for ${shortUrl(info.src)}.`, 'The image component preloads an image marked as a priority (the preload or priority property).');
  }
  if (notCase && info.preloaded) {
    throw failure(this, `Expected the image "${alt}" not to be preloaded, but the page preloads ${shortUrl(info.src)}.`, 'Only the images that matter at first sight should be preloaded.');
  }
});

/**
 * Whether the image comes from the app's image optimizer (/_next/image),
 * which sends a size made for the screen (the widths of its srcset) in a
 * modern format. An SVG and an image marked as unoptimized come as they are.
 *
 * Example #1: Then the image "Ivy Example's profile picture" should be optimized
 * Example #2: And the image "logo" should not be optimized
 * Example #3: Then image "Screenshots of the dashboard project showing desktop version" should be optimized
 * Example #4: Then the image "logomark" should not be optimized
 * Example #5: And the image "Oak Example's profile picture" should be optimized
 */
Then(/^(?:the )?image "([^"]*)?" should( not)* be optimized$/, async function (alt, notCase) {
  await pageReady(this);
  const info = await imageInfo(await theImage(this, alt));
  const optimized = optimizedAddress(info.src) && (!info.srcset || info.srcset.split(',').every((part) => optimizedAddress(part.trim())));
  if (!notCase && !optimized) {
    throw failure(this, `Expected the image "${alt}" to come from the image optimizer, but its address is ${shortUrl(info.src)}${info.srcset ? ` (srcset ${shortUrl(info.srcset)})` : ''}.`, 'The image component sends an image through /_next/image unless it is an SVG, marked as unoptimized, or the app\'s config turns the optimizer off.');
  }
  if (notCase && optimized) {
    throw failure(this, `Expected the image "${alt}" to come as it is, but it comes from the image optimizer (${shortUrl(info.src)}).`, 'An SVG, or an image marked as unoptimized, keeps its own address.');
  }
});

/**
 * The format the server sends the image in, for a browser that takes the
 * modern formats: "image/webp" or "image/avif" from the image optimizer.
 *
 * Example #1: Then the image "Ivy Example's profile picture" should be served as "image/webp"
 * Example #2: And the image "Screenshots of the dashboard project showing desktop version" should be served as "image/webp"
 * Example #3: Then image "Oak Example's profile picture" should be served as "image/webp"
 * Example #4: Then the image "logo" should be served as "image/svg+xml"
 * Example #5: And the image "Ivy Example's profile picture" should be served as "image/webp"
 */
Then(/^(?:the )?image "([^"]*)?" should be served as "([^"]*)?"$/, async function (alt, type) {
  await pageReady(this);
  const info = await imageInfo(await theImage(this, alt));
  const address = info.currentSrc || info.src;
  if (!address) {
    throw failure(this, `Expected the image "${alt}" to have an address, but it has none.`, 'The image has no src or srcset.');
  }
  let served = '';
  try {
    const response = await this.page.context().request.get(siteUrl(this, address), {
      headers: { accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' },
      failOnStatusCode: false,
    });
    served = String(response.headers()['content-type'] || '').split(';')[0].trim();
  } catch (err) {
    throw failure(this, `Could not ask for the image "${alt}" (${shortUrl(address)}): ${err.message}`, 'The step asks for the image the way the browser does.');
  }
  if (served !== type) {
    throw failure(this, `Expected the image "${alt}" to be served as ${type}, but it is served as ${served || 'no type'} (${shortUrl(address)}).`, 'The image optimizer sends the first of the formats of images.formats in next.config (WebP by default) that the browser takes.');
  }
});

/**
 * Whether the image has a width and a height before it loads, so the page
 * keeps its place and does not shift (as the image component asks for).
 *
 * Example #1: Then the image "Ivy Example's profile picture" should have a width and a height
 * Example #2: And the image "logo" should have a width and a height
 * Example #3: Then image "logomark" should have a width and a height
 * Example #4: Then the image "Screenshots of the dashboard project showing desktop version" should have a width and a height
 * Example #5: And the image "Oak Example's profile picture" should have a width and a height
 */
Then(/^(?:the )?image "([^"]*)?" should have a width and a height$/, async function (alt) {
  await pageReady(this);
  const image = await theImage(this, alt);
  const size = await image.evaluate((img) => ({
    width: img.getAttribute('width') || '',
    height: img.getAttribute('height') || '',
    fill: img.getAttribute('data-nimg') === 'fill',
  }));
  if (!size.fill && (!size.width || !size.height)) {
    throw failure(this, `Expected the image "${alt}" to have a width and a height, but it has width "${size.width}" and height "${size.height}".`, 'Without them the page moves when the image arrives (layout shift); the image component needs them unless the image fills its container.');
  }
});

/**
 * Whether the browser has fetched and decoded the image. A lazy image out of
 * the window has not loaded yet; "should have loaded" waits for it.
 *
 * Example #1: Then the image "Ivy Example's profile picture" should have loaded
 * Example #2: And the image "Screenshot of the dashboard project showing mobile version" should not have loaded
 * Example #3: Then image "logomark" should have loaded
 * Example #4: Then the image "Oak Example's profile picture" should not have loaded
 * Example #5: And the image "logo" should have loaded
 */
Then(/^(?:the )?image "([^"]*)?" should( not)* have loaded$/, async function (alt, notCase) {
  await pageReady(this);
  const image = await theImage(this, alt);
  const loaded = (info) => info.complete && info.naturalWidth > 0;
  if (notCase) {
    const info = await imageInfo(image);
    if (loaded(info)) {
      throw failure(this, `Expected the image "${alt}" not to have loaded yet, but the browser has it (${shortUrl(info.currentSrc)}).`, 'A lazy image loads when it comes near the window; a hidden one (display: none) never loads.');
    }
    return;
  }
  await eventually(this, () => imageInfo(image), loaded, (info) => ({
    message: `Expected the image "${alt}" to have loaded, but it has not (${info.visible ? 'it is on the page' : 'it is hidden'}, loading "${info.loading || 'eager'}", address ${shortUrl(info.currentSrc || info.src) || 'none yet'}).`,
    hint: info.loading === 'lazy' && info.visible ? 'A lazy image loads when it comes near the window: bring it into view first ("When I scroll the image "…" into view").' : 'Check that its address answers 200.',
  }), budget(this));
});

/**
 * Bring the image to the middle of the window, as a person scrolling to it
 * does, and wait for it to load (a lazy image loads only then).
 *
 * Example #1: When I scroll the image "Oak Example's profile picture" into view
 * Example #2: And we scroll the image "Ivy Example's profile picture" into view
 * Example #3: When I scroll the image "logomark" into view
 * Example #4: When I scroll the image "Ivy Example's profile picture" into view
 * Example #5: And I scroll the image "Oak Example's profile picture" into view
 */
When(/^(I |we )*scroll the image "([^"]*)?" into view$/, async function (pronounCase, alt) {
  await pageReady(this);
  const image = await theImage(this, alt);
  await image.evaluate((img) => img.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await eventually(this, () => imageInfo(image), (info) => info.complete && info.naturalWidth > 0, (info) => ({
    message: `Expected the image "${alt}" to load once in view, but it has not (${info.visible ? 'on the page' : 'hidden'}, address ${shortUrl(info.currentSrc || info.src) || 'none'}).`,
    hint: 'A hidden image (display: none) never loads; check also that its address answers 200.',
  }), budget(this));
});
