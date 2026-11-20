@must-fail @learn
Feature: Must fail: images
  Each scenario asserts something that is not true on the test app: its last step must fail, with the
  message its description announces and a hint.

  Scenario: A lazy image asserted as loading at once
    Fails with: Expected the image "Screenshots of the dashboard project showing desktop version" to load at once
    Given I am an anonymous user
    When I go to "/"
    Then the image "Screenshots of the dashboard project showing desktop version" should not load lazily

  Scenario: A hidden image asserted as loaded
    Fails with: Expected the image "Screenshot of the dashboard project showing mobile version" to have loaded
    Given I am an anonymous user
    When I go to "/"
    Then the image "Screenshot of the dashboard project showing mobile version" should have loaded

  Scenario: A loaded image asserted as not loaded
    Fails with: not to have loaded yet, but the browser has it
    Given I am an anonymous user
    When I go to "/"
    Then the image "Screenshots of the dashboard project showing desktop version" should not have loaded

  Scenario: An image asserted as preloaded that is not
    Fails with: Expected the image "Screenshots of the dashboard project showing desktop version" to be preloaded
    Given I am an anonymous user
    When I go to "/"
    Then the image "Screenshots of the dashboard project showing desktop version" should be preloaded

  Scenario: An optimized image asserted as coming as it is
    Fails with: to come as it is, but it comes from the image optimizer
    Given I am an anonymous user
    When I go to "/"
    Then the image "Screenshots of the dashboard project showing desktop version" should not be optimized

  Scenario: An image asserted in a format it is not sent in
    Fails with: to be served as image/avif, but it is served as image/webp
    Given I am an anonymous user
    When I go to "/"
    Then the image "Screenshots of the dashboard project showing desktop version" should be served as "image/avif"

  Scenario: An image the page does not have
    Fails with: Expected an image "Company logo"
    Given I am an anonymous user
    When I go to "/"
    Then the image "Company logo" should have a width and a height

  Scenario: A hidden image scrolled into view
    Fails with: to load once in view, but it has not
    Given I am an anonymous user
    When I go to "/"
    And I scroll the image "Screenshot of the dashboard project showing mobile version" into view
