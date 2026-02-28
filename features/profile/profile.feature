Feature: Profile management
  As a CLI user
  I want to manage multiple server profiles
  So that I can easily switch between environments

  Scenario: List profiles when none exist
    Given no config file exists
    When I run "geonic profile list"
    Then the exit code should be 0
    And the output should contain "default"

  Scenario: Create a new profile
    Given no config file exists
    When I run "geonic profile create staging"
    Then the exit code should be 0
    And the output should contain "staging"

  Scenario: Switch active profile
    Given a v2 config with profiles:
      """
      {
        "version": 2,
        "currentProfile": "default",
        "profiles": {
          "default": { "url": "http://localhost:3000" },
          "staging": { "url": "http://staging:1026" }
        }
      }
      """
    When I run "geonic profile use staging"
    Then the exit code should be 0
    And the active profile should be "staging"

  Scenario: Show profile details
    Given a v2 config with profiles:
      """
      {
        "version": 2,
        "currentProfile": "default",
        "profiles": {
          "default": { "url": "http://localhost:3000", "service": "myservice" }
        }
      }
      """
    When I run "geonic profile show default"
    Then the exit code should be 0
    And the output should contain "http://localhost:3000"

  Scenario: Delete a profile
    Given a v2 config with profiles:
      """
      {
        "version": 2,
        "currentProfile": "default",
        "profiles": {
          "default": { "url": "http://localhost:3000" },
          "staging": { "url": "http://staging:1026" }
        }
      }
      """
    When I run "geonic profile delete staging"
    Then the exit code should be 0
    And the config should not have profile "staging"

  Scenario: Cannot delete default profile
    Given a v2 config with profiles:
      """
      {
        "version": 2,
        "currentProfile": "default",
        "profiles": {
          "default": { "url": "http://localhost:3000" }
        }
      }
      """
    When I run "geonic profile delete default"
    Then the exit code should be 1

  Scenario: Cannot create duplicate profile
    Given a v2 config with profiles:
      """
      {
        "version": 2,
        "currentProfile": "default",
        "profiles": {
          "default": { "url": "http://localhost:3000" },
          "staging": { "url": "http://staging:1026" }
        }
      }
      """
    When I run "geonic profile create staging"
    Then the exit code should be 1

  Scenario: Cannot switch to non-existent profile
    Given a v2 config with profiles:
      """
      {
        "version": 2,
        "currentProfile": "default",
        "profiles": {
          "default": { "url": "http://localhost:3000" }
        }
      }
      """
    When I run "geonic profile use nonexistent"
    Then the exit code should be 1

  Scenario: Delete active profile switches to default
    Given a v2 config with profiles:
      """
      {
        "version": 2,
        "currentProfile": "staging",
        "profiles": {
          "default": { "url": "http://localhost:3000" },
          "staging": { "url": "http://staging:1026" }
        }
      }
      """
    When I run "geonic profile delete staging"
    Then the exit code should be 0
    And the config should not have profile "staging"
    And the active profile should be "default"

  Scenario: Show non-existent profile shows empty message
    Given a v2 config with profiles:
      """
      {
        "version": 2,
        "currentProfile": "default",
        "profiles": {
          "default": { "url": "http://localhost:3000" }
        }
      }
      """
    When I run "geonic profile show nonexistent"
    Then the exit code should be 0
    And the output should contain "has no settings"
