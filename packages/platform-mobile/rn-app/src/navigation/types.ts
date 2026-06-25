/**
 * Navigation Type Definitions for the mobile app.
 *
 * Bottom Tab Navigator has 5 tabs: Home, Chapters, Scan, Revision, Me
 * Each tab may contain a nested stack navigator.
 *
 * Requirements: 4.1, 4.2, 3.5
 */

export type BottomTabParamList = {
  Home: undefined;
  Chapters: undefined;
  Scan: undefined;
  Revision: undefined;
  Me: undefined;
};

export type HomeStackParamList = {
  Dashboard: undefined;
  SubjectLanding: { subjectId: string; subjectName: string; color: string };
  Pronunciation: { subjectId: string; wordId?: string };
  GrammarExercise: { subjectId: string; chapterId?: string };
  Quiz: { subjectId: string };
};

export type ChaptersStackParamList = {
  ChapterBrowser: undefined;
  TextbookList: { subjectId: string };
  ChapterSelection: { subjectId: string; bookId: string };
};

export type ScanStackParamList = {
  ContentIngestion: undefined;
  PageUpload: { chapterId: string; chapterName: string };
};

export type RevisionStackParamList = {
  RevisionHome: undefined;
};

export type MeStackParamList = {
  Profile: undefined;
};
