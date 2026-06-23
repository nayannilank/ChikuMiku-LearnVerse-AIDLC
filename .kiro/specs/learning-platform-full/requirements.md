# Requirements Document

## Introduction

This document defines the requirements for the ChikuMiku LearnVerse learning platform — a multi-subject educational application for children covering Kannada, English, Hindi, Maths, Computers, and EVS (Environmental Studies). The platform provides interactive learning experiences including pronunciation practice with audio recording, grammar exercises, timed quizzes, math practice with visual aids, code matching exercises, and science visualizations. Additionally, the platform supports content ingestion through camera capture and image upload of textbook pages, text recognition (OCR) to digitize physical textbook content, and AI-assisted learning features including chapter explanations with read/listen modes and exercise assistance that provides contextual hints and feedback referencing chapter content. The system spans a React web application and React Native mobile app, backed by AWS serverless infrastructure (API Gateway, Lambda, PostgreSQL with pgvector, S3, CloudFront, Cognito).

## Glossary

- **Dashboard**: The home screen displaying a personalized greeting, learning streaks, subject cards with progress, and recent activity
- **Subject_Card**: A UI card on the Dashboard representing a subject (Kannada, English, Hindi, Maths, Computers, EVS) showing title, icon, progress percentage, and subject-specific color
- **Pronunciation_Screen**: A screen displaying a word or script character with audio playback, syllable breakdown, recording capability, and accuracy score
- **Grammar_Exercise_Screen**: A screen displaying fill-in-the-blank or sentence-construction exercises with multiple-choice options and explanatory feedback
- **Quiz_Screen**: A timed assessment screen with numbered questions, A/B/C/D answer options, skip/submit controls, and a live score panel
- **Maths_Practice_Screen**: A screen displaying visual fraction representations with interactive numerator/denominator input and immediate answer checking
- **Computers_Exercise_Screen**: A screen with a code editor area and drag-and-drop matching exercises for programming concepts
- **EVS_Visualization_Screen**: A screen displaying animated scientific visualizations (e.g., water cycle) with drag-and-drop ordering exercises
- **Content_API**: The backend REST API service managing subject content (questions, exercises, audio references) via AWS API Gateway and Lambda
- **Progress_Service**: The backend service tracking per-student, per-subject learning progress, streaks, and quiz scores stored in PostgreSQL
- **Audio_Service**: The backend service handling audio file storage in S3, pronunciation scoring using Whisper (speech-to-text), and reference audio generation using Google Text-to-Speech
- **Quiz_Session**: A time-bounded assessment session with a fixed question set, timer, and score calculation
- **Bottom_Navigation**: The mobile navigation bar with tabs: Home, Chapters, Scan, Revision, Me
- **Web_Navigation**: The web top navigation bar with links: Dashboard, Subjects, Revision, Progress, and user avatar
- **Design_System**: The set of design tokens (colors, typography, spacing, radii) ensuring visual consistency across the platform
- **Student**: An authenticated child user who interacts with learning content; has a set of assigned subjects configured during registration by the Parent
- **Parent**: An authenticated adult user who registers students, assigns subjects, creates custom subjects, and monitors progress
- **Content_Ingestion_Screen**: The screen where a learner selects a subject, book, and chapter, then uploads textbook pages via camera or gallery
- **Page_Upload_UI**: The interface for capturing photos using camera or uploading image files (JPEG, PNG, HEIC, max 10MB per image, max 50 pages per chapter)
- **Text_Recognition_Service**: The backend service that extracts text from uploaded page images using Google Vision OCR
- **Chapter_Transcript**: The extracted and editable text content of a chapter, organized page by page with word counts
- **Chapter_Explanation_Screen**: The screen displaying AI-generated explanations of chapter content, with page-by-page navigation and Read/Listen mode toggle
- **Exercise_Assistant**: The AI-powered feature that helps learners complete exercises by referencing back to chapter content and providing contextual hints
- **Book**: A textbook belonging to a subject (e.g., "Tili Kannada - Part 1"), containing one or more chapters
- **Chapter_Page**: A single uploaded image of a textbook page, stored in S3

## Requirements

### Requirement 1: Authentication Integration

**User Story:** As a Student or Parent, I want to securely register and log in to the platform, so that my data is protected and personalized to my account.

#### Acceptance Criteria

##### JWT and Session Management

1. THE Content_API SHALL validate JWT tokens issued by AWS Cognito on every authenticated request
2. WHEN a Student or Parent provides valid credentials, THE Authentication service SHALL issue a JWT access token and refresh token
3. IF a JWT token is expired, THEN THE Authentication service SHALL allow token refresh using a valid refresh token without requiring re-login
4. IF a refresh token is expired or invalid, THEN THE Authentication service SHALL require the user to log in again
5. THE Content_API SHALL extract the Student identifier from the JWT token claims to scope data access to the authenticated user

##### Login

6. THE Login Screen SHALL display a role selector with two options: "Parent" and "Learner", with "Parent" selected by default
7. THE Login Screen SHALL display a Username text input field with a visible label
8. THE Login Screen SHALL display a Password text input field with a visible label and masked characters
9. THE Login Screen SHALL display a "Login" submit button
10. THE Login Screen SHALL display a "Forgot Password?" link below the login button
11. WHEN a Parent or Student taps the Login button with valid credentials, THE application SHALL authenticate against the selected role and navigate to the appropriate Dashboard (Parent Dashboard for Parents, Learner Dashboard for Students)
12. IF login fails due to invalid credentials, THEN THE Login Screen SHALL display an error message indicating incorrect username or password, preserve the username field value, and clear the password field
13. WHEN a Parent or Student taps the "Forgot Password?" link, THE application SHALL navigate to the Password Recovery flow

##### Parent Registration

14. THE Parent Registration Form SHALL contain a Parent Username text input field with a visible label (between 8-15 characters with alphabets, numbers, hyphens, or underscores)
15. THE Parent Registration Form SHALL contain a Name text input field with a visible label (5-20 characters with alphabets and spaces)
16. THE Parent Registration Form SHALL contain a Phone Number text input field with a visible label (10 digits)
17. THE Parent Registration Form SHALL contain an Email text input field with a visible label (within 30 characters in proper format)
18. THE Parent Registration Form SHALL contain a Password input field with a visible label and masked characters (8-20 characters, at least one Uppercase alphabet, at least one lowercase alphabet, at least one number, at least one special symbol)
19. THE Parent Registration Form SHALL contain a submit button labeled "Register Parent"

##### Registration Error Handling

44. THE Registration Forms (Parent and Student) SHALL perform inline validation on each input field as the user types or when the field loses focus, displaying field-specific error messages adjacent to the invalid field
45. IF the server returns a duplicate username error, THEN THE Registration Form SHALL display a clear error message "Username already taken — please choose a different username" adjacent to the username field
46. IF the server returns a duplicate email error, THEN THE Registration Form SHALL display a clear error message "Email already registered — try logging in or use a different email" adjacent to the email field
47. IF the server returns a duplicate phone number error, THEN THE Registration Form SHALL display a clear error message "Phone number already registered — try logging in or use a different number" adjacent to the phone field
48. IF the server returns an internal error (5xx), THEN THE Registration Form SHALL display a message "Something went wrong — please try again after some time" and preserve all entered field values
49. WHEN a validation error is displayed, THE Registration Form SHALL preserve all valid field values and only highlight the invalid fields

##### Student Registration (by Parent)

20. THE Student Registration Form SHALL contain a Parent Username text input field pre-filled with the authenticated parent's username and marked as read-only
21. THE Student Registration Form SHALL contain a Student Username text input field with a visible label (between 8-15 characters with alphabets, numbers, hyphens, or underscores)
22. THE Student Registration Form SHALL contain a Name text input field with a visible label (5-20 characters with alphabets and spaces)
23. THE Student Registration Form SHALL contain a Password input field with a visible label and masked characters (8-20 characters, at least one Uppercase alphabet, at least one lowercase alphabet, at least one number, at least one special symbol)
24. THE Student Registration Form SHALL contain a Grade dropdown with options: LKG, UKG, First, Second, Third, Fourth, Fifth, Sixth, Seventh, Eighth, Ninth, Tenth, Eleventh, Twelfth
25. THE Student Registration Form SHALL contain a School Name text input field with a visible label (5-30 characters, allowing alphabets, numbers, commas, and hyphens)
26. THE Student Registration Form SHALL display a subject selection interface showing the 7 default subjects (Maths, Science, Computers, EVS, Hindi, English, Kannada) as selectable checkboxes, with all selected by default
27. THE Student Registration Form SHALL allow the Parent to deselect subjects that are not applicable to the Student
28. THE Student Registration Form SHALL provide an "Add Subject" option allowing the Parent to create a custom subject with a name of 1-50 characters (e.g., "French") which is then added to the selectable list
29. THE Student Registration Form SHALL require at least one subject to be selected before submission
30. THE Student Registration Form SHALL contain a submit button labeled "Register Student"

##### Password Recovery (Forgot Password)

31. THE Login Screen SHALL display a "Forgot Password?" link that navigates to the Password Recovery flow
32. WHEN a Parent or Student initiates Password Recovery, THE application SHALL display a form requesting the Parent's registered email address and phone number
33. WHEN the Parent or Student submits valid email and phone, THE Authentication service SHALL send a one-time password (OTP) to both the Parent's registered email and phone number simultaneously
34. THE OTP Verification screen SHALL display input fields for the OTP received via email and the OTP received via phone, both of which must be provided correctly before proceeding
35. IF either OTP is incorrect or expired (OTPs expire after 10 minutes), THEN THE application SHALL display an error message indicating the OTP is invalid and allow the user to request a new OTP
36. WHEN both OTPs are verified successfully, THE application SHALL navigate to the New Password screen where the user enters a new password conforming to the same complexity rules (8-20 characters, at least one uppercase, one lowercase, one number, one special symbol)
37. WHEN the new password is submitted, THE Authentication service SHALL update the password for the corresponding account (Parent or Student) and redirect to the Login screen with a success message
38. THE Password Recovery flow SHALL work for both Parent accounts (using the Parent's own email/phone) and Student accounts (using the linked Parent's email/phone)

##### Logout

39. THE application SHALL display a Logout button in the top-right corner of both web and mobile screens, visible on all authenticated pages
40. WHEN a Parent or Student taps the Logout button, THE application SHALL display a confirmation dialog asking "Are you sure you want to log out?"
41. WHEN the user confirms logout, THE application SHALL persist the latest state of all progress, exercise results, and session data to PostgreSQL before terminating the session
42. WHEN the state has been persisted, THE application SHALL clear the local JWT tokens and navigate to the Login Screen
43. WHEN the same Parent or Student logs back in, THE application SHALL restore the same state they had before logout (progress, streak, last viewed chapter/page)

### Requirement 2: AWS Serverless Infrastructure

**User Story:** As an operations team member, I want the platform hosted on AWS serverless infrastructure, so that the system scales automatically and minimizes operational overhead.

#### Acceptance Criteria

1. THE Infrastructure SHALL deploy the backend API using AWS API Gateway integrated with AWS Lambda functions running Node.js
2. THE Infrastructure SHALL provision PostgreSQL (with pgvector extension) for storing relational data, chapter embeddings, and vector similarity search
3. THE Infrastructure SHALL provision an S3 bucket for storing audio recordings (MP3), textbook page images, and generated assets with appropriate lifecycle policies
4. THE Infrastructure SHALL deploy the React web application via CloudFront distribution backed by an S3 origin bucket
5. THE Infrastructure SHALL configure AWS Cognito user pools for authentication with support for Student and Parent user groups
6. THE Infrastructure SHALL define all resources using AWS CDK (TypeScript) within the existing infra/cdk package
7. THE Infrastructure SHALL integrate with external AI services: Google Vision OCR for text extraction, OpenAI text-embedding-3-small for chapter embeddings, GPT-5 Mini for question answering and content generation, Google Text-to-Speech for audio playback, and Whisper for pronunciation evaluation
8. THE Infrastructure SHALL provision a custom Node.js AI Gateway service that mediates all AI service calls, manages API keys, and enforces the generate-once-store-permanently caching pattern to minimize AI costs

### Requirement 3: Design System Compliance

**User Story:** As a developer, I want all UI components to follow the established design system, so that the platform maintains visual consistency across screens and platforms.

#### Acceptance Criteria

1. THE Design_System SHALL define color tokens: pink primary (#E94F9B), purple secondary (#9B59B6), sky blue (#5DADE2), gold (#F7C948), green (#27AE60), dark (#2C2341), red (#E74C3C), indigo (#4A6CF7), background (#F8F5FF), border (#E0D8EC)
2. THE Design_System SHALL define typography scales: title 26px bold, headings 16-18px bold, card titles 13-14px semibold, body 12-13px regular, buttons 11-13px semibold, labels 10-11px semibold, captions 9-10px regular, Indic scripts 14-52px bold
3. THE Design_System SHALL define spacing tokens: card radius large 16px, card radius small 10px, button radius 20-22px, input radius 8px, card shadow "0 4px 20px rgba(0,0,0,.08)"
4. THE Design_System SHALL assign subject-specific colors for the 7 default subjects: Kannada uses purple, English uses sky blue, Hindi uses gold, Maths uses pink, Computers uses indigo, EVS uses green, Science uses teal (#4ECDC4). Custom subjects created by parents SHALL be assigned a color from a predefined palette that does not conflict with existing subject colors
5. WHILE the platform renders on mobile viewports (width 320-420px), THE Design_System SHALL apply mobile-specific layout patterns including the 44px Bottom_Navigation and full-width content
6. WHILE the platform renders on web viewports (width 960px and above), THE Design_System SHALL apply desktop layout patterns including the 36px Web_Navigation and 180-220px sidebar

### Requirement 4: Responsive Navigation

**User Story:** As a Student, I want consistent navigation across mobile and web platforms, so that I can easily move between sections regardless of my device.

#### Acceptance Criteria

1. WHILE the platform is accessed on mobile, THE Bottom_Navigation SHALL display five tabs: Home, Chapters, Scan, Revision, and Me with icons and labels
2. WHEN a Student taps a Bottom_Navigation tab, THE application SHALL navigate to the corresponding section and visually highlight the active tab
3. WHILE the platform is accessed on web, THE Web_Navigation SHALL display a top bar with the logo, navigation links (Dashboard, Subjects, Revision, Progress), and a user avatar
4. WHEN a Student clicks a Web_Navigation link, THE application SHALL navigate to the corresponding section and visually highlight the active link
5. THE Web_Navigation SHALL display a sidebar on screens wider than 960px listing all subjects with their icons and progress indicators

### Requirement 5: Streak Tracking

**User Story:** As a Student, I want to see my daily learning streak, so that I am motivated to practice consistently.

#### Acceptance Criteria

1. THE Progress_Service SHALL maintain a streak counter representing consecutive calendar days with at least one completed exercise
2. WHEN a Student completes the first exercise of a new calendar day, THE Progress_Service SHALL increment the streak counter by one
3. WHEN the Dashboard is loaded, THE Dashboard SHALL display the current streak count with a flame or fire icon and gold color styling
4. IF a Student has not completed any exercise for two consecutive calendar days, THEN THE Progress_Service SHALL reset the streak to zero on the second missed day

### Requirement 6: Dashboard Display

**User Story:** As a Student, I want to see a personalized dashboard when I open the app, so that I can quickly access my subjects and track my learning progress.

#### Acceptance Criteria

1. WHEN an authenticated Student navigates to the home route, THE Dashboard SHALL display a personalized greeting containing the Student name (truncated to 30 characters if longer) and the current date in the format "Day, DD Month" (e.g., "Monday, 15 January")
2. WHEN an authenticated Student navigates to the home route, THE Dashboard SHALL display the current learning streak count as an integer (minimum 0) followed by a "days" label, styled with a fire icon and gold color
3. THE Dashboard SHALL display a grid of Subject_Cards only for the subjects assigned to the authenticated Student during registration, arranged in 2 columns on mobile and 3 columns on web
4. WHEN a Subject_Card is rendered, THE Dashboard SHALL display the subject name, subject-specific icon, subject-specific color as defined in the Design_System, and the Student progress as an integer percentage from 0 to 100 followed by a "%" symbol
5. WHEN a Student taps or clicks a Subject_Card, THE Dashboard SHALL navigate to the corresponding subject landing screen within 300 milliseconds
6. WHILE the platform is accessed on mobile, THE Dashboard SHALL display a gradient header with greeting and stats, a subject cards grid, and the Bottom_Navigation
7. WHILE the platform is accessed on web, THE Dashboard SHALL display the Web_Navigation, a sidebar with the subject list, progress cards, and a recent activity panel
8. IF the Dashboard fails to load progress data from the Progress_Service, THEN THE Dashboard SHALL display the Subject_Cards with a placeholder indicator in place of the progress percentage and show an error message indicating that progress data is temporarily unavailable
9. WHILE the Dashboard is fetching data from the Progress_Service, THE Dashboard SHALL display a loading indicator in place of the streak count and progress percentages

### Requirement 7: Content Ingestion — Subject, Book, and Chapter Selection

**User Story:** As a Student, I want to select a subject, book, and chapter to add textbook pages, so that I can digitize my study material for learning.

#### Acceptance Criteria

1. WHEN a Student navigates to the content ingestion flow, THE Content_Ingestion_Screen SHALL display only the subjects assigned to the authenticated Student
2. WHEN a Student selects a subject, THE Content_Ingestion_Screen SHALL display the list of books associated with that subject, with each book showing its name and number of chapters added
3. THE Content_Ingestion_Screen SHALL provide an "Add New Book" button allowing the Student to create a new book under the selected subject with a name of 1-200 characters
4. WHEN a Student selects a book, THE Content_Ingestion_Screen SHALL display the list of chapters within that book, with each chapter showing its name, sequence number, and completion status (checkmark for chapters with content, "New" label for empty chapters)
5. THE Content_Ingestion_Screen SHALL provide an "Add New Chapter" button allowing the Student to create a new chapter under the selected book with a name of 1-200 characters
6. WHEN a Student selects a chapter, THE Content_Ingestion_Screen SHALL navigate to the Page_Upload_UI for that chapter
7. WHILE the platform is accessed on web, THE Content_Ingestion_Screen SHALL display a left sidebar with subject list and a main content area showing books and chapters side by side
8. WHILE the platform is accessed on mobile, THE Content_Ingestion_Screen SHALL use a step-by-step flow: select subject → select book → select chapter → upload pages

### Requirement 8: Page Upload — Camera and Image Upload

**User Story:** As a Student, I want to capture photos of textbook pages or upload images, so that my physical textbook content is digitized for the app.

#### Acceptance Criteria

1. WHEN a Student opens the Page_Upload_UI for a chapter, THE Page_Upload_UI SHALL display options to "Take Photo" (camera capture) and "Upload Images" (file picker / drag-and-drop on web)
2. WHEN a Student taps "Take Photo" and camera permission is granted, THE Page_Upload_UI SHALL open the device camera for photo capture in JPEG format
3. WHEN a Student taps "Upload Images", THE Page_Upload_UI SHALL open a file picker filtered to image files (JPEG, PNG, HEIC) allowing selection of one or more files
4. THE Page_Upload_UI SHALL validate that each uploaded image does not exceed 10 MB in file size
5. IF an image exceeds 10 MB, THEN THE Page_Upload_UI SHALL display an error message indicating the file exceeds the 10 MB size limit and shall not include that file
6. THE Page_Upload_UI SHALL allow a maximum of 50 pages per chapter; IF the limit is reached, THEN THE Page_Upload_UI SHALL display a message indicating the maximum page count has been reached and disable further uploads
7. WHEN pages are uploaded, THE Page_Upload_UI SHALL display thumbnails of all captured/uploaded pages in a numbered grid with the total count shown (e.g., "4 of 50 max")
8. THE Page_Upload_UI SHALL allow the Student to remove individual pages by tapping a delete/close button on the page thumbnail
9. WHEN the Student taps "Done — Extract Text", THE Page_Upload_UI SHALL upload all page images to the backend and initiate the text recognition process
10. WHILE the platform is accessed on web, THE Page_Upload_UI SHALL support drag-and-drop of image files into a designated drop zone in addition to the file picker
11. THE Page_Upload_UI SHALL display a "Supported: JPEG, PNG, HEIC • Max 10MB per image" notice below the upload area

### Requirement 9: Text Recognition and Chapter Transcript

**User Story:** As a Student, I want the app to automatically extract text from my uploaded textbook pages, so that I can study the content digitally without manual transcription.

#### Acceptance Criteria

1. WHEN the Student initiates text extraction, THE Text_Recognition_Service SHALL process each uploaded page image using Google Vision OCR and extract the text content
2. WHEN text extraction completes, THE application SHALL display the Chapter_Transcript screen showing the extracted text organized page by page
3. THE Chapter_Transcript screen SHALL display for each page: the page number, word count, and the extracted text content
4. THE Chapter_Transcript screen SHALL display the total number of pages processed and total word count across all pages (e.g., "Text extracted from 4 pages • Total: 1,024 words")
5. THE Chapter_Transcript screen SHALL provide an "Edit Transcript" button allowing the Student to manually correct any OCR errors in the extracted text
6. WHEN the Student taps "Save Transcript", THE application SHALL persist the transcript (original or edited) as the chapter content in the database
7. WHILE the platform is accessed on web, THE Chapter_Transcript screen SHALL display page image thumbnails on the left and the corresponding text on the right, with the selected page highlighted
8. WHILE the platform is accessed on mobile, THE Chapter_Transcript screen SHALL display a scrollable list of page text blocks, each showing page number, word count, and extracted text
9. THE Text_Recognition_Service SHALL support text extraction for Kannada, English, Hindi, mathematical notation, and other Indic scripts present in the uploaded pages using Google Vision OCR
10. IF text extraction fails for a page, THEN THE application SHALL display an error indicator for that specific page while showing successfully extracted pages normally

### Requirement 10: Chapter Explanation — AI-Generated Content Explanation

**User Story:** As a Student, I want the app to explain chapter content page by page with options to read or listen, so that I can understand my textbook material with contextual guidance.

#### Acceptance Criteria

1. WHEN a Student opens the Chapter_Explanation_Screen for a chapter with a saved transcript, THE application SHALL generate an AI explanation using GPT-5 Mini (or equivalent low-cost reasoning model) including a summary, key words with translations/meanings, and contextual notes; THE explanation SHALL be generated once and stored permanently for reuse
2. THE Chapter_Explanation_Screen SHALL provide a toggle between "Read (Text)" mode and "Listen (Speech)" mode, defaulting to Read mode
3. WHILE in Read mode, THE Chapter_Explanation_Screen SHALL display the explanation as formatted text with sections: Summary, Key Words (with romanization and meaning for Indic scripts), and Concepts/Moral
4. WHILE in Listen mode, THE application SHALL generate and play an audio narration of the explanation using Google Text-to-Speech; THE audio SHALL be generated once and served from CDN (CloudFront) for subsequent requests
5. THE Chapter_Explanation_Screen SHALL display the current page number and total pages with "Previous" and "Next" navigation buttons allowing the Student to navigate between page explanations
6. WHEN a Student navigates to a new page, THE Chapter_Explanation_Screen SHALL display the explanation for that specific page
7. WHILE the platform is accessed on web, THE Chapter_Explanation_Screen SHALL display the original text on the left panel and the explanation on the right panel with page navigation at the bottom
8. WHILE the platform is accessed on mobile, THE Chapter_Explanation_Screen SHALL display the explanation as a scrollable card with page navigation at the bottom and a word count indicator
9. THE explanation SHALL include key vocabulary words with their romanized pronunciation and English translation for non-English subjects
10. THE Chapter_Explanation_Screen SHALL display a "Generate Revision Questions" button; WHEN tapped, THE application SHALL invoke GPT-5 Mini to generate MCQs, short answer questions, and fill-in-the-blank questions from the chapter content; THE generated questions SHALL be stored permanently in PostgreSQL for reuse without regeneration; UPON generation completion, THE application SHALL navigate to a separate Revision Screen displaying the generated questions
11. THE Chapter_Explanation_Screen SHALL display a "Generate Summary" button; WHEN tapped, THE application SHALL invoke GPT-5 Mini to generate a chapter summary containing key points, important concepts, and exam preparation notes; THE summary SHALL be generated once and stored permanently for reuse
12. WHEN revision questions have already been generated for a chapter, THE "Generate Revision Questions" button SHALL change to "View Revision Questions" and navigate to the Revision Screen displaying the stored questions without invoking the AI service again
13. WHEN a chapter summary has already been generated for a chapter, THE "Generate Summary" button SHALL change to "View Summary" and display the stored summary without invoking the AI service again
14. FOR language subjects (Kannada, Hindi, English, and custom language subjects such as French), THE Chapter_Explanation_Screen SHALL display a translation language selector with options "English" and "Hindi"
15. WHEN a Student selects a translation language, THE application SHALL translate the chapter explanation and content into the selected language using GPT-5 Mini and display the translated text alongside or in place of the original
16. THE translated content SHALL be generated once per language per chapter page and stored permanently for reuse without re-invoking the AI service

### Requirement 11: Exercise Assistance — AI-Powered Exercise Help

**User Story:** As a Student, I want the app to help me solve exercises from my textbook by referencing chapter content, so that I can practice with contextual guidance rather than just answers.

#### Acceptance Criteria

1. DURING OCR processing, THE Text_Recognition_Service SHALL use AI classification to identify pages containing exercises (questions, fill-in-the-blanks, problems) and display a confirmation prompt to the Student asking "This page appears to contain exercises. Confirm?" with "Yes" and "No" options
2. IF the AI classification cannot determine whether a page contains exercises, THEN THE application SHALL ask the Student to manually indicate whether the page contains exercises via a toggle or selection option
3. THE Exercise_Assistant SHALL detect and parse individual exercise items from confirmed exercise pages
2. THE Exercise_Assistant SHALL display each exercise item with its original text and provide an interactive interface for the Student to attempt the answer
3. WHEN a Student requests a hint for an exercise, THE Exercise_Assistant SHALL use RAG (Retrieval-Augmented Generation) to retrieve the top 5 relevant paragraphs from the chapter content via pgvector similarity search, and provide a contextual hint using GPT-5 Mini without revealing the full answer
4. WHEN a Student submits an answer, THE Exercise_Assistant SHALL validate the answer using GPT-5 Mini prompted as a grade-appropriate teacher (e.g., "Grade as a CBSE Grade 4 teacher") and display feedback indicating correct/incorrect with an explanation
5. IF the Student answer is incorrect, THEN THE Exercise_Assistant SHALL reference the relevant chapter section where the answer can be found, guiding the Student to review that content
6. THE Exercise_Assistant SHALL support exercise types including: fill-in-the-blanks, multiple choice, match-the-following, true/false, and short answer questions
7. THE Exercise_Assistant functionality SHALL be available for all subjects (Kannada, English, Hindi, Maths, Science, Computers, EVS)
8. WHEN the Student completes all exercises on a page, THE Exercise_Assistant SHALL display a summary showing the score (correct/total) and areas for review

### Requirement 12: Pronunciation Practice

**User Story:** As a Student, I want to practice pronunciation of words and characters in Kannada, English, and Hindi, so that I can improve my speaking skills with real-time feedback.

#### Acceptance Criteria

1. WHEN a Student opens a pronunciation exercise, THE Pronunciation_Screen SHALL display the target word or script character at a font size of 32px for English, 40px for Hindi, and 52px for Kannada script
2. WHEN a Student opens a pronunciation exercise, THE Pronunciation_Screen SHALL display the phonetic transcription (romanization or IPA) below the target word
3. WHEN a Student taps the audio playback button, THE Audio_Service SHALL play the reference pronunciation audio generated by Google Text-to-Speech, served from CDN; THE audio SHALL be generated once per word and stored as MP3 in S3
4. WHEN a Student taps the record button, THE Pronunciation_Screen SHALL capture audio from the device microphone until the Student taps the stop button or a maximum duration of 10 seconds is reached, whichever occurs first
5. WHEN a recording completes, THE Audio_Service SHALL transcribe the audio using Whisper, compare the transcription against the expected word, and return a pronunciation accuracy score as a percentage between 0 and 100 within 5 seconds of submission
6. WHEN a pronunciation score is returned, THE Pronunciation_Screen SHALL display the accuracy percentage and highlight each syllable as correct (green) or incorrect (red) based on the per-syllable correctness indicators returned by the Audio_Service
7. WHEN a Student taps the Retry button, THE Pronunciation_Screen SHALL reset the recording state and allow the Student to record again
8. WHEN a Student taps the Next button and additional words remain in the exercise sequence, THE Pronunciation_Screen SHALL navigate to the next word in the sequence
9. IF the device microphone permission is not granted, THEN THE Pronunciation_Screen SHALL display an error message indicating that microphone access is required and shall not initiate recording
10. IF the audio upload or scoring request fails, THEN THE Pronunciation_Screen SHALL display an error message indicating the failure and allow the Student to retry the submission
11. WHEN a Student taps the Next button and no additional words remain in the exercise sequence, THE Pronunciation_Screen SHALL navigate to the exercise completion summary screen

### Requirement 13: Grammar and Fill-in-the-Blank Exercises

**User Story:** As a Student, I want to complete grammar exercises with fill-in-the-blank sentences, so that I can practice language structure and receive explanatory feedback.

#### Acceptance Criteria

1. WHEN a Student opens a grammar exercise, THE Grammar_Exercise_Screen SHALL display the current question number and total question count in the format "N/T" (e.g., "4/8"), where T is between 1 and 30
2. WHEN a Student opens a grammar exercise, THE Grammar_Exercise_Screen SHALL display a progress bar indicating completion percentage calculated as the number of answered questions divided by total questions
3. THE Grammar_Exercise_Screen SHALL display the exercise prompt sentence with the blank position indicated by a visible underscore placeholder
4. THE Grammar_Exercise_Screen SHALL display between 2 and 5 multiple-choice answer options as tappable elements
5. WHEN a Student selects an answer option, THE Grammar_Exercise_Screen SHALL immediately visually highlight the selected option with the primary pink color and border, and display the corresponding feedback panel
6. WHEN a Student selects the correct answer, THE Grammar_Exercise_Screen SHALL display a green success feedback panel containing the correct answer and a grammatical explanation of why it is correct
7. WHEN a Student selects an incorrect answer, THE Grammar_Exercise_Screen SHALL display a red error feedback panel showing the correct answer highlighted and an explanation of the grammatical rule
8. WHILE no answer has been selected for the current question, THE Grammar_Exercise_Screen SHALL disable the Next button
9. WHEN a Student taps the Next button after answering, THE Grammar_Exercise_Screen SHALL advance to the next exercise in the sequence and update the progress bar
10. WHEN a Student taps the Next button on the last question in the exercise set, THE Grammar_Exercise_Screen SHALL navigate to an exercise completion summary showing the number of correct answers out of total questions
11. IF the Content_API fails to load exercise data, THEN THE Grammar_Exercise_Screen SHALL display an error message indicating the exercises could not be loaded and provide a retry option

### Requirement 14: Timed Quiz and Revision

**User Story:** As a Student, I want to take timed quizzes to revise subject material, so that I can assess my knowledge under time pressure and identify areas for improvement.

#### Acceptance Criteria

1. WHEN a Student starts a quiz, THE Quiz_Screen SHALL create a Quiz_Session with a countdown timer displayed in MM:SS format, where the timer duration is defined by the quiz configuration and ranges between 30 seconds and 60 minutes
2. WHEN a Quiz_Session is active, THE Quiz_Screen SHALL display the current question number and total question count (e.g., "Q8/20")
3. THE Quiz_Screen SHALL display the question text and four answer options labeled A, B, C, and D as tappable cards
4. WHEN a Student selects an answer option, THE Quiz_Screen SHALL highlight the selected option with the primary pink color
5. WHEN a Student taps the Submit button after selecting an option, THE Progress_Service SHALL record the answer, indicate whether it is correct or incorrect, and update the live score showing the current percentage and correct-answer count
6. WHEN a Student taps the Skip button, THE Quiz_Screen SHALL skip the current question without recording an answer and advance to the next question
7. WHILE a Quiz_Session is active on web, THE Quiz_Screen SHALL display a live score panel showing the current percentage and correct-answer count
8. WHEN the quiz timer reaches zero or the Student submits or skips the last question, THE Quiz_Screen SHALL end the Quiz_Session and display the final score summary containing the total correct answers, total questions, percentage score, and time taken
9. IF a Student attempts to navigate away during an active Quiz_Session, THEN THE Quiz_Screen SHALL display a confirmation dialog warning that progress will be lost; if confirmed, the Quiz_Session SHALL end and the Student SHALL be navigated away without saving the session result
10. IF a Student taps the Submit button without selecting an answer option, THEN THE Quiz_Screen SHALL not submit the question and SHALL display an inline prompt indicating that an option must be selected

### Requirement 15: Maths Practice with Visual Aids

**User Story:** As a Student, I want to practice math problems with visual fraction representations, so that I can build number sense through interactive exercises.

#### Acceptance Criteria

1. WHEN a Student opens a maths exercise, THE Maths_Practice_Screen SHALL display a visual representation of the fraction problem using shapes (circles, rectangles) with colored portions representing the fractional value
2. THE Maths_Practice_Screen SHALL provide interactive input fields for numerator and denominator values, each accepting integer values between 0 and 99
3. WHEN a Student enters values and taps the Check Answer button, THE Content_API SHALL validate the answer against the correct solution and return the result within 3 seconds
4. IF the numerator or denominator input field is empty or contains a non-integer value when the Student taps Check Answer, THEN THE Maths_Practice_Screen SHALL display an inline validation message indicating that both fields require whole number values
5. WHEN the submitted answer is correct, THE Maths_Practice_Screen SHALL display a green success indicator with feedback text stating the answer is correct
6. WHEN the submitted answer is incorrect, THE Maths_Practice_Screen SHALL display a red error indicator with a hint that identifies whether the numerator or denominator (or both) is wrong, without revealing the correct answer
7. THE Maths_Practice_Screen SHALL display the current question number and total questions in the exercise set (e.g., "3/10"), where an exercise set contains between 5 and 20 questions

### Requirement 16: Computers Subject Exercises

**User Story:** As a Student, I want to practice programming concepts through code editing and matching exercises, so that I can develop computational thinking skills.

#### Acceptance Criteria

1. WHEN a Student opens a computers exercise, THE Computers_Exercise_Screen SHALL display a code editor area with syntax highlighting for the target programming language specified in the exercise content
2. THE Computers_Exercise_Screen SHALL support drag-and-drop matching exercises where the Student pairs code concepts with their descriptions, containing between 3 and 8 pairs per exercise
3. IF a Student taps the Check Matches button before completing all matches, THEN THE Computers_Exercise_Screen SHALL display an inline message indicating the number of remaining unmatched pairs
4. WHEN a Student completes all matches and taps the Check Matches button, THE Content_API SHALL validate the matches and return a correctness score as the count of correct matches out of total pairs (e.g., "4/6")
5. WHEN matches are validated, THE Computers_Exercise_Screen SHALL visually indicate correct matches in green and incorrect matches in red
6. WHEN a Student taps the Reset button, THE Computers_Exercise_Screen SHALL clear all current matches and restore items to their unmatched state

### Requirement 17: EVS Interactive Visualizations

**User Story:** As a Student, I want to explore science topics through animated visualizations and ordering exercises, so that I can understand natural processes through interactive learning.

#### Acceptance Criteria

1. WHEN a Student opens an EVS visualization exercise (e.g., Water Cycle), THE EVS_Visualization_Screen SHALL display an animated visual representation of the scientific process using emoji or icon sequences that loops continuously until the Student interacts with the ordering exercise
2. THE EVS_Visualization_Screen SHALL display labeled stage descriptions for each stage in the process (e.g., "Evaporation · Condensation · Precipitation"), containing between 3 and 8 stages
3. THE EVS_Visualization_Screen SHALL provide a drag-and-drop ordering exercise where the Student arranges process stages in the correct sequence, with stages initially presented in a randomized order
4. WHEN a Student taps the Check Order button, THE Content_API SHALL validate the ordering against the correct sequence and return per-item correctness
5. WHEN all items in the ordering are correct, THE EVS_Visualization_Screen SHALL highlight all items in green with checkmarks
6. WHEN the ordering contains at least one incorrect item, THE EVS_Visualization_Screen SHALL highlight correctly-positioned items in green and incorrectly-positioned items in the default blue state
7. WHEN a Student opens an EVS quiz (e.g., Plants Quiz), THE Quiz_Screen SHALL display MCQ questions with four answer options
8. WHEN a Student selects the correct answer in an EVS quiz, THE Quiz_Screen SHALL display a scientific explanation below the question

### Requirement 18: Subject Content Management API

**User Story:** As a content administrator, I want to manage subject content through a backend API, so that questions, exercises, and audio references can be created, updated, and retrieved per subject.

#### Acceptance Criteria

1. THE Content_API SHALL expose REST endpoints for creating, reading, updating, and deleting questions and exercises per subject
2. WHEN a client sends a GET request for a subject exercise set, THE Content_API SHALL return a paginated list of exercises ordered by sequence number, with a default page size of 20 and a maximum page size of 100
3. WHEN a client sends a POST request with valid exercise data, THE Content_API SHALL create the exercise record in PostgreSQL and return the created resource with a unique identifier and HTTP 201 status
4. IF a client sends a request with invalid or missing required fields, THEN THE Content_API SHALL return an HTTP 400 response with an error message indicating which fields are invalid or missing
5. IF a client sends a request without a valid authentication token, THEN THE Content_API SHALL return an HTTP 401 response
6. THE Content_API SHALL support filtering exercises by subject, chapter, exercise type (pronunciation, grammar, quiz, maths, code, evs), and difficulty level
7. IF a client sends a GET request with filters that match no exercises, THEN THE Content_API SHALL return an HTTP 200 response with an empty list and zero total count

### Requirement 19: Student Progress Tracking

**User Story:** As a Student, I want my learning progress to be saved automatically, so that I can resume where I left off and see my improvement over time.

#### Acceptance Criteria

1. WHEN a Student completes an exercise or quiz question, THE Progress_Service SHALL record the result (correct/incorrect, score, timestamp) in PostgreSQL associated with the Student identifier and subject
2. THE Progress_Service SHALL calculate and store the overall progress percentage per subject based on completed exercises divided by total available exercises
3. WHEN a Student completes at least one exercise in a calendar day, THE Progress_Service SHALL update the learning streak count for that Student
4. IF a Student misses two consecutive calendar days without completing any exercise, THEN THE Progress_Service SHALL reset the streak count to zero on the second missed day
5. WHEN a client requests progress data for a Student, THE Progress_Service SHALL return per-subject progress percentages, current streak count, and recent activity history
6. THE Progress_Service SHALL support retrieving historical quiz scores for a Student within a specified date range

### Requirement 20: Audio Recording and Pronunciation Scoring

**User Story:** As a Student, I want my pronunciation recordings to be scored automatically, so that I receive objective feedback on my speaking accuracy.

#### Acceptance Criteria

1. WHEN a recording is submitted, THE Audio_Service SHALL upload the audio file to S3 with a unique key derived from the Student identifier, subject, and timestamp
2. WHEN an audio file is uploaded, THE Audio_Service SHALL invoke Whisper to transcribe the speech to text
3. WHEN transcription completes, THE Audio_Service SHALL compare the transcribed text against the expected pronunciation text and calculate a syllable-level accuracy score
4. THE Audio_Service SHALL return the accuracy score and per-syllable correctness indicators within 5 seconds of recording submission
5. THE Audio_Service SHALL generate reference pronunciation audio using Google Text-to-Speech for each word in the content library; THE audio SHALL be generated once and stored as MP3 in S3 for CDN delivery
6. IF the audio recording is shorter than 0.5 seconds or longer than 15 seconds, THEN THE Audio_Service SHALL return an error indicating invalid recording duration

### Requirement 21: Quiz Scoring and Session Management

**User Story:** As a Student, I want my quiz sessions to be managed reliably with accurate scoring, so that my assessment results reflect my actual performance.

#### Acceptance Criteria

1. WHEN a Quiz_Session is created, THE Progress_Service SHALL generate a unique session identifier, record the start timestamp, and associate the question set with the Student
2. WHEN an answer is submitted during a Quiz_Session, THE Progress_Service SHALL validate the answer, record correct/incorrect status, and update the running score
3. WHEN a Quiz_Session ends (timer expires or all questions answered), THE Progress_Service SHALL calculate the final score as a percentage and store the session result
4. IF a Student submits an answer for a question already answered in the same Quiz_Session, THEN THE Progress_Service SHALL reject the submission and return an error
5. THE Progress_Service SHALL support retrieving all quiz session results for a Student, ordered by date descending

### Requirement 22: Parent Dashboard

**User Story:** As a Parent, I want to see a list of my registered learners and monitor their progress, so that I can track their learning activities and support them.

#### Acceptance Criteria

1. WHEN an authenticated Parent logs in, THE application SHALL navigate to the Parent Dashboard as the default landing page
2. THE Parent Dashboard SHALL display a list of all learners (students) linked to the authenticated Parent, showing each learner's name and grade
3. WHEN a Parent taps or clicks on a learner's entry, THE Parent Dashboard SHALL navigate to a learner progress view displaying the same subject progress information that the learner sees on their own Dashboard (subject cards with progress percentages, streak count, and recent activity)
4. THE Parent Dashboard SHALL provide access to the "Register Student" flow allowing the Parent to add additional learners
5. IF the Parent has no linked learners, THEN THE Parent Dashboard SHALL display a message prompting the Parent to register their first learner with a prominent "Register Student" button
6. WHEN a Parent views a learner's progress, THE Parent Dashboard SHALL provide an "Edit Subjects" option allowing the Parent to add or remove subjects for that learner after registration
7. THE "Edit Subjects" interface SHALL display the current assigned subjects as checkboxes (checked = assigned) and allow the Parent to select additional default or custom subjects, or deselect existing ones, with a minimum of one subject required

### Requirement 23: Logging and Observability

**User Story:** As an operations team member, I want all user operations and errors logged in CloudWatch, so that I can monitor system health, debug issues, and audit user activity.

#### Acceptance Criteria

1. THE backend services SHALL log all user operations to AWS CloudWatch Logs, including: login, logout, registration (parent and student), subject/book/chapter creation, page upload, transcript save, and exercise completion
2. EACH log entry SHALL include: timestamp (ISO 8601), user identifier (parent or student username), operation type, resource affected (subject/book/chapter/page ID where applicable), and result (success or failure)
3. THE backend services SHALL log all errors to CloudWatch Logs with severity level (ERROR for application errors, WARN for validation failures, INFO for successful operations)
4. WHEN an API request fails due to a server error (5xx), THE backend SHALL log the full error stack trace, request path, request body (excluding sensitive fields like passwords), and user identifier
5. WHEN an external AI service call fails (Google Vision OCR, GPT-5 Mini, Google TTS, Whisper), THE AI Gateway SHALL log the service name, request parameters, error response, and retry count
6. THE Infrastructure SHALL configure CloudWatch Log Groups with a retention period of 30 days for INFO logs and 90 days for ERROR logs
7. THE logging system SHALL NOT log sensitive data including passwords, JWT tokens, OTP values, or full email addresses (email SHALL be masked as "d***@email.com")
