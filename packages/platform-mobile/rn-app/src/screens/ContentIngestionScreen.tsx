/**
 * ContentIngestionScreen (Mobile)
 *
 * Step-by-step flow for content ingestion on mobile:
 * 1. Subject selection (only assigned subjects)
 * 2. Book selection (with "Add New Book" option)
 * 3. Chapter selection (with "Add New Chapter" option)
 * 4. Page upload with native camera capture
 *
 * Mobile-specific: Uses step-by-step flow instead of sidebar layout.
 * Camera capture uses native camera API (react-native-camera or expo-camera).
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 8.1, 8.2, 3.5
 */
import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  Alert,
  Image,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import {colors, spacing, radius, mobileLayout} from '../theme/tokens';

type Step = 'subject' | 'book' | 'chapter' | 'upload';

interface SubjectItem {
  id: string;
  name: string;
  color: string;
}

interface BookItem {
  id: string;
  name: string;
  chapterCount: number;
}

interface ChapterItem {
  id: string;
  name: string;
  hasContent: boolean;
  pageCount: number;
}

interface CapturedPage {
  uri: string;
  id: string;
}

const MOCK_SUBJECTS: SubjectItem[] = [
  {id: '1', name: 'Kannada', color: '#9B59B6'},
  {id: '2', name: 'English', color: '#5DADE2'},
  {id: '3', name: 'Hindi', color: '#F7C948'},
  {id: '4', name: 'Maths', color: '#E94F9B'},
];

const MOCK_BOOKS: BookItem[] = [
  {id: 'b1', name: 'Textbook Grade 5', chapterCount: 12},
  {id: 'b2', name: 'Workbook Grade 5', chapterCount: 8},
];

const MOCK_CHAPTERS: ChapterItem[] = [
  {id: 'c1', name: 'Chapter 1 - Introduction', hasContent: true, pageCount: 5},
  {id: 'c2', name: 'Chapter 2 - Letters', hasContent: false, pageCount: 0},
  {id: 'c3', name: 'Chapter 3 - Words', hasContent: false, pageCount: 0},
];

const MAX_PAGES = 50;
const MAX_FILE_SIZE_MB = 10;

export default function ContentIngestionScreen() {
  const [step, setStep] = useState<Step>('subject');
  const [selectedSubject, setSelectedSubject] = useState<SubjectItem | null>(null);
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<ChapterItem | null>(null);
  const [capturedPages, setCapturedPages] = useState<CapturedPage[]>([]);
  const [isAddingBook, setIsAddingBook] = useState(false);
  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleSubjectSelect = (subject: SubjectItem) => {
    setSelectedSubject(subject);
    setStep('book');
  };

  const handleBookSelect = (book: BookItem) => {
    setSelectedBook(book);
    setStep('chapter');
  };

  const handleChapterSelect = (chapter: ChapterItem) => {
    setSelectedChapter(chapter);
    setStep('upload');
  };

  const handleAddBook = () => {
    if (newItemName.length < 1 || newItemName.length > 200) {
      Alert.alert('Invalid Name', 'Book name must be between 1 and 200 characters.');
      return;
    }
    // In production, would call API to create book
    Alert.alert('Book Created', `"${newItemName}" has been added.`);
    setIsAddingBook(false);
    setNewItemName('');
  };

  const handleAddChapter = () => {
    if (newItemName.length < 1 || newItemName.length > 200) {
      Alert.alert('Invalid Name', 'Chapter name must be between 1 and 200 characters.');
      return;
    }
    // In production, would call API to create chapter
    Alert.alert('Chapter Created', `"${newItemName}" has been added.`);
    setIsAddingChapter(false);
    setNewItemName('');
  };

  const handleCameraCapture = useCallback(() => {
    if (capturedPages.length >= MAX_PAGES) {
      Alert.alert('Limit Reached', `Maximum ${MAX_PAGES} pages per chapter.`);
      return;
    }
    // In production, would invoke native camera API (expo-camera / react-native-camera)
    // For now, simulate a captured image
    const newPage: CapturedPage = {
      uri: `captured_page_${Date.now()}.jpg`,
      id: `page_${Date.now()}`,
    };
    setCapturedPages(prev => [...prev, newPage]);
  }, [capturedPages.length]);

  const handleDeletePage = (pageId: string) => {
    setCapturedPages(prev => prev.filter(p => p.id !== pageId));
  };

  const handleExtractText = async () => {
    if (capturedPages.length === 0) {
      Alert.alert('No Pages', 'Please capture at least one page before extracting text.');
      return;
    }
    setIsUploading(true);
    try {
      // In production: await uploadPages(chapterId, uris); await extractText(chapterId);
      await new Promise(resolve => setTimeout(resolve, 2000));
      Alert.alert('Success', 'Pages uploaded and text extraction started!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleBack = () => {
    switch (step) {
      case 'book':
        setStep('subject');
        setSelectedSubject(null);
        break;
      case 'chapter':
        setStep('book');
        setSelectedBook(null);
        break;
      case 'upload':
        setStep('chapter');
        setSelectedChapter(null);
        setCapturedPages([]);
        break;
    }
  };

  const renderSubjectStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Select Subject</Text>
      <Text style={styles.stepSubtitle}>Choose a subject to add content</Text>
      {MOCK_SUBJECTS.map(subject => (
        <TouchableOpacity
          key={subject.id}
          style={[styles.listItem, {borderLeftColor: subject.color}]}
          onPress={() => handleSubjectSelect(subject)}
          accessibilityRole="button"
          accessibilityLabel={`Select ${subject.name}`}>
          <View style={[styles.subjectDot, {backgroundColor: subject.color}]} />
          <Text style={styles.listItemText}>{subject.name}</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderBookStep = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity onPress={handleBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.stepTitle}>Select Book</Text>
      <Text style={styles.stepSubtitle}>{selectedSubject?.name}</Text>
      {MOCK_BOOKS.map(book => (
        <TouchableOpacity
          key={book.id}
          style={styles.listItem}
          onPress={() => handleBookSelect(book)}
          accessibilityRole="button"
          accessibilityLabel={`Select ${book.name}`}>
          <View style={styles.listItemContent}>
            <Text style={styles.listItemText}>{book.name}</Text>
            <Text style={styles.listItemMeta}>{book.chapterCount} chapters</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      ))}

      {/* Add New Book */}
      {isAddingBook ? (
        <View style={styles.addForm}>
          <TextInput
            style={styles.addInput}
            placeholder="Book name (1-200 chars)"
            value={newItemName}
            onChangeText={setNewItemName}
            maxLength={200}
            accessibilityLabel="New book name"
          />
          <View style={styles.addFormButtons}>
            <TouchableOpacity style={styles.addConfirmBtn} onPress={handleAddBook}>
              <Text style={styles.addConfirmText}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addCancelBtn}
              onPress={() => {
                setIsAddingBook(false);
                setNewItemName('');
              }}>
              <Text style={styles.addCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.addNewButton}
          onPress={() => setIsAddingBook(true)}>
          <Text style={styles.addNewText}>+ Add New Book</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderChapterStep = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity onPress={handleBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.stepTitle}>Select Chapter</Text>
      <Text style={styles.stepSubtitle}>{selectedBook?.name}</Text>
      {MOCK_CHAPTERS.map(chapter => (
        <TouchableOpacity
          key={chapter.id}
          style={styles.listItem}
          onPress={() => handleChapterSelect(chapter)}
          accessibilityRole="button"
          accessibilityLabel={`Select ${chapter.name}`}>
          <View style={styles.listItemContent}>
            <Text style={styles.listItemText}>{chapter.name}</Text>
            <Text style={styles.listItemMeta}>
              {chapter.hasContent ? `${chapter.pageCount} pages` : 'No content'}
            </Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      ))}

      {/* Add New Chapter */}
      {isAddingChapter ? (
        <View style={styles.addForm}>
          <TextInput
            style={styles.addInput}
            placeholder="Chapter name (1-200 chars)"
            value={newItemName}
            onChangeText={setNewItemName}
            maxLength={200}
            accessibilityLabel="New chapter name"
          />
          <View style={styles.addFormButtons}>
            <TouchableOpacity style={styles.addConfirmBtn} onPress={handleAddChapter}>
              <Text style={styles.addConfirmText}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addCancelBtn}
              onPress={() => {
                setIsAddingChapter(false);
                setNewItemName('');
              }}>
              <Text style={styles.addCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.addNewButton}
          onPress={() => setIsAddingChapter(true)}>
          <Text style={styles.addNewText}>+ Add New Chapter</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderUploadStep = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity onPress={handleBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.stepTitle}>Upload Pages</Text>
      <Text style={styles.stepSubtitle}>{selectedChapter?.name}</Text>

      {/* Camera & gallery actions */}
      <View style={styles.uploadActions}>
        <TouchableOpacity
          style={styles.cameraButton}
          onPress={handleCameraCapture}
          accessibilityRole="button"
          accessibilityLabel="Take Photo">
          <Text style={styles.cameraIcon}>📷</Text>
          <Text style={styles.cameraText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.galleryButton}
          onPress={handleCameraCapture}
          accessibilityRole="button"
          accessibilityLabel="Upload Images">
          <Text style={styles.cameraIcon}>🖼️</Text>
          <Text style={styles.cameraText}>Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* Page count and constraints */}
      <Text style={styles.pageCountText}>
        {capturedPages.length} of {MAX_PAGES} max
      </Text>
      <Text style={styles.constraintText}>
        Supported: JPEG, PNG, HEIC • Max {MAX_FILE_SIZE_MB}MB per image
      </Text>

      {/* Page thumbnail grid */}
      {capturedPages.length > 0 && (
        <View style={styles.thumbnailGrid}>
          {capturedPages.map((page, index) => (
            <View key={page.id} style={styles.thumbnailContainer}>
              <View style={styles.thumbnail}>
                <Text style={styles.thumbnailPageNum}>{index + 1}</Text>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeletePage(page.id)}
                accessibilityLabel={`Delete page ${index + 1}`}>
                <Text style={styles.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Extract text button */}
      <TouchableOpacity
        style={[
          styles.extractButton,
          capturedPages.length === 0 && styles.extractButtonDisabled,
        ]}
        onPress={handleExtractText}
        disabled={capturedPages.length === 0 || isUploading}
        accessibilityRole="button"
        accessibilityLabel="Done - Extract Text">
        {isUploading ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text style={styles.extractButtonText}>Done — Extract Text</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {step === 'subject' && renderSubjectStep()}
        {step === 'book' && renderBookStep()}
        {step === 'chapter' && renderChapterStep()}
        {step === 'upload' && renderUploadStep()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: mobileLayout.screenPadding,
    paddingBottom: spacing.xxxl,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  backButton: {
    marginBottom: spacing.md,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.cardSmall,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.border,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  listItemContent: {
    flex: 1,
  },
  listItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  listItemMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  subjectDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.md,
  },
  arrow: {
    fontSize: 20,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  addNewButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: radius.cardSmall,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  addNewText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  addForm: {
    backgroundColor: colors.white,
    borderRadius: radius.cardSmall,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  addInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    padding: spacing.md,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  addFormButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addConfirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.buttonSm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  addConfirmText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 13,
  },
  addCancelBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.buttonSm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  addCancelText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  uploadActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  cameraButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.cardSmall,
    padding: spacing.lg,
    alignItems: 'center',
  },
  galleryButton: {
    flex: 1,
    backgroundColor: colors.indigo,
    borderRadius: radius.cardSmall,
    padding: spacing.lg,
    alignItems: 'center',
  },
  cameraIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  cameraText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  pageCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  constraintText: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  thumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  thumbnailContainer: {
    position: 'relative',
  },
  thumbnail: {
    width: 64,
    height: 80,
    backgroundColor: colors.white,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailPageNum: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textMuted,
  },
  deleteButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  extractButton: {
    backgroundColor: colors.green,
    borderRadius: radius.button,
    padding: spacing.lg,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  extractButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  extractButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
