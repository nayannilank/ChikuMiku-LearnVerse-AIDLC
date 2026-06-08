# Requirements Document

## Introduction

ChikuMiku LearnVerse is a subject-agnostic learning platform designed for children that enables them to learn any subject — including languages (Kannada, Hindi, English), Maths, Computers, Science, and more — through textbook chapter content. The platform supports photo-based content ingestion from textbook pages, interactive pronunciation practice for language subjects, grammar exercises, chapter-based question answering, and revision tools for test preparation. Learners can enroll in multiple subjects simultaneously and track progress independently per subject. The system is available on Android mobile and web platforms with persistent user sessions for continuous learning.

## Glossary

- **Learning_App**: The ChikuMiku LearnVerse application system encompassing both Android and web clients
- **Content_Ingestion_Service**: The subsystem responsible for capturing, processing, and extracting text from textbook page images in any language or notation
- **Pronunciation_Engine**: The subsystem that provides audio playback and speech recognition for alphabets and words of any language subject
- **Grammar_Engine**: The subsystem that assists learners in constructing grammatically correct sentences for any language subject
- **Comprehension_Service**: The subsystem that generates and evaluates questions based on stored chapter content across all subjects
- **Content_Store**: The persistent storage subsystem that retains chapter content for revision and test preparation
- **Authentication_Service**: The subsystem responsible for user login, registration, and session management
- **Learner**: A child user of the application who is learning one or more subjects
- **Chapter**: A unit of textbook content consisting of one or more ingested pages stored together
- **Session**: An authenticated period of interaction between a Learner and the Learning_App
- **Revision_Mode**: A dedicated learning mode where the Learner selects one or more Chapters for question-based review and test preparation
- **Subject**: A learning domain such as Kannada, Maths, Computers, Science, Hindi, or English that the platform supports from day one
- **Grade**: The academic class or standard level of the Learner, used to organize content and manage storage lifecycle
- **Subject_Module**: A pluggable module that defines subject-specific content types, extraction rules, question generation strategies, and rendering logic for a given Subject

## Requirements

### Requirement 1: Textbook Content Ingestion

**User Story:** As a Learner, I want to upload or capture photos of textbook pages for any subject, so that the application can extract and use the chapter content for my learning activities.

#### Acceptance Criteria

1. WHEN a Learner uploads an image of a textbook page, THE Content_Ingestion_Service SHALL extract text from the image within 10 seconds using the extraction rules defined by the Subject_Module associated with the selected Subject, and display the extracted content for confirmation
2. WHEN a Learner captures a photo using the device camera, THE Content_Ingestion_Service SHALL process the captured image and extract text from it using the appropriate Subject_Module extraction rules
3. WHEN multiple pages are uploaded for the same chapter in a single session, THE Content_Ingestion_Service SHALL combine the extracted text from the first 50 pages into a single Chapter in sequential order, and SHALL reject any pages beyond the 50-page limit with a message indicating the maximum has been reached
4. WHEN a Learner revisits an existing Chapter, THE Content_Ingestion_Service SHALL allow the Learner to add new pages by uploading or capturing additional photos that are appended to the existing Chapter content
5. WHEN new pages are added to an existing Chapter, THE Content_Ingestion_Service SHALL allow the Learner to reorder pages within the Chapter to maintain correct sequence
6. IF the Content_Ingestion_Service cannot extract text from an uploaded image, THEN THE Content_Ingestion_Service SHALL display an error message indicating the reason and suggest corrective actions such as retaking the photo with better lighting
7. WHEN an image is uploaded, THE Content_Ingestion_Service SHALL accept JPEG, PNG, and HEIC image formats with a maximum file size of 10 MB per image
8. WHEN text extraction is complete, THE Content_Ingestion_Service SHALL allow the Learner to review and edit the extracted text before saving it as a Chapter
9. IF a Learner uploads an image in an unsupported format or exceeding the maximum file size, THEN THE Content_Ingestion_Service SHALL reject the upload and display an error message indicating the accepted formats and size limit
10. IF the Content_Ingestion_Service extracts only partial text from an uploaded image, THEN THE Content_Ingestion_Service SHALL display the partially extracted content, indicate which regions could not be processed, and allow the Learner to manually complete the missing text before saving
11. THE Content_Ingestion_Service SHALL support configurable content extraction pipelines where each Subject_Module defines its own extraction rules for recognized content formats such as text in any language, mathematical notation, code snippets, and scientific diagrams, and new extraction rules can be deployed without redeploying the Content_Ingestion_Service

### Requirement 2: Pronunciation Assistance

**User Story:** As a Learner enrolled in a language subject, I want help pronouncing alphabets and words, so that I can develop correct spoken language skills.

#### Acceptance Criteria

1. WHEN a Learner selects an alphabet or word within a language subject, THE Pronunciation_Engine SHALL begin playing an audio recording of the correct pronunciation within 1 second of selection
2. WHEN a Learner records their pronunciation attempt, THE Pronunciation_Engine SHALL accept a recording of up to 10 seconds, compare the recording against the correct pronunciation, and provide an accuracy score from 0 to 100 percent along with feedback indicating which syllables were pronounced incorrectly
3. THE Pronunciation_Engine SHALL support pronunciation practice for the complete alphabet set defined by the Subject_Module of the enrolled language subject
4. WHEN a Learner requests pronunciation for a word from a stored Chapter in a language subject, THE Pronunciation_Engine SHALL break the word into syllables and provide pronunciation for each syllable and the complete word
5. WHILE a Learner is in pronunciation practice mode, THE Pronunciation_Engine SHALL display the character alongside its transliteration in English
6. IF the Pronunciation_Engine cannot access the microphone or the recorded audio level is strictly below the minimum detectable threshold, THEN THE Pronunciation_Engine SHALL display an error message indicating the issue and prompt the Learner to check microphone permissions or speak louder
7. IF audio playback fails due to unavailable audio output or missing audio data, THEN THE Pronunciation_Engine SHALL display an error message indicating the playback failure and offer the Learner the option to retry
8. WHEN a Learner is enrolled in multiple language subjects, THE Pronunciation_Engine SHALL load the pronunciation rules and audio assets specific to the language subject the Learner is currently practicing
9. IF some pronunciation audio assets fail to load for certain letters, THEN THE Pronunciation_Engine SHALL allow practice for letters with available assets and SHALL visually indicate which letters are temporarily unavailable due to missing assets

### Requirement 3: Grammar Assistance

**User Story:** As a Learner enrolled in a language subject, I want help building grammatically correct sentences, so that I can improve my written and spoken grammar for that language.

#### Acceptance Criteria

1. WHEN a Learner submits a sentence for review within a language subject, THE Grammar_Engine SHALL analyze the sentence using the grammar rules defined by the Subject_Module for that language and identify grammatical errors, providing for each error a correction and an explanation using vocabulary suitable for the Learner's Grade level
2. IF no grammatical errors are found in the submitted sentence, THEN THE Grammar_Engine SHALL display a confirmation message indicating the sentence is grammatically correct
3. WHEN a Learner requests a grammar exercise, THE Grammar_Engine SHALL generate between 5 and 10 sentence construction exercises drawn from the vocabulary and content of stored Chapters associated with the Learner's enrolled language subject and Grade
4. THE Grammar_Engine SHALL support grammar rules as defined by each language Subject_Module, including language-specific rules such as noun declension, verb conjugation, word order, and postposition or preposition usage
5. WHEN a Learner completes a grammar exercise, THE Grammar_Engine SHALL provide a score as a percentage from 0 to 100 and highlight grammar rules where the Learner scored below 60 percent as areas needing improvement
6. IF a Learner requests a grammar exercise and no Chapters are stored for the selected language subject in the Learner's account, THEN THE Grammar_Engine SHALL display a message indicating that chapter content must be added before exercises can be generated

### Requirement 4: Chapter-Based Question Answering

**User Story:** As a Learner, I want to upload or capture photos of questions from my textbook chapter for any subject, so that the application can help me prepare answers for those questions.

#### Acceptance Criteria

1. WHEN a Learner uploads or captures a photo of questions from a textbook chapter, THE Content_Ingestion_Service SHALL extract the questions, display them for the Learner to confirm, and associate them with the Chapter the Learner selects from their stored Chapters
2. WHEN a Learner selects an extracted question, THE Comprehension_Service SHALL first verify that the stored Chapter content is sufficient to generate a model answer, and when content is sufficient, SHALL generate the model answer within 10 seconds using the question generation strategy registered by the Subject_Module for that Subject
3. WHEN a Learner submits their own answer attempt, THE Comprehension_Service SHALL compare it against the model answer and provide feedback as a percentage score for accuracy along with specific indications of missing points and factual errors
4. IF a Learner requests help with a question, THEN THE Comprehension_Service SHALL provide guidance broken into individually numbered steps derived from the Chapter content, with each step building toward the complete answer without revealing the full answer directly
5. WHEN a Learner completes answering all questions for a Chapter, THE Comprehension_Service SHALL display a performance summary including a percentage score, the count of correct versus total questions, and a list of questions where the Learner scored below 60 percent
6. THE Comprehension_Service SHALL support question types including fill-in-the-blanks, short answer, match-the-following, and descriptive answer formats across all subjects
7. IF the Content_Ingestion_Service cannot extract questions from an uploaded image, THEN THE Content_Ingestion_Service SHALL display an error message indicating the reason and suggest corrective actions such as retaking the photo with better lighting or ensuring questions are clearly visible
8. IF the stored Chapter content is insufficient to generate a model answer for an extracted question, THEN THE Comprehension_Service SHALL indicate to the Learner that additional Chapter pages are needed and identify which question cannot be answered

### Requirement 5: Content Storage and Revision

**User Story:** As a Learner, I want my chapter content stored for revision and test preparation across all my enrolled subjects, so that I can review material across multiple sessions.

#### Acceptance Criteria

1. WHEN a Chapter is saved, THE Content_Store SHALL persist the Chapter content and associate it with the Learner's account and the selected Subject
2. THE Content_Store SHALL organize Chapters by Subject, textbook, and chapter number, and SHALL allow the Learner to browse and retrieve any stored Chapter within 3 navigation steps
3. WHEN a Learner requests revision material, THE Content_Store SHALL present stored Chapters for the selected Subject with options for comprehension questions, and SHALL additionally present pronunciation practice and grammar exercise options only when the selected Subject is a language subject
4. THE Content_Store SHALL track the Learner's progress per Chapter including completion percentage calculated as the proportion of available activities completed across the activity types applicable to the Chapter's Subject, individual scores per activity type, and last accessed date
5. WHEN a Learner accesses revision material, THE Content_Store SHALL visually distinguish activity types where the Learner previously scored below 60 percent, identifying each applicable activity type separately for focused review
6. IF the Content_Store fails to persist a Chapter during save, THEN THE Content_Store SHALL display an error message indicating the failure reason and SHALL retain the unsaved Chapter content locally so the Learner can retry without data loss
7. IF a Learner requests revision material and no Chapters are stored for the selected Subject, THEN THE Content_Store SHALL display both a message indicating no content is available and guidance directing the Learner to add Chapters through content ingestion

### Requirement 6: Revision Mode

**User Story:** As a Learner, I want a dedicated revision mode where I can select one, multiple, or all chapters within a subject, so that the application generates questions to test my understanding across selected material.

#### Acceptance Criteria

1. WHEN a Learner enters Revision Mode, THE Learning_App SHALL display all stored Chapters for the selected Subject with options to select one, multiple, or all Chapters
2. WHEN a Learner selects Chapters and starts revision, THE Comprehension_Service SHALL generate between 5 and 20 questions per selected Chapter using the question generation strategy registered by the Subject_Module, spanning the content of all selected Chapters
3. THE Comprehension_Service SHALL generate revision questions distributed across recall, understanding, and application difficulty levels with at least one question of each level per selected Chapter
4. WHEN a Learner selects timed test mode within Revision Mode, THE Comprehension_Service SHALL generate a timed mock test with a Learner-configurable time limit between 5 and 120 minutes
5. WHEN a revision session is complete, THE Comprehension_Service SHALL display a performance summary broken down by Chapter showing percentage score, topics where the Learner scored 70 percent or above as strengths, and topics where the Learner scored below 70 percent as areas needing improvement
6. THE Content_Store SHALL record revision session results including date, selected Subject, selected Chapters, per-Chapter scores, and question-level responses to track improvement across multiple revision attempts
7. IF a Learner exits a revision session before answering all questions, THEN THE Comprehension_Service SHALL save the partial progress and allow the Learner to resume the session or view a summary of questions answered so far
8. WHEN a timed mock test reaches the configured time limit, THE Comprehension_Service SHALL automatically end the session, mark unanswered questions as unattempted, and display the performance summary based on answered questions only

### Requirement 7: Multi-Platform Support

**User Story:** As a Learner, I want to access the application on Android mobile and web browsers, so that I can learn from any device.

#### Acceptance Criteria

1. THE Learning_App SHALL provide an Android mobile application compatible with Android 8.0 and above
2. THE Learning_App SHALL provide a web application accessible through the two most recent major versions of Chrome, Firefox, Safari, and Edge browsers
3. THE Learning_App SHALL synchronize learning progress and stored content across Android and web platforms within 5 seconds of a conflict-free change being saved
4. WHEN a Learner switches between Android and web platforms, THE Learning_App SHALL restore the Learner's last active Subject, Chapter, exercise position, and any unsaved input so that the Learner can continue from where they left off
5. THE Learning_App SHALL provide camera capture functionality on the Android application and file upload functionality on the web application for content ingestion
6. IF a synchronization conflict occurs because the same content was modified on both platforms before syncing, THEN THE Learning_App SHALL retain the most recently saved version and provide the Learner with an option to review the overwritten changes

### Requirement 8: Authentication and Session Persistence

**User Story:** As a Learner, I want to log in and have my session persist across visits, so that I can continue learning without losing progress.

#### Acceptance Criteria

1. THE Authentication_Service SHALL support user registration with email or phone number and a password between 8 and 128 characters containing at least one letter and one digit
2. WHEN a Learner provides valid credentials, THE Authentication_Service SHALL authenticate the Learner and establish a Session
3. WHILE a Session is active, THE Learning_App SHALL maintain the Learner's state including current Subject, current Chapter, exercise progress, and navigation position
4. WHEN a Learner closes the application without logging out, THE Authentication_Service SHALL preserve the Session for a minimum of 30 days
5. IF a Learner provides invalid credentials three consecutive times, THEN THE Authentication_Service SHALL temporarily lock the account for 15 minutes, notify the registered contact via the registered email or phone number, and reset the failed attempt counter upon the next successful authentication
6. THE Authentication_Service SHALL support parental account linking so that a parent can view the Learner's progress across all enrolled subjects, reset the Learner's password, and update the Learner's profile including Grade and registered contact information
7. THE Learning_App SHALL continuously preserve the Learner's progress locally as a background backup regardless of Session status, retaining the local backup for a maximum of 7 days
8. IF a Learner submits a registration form with an invalid email format or phone number format, THEN THE Authentication_Service SHALL display an error message indicating which field is invalid, preserve all entered form data, and allow the Learner to correct the invalid fields without re-entering other information
9. WHEN a Session expires, THE Authentication_Service SHALL redirect the Learner to the login screen
10. WHEN a Learner re-authenticates after a Session expiry, THE Learning_App SHALL restore the locally preserved progress to the Learner's account and resume from the last saved state

### Requirement 9: Grade Management and Content Lifecycle

**User Story:** As a Learner, I want my grade level stored in my profile, so that when I move to the next grade the application archives previous grade content to reduce storage costs.

#### Acceptance Criteria

1. THE Learning_App SHALL store the Learner's current Grade as a value from Grade 1 through Grade 12 as part of their profile
2. WHEN a Learner or parent updates the Grade to the next sequential level, THE Learning_App SHALL prompt the Learner or parent to choose whether to keep or delete the previous Grade's Chapters and progress data across all enrolled Subjects
3. WHEN the Learner or parent chooses to delete previous Grade content, THE Learning_App SHALL present a confirmation prompt requiring explicit acknowledgment before THE Content_Store permanently removes all Chapters, questions, and progress data associated with that Grade across all Subjects
4. WHEN the Learner or parent chooses to keep previous Grade content, THE Content_Store SHALL retain the content in a read-only archived state accessible from the Learner's profile
5. WHEN a Learner is promoted to a new Grade, THE Learning_App SHALL reset progress tracking for the new Grade while preserving cumulative achievement history including total Chapters completed, overall scores per Subject, and revision session count across all previous Grades
6. WHEN the configured academic year end date is 30 days away, THE Learning_App SHALL notify the parent account to confirm the upcoming grade promotion and allow the parent to set or adjust the expected promotion date

### Requirement 10: Multi-Subject Enrollment and Management

**User Story:** As a Learner, I want to enroll in multiple subjects simultaneously and manage them independently, so that I can use the platform for all my learning needs across different subjects.

#### Acceptance Criteria

1. THE Learning_App SHALL allow a Learner to enroll in up to 10 Subjects independently such that enrolling in, progressing through, or removing one Subject does not alter the content, scores, or progress of any other Subject
2. WHEN a Learner enrolls in a Subject, THE Learning_App SHALL create an isolated content and progress space for that Subject, and THE Learning_App SHALL display only the Chapters and progress associated with the selected Subject in the Learner's active view
3. THE Learning_App SHALL implement a content model where Subject-specific content types, validation rules, and rendering logic are defined by Subject_Modules separately from core platform functionality including authentication, session management, progress tracking, and content storage
4. THE Comprehension_Service SHALL support pluggable question generation strategies where each Subject_Module registers its own question generation logic, and the Comprehension_Service selects the appropriate strategy based on the Subject associated with the content
5. WHEN a new Subject is added to the platform, THE Learning_App SHALL make the Subject available to Learners for enrollment by deploying only the Subject_Module including content extraction rules, question generation strategy, and rendering configuration without requiring changes to authentication, session management, progress tracking, or content storage services
6. THE Learning_App SHALL present a Subject selection interface upon login or from the main navigation, allowing the Learner to switch between enrolled Subjects within a single tap or click
7. THE Content_Store SHALL organize all content and progress tracking by Subject, and THE Learning_App SHALL display aggregate progress summaries across all enrolled Subjects on the Learner's dashboard

### Requirement 11: SaaS Deployment Model

**User Story:** As a product owner, I want the application delivered as a Software-as-a-Service solution, so that learners can access it without local installation of backend components and the platform can scale with demand.

#### Acceptance Criteria

1. THE Learning_App SHALL be deployed as a cloud-hosted multi-tenant SaaS solution where each Learner's data is logically isolated such that no Learner can access, view, or modify another Learner's content, progress, or account data through any application interface or API
2. THE Learning_App SHALL support horizontal scaling of backend services to handle a minimum of 1000 concurrent Learners while maintaining 95th percentile response times under 2 seconds for API requests
3. THE Learning_App SHALL provide automatic software updates to all Learners without requiring manual intervention or application reinstallation
4. THE Learning_App SHALL maintain a service availability of 99.5 percent measured on a monthly basis excluding pre-announced maintenance windows of no more than 4 hours per month
5. WHEN backend services are updated, THE Learning_App SHALL perform zero-downtime deployments so that active Learner Sessions continue without loss of in-progress data or forced re-authentication
6. IF the Learning_App reaches its maximum scaling capacity, THEN THE Learning_App SHALL queue incoming requests and display a notification to affected Learners indicating temporary high demand, rather than returning errors or dropping connections

### Requirement 12: Cost Effectiveness

**User Story:** As a product owner, I want the solution to be cost effective, so that the platform remains financially sustainable while serving a large number of learners.

#### Acceptance Criteria

1. THE Learning_App SHALL use serverless or auto-scaling compute resources that scale down to minimal resource allocation when fewer than 10 concurrent Learners are active
2. THE Learning_App SHALL cache content accessed more than once per Learner session, such as pronunciation audio and Chapter text, at the client side with a maximum cache size of 500 MB per device and a cache expiration period of 7 days since last access
3. THE Learning_App SHALL use tiered storage where content accessed within the last 30 days (day 0 through day 29) uses high-performance storage and content last accessed 30 or more days ago is moved to lower-cost storage
4. THE Learning_App SHALL batch non-urgent processing tasks such as progress analytics and revision statistics with a maximum processing delay of 24 hours from the time of the triggering event
5. WHEN a Learner uploads an image for content ingestion, THE Content_Ingestion_Service SHALL compress the image to a maximum file size of 1 MB while maintaining sufficient resolution for accurate text extraction before transmission

### Requirement 13: Reactive User Interface

**User Story:** As a Learner, I want the application interface to be responsive and reactive, so that interactions feel immediate and the app adapts to different screen sizes.

#### Acceptance Criteria

1. THE Learning_App SHALL render interactive elements and respond to user input within 100 milliseconds for operations that do not require a network request
2. THE Learning_App SHALL display loading indicators for operations that take longer than 500 milliseconds to complete
3. THE Learning_App SHALL adapt its layout responsively to viewport widths ranging from 320 pixels to 1920 pixels, and SHALL render content below 320 pixels using best-effort layout adaptation without guaranteeing full design fidelity
4. WHILE network connectivity is unavailable, THE Learning_App SHALL allow the Learner to continue using cached content and SHALL queue pending actions up to a maximum of 50 queued actions
5. WHEN network connectivity is restored, THE Learning_App SHALL synchronize all queued actions with the server in the order they were performed
6. THE Learning_App SHALL use optimistic UI updates for actions such as saving answers and marking progress so that the Learner perceives the result within 100 milliseconds
7. IF the server rejects a queued or optimistically applied action upon synchronization, THEN THE Learning_App SHALL revert the local state for that action and display a notification informing the Learner that the action could not be saved

### Requirement 14: iOS Platform Extensibility

**User Story:** As a product owner, I want the application architecture to support future extension to the iOS platform, so that the user base can expand to Apple device users.

#### Acceptance Criteria

1. THE Learning_App SHALL implement backend APIs as platform-independent RESTful or GraphQL services that require only standard HTTP/HTTPS protocols and JSON data formats, with no platform-specific SDKs or libraries required for client consumption
2. THE Learning_App SHALL separate all business logic from platform-specific UI code such that shared business logic modules contain no imports or dependencies on platform-specific UI frameworks, enabling reuse across Android, web, and future iOS clients
3. THE Learning_App SHALL use a data synchronization protocol based on standard HTTP/HTTPS and JSON or Protocol Buffers that supports Android, web, and iOS clients without backend modifications or proprietary client libraries
4. THE Learning_App SHALL provide a machine-readable API specification covering all endpoints, request and response schemas, authentication requirements, and error responses to enable independent iOS client development
5. WHERE the Android client uses platform-specific features including camera access, file system access, and push notifications, THE Learning_App SHALL abstract these behind a platform interface layer that defines input and output contracts independently of any platform implementation
6. THE Learning_App SHALL ensure that the Authentication_Service issues tokens and manages sessions using platform-agnostic standards so that any client on Android, web, or iOS can authenticate without platform-specific authentication flows
