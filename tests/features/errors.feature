@learn
Feature: Not-found pages and error pages
  As a person who opens an address that is wrong or a record that fails
  I want a page that says so, without the inner details of the server
  So that I can go back to what works

  # The browser logs "Failed to load resource" for a 404 or a 500: those scenarios carry @js-off.

  @js-off
  Scenario: An invoice that does not exist shows the app's own not-found page
    Given I am a logged in user with the "administrator" user
    When I go to "/dashboard/invoices/7f3c2a10-0000-4000-8000-000000000404/edit"
    Then I should be on a 404 page
    And I should not be on the default 404 page
    And I should see "Could not find the requested invoice."
    And the response status code should be 404

  @js-off
  Scenario: An address with no route shows the default not-found page
    Given I am an anonymous user
    When I go to "/no-such-page"
    Then I should be on a 404 page
    And I should be on the default 404 page

  @js-off
  Scenario: A part of the page that fails shows the error page, without the details of the error
    Given I am a logged in user with the "editor" user
    When I go to "/dashboard/invoices/not-an-invoice/edit"
    Then the error page should show "Something went wrong!"
    And the page should not show the details of the error
    And I should not see "Failed to fetch invoice."
    And the response status code should be 500

  Scenario: A page that exists is neither a not-found page nor an error page
    Given I am a logged in user with the "editor" user
    When I go to "/dashboard/customers"
    Then I should not be on a 404 page
    And the error page should not show "Something went wrong!"
