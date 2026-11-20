@learn
Feature: Forms and their actions
  As a person who keeps the invoices
  I want each form to say what is wrong next to the field, and to save without reloading the page
  So that I can correct a form quickly and see the list as it is now

  # A scenario that creates or changes an invoice takes it back before it ends; the invoices of the
  # suite's own customers ("Ivy Example", "Oak Example") come from the build.

  Scenario: The errors of the server are shown next to each field and for the whole form
    Given I am a logged in user with the "editor" user
    And I am on "/dashboard/invoices/create"
    When I send the form with "Create Invoice"
    Then the field "Choose customer" should show the error "Please select a customer."
    And the field "Choose an amount" should show the error "Please enter an amount greater than $0."
    And the field "Set the invoice status" should show the error "Please select an invoice status."
    And the form should show the message "Missing Fields. Failed to Create Invoice."
    And the form should have been sent without a full page reload

  Scenario: A field that is right loses its error when the form is sent again
    Given I am a logged in user with the "editor" user
    And I am on "/dashboard/invoices/create"
    When I send the form with "Create Invoice"
    And I select "Oak Example" from "Choose customer"
    And I send the form with "Create Invoice"
    Then the field "Choose customer" should not show the error "Please select a customer."
    And the field "Choose an amount" should show the error "Please enter an amount greater than $0."

  Scenario: An invoice is created, listed and deleted
    Given I am a logged in user with the "administrator" user
    And I am on "/dashboard/invoices/create"
    When I select "Ivy Example" from "Choose customer"
    And I fill in "Choose an amount" with "42.17"
    And I choose the radio button "Pending"
    And I send the form with "Create Invoice"
    Then the path should be "/dashboard/invoices"
    And the form should have been sent without a full page reload
    And I should see "$42.17"
    When I send the form with "Delete" in the "$42.17" row
    Then I should not see "$42.17"
    And the form should have been sent without a full page reload

  Scenario: An invoice is changed, then put back
    Given I am a logged in user with the "editor" user
    And I am on "/dashboard/invoices/7f3c2a10-0000-4000-8000-0000000000a1/edit"
    When I fill in "Choose an amount" with "121.50"
    And I send the form with "Edit Invoice"
    Then the path should be "/dashboard/invoices"
    When I go to "/dashboard/invoices?query=Ivy"
    Then I should see "$121.50"
    When I go to "/dashboard/invoices/7f3c2a10-0000-4000-8000-0000000000a1/edit"
    And I fill in "Choose an amount" with "120"
    And I send the form with "Edit Invoice"
    And I go to "/dashboard/invoices?query=Ivy"
    Then I should see "$120.00"
    And I should not see "$121.50"
