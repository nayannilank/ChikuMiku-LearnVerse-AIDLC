# Requirements Document

## Introduction

This document specifies the UX improvements required for the ChikuMiku LearnVerse mobile and web applications. The app currently launches directly into the subject selection screen without authentication, lacks proper textbook and chapter management when creating new content, does not provide camera or image upload functionality in the learning screen, and needs branding integration using the existing logo asset across mobile, app icon, and web UI. These improvements address critical gaps in user onboarding, content creation, and branding experience.

## Glossary

- **App**: The ChikuMiku LearnVerse React Native mobile application located at `packages/platform-mobile/rn-app/`
- **Web_UI**: The ChikuMiku LearnVerse web application interface accessible via browser
- **Auth_Service**: The existing authentication backend at `packages/services/auth/` providing registration, login, session management, and lockout logic
- **Auth_Screen**: The login and registration screen presented before access to the main app content
- **Navigator**: The React Navigation native stack navigator managing screen transitions in the App
- **Learning_Screen**: The screen where learners interact with chapter content, upload pages, and study
- **Textbook_Entry_Form**: A form collecting the textbook name when a subject has no existing textbook associated with it
- **Chapter_Creation_Form**: A form collecting the chapter name after a textbook has been created or selected
- **Camera_Capture_UI**: The user interface element allowing learners to take a photo using the device camera
- **Image_Picker_UI**: The user interface element allowing learners to select an image from the device gallery
- **Page_Addition_UI**: The combined interface presenting both Camera_Capture_UI and Image_Picker_UI options for adding textbook pages to an active chapter
- **Splash_Screen**: The initial branded screen displayed while the App loads
- **Logo_Asset**: The `LearnVerse-LearnVerse-Logo.png` file located at the project root
- **Session_Token**: A JWT token issued by the Auth_Service upon successful login, valid for a minimum of 30 days
- **Lockout**: A 15-minute account lock triggered after 3 consecutive failed login attempts
- **Parent**: A registered adult user who can have one or more students (kids) linked to their account; owns the phone number and email used for account recovery
- **Student**: A learner (kid) who uses the app and is linked to a Parent account via the Parent's username

## Requirements

### Requirement 1: Authentication Gate

**User Story:** As a learner, I want to log in or create an account before accessing app content, so that my learning progress is associated with my profile.

#### Acceptance Criteria

1. WHEN the App launches and no valid Session_Token exists in device storage, THE Navigator SHALL display the Auth_Screen as the initial route instead of the subject selection screen
2. WHEN the App launches and a valid (non-expired) Session_Token exists in device storage, THE Navigator SHALL bypass the Auth_Screen and display the subject selection screen within 2 seconds of the Splash_Screen appearing
3. WHEN an API call returns an authentication error indicating the Session_Token is expired or invalid during an active session, THE Navigator SHALL redirect the learner to the Auth_Screen and display a message indicating the session has ended
4. THE Auth_Screen SHALL provide a toggle between login mode and registration mode, with login mode displayed as the default
5. IF the App launches and token validation fails due to a network error, THEN THE Navigator SHALL display the Auth_Screen with a message indicating a connection problem
6. WHEN the Navigator redirects the learner to the Auth_Screen due to Session_Token expiration, THE App SHALL attempt to preserve any unsaved learner input in local device storage so it can be restored after re-authentication. IF the local storage operation fails due to device storage limits or permissions, THEN THE App SHALL display an error message and allow the user to choose whether to proceed without saving or attempt to save their work elsewhere

### Requirement 2: Login Flow

**User Story:** As a returning learner, I want to log in with my username and password, so that I can resume my learning sessions.

#### Acceptance Criteria

1. THE Auth_Screen in login mode SHALL display input fields for username (5 to 15 characters) and password (maximum 20 characters, masked by default)
2. WHEN the learner submits valid credentials, THE Auth_Screen SHALL disable the submit button, authenticate against the Auth_Service within 30 seconds, and store the returned Session_Token in device storage
3. WHEN login succeeds, THE Navigator SHALL transition to the subject selection screen regardless of other system states
4. IF the Auth_Service returns an authentication error or any error flag is set, THEN THE Auth_Screen SHALL display the error message to the learner, preserve the username field, clear the password field, and re-enable the submit button
5. IF the account is locked due to 3 consecutive failed attempts, THEN THE Auth_Screen SHALL display a lockout notification informing the learner to retry after 15 minutes and disable the submit button until the lockout period expires
6. IF the device has no network connectivity when the learner submits credentials, THEN THE Auth_Screen SHALL display an error message indicating that a network connection is required and preserve all entered field values
7. THE Auth_Screen in login mode SHALL provide a "Forgot Password" link that initiates the password recovery process using the phone number or email registered to the Parent account linked to the Student

### Requirement 3: Registration Flow

**User Story:** As a new user (parent or student), I want to create an account, so that I can start using the app.

#### Acceptance Criteria

##### New Parent Registration

1. THE Auth_Screen in registration mode SHALL provide a "Register as Parent" option displaying input fields for name (maximum 100 characters), username (5 to 15 characters), phone number (exactly 10 digits, without country code), and email address (maximum 254 characters, containing "@" and a domain)
2. THE Auth_Screen SHALL validate that the Parent username contains only alphanumeric characters, underscores, and hyphens, with a length between 5 and 15 characters
3. THE Auth_Screen SHALL validate that the Parent email matches a valid email address format and the phone number contains exactly 10 digits without a country code
4. WHEN a Parent submits a valid registration form, THE Auth_Screen SHALL disable the submit button, display a loading indicator, and send the registration request to the Auth_Service
5. WHEN Parent registration succeeds, THE Auth_Screen SHALL display a confirmation message indicating the Parent account has been created and prompt the Parent to register their student
6. IF the Auth_Service returns a registration error (duplicate username, email, or phone), THEN THE Auth_Screen SHALL display an error message identifying the duplicate field and preserve all other valid form fields

##### New Student Registration

7. THE Auth_Screen in registration mode SHALL provide a "Register as Student" option displaying input fields for name (maximum 100 characters), username (5 to 15 characters), password, grade selection (grades 1 through 12), and parent username (5 to 15 characters)
8. THE Auth_Screen SHALL validate that the Student password is between 8 and 20 characters, contains at least one uppercase letter, one lowercase letter, one special character, and one digit
9. THE Auth_Screen SHALL validate that the Student username contains only alphanumeric characters, underscores, and hyphens, with a length between 5 and 15 characters
10. WHEN a Student submits a valid registration form, THE Auth_Service SHALL verify that the parent username exists and link the Student account to the corresponding Parent account
11. WHEN Student registration succeeds, THE Auth_Screen SHALL automatically log in the Student and only transition to the subject selection screen after login completes successfully
12. IF the Auth_Service cannot find the specified parent username, THEN THE Auth_Screen SHALL display an error message indicating that the parent username does not exist and preserve all other valid form fields
13. IF a registration request fails due to a network error or timeout (within 30 seconds), THEN THE Auth_Screen SHALL display an error message indicating a connectivity problem, re-enable the submit button, and preserve all form field values

##### Shared Validation

14. WHEN validation fails on any registration form, THE Auth_Screen SHALL display field-specific error messages adjacent to the invalid fields while preserving valid field values

### Requirement 4: Textbook and Chapter Creation

**User Story:** As a learner, I want to add textbooks to a subject and then create chapters within those textbooks, so that my study content is organized by book and chapter.

#### Acceptance Criteria

1. WHEN the learner selects a subject that has no textbooks associated with it, THE App SHALL display the Textbook_Entry_Form prompting the learner to enter a textbook name before any chapter can be created
2. THE Textbook_Entry_Form SHALL validate that the textbook name is a non-empty string of at most 200 characters
3. WHEN the learner submits a valid Textbook_Entry_Form, THE App SHALL create the textbook under the selected subject and display the chapter list for that textbook
4. WHEN a subject already has one or more textbooks, THE App SHALL display the list of existing textbooks and allow the learner to select one or add a new textbook
5. WHEN the learner taps "Add Chapter" within a selected textbook, THE Chapter_Creation_Form SHALL appear requesting the chapter name
6. THE Chapter_Creation_Form SHALL validate that the chapter name is a non-empty string of at most 200 characters
7. WHEN the learner submits a valid Chapter_Creation_Form, THE App SHALL create the chapter under the selected textbook and navigate to the Learning_Screen for that chapter
8. IF the learner cancels the Textbook_Entry_Form or Chapter_Creation_Form, THEN THE App SHALL remain on the previous screen without creating a textbook or chapter
9. IF the backend API returns an error during textbook or chapter creation, THEN THE active form SHALL display the error message and remain open for correction with all previously entered field values preserved
10. IF the learner submits a form with invalid input, THEN THE active form SHALL display field-specific error messages indicating the validation failure and preserve all entered field values

### Requirement 5: Page Addition in Learning Screen (Camera and Image Upload)

**User Story:** As a learner, I want to capture or upload photos of textbook pages from within an active chapter, so that I can digitize content for study.

#### Acceptance Criteria

1. WHILE a chapter is active, THE Learning_Screen SHALL display the Page_Addition_UI containing both a camera capture button and a gallery upload button
2. WHEN the learner taps the camera capture button and camera permission has not been previously granted, THE App SHALL request camera permission from the operating system
3. WHEN camera permission is granted, THE App SHALL open the device camera for photo capture in JPEG format
4. WHEN the learner captures a photo, THE App SHALL display a preview of the captured image with options to accept or retake
5. WHEN the learner accepts a captured image, THE App SHALL associate the image with the active chapter as a new page and return to the Learning_Screen
6. IF camera permission is denied, THEN THE App SHALL display a message explaining that camera access is required and provide guidance to enable it in device settings
7. IF the camera is unavailable on the device, THEN THE App SHALL hide the camera capture button and display only the gallery upload button in the Page_Addition_UI
8. IF the capture operation fails due to a hardware or storage error, THEN THE App SHALL display an error message indicating the failure reason and return the learner to the Learning_Screen without losing existing chapter content
9. WHEN the learner taps the gallery upload button, THE App SHALL request storage or photo library permission if not previously granted
10. WHEN storage or photo library permission is granted, THE App SHALL open the device file picker filtered to image files (JPEG and PNG)
11. WHEN the learner selects an image that is 10 MB or smaller, THE App SHALL display a preview of the selected image with options to accept or choose a different image
12. WHEN the learner accepts a previewed gallery image, THE App SHALL upload the image to the backend API associated with the active chapter as a new page. IF the backend upload fails, THEN THE App SHALL remove the local association, display an error message indicating the upload failure, and return to the Learning_Screen without the failed page
13. IF the learner cancels the file picker without selecting an image, THEN THE App SHALL remain on the Learning_Screen without changes
14. IF the selected file exceeds 10 MB, THEN THE App SHALL display an error message indicating the 10 MB size limit and return to the Learning_Screen without uploading
15. IF storage or photo library permission is denied, THEN THE App SHALL display a message explaining that gallery access is required and provide guidance to enable it in device settings

### Requirement 6: Splash Screen and Mobile Branding

**User Story:** As a learner, I want to see the ChikuMiku LearnVerse logo when the app starts, so that I recognize the brand and have a polished launch experience.

#### Acceptance Criteria

1. WHEN the App launches, THE Splash_Screen SHALL display the Logo_Asset horizontally and vertically centered on a white background
2. WHILE the App is initializing, THE Splash_Screen SHALL remain visible for a minimum of 1 second and a maximum of 5 seconds; these duration constraints apply only during initialization, after which the App SHALL transition to either the Auth_Screen or the subject selection screen
3. THE App SHALL use the Logo_Asset as the Android app icon
4. THE App SHALL use the Logo_Asset as the header logo within the navigation bar, scaled to fit the navigation bar height without cropping
5. IF the App fails to complete initialization within the 5-second maximum splash duration, THEN THE App SHALL transition to the Auth_Screen and display an error message indicating a connection or loading issue

### Requirement 7: Web UI Branding

**User Story:** As a user accessing the web interface, I want to see the ChikuMiku LearnVerse logo on the web UI, so that the brand is consistent across all platforms.

#### Acceptance Criteria

1. THE Web_UI SHALL display the Logo_Asset in the header or navigation area, scaled proportionally to fit without cropping
2. THE Web_UI SHALL use the Logo_Asset as the browser favicon
3. WHEN the Web_UI loads, THE Logo_Asset SHALL be visible on the login page and all authenticated pages within the navigation area
4. IF the Logo_Asset fails to load, THEN THE Web_UI SHALL display the text "ChikuMiku LearnVerse" as a fallback in place of the logo image
