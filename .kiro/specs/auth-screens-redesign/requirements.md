# Requirements Document

## Introduction

Rebuild the web Login and Parent Registration screens to match the ChikuMiku LearnVerse design mockups and design system. The current implementation uses generic colors and a single-column layout without branding. The redesign introduces a two-panel login layout with a branding panel, styled role-selector tabs, a full-width navigation bar, password strength indicators on registration, and pixel-accurate adherence to the design system tokens (colors, typography, spacing, radii, shadows).

## Glossary

- **Login_Screen**: The web page at `/login` that allows users to authenticate by entering credentials
- **Registration_Screen**: The web page at `/register/parent` that allows new parents to create an account
- **Top_Navigation_Bar**: A 36px-height horizontal bar at the top of every auth screen containing the logo, nav links, and an avatar
- **Branding_Panel**: The left half of the Login_Screen displaying the platform title, subtitle, and stats
- **Login_Panel**: The right half of the Login_Screen containing the login form with role tabs
- **Role_Tabs**: A pair of styled tab buttons ("Parent" | "Learner") that switch the login context
- **Password_Strength_Indicator**: A set of inline checkmarks showing which password criteria have been met
- **Design_System**: The set of color, typography, spacing, radius, and shadow tokens that all UI elements follow
- **Logo_Watermark**: The ChikuMiku LearnVerse logo rendered at 75% container width, centered, at 5% opacity behind page content

## Requirements

### Requirement 1: Top Navigation Bar

**User Story:** As a user, I want to see a consistent navigation bar at the top of auth screens, so that I can identify the platform and navigate to key areas.

#### Acceptance Criteria

1. THE Top_Navigation_Bar SHALL render at a fixed height of 36px with background color #2C2341
2. THE Top_Navigation_Bar SHALL display the ChikuMiku LearnVerse logo on the left side with a maximum height equal to the bar height and an alt text of "ChikuMiku LearnVerse"
3. THE Top_Navigation_Bar SHALL display navigation links (Dashboard, Subjects, Revision, Progress) horizontally after the logo
4. THE Top_Navigation_Bar SHALL display a circular avatar element with the letter "A" on the right side
5. WHEN a navigation link receives hover or keyboard focus, THE Top_Navigation_Bar SHALL indicate the focused link by applying an underline or a background color change distinguishable from the default link state
6. THE Top_Navigation_Bar SHALL use font size 11-13px SemiBold #FFFFFF for navigation link text
7. THE Top_Navigation_Bar SHALL render all navigation links as focusable elements accessible via Tab and Shift+Tab keyboard navigation in left-to-right order
8. WHEN a user activates a navigation link via click or Enter key, THE Top_Navigation_Bar SHALL navigate to the corresponding application route without a full page reload
9. THE Top_Navigation_Bar SHALL be rendered identically on the Login_Screen and the Registration_Screen

### Requirement 2: Login Screen Two-Panel Layout

**User Story:** As a user, I want to see an attractive split layout on the login page, so that I can quickly identify the platform branding and locate the login form.

#### Acceptance Criteria

1. THE Login_Screen SHALL display a two-panel horizontal layout with the Branding_Panel on the left and the Login_Panel on the right
2. THE Login_Screen SHALL use page background color #F8F5FF
3. THE Branding_Panel SHALL display "ChikuMiku LearnVerse" as the title at 26px Bold #2C2341
4. THE Branding_Panel SHALL display "Where Curiosity Comes Alive ✨" as the subtitle below the title
5. THE Branding_Panel SHALL display three stat badges: "7+ Subjects", "LKG-12 Grades", "AI Powered"
6. THE Login_Panel SHALL be contained in a card with 16px border-radius and box-shadow 0 4px 20px rgba(0,0,0,.08)
7. WHEN the viewport width is below 768px, THE Login_Screen SHALL stack the panels vertically with the Branding_Panel above the Login_Panel

### Requirement 3: Login Form Styling

**User Story:** As a user, I want the login form to match the mockup exactly, so that I have a polished and consistent experience.

#### Acceptance Criteria

1. THE Login_Panel SHALL display "Welcome Back!" as the heading at 16-18px Bold #2C2341
2. THE Login_Panel SHALL display "Log in to continue learning" as the subtitle below the heading at 12-14px Regular #6B7280
3. THE Login_Panel SHALL render Role_Tabs as pill-shaped toggle buttons with 20-22px border-radius, where the inactive tab has a transparent background and text color #2C2341
4. WHILE the "Parent" tab is active, THE Role_Tabs SHALL highlight the active tab with background color #E94F9B and text color #FFFFFF
5. WHILE the "Learner" tab is active, THE Role_Tabs SHALL highlight the active tab with background color #E94F9B and text color #FFFFFF
6. THE Login_Panel SHALL render the Username input with label "Username" at 10-11px SemiBold #2C2341, input border-radius 8px, and a 1px solid #E0D8EC border
7. THE Login_Panel SHALL render the Password input with label "Password" at 10-11px SemiBold #2C2341, input border-radius 8px, and a 1px solid #E0D8EC border
8. THE Login_Panel SHALL render a "Login" button with background color #E94F9B, text color #FFFFFF, font 11-13px SemiBold, border-radius 20-22px (pill-shaped), and full width of the form container
9. THE Login_Panel SHALL display a "Forgot Password?" link below the login button at 10-12px Regular #E94F9B, center-aligned
10. WHEN the Login_Panel initially loads, THE Role_Tabs SHALL display the "Parent" tab as active by default

### Requirement 4: Login Logo Watermark

**User Story:** As a user, I want to see the platform logo subtly in the background, so that the branding feels immersive without distracting from the form.

#### Acceptance Criteria

1. THE Login_Screen SHALL display the Logo_Watermark at 75% of the content area width while maintaining the logo's original aspect ratio
2. THE Logo_Watermark SHALL be centered horizontally and vertically within the Login_Screen content area
3. THE Logo_Watermark SHALL render at 5% opacity
4. THE Logo_Watermark SHALL be rendered behind all interactive elements and SHALL not intercept pointer events, so that all form inputs, buttons, and links remain fully clickable
5. IF the Logo_Watermark image fails to load, THEN THE Login_Screen SHALL hide the watermark element and continue to display the login form without visual disruption

### Requirement 5: Parent Registration Screen Layout

**User Story:** As a parent, I want a clear and well-structured registration form, so that I can create my account without confusion.

#### Acceptance Criteria

1. THE Registration_Screen SHALL display the same Top_Navigation_Bar as the Login_Screen
2. THE Registration_Screen SHALL display "Create Parent Account" as the heading at 16-18px Bold #2C2341
3. THE Registration_Screen SHALL display "Register first, then add your children" as the subtitle below the heading
4. THE Registration_Screen SHALL use page background color #F8F5FF
5. THE Registration_Screen SHALL render the form inside a card with 16px border-radius and box-shadow 0 4px 20px rgba(0,0,0,.08)

### Requirement 6: Parent Registration Form Fields

**User Story:** As a parent, I want clearly labeled form fields with constraints visible, so that I know what is expected before I submit.

#### Acceptance Criteria

1. THE Registration_Screen SHALL render a "Parent Username *" field with placeholder indicating 8-15 characters allowed
2. THE Registration_Screen SHALL render a "Name *" field with placeholder indicating 5-20 characters allowed
3. THE Registration_Screen SHALL render a "Phone *" field with placeholder indicating 10 digits required
4. THE Registration_Screen SHALL render an "Email *" field with placeholder indicating 30 characters maximum
5. THE Registration_Screen SHALL render a "Password *" field with placeholder indicating 8-20 characters with uppercase, lowercase, number, and symbol required
6. THE Registration_Screen SHALL render all input fields with border-radius 8px and border color #E0D8EC
7. THE Registration_Screen SHALL render all field labels at 10-11px SemiBold #2C2341

### Requirement 7: Password Strength Indicator

**User Story:** As a parent, I want to see real-time feedback on my password strength, so that I can create a secure password that meets all requirements.

#### Acceptance Criteria

1. WHILE the Password field on the Registration_Screen has focus or contains text, THE Password_Strength_Indicator SHALL be visible below the password input
2. THE Password_Strength_Indicator SHALL display five criteria: "Uppercase", "Lowercase", "Number", "Symbol", "8+ chars"
3. WHEN a criterion is satisfied, THE Password_Strength_Indicator SHALL display a green checkmark (color #27AE60) next to that criterion
4. WHEN a criterion is not satisfied, THE Password_Strength_Indicator SHALL display a neutral or inactive indicator next to that criterion
5. THE Password_Strength_Indicator SHALL update in real-time as the user types each character

### Requirement 8: Registration Submit Button

**User Story:** As a parent, I want a clear call-to-action button to submit my registration, so that I can complete the process confidently.

#### Acceptance Criteria

1. THE Registration_Screen SHALL render a "Register Parent" button with background color #E94F9B, text color #FFFFFF, font 11-13px SemiBold, and border-radius 20-22px (pill-shaped)
2. WHEN the form is being submitted, THE Registration_Screen SHALL disable the button and display loading text "Registering..."
3. IF form validation fails, THEN THE Registration_Screen SHALL display inline error messages in color #E74C3C below the respective fields

### Requirement 9: Design System Token Compliance

**User Story:** As a designer, I want all UI elements to use the exact design system tokens, so that the screens are pixel-accurate to the mockups.

#### Acceptance Criteria

1. THE Design_System SHALL define the primary color as #E94F9B for all CTA buttons and active states
2. THE Design_System SHALL define the secondary color as #9B59B6 for headers and sidebar elements
3. THE Design_System SHALL define the background color as #F8F5FF for page bases
4. THE Design_System SHALL define the border color as #E0D8EC for all input dividers
5. THE Design_System SHALL define the dark color as #2C2341 for dark backgrounds and heading text
6. THE Design_System SHALL define the error color as #E74C3C for all error states
7. THE Design_System SHALL define the success color as #27AE60 for success states and password criteria checkmarks
8. THE Design_System SHALL define card radius as 16px, button radius as 20-22px, and input radius as 8px
9. THE Design_System SHALL define card shadow as 0 4px 20px rgba(0,0,0,.08)
10. THE Design_System SHALL define the web content area minimum width as 960px
