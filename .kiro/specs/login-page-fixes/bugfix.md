# Bugfix Requirements Document

## Introduction

This document addresses four bugs on the LearnVerse web application login/registration pages that degrade user experience and compromise form security:

1. The parent registration form lacks inline (real-time) validation for phone number and email fields — errors only appear after form submission.
2. The forgot password link is not visible on the login UI until after a login failure occurs, making it undiscoverable.
3. The login form accepts and submits empty username/password fields without client-side validation, allowing empty credentials to reach the API.
4. After a successful login, the user sees a static welcome card but is not navigated to a post-login view/dashboard.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user types an invalid phone number in the parent registration form and moves to the next field THEN the system does not display any inline validation error until the form is submitted

1.2 WHEN a user types an invalid email address in the parent registration form and moves to the next field THEN the system does not display any inline validation error until the form is submitted

1.3 WHEN the login form is initially rendered (before any login failure) THEN the system does not display the forgot password link anywhere on the login UI

1.4 WHEN a user submits the login form with empty username and empty password fields THEN the system sends the empty credentials to the API instead of blocking submission with a validation error

1.5 WHEN a user submits the login form with an empty username but non-empty password THEN the system sends the request without validating that the username is required

1.6 WHEN a user submits the login form with a non-empty username but empty password THEN the system sends the request without validating that the password is required

1.7 WHEN a user successfully logs in THEN the system displays a welcome card in the same view but does not navigate the user to a post-login route (e.g., a dashboard)

### Expected Behavior (Correct)

2.1 WHEN a user types an invalid phone number in the parent registration form and the phone input loses focus THEN the system SHALL display an inline validation error below the phone field indicating the expected format (10 digits)

2.2 WHEN a user types an invalid email address in the parent registration form and the email input loses focus THEN the system SHALL display an inline validation error below the email field indicating the expected format

2.3 WHEN the login form is initially rendered THEN the system SHALL display a visible "Forgot password?" link below the login form submit button, accessible without requiring a prior login failure

2.4 WHEN a user submits the login form with empty username and empty password fields THEN the system SHALL prevent form submission and display inline validation errors for both fields indicating they are required

2.5 WHEN a user submits the login form with an empty username but non-empty password THEN the system SHALL prevent form submission and display an inline validation error for the username field indicating it is required

2.6 WHEN a user submits the login form with a non-empty username but empty password THEN the system SHALL prevent form submission and display an inline validation error for the password field indicating it is required

2.7 WHEN a user successfully logs in THEN the system SHALL navigate the user to a post-login dashboard route (e.g., `#dashboard`)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user types a valid phone number (exactly 10 digits) in the parent registration form and the phone input loses focus THEN the system SHALL CONTINUE TO not display any error for the phone field

3.2 WHEN a user types a valid email address in the parent registration form and the email input loses focus THEN the system SHALL CONTINUE TO not display any error for the email field

3.3 WHEN the user submits the registration form with invalid data THEN the system SHALL CONTINUE TO display inline validation errors for all invalid fields on submission

3.4 WHEN a user submits the login form with both username and password filled in THEN the system SHALL CONTINUE TO send the credentials to the authentication API

3.5 WHEN the authentication API returns an error THEN the system SHALL CONTINUE TO display the error message below the login form and show the failure action links (Register, Reset Password)

3.6 WHEN a user clicks the Register button in the header THEN the system SHALL CONTINUE TO navigate to the registration view

3.7 WHEN authentication API is unreachable THEN the system SHALL CONTINUE TO display a network error message to the user
