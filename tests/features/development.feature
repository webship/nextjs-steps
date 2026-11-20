@learn @development
Feature: The development server
  As a developer of the app
  I want the development server to show its tools, and the details of an error over the page
  So that I see what failed while I work, and never in a production build

  # These scenarios run against the development server (SERVER_MODE=development of the build script).

  Scenario: The development server shows its tools and no error on a page that works
    Given I am a logged in user with the "administrator" user
    When I go to "/dashboard/invoices"
    Then the site should not be served as a production build
    And the development tools should be on the page
    And the development error overlay should not be shown

  @js-off
  Scenario: A part of the page that fails opens the error overlay with the details
    Given I am a logged in user with the "editor" user
    When I go to "/dashboard/invoices/not-an-invoice/edit"
    Then the development error overlay should be shown
    And the development error overlay should show "invalid input syntax for type uuid"
    And the development error overlay should list 2 errors
    And the page should show the details of the error
    And the error page should show "Something went wrong!"
