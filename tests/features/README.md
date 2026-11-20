# Features

Reference features for the apps that `.github/scripts/build-ddev-site.sh`
builds. Each feature carries the tag of the app it runs on: `@learn` (the
finished app of the official Learn course with the suite's own test data and
the two accounts of `cucumber.js`, `administrator` and `editor`),
`@default-app` (the app `create-next-app` makes with its defaults) and
`@pages-router` (the official Pages Router example); `@development` runs on the
development server. Copy a feature into your project and replace the
addresses, links, labels and texts with those of your app.

| Feature | Covers |
| --- | --- |
| `session` | A visitor sent to the login form, which keeps the page asked for; each account logging in through the form; a wrong password and an unknown address refused; the login button busy while its answer is held back; a session taken over; logging out. |
| `navigation` | The side navigation without a full page reload and the route announcer, back and forward, the pages fetched ahead of a click, the route announcer of a first page, a page opened from its address. |
| `search-and-pagination` | A search put in the address and the list it gives, a search in the address filling in the search box, the pages of the list. |
| `forms` | The errors of the server next to each field and for the whole form, an error gone once its field is right, an invoice created, listed and deleted, an invoice changed and put back. |
| `loading` | A loading state on a slow network while a search streams in (`@since-16`), a page whose parts stream in one after the other, the router keeping its page while the answer of a navigation is held back. |
| `errors` | The app's own not-found page, the default one, the error page of a part that fails without the details of the error, a page that exists. |
| `build` | A hydrated production build of the app router, prerendered pages and pages rendered for each request. |
| `images` | Lazy, optimized and sized images, the format the optimizer sends, the picture made for a small screen. |
| `development` | The development server's tools, and its error overlay with the details of a part that fails. |
| `default-app` | The start page of a new app: a hydrated, prerendered production build, its preloaded and lazy images, the default not-found page. |
| `pages-router` | The Pages Router example: a hydrated, prerendered production build, its links without a full page reload and announced, a prefetched page, the default not-found page. |

Scenarios that change something change it back in the same scenario: an
invoice created is deleted, an amount changed is put back. No scenario creates
or deletes a user.
