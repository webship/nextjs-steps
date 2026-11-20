@pages-router
Feature: An app of the pages router
  As a person who uses an app of the pages router
  I want its pages hydrated, its links opening pages in the same document and each new page announced
  So that the older router behaves as the newer one does

  Scenario: The pages are a hydrated, prerendered production build of the pages router
    Given I am on "/"
    Then the site should be served as a production build
    And the page should be served by the pages router
    And I should see a hydrated page
    And there should be no hydration errors
    And the page should be prerendered
    And the page should have a route announcer

  Scenario: The links open their pages in the same document, and the router announces each one
    Given I am on "/"
    When I click the link "About" without a full page reload
    Then the path should be "/about"
    And the route announcer should announce "About"
    When I click the link "Users List" without a full page reload
    Then the path should be "/users"
    And the route announcer should announce "Users List"
    When I go back without a full page reload
    Then the path should be "/about"

  Scenario: The page behind a link is fetched ahead of a click
    Given I am on "/"
    Then the page "/users" should be prefetched

  @js-off
  Scenario: An address with no page shows the default not-found page
    When I go to "/no-such-page"
    Then I should be on a 404 page
    And I should be on the default 404 page
