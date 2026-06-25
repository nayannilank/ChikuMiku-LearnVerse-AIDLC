# ChikuMiku LearnVerse — User Guide

## Welcome

ChikuMiku LearnVerse is a learning platform designed for children (LKG through 12th grade) to study any subject — languages (Kannada, Hindi, English), Maths, Computers, EVS (Environmental Studies), Science, and more — using their own textbook content. Simply take photos of your textbook pages, and the app helps you learn through AI-powered explanations, pronunciation practice, grammar exercises, timed quizzes, maths visual aids, coding exercises, science visualizations, and revision tests.

## Getting Started

### App Launch

When you open ChikuMiku LearnVerse, you'll see the branded splash screen — the ChikuMiku LearnVerse logo centered on a white background. This displays for 1–5 seconds while the app initializes.

- If you're already logged in (session still active), you'll go straight to your Dashboard.
- If you're not logged in, you'll be taken to the Login screen.
- If there's a connection issue during startup, you'll see the Login screen with an error message.

### Creating an Account

ChikuMiku LearnVerse uses a two-step registration process: a **parent** creates their account first, then registers their **student** (child) linked to that parent account.

#### Registering as a Parent

1. Navigate to the Registration screen
2. Select **Parent** as the account type
3. Fill in the following fields:
   - **Username** (8–15 characters; letters, numbers, hyphens, and underscores only)
   - **Name** (5–20 characters; letters and spaces only)
   - **Phone Number** (exactly 10 digits)
   - **Email** (up to 30 characters, valid email format)
   - **Password** (8–20 characters; must include at least one uppercase letter, one lowercase letter, one digit, and one special character)
4. Tap **Register Parent**
5. On success, you'll see a confirmation message and be redirected to the Login screen

If a username, email, or phone number is already taken, the app highlights exactly which field has the conflict without clearing your other entries.

#### Registering a Student (requires parent login)

1. Log in as a parent first
2. Navigate to the Student Registration form (your parent username will be pre-filled and read-only)
3. Fill in the following fields:
   - **Student Username** (8–15 characters; letters, numbers, hyphens, and underscores only)
   - **Name** (5–20 characters; letters and spaces only)
   - **Password** (8–20 characters; must include at least one uppercase letter, one lowercase letter, one digit, and one special character)
   - **Grade** (select from: LKG, UKG, First, Second, Third, Fourth, Fifth, Sixth, Seventh, Eighth, Ninth, Tenth, Eleventh, Twelfth)
   - **School Name** (5–30 characters; letters, numbers, commas, and hyphens)
4. **Select Subjects**: The 7 default subjects (Maths, Science, Computers, EVS, Hindi, English, Kannada) are shown as checkboxes — all selected by default. You can:
   - Deselect subjects that don't apply to your child
   - Tap **Add Subject** to create a custom subject (e.g., "French") with a name of 1–50 characters
   - At least one subject must remain selected
5. Tap **Register Student**

### Parent and Student Account Relationship

- Each student account is linked to a parent account
- Parents can have multiple students linked to their account
- Parents assign and manage subjects for each student
- Password recovery uses the phone number and email registered to the parent account
- Parents can monitor progress and edit subjects via the Parent Dashboard

### Logging In

1. On the Login screen, select your role — **Parent** or **Learner** — using the role selector (Parent is selected by default)
2. Enter your **Username** and **Password** (masked)
3. Tap **Login**
4. On success:
   - **Parents** are taken to the Parent Dashboard
   - **Students** are taken to the Learner Dashboard

If login fails, you'll see an error message ("incorrect username or password"). Your username is preserved but the password field is cleared.

**Note**: After 3 consecutive incorrect password attempts, your account will be locked for 15 minutes for security.

A **Forgot Password?** link is displayed below the Login button.

### Forgot Password (Dual OTP Verification)

Password recovery works for both parent and student accounts. For student accounts, the recovery always routes through the linked parent's registered email and phone.

1. Tap **Forgot Password?** on the Login screen
2. Enter the parent's registered **email address** and **phone number**
3. Tap **Send OTP**
4. The system sends a one-time password (OTP) to **both** the email and phone simultaneously
5. On the OTP Verification screen, enter:
   - The OTP received via **email**
   - The OTP received via **phone** (SMS)
6. Both OTPs must be correct. They expire after **10 minutes** — if expired, tap "Resend OTP" to get new codes
7. Once both OTPs are verified, the New Password screen appears
8. Enter your new password (8–20 characters; must include uppercase, lowercase, digit, and special character)
9. Tap **Reset Password**
10. On success, you'll be redirected to the Login screen with a success message

### Logging Out

A **Logout** button is visible in the top-right corner of both web and mobile screens on all authenticated pages.

1. Tap the **Logout** button
2. A confirmation dialog appears: "Are you sure you want to log out?"
3. Confirm to log out — your progress, exercise results, and session data are automatically saved
4. You'll be taken to the Login screen

When you log back in, everything is restored exactly where you left off — progress, streak, last viewed chapter and page.

### Session Expiry

If your session expires while you're using the app:
- You'll be redirected to the Login screen with a "Session ended" message
- The app attempts to save any unsaved input before redirecting
- After logging back in, your progress is restored

## Navigation

### Mobile Navigation (Bottom Bar)

On mobile, a bottom navigation bar with 5 tabs is always visible:

| Tab | Icon | Destination |
|-----|------|-------------|
| Home | 🏠 | Learner Dashboard |
| Chapters | 📚 | Chapter Browser |
| Scan | 📷 | Content Ingestion (upload pages) |
| Revision | 🔄 | Revision Screen |
| Me | 👤 | Profile / Settings |

Tap any tab to navigate. The active tab is highlighted.

### Web Navigation (Top Bar + Sidebar)

On web, navigation consists of:

- **Top Navigation Bar**: Logo, navigation links (Dashboard, Subjects, Revision, Progress), and your user avatar with a Logout button
- **Sidebar** (on screens wider than 960px): Lists all your assigned subjects with their icons and progress indicators

Click any link or subject in the sidebar to navigate. The active item is highlighted.

## Learner Dashboard

When you log in as a student, the Dashboard is your home screen.

### What You'll See

- **Personalized greeting**: "Hi, [Your Name]!" with the current date in "Day, DD Month" format (e.g., "Monday, 15 January"). Names longer than 30 characters are truncated.
- **Learning streak**: A fire 🔥 icon with your streak count in gold (e.g., "7 days") — showing how many consecutive days you've completed at least one exercise.
- **Subject cards**: A grid of cards for each of your assigned subjects (2 columns on mobile, 3 columns on web). Each card shows:
  - Subject name
  - Subject-specific color and icon
  - Your progress as a percentage (0–100%)

Tap any subject card to open that subject's learning area.

### Loading and Error States

- While data is loading, you'll see placeholder indicators for streak and progress
- If progress data is temporarily unavailable, subject cards show a placeholder with an error message

## Learning Streaks

Streaks motivate consistent daily practice.

- **How it works**: Complete at least one exercise on a calendar day to maintain your streak
- **How it increments**: The first exercise you complete on a new day adds 1 to your streak
- **How it resets**: If you miss **two consecutive calendar days** without completing any exercise, your streak resets to zero on the second missed day
- **Where it's displayed**: On your Dashboard with a fire icon and gold color

## Subject Management

Subjects are managed by your parent — not directly by students.

- **During registration**: Your parent selects which subjects you study from the 7 defaults (Kannada, English, Hindi, Maths, Computers, EVS, Science) plus any custom subjects they create
- **After registration**: Your parent can add or remove subjects from the Parent Dashboard using "Edit Subjects"
- **Minimum**: At least one subject must always be assigned

Custom subjects (e.g., "French", "Drawing") can be created by parents with names up to 50 characters. Each gets its own unique color that doesn't conflict with default subject colors.

## Adding Textbook Content

### Content Hierarchy

Your study content is organized as: **Subject → Book → Chapter → Pages**

### Selecting Subject, Book, and Chapter

1. Navigate to the content ingestion flow (tap "Scan" on mobile, or "Subjects" on web)
2. You'll see only your assigned subjects
3. Select a subject to see its books (each shows name + chapter count)
4. Tap **Add New Book** to create a new book (name: 1–200 characters)
5. Select a book to see its chapters (each shows name, sequence number, and status — ✓ for chapters with content, "New" for empty ones)
6. Tap **Add New Chapter** to create a new chapter (name: 1–200 characters)
7. Select a chapter to open the page upload area

**Platform differences**:
- **Web**: Left sidebar with subject list, main content area showing books and chapters side by side
- **Mobile**: Step-by-step flow — select subject → select book → select chapter → upload pages

### Uploading Pages

Once inside a chapter, you'll see options to add pages:

- **Take Photo** (mobile): Opens your device camera for JPEG capture
- **Upload Images** (all platforms): Opens a file picker for JPEG, PNG, or HEIC files
- **Drag and Drop** (web only): Drop image files into the designated drop zone

**Constraints**:
- Maximum **10 MB** per image — larger files are rejected with a size error
- Maximum **50 pages** per chapter — once reached, uploads are disabled
- Supported formats: JPEG, PNG, HEIC

After uploading, you'll see:
- Numbered thumbnail grid of all pages with total count (e.g., "4 of 50 max")
- Delete button on each thumbnail to remove individual pages
- **"Done — Extract Text"** button to upload and start text recognition

### Text Recognition (OCR)

After tapping "Done — Extract Text":

1. Each page image is processed to extract text (supports Kannada, English, Hindi, mathematical notation, and other Indic scripts)
2. The Chapter Transcript screen appears showing:
   - Page-by-page extracted text with page number and word count
   - Total summary (e.g., "Text extracted from 4 pages • Total: 1,024 words")
3. Tap **Edit Transcript** to manually correct any OCR errors
4. Tap **Save Transcript** to save the chapter content

**Platform differences**:
- **Web**: Page image thumbnails on the left, corresponding text on the right
- **Mobile**: Scrollable list of page text blocks

If extraction fails for a specific page, that page shows an error indicator while other pages display normally.

## Learning Features

### Chapter Explanations (AI-Powered)

After saving a chapter transcript, you can get AI-generated explanations:

1. Open the Chapter Explanation screen for any chapter with saved content
2. The app generates an explanation including:
   - **Summary** of the page content
   - **Key Words** with romanization and meaning (for non-English subjects)
   - **Concepts / Moral** — contextual notes about the material

**Read / Listen modes**:
- **Read (Text)** — default mode, displays the explanation as formatted text
- **Listen (Speech)** — generates and plays audio narration of the explanation

**Page navigation**: Use **Previous** and **Next** buttons to move between page-by-page explanations.

**Additional features**:
- **Generate Revision Questions** — creates MCQs, short answers, and fill-in-the-blank questions from the chapter. Once generated, the button changes to "View Revision Questions"
- **Generate Summary** — creates key points, important concepts, and exam preparation notes. Once generated, the button changes to "View Summary"
- **Translation** (language subjects only) — select "English" or "Hindi" to translate the explanation

All AI-generated content is created once and stored permanently — subsequent views load instantly without regeneration.

### Exercise Assistant (AI-Powered Help)

The Exercise Assistant helps you solve textbook exercises with contextual guidance:

1. During text extraction, the app identifies pages that contain exercises and asks you to confirm: "This page appears to contain exercises. Confirm?"
2. Confirmed exercise pages are parsed into individual exercise items
3. For each exercise, you can:
   - **Get Hint** — the app references your chapter content to provide a contextual hint without revealing the full answer
   - **Submit Answer** — get feedback as a grade-appropriate teacher would give it (correct/incorrect with explanation)
   - If incorrect, the app references the relevant chapter section where the answer can be found
4. After completing all exercises, see a **completion summary** with your score (correct/total)

Supported exercise types: fill-in-the-blanks, multiple choice, match-the-following, true/false, and short answer — for all subjects.

### Pronunciation Practice (Language Subjects)

Available for Kannada, Hindi, and English:

1. A target word is displayed at language-appropriate size (32px English, 40px Hindi, 52px Kannada)
2. Below it: phonetic transcription (romanization)
3. Tap the **audio button** to hear the correct pronunciation (generated once, served from CDN)
4. Tap **Record** to capture your pronunciation (up to 10 seconds)
5. Get an **accuracy score** (0–100%) with syllable-by-syllable highlights:
   - Green = correct syllable
   - Red = incorrect syllable
6. Tap **Retry** to try again, or **Next** to move to the next word

**Tips**:
- Make sure microphone permission is granted
- Speak clearly at normal volume
- Score is returned within 5 seconds

### Grammar Exercises (Language Subjects)

Fill-in-the-blank grammar exercises with explanatory feedback:

1. See the current question counter (e.g., "4/8") and a progress bar
2. A sentence is displayed with a blank (underscore placeholder)
3. Choose from 2–5 multiple-choice options
4. Tap an option to select it (highlighted in pink):
   - **Correct**: Green feedback panel with grammatical explanation
   - **Incorrect**: Red feedback panel showing the correct answer and the grammar rule
5. The **Next** button is disabled until you answer
6. After the last question, see your completion summary (correct/total)

### Timed Quiz

Test your knowledge under time pressure with A/B/C/D multiple choice:

1. A countdown timer starts (displayed as MM:SS, ranging from 30 seconds to 60 minutes)
2. See the question counter (e.g., "Q8/20")
3. Four answer options (A, B, C, D) are displayed as tappable cards
4. Select an option (highlighted in pink), then:
   - **Submit** — records your answer and shows correct/incorrect + updates live score
   - **Skip** — moves to next question without recording an answer
5. If you tap Submit without selecting an option, you'll see an inline prompt
6. **Live score panel** (web): shows running percentage and correct count
7. Quiz ends when timer reaches zero or you answer/skip the last question
8. **Final score summary**: total correct, total questions, percentage, time taken

**Note**: If you try to navigate away during a quiz, a confirmation dialog warns that progress will be lost.

### Maths Practice

Visual fraction problems with interactive input:

1. A fraction problem is shown using colored shapes (circles or rectangles with filled portions)
2. Enter the **numerator** and **denominator** (integers 0–99)
3. Tap **Check Answer**:
   - **Correct**: Green success indicator
   - **Incorrect**: Red indicator with a hint about which part (numerator/denominator) is wrong — doesn't reveal the answer
4. Empty or non-integer inputs show a validation message
5. Question counter shows progress (e.g., "3/10") with 5–20 questions per set

### Computers Exercises

Programming concept practice with code and matching:

1. **Code editor**: Displays code with syntax highlighting
2. **Drag-and-drop matching**: Pair code concepts with their descriptions (3–8 pairs per exercise)
3. Tap **Check Matches**:
   - If not all pairs matched: shows remaining count
   - If all matched: validates and shows green (correct) / red (incorrect) per pair
4. Tap **Reset** to clear all matches and start over

### EVS Visualizations (Science)

Interactive animated science exercises:

1. **Animated visualization**: Shows a scientific process (e.g., water cycle) as a looping animation with emoji/icon sequences
2. **Stage descriptions**: Labeled stages (3–8) of the process
3. **Drag-and-drop ordering**: Arrange the stages in correct sequence (initially randomized)
4. Tap **Check Order**:
   - Correct items: highlighted in green with checkmarks
   - Incorrect items: shown in default blue
5. **EVS Quiz**: MCQ questions with scientific explanations shown for correct answers

## Revision Mode

### Starting a Revision Session

Revision questions are generated from your chapter content:

1. Open a chapter's Explanation screen
2. Tap **Generate Revision Questions** — the app creates MCQs, short answers, and fill-in-the-blank questions
3. Navigate to the Revision screen to answer them
4. Questions span different difficulty levels:
   - **Recall**: Basic facts and definitions
   - **Understanding**: Explain concepts in your own words
   - **Application**: Apply knowledge to new situations

Once generated, questions are stored permanently — tap "View Revision Questions" anytime to access them.

### Performance Summary

After completing a revision session:
- **Per-chapter scores** with percentage
- **Strengths**: Topics where you scored 70% or above
- **Areas to improve**: Topics where you scored below 70%
- Results are saved to track improvement over time

### Saving Progress

- If you exit early, progress is saved automatically
- You can resume later or view a summary of what you've answered

## Parent Dashboard

When you log in as a parent, you'll see the Parent Dashboard.

### Learner List

- All your registered students are listed with their **name** and **grade**
- If you have no learners yet, you'll see a prompt with a prominent **Register Student** button

### Viewing Learner Progress

Tap any learner to see their progress:
- Subject cards with progress percentages (same view as the student's own Dashboard)
- Current streak count
- Recent activity

### Registering Additional Students

Tap **Register Student** to add more children to your account (follows the same student registration flow).

### Editing Subjects

From a learner's progress view:
1. Tap **Edit Subjects**
2. See current assigned subjects as checkboxes (checked = assigned)
3. Select additional default or custom subjects, or deselect existing ones
4. At least one subject must remain selected
5. Save changes

## Progress Tracking

### Per-Subject Progress

For each subject, the app tracks:
- **Progress percentage**: Completed exercises ÷ total available exercises
- **Individual scores**: Per activity type (pronunciation, grammar, quiz, comprehension, maths, etc.)
- **Last accessed date**

### Chapter Progress

For each chapter:
- **Completion percentage**: Proportion of available activities completed
- Activities where you scored below 60% are highlighted for focused review

### Historical Quiz Scores

View your past quiz results filtered by date range, ordered newest first.

## Grade Management

### Updating Your Grade

When you move to the next grade:

1. Your parent can update the grade in your profile
2. You'll be asked whether to **keep** or **delete** previous grade content:
   - **Keep**: Content is archived in read-only mode (you can still view it)
   - **Delete**: Requires confirmation before permanent removal
3. Progress resets for the new grade, but your cumulative achievement history is preserved

### Academic Year Notifications

- Your parent receives a notification 30 days before the configured academic year end
- They can confirm or adjust the expected promotion date

## Using the Help Button

A help button (question mark icon) is always visible in the bottom-right corner of the screen after you log in. Tap or click it at any time to open this User Guide directly inside the app.

### Navigating the Help Viewer

- A **table of contents** on the side lists all sections — tap any entry to jump directly to that section
- Scroll through the full guide content
- The active section is highlighted in the table of contents as you read

### Closing the Help Viewer

- Tap the **close button** (X) to dismiss the viewer
- On Android, press the **back button** to close
- On web, press the **Escape key** to close
- When you close the viewer, you return to exactly where you were — your scroll position, form inputs, and activity progress are all preserved

### Offline Access

- On **Android**, the User Guide is bundled with the app and always available offline
- On **Web**, the guide is cached after your first online visit — you can access it offline after that
- If you're on the web and haven't loaded the guide online yet, you'll see a message explaining that an internet connection is needed for the first load

## Using Multiple Devices

ChikuMiku LearnVerse works on:
- **Android** (8.0 and above)
- **Web browsers** (Chrome, Firefox, Safari, Edge — latest 2 versions)

### Syncing

- Your progress syncs automatically across devices within 5 seconds
- When you switch devices, the app restores exactly where you left off (subject, chapter, exercise position, and any unsaved input)
- If you edit the same content on two devices before syncing, the most recent version is kept (you can review what was overwritten)

### Offline Mode

You can keep learning even without internet:
- Previously accessed content is cached on your device (up to 500 MB)
- Actions you take offline are queued (up to 50 actions)
- Everything syncs automatically when you're back online
- If a queued action can't be saved, you'll be notified

## Local Progress Backup

Your progress is continuously backed up locally on your device:
- Backups are kept for up to 7 days
- If your session expires, simply log in again and your local progress is restored
- This works regardless of whether you're online or offline

## Branding

You'll notice the ChikuMiku LearnVerse logo throughout the app:
- **Splash screen**: Centered logo on a white background at launch
- **Navigation bar**: Logo displayed in the header as you navigate
- **Android app icon**: The ChikuMiku LearnVerse logo
- **Web browser**: Logo in the header/navigation area plus the browser favicon

On the web, if the logo image can't load, the text "ChikuMiku LearnVerse" appears as a fallback.

## Tips for Best Results

1. **Good photos**: Use good lighting and hold your phone steady when photographing textbook pages
2. **Review extracted text**: Always check the extracted text before saving — fix any errors
3. **Use Chapter Explanations**: After saving a transcript, generate explanations to understand content better
4. **Practice pronunciation daily**: Maintain your streak by completing at least one exercise per day
5. **Generate Revision Questions**: Use these before exams for targeted practice
6. **Get Hints, don't skip**: When stuck on an exercise, use "Get Hint" to learn from chapter content
7. **Regular revision**: Use Revision Mode regularly to identify and strengthen weak areas
8. **Timed quizzes**: Practice with timed quizzes before real exams to build speed
9. **Use the help button**: Tap the help icon anytime you need guidance — it's always there in the corner
10. **Organize by textbook**: Create separate books for each physical textbook you study from

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Photo text not extracting well | Retake with better lighting, ensure text is clearly visible |
| Microphone not working | Check app permissions in device settings |
| Audio not playing | Check volume, try the retry option |
| Can't save chapter | Check internet connection; content is saved locally for retry |
| Account locked | Wait 15 minutes, then try again with correct password |
| Session expired | Log in again; your local progress will be restored |
| Help guide not loading (web) | Connect to the internet once to cache the guide for offline use |
| "Session ended" message | Your token expired — log in again and your unsaved work is restored |
| Can't log in (network error) | Check your internet connection and try again |
| Parent username not found (registration) | Verify the parent registered first and check the username spelling |
| Camera permission denied | Go to device Settings → App Permissions and enable camera access |
| Gallery permission denied | Go to device Settings → App Permissions and enable storage/photos access |
| Image too large (>10 MB) | Use a smaller image or reduce the photo resolution before selecting |
| Upload failed | Check your connection; existing pages are not affected — try again |
| Splash screen stuck | Force-close the app and reopen; if persistent, check your internet connection |
| OTP expired | OTPs are valid for 10 minutes — tap "Resend OTP" to get new codes |
| OTP not received | Check spam/junk folder for email OTP; ensure correct phone number |
| Explanation not generating | Ensure chapter transcript is saved first; check internet connection |
| Quiz timer ran out | Your score is calculated from questions answered before time expired |
| Streak reset unexpectedly | Streaks reset after 2 missed days — complete one exercise daily to maintain |

## Privacy and Safety

- Your data is private — no other learner can see your content or progress
- Parent accounts can monitor progress for child safety
- Local backups ensure you never lose work unexpectedly
- Login is required before any content can be accessed
- Student accounts are always linked to a parent for security and recovery
- Passwords are never stored in plain text
- OTP codes expire after 10 minutes for security
