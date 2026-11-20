@learn
Feature: The production build
  As the owner of the app
  I want it served as a production build, prerendered where it can be
  So that the visitors get the fast pages and never the development tools

  @critical
  Scenario: The pages are a hydrated production build of the app router
    Given I am an anonymous user
    When I go to "/"
    Then the site should be served as a production build
    And the page should be served by the app router
    And the page should not run on the release "14"
    And I should see a hydrated page
    And there should be no hydration errors
    And the development tools should not be on the page
    And the development error overlay should not be shown

  Scenario: Pages with no input of their own are prerendered, the others rendered for each request
    Given I am a logged in user with the "administrator" user
    When I go to "/dashboard"
    Then the page should be prerendered
    When I go to "/dashboard/invoices"
    Then the page should not be prerendered
