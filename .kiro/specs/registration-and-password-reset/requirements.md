# Requirements Document

## Introduction

This document defines the requirements for the role-based login, conditional registration, and password reset flows in the ChikuMiku LearnVerse web application. The home page presents a role selector (Parent or Student) before login. Registration is conditional: parents register directly, while students can only be registered by an authenticated parent. Password reset works for both roles but always routes the reset link to the parent's registered email. All views integrate with the existing hash-based routing and factory-function component pattern.

## Glossary

- **Home_Page**: The main landing page of the application displaying the role selector and login form
- **Role_Selector**: A UI control on the Home_Page that allows the user to choose between "Parent" and "Student" roles before logging in
- **Login_Form**: The form displayed on the Home_Page after a role is selected, accepting username and password
- **Login_Failure_Actions**: The "Register" and "Reset Password" links displayed after a failed login attempt
- **Registration_View**: The registration UI displayed when the URL hash is `#register`
- **Role_Choice_Screen**: The first screen in the Registration_View asking whether a new parent or a student is registering
- **Parent_Registration_Form**: The form capturing parent account details, shown when "Parent" is selected on the Role_Choice_Screen
- **Parent_Login_Gate**: A parent login form displayed when "Student" is selected on the Role_Choice_Screen, requiring parent authentication before student registration
- **Student_Registration_Form**: The form capturing student details, shown after successful parent authentication via the Parent_Login_Gate
- **Forgot_Password_View**: The password recovery UI displayed when the URL hash is `#forgot-password`
- **Reset_Password_View**: The page displayed when a user follows a password reset link containing a token
- **Auth_Service**: The client-side service module responsible for calling authentication API endpoints
- **Validation_Engine**: The client-side logic that checks form field values against defined rules before submission
- **Parent_Username**: A unique identifier for a parent account, 8-15 characters, containing alphabets, numbers, hyphens, and underscores
- **Student_Username**: A unique identifier for a student account, 8-15 characters, containing alphabets, numbers, hyphens, and underscores

## Requirements

### Requirement 1: Role-Based Login on Home Page

**User Story:** As a user (parent or student), I want to select my role before logging in so that the system authenticates me against the correct account type.

#### Acceptance Criteria

1. THE Home_Page SHALL display a Role_Selector with two options: "Parent" and "Student"
2. WHEN a user selects a role on the Role_Selector, THE Home_Page SHALL display the Login_Form with username and password fields
3. WHEN a user submits the Login_Form, THE Auth_Service SHALL send a POST request to `/api/v1/auth/login` with the username, password, and selected role
4. WHILE the Login_Form submission is in progress, THE Login_Form SHALL disable the submit button and display a loading indicator
5. IF the login API returns an error response OR the Login_Form encounters a client-side validation failure, THEN THE Home_Page SHALL display the error message and show the Login_Failure_Actions containing "Register" and "Reset Password" links
6. THE Login_Failure_Actions SHALL remain hidden until a login attempt fails, and SHALL always appear together with any error message display
7. WHEN a user clicks the "Register" link in the Login_Failure_Actions, THE application SHALL navigate to hash `#register`
8. WHEN a user clicks the "Reset Password" link in the Login_Failure_Actions, THE application SHALL navigate to hash `#forgot-password`

### Requirement 2: Registration Role Choice

**User Story:** As a new user, I want to indicate whether I am registering as a parent or a student so that the system shows me the correct registration flow.

#### Acceptance Criteria

1. WHEN the URL hash is `#register`, THE Registration_View SHALL display the Role_Choice_Screen with two options: "Parent" and "Student"
2. WHEN a user selects "Parent" on the Role_Choice_Screen, THE Registration_View SHALL display the Parent_Registration_Form
3. WHEN a user selects "Student" on the Role_Choice_Screen, THE Registration_View SHALL display the Parent_Login_Gate

### Requirement 3: Parent Registration Form Display

**User Story:** As a new parent, I want to see a clear registration form so that I can create my account to manage my child's learning.

#### Acceptance Criteria

1. THE Parent_Registration_Form SHALL contain a Parent_Username text input field with a visible label
2. THE Parent_Registration_Form SHALL contain a Name text input field with a visible label
3. THE Parent_Registration_Form SHALL contain a Phone Number text input field with a visible label
4. THE Parent_Registration_Form SHALL contain an Email text input field with a visible label
5. THE Parent_Registration_Form SHALL contain a Password input field with a visible label and masked characters
6. THE Parent_Registration_Form SHALL contain a submit button labeled "Register Parent"

### Requirement 4: Parent Registration Form Validation

**User Story:** As a new parent, I want immediate feedback on my input so that I can correct errors before submitting.

#### Acceptance Criteria

1. WHEN a user submits the Parent_Registration_Form with a Parent_Username shorter than 8 characters or longer than 15 characters, THE Validation_Engine SHALL display an inline error message stating the allowed length
2. WHEN a user submits the Parent_Registration_Form with a Parent_Username containing characters other than alphabets, numbers, hyphens, or underscores, THE Validation_Engine SHALL display an inline error message stating the allowed characters
3. WHEN a user submits the Parent_Registration_Form with a Name shorter than 5 characters or longer than 20 characters, THE Validation_Engine SHALL display an inline error message stating the allowed length
4. WHEN a user submits the Parent_Registration_Form with a Name containing characters other than alphabets and spaces, THE Validation_Engine SHALL display an inline error message stating the allowed characters
5. WHEN a user submits the Parent_Registration_Form with a Phone Number that is not exactly 10 digits, THE Validation_Engine SHALL display an inline error message stating the required format
6. WHEN a user submits the Parent_Registration_Form with an Email longer than 30 characters or in an invalid email format, THE Validation_Engine SHALL display an inline error message stating the requirements
7. WHEN a user submits the Parent_Registration_Form with a Password shorter than 8 characters or longer than 20 characters, THE Validation_Engine SHALL display an inline error message stating the allowed length
8. WHEN a user submits the Parent_Registration_Form with a Password containing characters other than alphabets, numbers, or special symbols, THE Validation_Engine SHALL display an inline error message stating the allowed characters
9. WHEN a validation error is displayed, THE Validation_Engine SHALL associate the error message with the relevant input using `aria-describedby`

### Requirement 5: Parent Registration Submission

**User Story:** As a new parent, I want to submit my registration so that my account is created and I can start using the platform.

#### Acceptance Criteria

1. WHEN a user submits a valid Parent_Registration_Form, THE Auth_Service SHALL send a POST request to `/api/v1/auth/register/parent` with the form data
2. WHEN the parent registration API returns a success response, THE Registration_View SHALL display a success message and navigate to the login view (hash `#`) after 3 seconds; IF the navigation fails, THEN THE Registration_View SHALL display a "Go to Login" link as fallback
3. WHILE the Parent_Registration_Form submission is in progress, THE Parent_Registration_Form SHALL disable the submit button and display a loading indicator
4. IF the parent registration API returns an error response, THEN THE Registration_View SHALL display the error message below the form

### Requirement 6: Parent Login Gate for Student Registration

**User Story:** As a parent, I want to authenticate myself before registering my child so that only authorized parents can create student accounts.

#### Acceptance Criteria

1. THE Parent_Login_Gate SHALL display a login form with username and password fields and a submit button labeled "Login as Parent"
2. WHEN a user submits the Parent_Login_Gate form, THE Auth_Service SHALL send a POST request to `/api/v1/auth/login` with the username, password, and role set to "parent"
3. WHEN the parent login API returns a success response, THE Registration_View SHALL store the parent authentication token and display the Student_Registration_Form
4. WHILE the Parent_Login_Gate submission is in progress, THE Parent_Login_Gate SHALL disable the submit button and display a loading indicator
5. IF the parent login API returns an error response, THEN THE Parent_Login_Gate SHALL display the error message below the form

### Requirement 7: Student Registration Form Display

**User Story:** As an authenticated parent, I want to register my child's details so that they can access age-appropriate learning content.

#### Acceptance Criteria

1. WHEN the parent authentication succeeds via the Parent_Login_Gate, THE Registration_View SHALL display the Student_Registration_Form
2. THE Student_Registration_Form SHALL contain a Parent Username text input field pre-filled with the authenticated parent's username and marked as read-only
3. THE Student_Registration_Form SHALL contain a Student_Username text input field with a visible label
4. THE Student_Registration_Form SHALL contain a Name text input field with a visible label
5. THE Student_Registration_Form SHALL contain a Grade dropdown with options: LKG, UKG, First, Second, Third, Fourth, Fifth, Sixth, Seventh, Eighth, Ninth, Tenth, Eleventh, Twelfth
6. THE Student_Registration_Form SHALL contain a School Name text input field with a visible label
7. THE Student_Registration_Form SHALL contain a submit button labeled "Register Student"

### Requirement 8: Student Registration Form Validation

**User Story:** As an authenticated parent, I want immediate feedback on my child's registration details so that I can fix errors before submitting.

#### Acceptance Criteria

1. WHEN a user submits the Student_Registration_Form with a Student_Username shorter than 8 characters or longer than 15 characters, THE Validation_Engine SHALL display an inline error message stating the allowed length
2. WHEN a user submits the Student_Registration_Form with a Student_Username containing characters other than alphabets, numbers, hyphens, or underscores, THE Validation_Engine SHALL display an inline error message stating the allowed characters
3. WHEN a user submits the Student_Registration_Form with a Name shorter than 5 characters or longer than 20 characters, THE Validation_Engine SHALL display an inline error message stating the allowed length
4. WHEN a user submits the Student_Registration_Form with a Name containing characters other than alphabets and spaces, THE Validation_Engine SHALL display an inline error message stating the allowed characters
5. WHEN a user submits the Student_Registration_Form with a School Name shorter than 5 characters or longer than 20 characters, THE Validation_Engine SHALL display an inline error message stating the allowed length
6. WHEN a user submits the Student_Registration_Form with a School Name containing characters other than alphabets, spaces, commas, or hyphens, THE Validation_Engine SHALL display an inline error message stating the allowed characters
7. WHEN a user submits the Student_Registration_Form without selecting a Grade, THE Validation_Engine SHALL display an inline error message requiring a selection
8. WHEN a validation error is displayed, THE Validation_Engine SHALL associate the error message with the relevant input using `aria-describedby`

### Requirement 9: Student Registration Submission

**User Story:** As an authenticated parent, I want to complete my child's registration and be directed back to login so that my child can start using the platform.

#### Acceptance Criteria

1. WHEN a user submits a valid Student_Registration_Form, THE Auth_Service SHALL send a POST request to `/api/v1/auth/register/student` with the form data and the parent authentication token in the Authorization header
2. WHEN the student registration API returns a success response, THE Registration_View SHALL display a success message and navigate to the login view (hash `#`) after 3 seconds; IF the navigation fails, THEN THE Registration_View SHALL display a "Go to Login" link as fallback
3. WHILE the Student_Registration_Form submission is in progress, THE Student_Registration_Form SHALL disable the submit button and display a loading indicator
4. IF the student registration API returns an error response, THEN THE Registration_View SHALL display the error message below the form

### Requirement 10: Forgot Password Request

**User Story:** As a user (parent or student) who has forgotten my password, I want to request a reset link so that I can regain access to my account.

#### Acceptance Criteria

1. WHEN the URL hash is `#forgot-password`, THE Forgot_Password_View SHALL display a form with a single input field labeled "Parent Username or Email"
2. THE Forgot_Password_View SHALL display helper text explaining that the reset link is sent to the parent's registered email for both parent and student accounts
3. THE Forgot_Password_View SHALL contain a submit button labeled "Send Reset Link"
4. WHEN a user submits the forgot password form with a non-empty value, THE Auth_Service SHALL send a POST request to `/api/v1/auth/forgot-password` with the identifier
5. WHEN the forgot password API returns a success response, THE Forgot_Password_View SHALL display a confirmation message stating that a reset link has been sent to the parent's registered email
6. WHILE the forgot password form submission is in progress, THE Forgot_Password_View SHALL disable the submit button and display a loading indicator
7. IF the forgot password API returns an error response, THEN THE Forgot_Password_View SHALL display the error message below the form and hide any inline validation errors
8. WHEN a user submits the forgot password form with an empty value, THE Validation_Engine SHALL display an inline error message requiring input; IF an API error message is already displayed, THEN inline validation errors SHALL be hidden

### Requirement 11: Reset Password Form

**User Story:** As a user, I want to set a new password using the link I received so that I can securely access my account again.

#### Acceptance Criteria

1. WHEN the URL hash matches `#reset-password?token=<value>`, THE Reset_Password_View SHALL display a form with New Password and Confirm Password fields
2. WHEN a user submits the reset password form with a New Password shorter than 8 characters or longer than 20 characters, THE Validation_Engine SHALL display an inline error message stating the allowed length
3. WHEN a user submits the reset password form with a New Password containing characters other than alphabets, numbers, or special symbols, THE Validation_Engine SHALL display an inline error message stating the allowed characters
4. WHEN a user submits the reset password form where New Password and Confirm Password do not match, THE Validation_Engine SHALL display an inline error message stating that passwords must match
5. WHEN a user submits a valid reset password form, THE Auth_Service SHALL send a POST request to `/api/v1/auth/reset-password` with the new password and the token from the URL
6. WHEN the reset password API returns a success response, THE Reset_Password_View SHALL display a success message and navigate to the login view (hash `#`) after 3 seconds
7. WHILE the reset password form submission is in progress, THE Reset_Password_View SHALL disable the submit button and display a loading indicator; THE loading state SHALL persist until the API returns a success or error response
8. IF the reset password API returns an error response, THEN THE Reset_Password_View SHALL display the error message below the form

### Requirement 12: Navigation

**User Story:** As a user, I want to navigate between registration, forgot password, and login views so that I can access the correct flow.

#### Acceptance Criteria

1. THE Registration_View SHALL display a "Back to Login" link that navigates to hash `#`
2. THE Forgot_Password_View SHALL display a "Back to Login" link that navigates to hash `#`
3. THE Reset_Password_View SHALL display a "Back to Login" link that navigates to hash `#`
4. WHEN the URL hash changes, THE application SHALL render the corresponding view without a full page reload; IF the hash does not match any known route, THEN THE application SHALL fall back to rendering the Home_Page login view

### Requirement 13: Accessibility

**User Story:** As a user with assistive technology, I want the login, registration, and password reset forms to be keyboard navigable and screen-reader friendly so that I can use the application independently.

#### Acceptance Criteria

1. THE Home_Page, Registration_View, Forgot_Password_View, and Reset_Password_View SHALL support full keyboard navigation using Tab, Shift+Tab, and Enter keys
2. THE form inputs in all views SHALL each have an associated `<label>` element with matching `for` and `id` attributes
3. WHEN a form validation error occurs, THE Validation_Engine SHALL associate the error message with the relevant input using `aria-describedby`
4. THE Role_Selector on the Home_Page SHALL use radio button inputs with a visible group label for screen reader context
5. THE Role_Choice_Screen in the Registration_View SHALL use radio button inputs with a visible group label for screen reader context
6. THE read-only Parent Username field in the Student_Registration_Form SHALL include `aria-readonly="true"` for assistive technology awareness
