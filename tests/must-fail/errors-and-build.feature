@must-fail @learn
Feature: Must fail: not-found and error pages, the build
  Each scenario asserts something that is not true on the test app: its last step must fail, with the
  message its description announces and a hint.

  Scenario: A page that exists asserted as a 404 page
    Fails with: Expected a 404 page
    Given I am a logged in user with the "editor" user
    When I go to "/dashboard/customers"
    Then I should be on a 404 page

  @js-off
  Scenario: A not-found page asserted as a page that exists
    Fails with: Expected a page that exists
    Given I am a logged in user with the "editor" user
    When I go to "/dashboard/invoices/7f3c2a10-0000-4000-8000-000000000404/edit"
    Then I should not be on a 404 page

  @js-off
  Scenario: The app's own not-found page asserted as the default one
    Fails with: Expected the framework's default 404 page
    Given I am a logged in user with the "editor" user
    When I go to "/dashboard/invoices/7f3c2a10-0000-4000-8000-000000000404/edit"
    Then I should be on the default 404 page

  @js-off
  Scenario: The default not-found page asserted as the app's own
    Fails with: Expected a not-found page of the app's own
    Given I am an anonymous user
    When I go to "/no-such-page"
    Then I should not be on the default 404 page

  Scenario: The words of an error page on a page with no error
    Fails with: The page shows "Customers", but nothing on it failed
    Given I am a logged in user with the "editor" user
    When I go to "/dashboard/customers"
    Then the error page should show "Customers"

  Scenario: An error page asserted on a page without one
    Fails with: Expected the error page to show "Something went wrong!"
    Given I am a logged in user with the "editor" user
    When I go to "/dashboard/customers"
    Then the error page should show "Something went wrong!"

  @js-off
  Scenario: An error page asserted absent
    Fails with: Expected no error page with "Something went wrong!"
    Given I am a logged in user with the "editor" user
    When I go to "/dashboard/invoices/not-an-invoice/edit"
    Then the error page should not show "Something went wrong!"

  @js-off
  Scenario: A production error page asserted with its details
    Fails with: Expected the page to show the details of the error
    Given I am a logged in user with the "editor" user
    When I go to "/dashboard/invoices/not-an-invoice/edit"
    Then the page should show the details of the error

  Scenario: A production build asserted as the development server
    Fails with: Expected the development server
    Given I am an anonymous user
    When I go to "/"
    Then the site should not be served as a production build

  Scenario: The development error overlay asserted on a production build
    Fails with: Expected the development error overlay
    Given I am an anonymous user
    When I go to "/"
    Then the development error overlay should be shown

  Scenario: The words of the development error overlay on a production build
    Fails with: Expected the development error overlay to show "invalid input syntax"
    Given I am an anonymous user
    When I go to "/"
    Then the development error overlay should show "invalid input syntax"

  Scenario: The errors of the development error overlay on a production build
    Fails with: Expected the development error overlay to list 2 error(s)
    Given I am an anonymous user
    When I go to "/"
    Then the development error overlay should list 2 errors

  Scenario: The development tools asserted on a production build
    Fails with: Expected the development tools on the page
    Given I am an anonymous user
    When I go to "/"
    Then the development tools should be on the page

  Scenario: A page rendered for each request asserted as prerendered
    Fails with: to be prerendered, but the server rendered it for this request
    Given I am a logged in user with the "administrator" user
    When I go to "/dashboard/invoices"
    Then the page should be prerendered

  Scenario: A prerendered page asserted as rendered for each request
    Fails with: to be rendered for each request, but the server sent what it prerendered
    Given I am a logged in user with the "administrator" user
    When I go to "/dashboard"
    Then the page should not be prerendered

  Scenario: The release asserted as an older one
    Fails with: Expected the page to run on the release 14
    Given I am an anonymous user
    When I go to "/"
    Then the page should run on the release "14"

  Scenario: The router asserted as the other one
    Fails with: Expected the pages router to serve
    Given I am an anonymous user
    When I go to "/"
    Then the page should be served by the pages router

  Scenario: Hydration errors asserted on a page that has none
    Fails with: Expected hydration errors, but the console reported none
    Given I am an anonymous user
    When I go to "/"
    Then there should be hydration errors
