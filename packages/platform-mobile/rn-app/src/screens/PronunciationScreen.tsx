/**
 * PronunciationScreen (Mobile)
 *
 * Displays a word for pronunciation practice with:
 * - Word display at language-appropriate font size (32px English, 40px Hindi, 52px Kannada)
 * - Phonetic transcription below the word
 * - Audio playback button for reference TTS
 * - Record button → stop button (max 10s recording)
 * - Accuracy percentage and syllable highlights (green/red)
 * - Retry and Next buttons
 * - Microphone permission error handling
 *
 * Uses native microphone API (expo-av / react-native-audio-recorder-player).
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 12.11, 3.5, 8.2
 */
import React, {useState, useCallback, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {colors, spacing, radius, mobileLayout, pronunciationFontSizes} from '../theme/tokens';

interface SyllableResult {
  syllable: string;
  isCorrect: boolean;
}

interface WordData {
  word: string;
  phonetic: string;
  syllables: string[];
  language: 'kannada' | 'english' | 'hindi';
  referenceAudioUrl: string;
}

const MOCK_WORDS: WordData[] = [
  {
    word: 'Beautiful',
    phonetic: '/ˈbjuːtɪfʊl/',
    syllables: ['Beau', 'ti', 'ful'],
    language: 'english',
    referenceAudioUrl: 'https://example.com/audio/beautiful.mp3',
  },
  {
    word: 'नमस्ते',
    phonetic: '/nəˈmʌsteɪ/',
    syllables: ['न', 'म', 'स्ते'],
    language: 'hindi',
    referenceAudioUrl: 'https://example.com/audio/namaste.mp3',
  },
  {
    word: 'ಕನ್ನಡ',
    phonetic: '/ˈkʌnnʌdʌ/',
    syllables: ['ಕ', 'ನ್ನ', 'ಡ'],
    language: 'kannada',
    referenceAudioUrl: 'https://example.com/audio/kannada.mp3',
  },
];

const MAX_RECORDING_SECONDS = 10;

export default function PronunciationScreen() {
  const [wordIndex, setWordIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [accuracyScore, setAccuracyScore] = useState<number | null>(null);
  const [syllableResults, setSyllableResults] = useState<SyllableResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentWord = MOCK_WORDS[wordIndex % MOCK_WORDS.length];

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const getWordFontSize = (language: string): number => {
    switch (language) {
      case 'kannada':
        return pronunciationFontSizes.kannada;
      case 'hindi':
        return pronunciationFontSizes.hindi;
      default:
        return pronunciationFontSizes.english;
    }
  };

  const handlePlayReference = useCallback(async () => {
    // In production, would use expo-av or react-native-sound to play reference audio
    setIsPlaying(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsPlaying(false);
  }, []);

  const handleStartRecording = useCallback(async () => {
    // In production, would request microphone permission and start recording
    // using expo-av Audio.Recording or react-native-audio-recorder-player
    if (hasPermission === false) {
      Alert.alert(
        'Microphone Permission Required',
        'Please enable microphone access in Settings to use pronunciation practice.',
        [{text: 'OK'}],
      );
      return;
    }

    setHasPermission(true); // Mock permission grant
    setIsRecording(true);
    setRecordingTime(0);
    setAccuracyScore(null);
    setSyllableResults([]);

    // Start recording timer
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= MAX_RECORDING_SECONDS) {
          handleStopRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  }, [hasPermission]);

  const handleStopRecording = useCallback(async () => {
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    // Process recording
    setIsProcessing(true);
    try {
      // In production: await submitPronunciationRecording(audioUri, wordId)
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock scoring results
      const mockScore = Math.floor(Math.random() * 40) + 60; // 60-100
      const mockSyllableResults = currentWord.syllables.map(syllable => ({
        syllable,
        isCorrect: Math.random() > 0.3,
      }));

      setAccuracyScore(mockScore);
      setSyllableResults(mockSyllableResults);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to process recording. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [currentWord.syllables]);

  const handleRetry = () => {
    setAccuracyScore(null);
    setSyllableResults([]);
    setRecordingTime(0);
  };

  const handleNext = () => {
    setWordIndex(prev => prev + 1);
    setAccuracyScore(null);
    setSyllableResults([]);
    setRecordingTime(0);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Word Display */}
        <View style={styles.wordContainer}>
          <Text
            style={[styles.word, {fontSize: getWordFontSize(currentWord.language)}]}
            accessibilityLabel={`Word: ${currentWord.word}`}>
            {currentWord.word}
          </Text>
          <Text style={styles.phonetic}>{currentWord.phonetic}</Text>
        </View>

        {/* Reference Audio Playback */}
        <TouchableOpacity
          style={[styles.playButton, isPlaying && styles.playButtonActive]}
          onPress={handlePlayReference}
          disabled={isPlaying}
          accessibilityRole="button"
          accessibilityLabel="Play reference audio">
          <Text style={styles.playIcon}>{isPlaying ? '⏸' : '🔊'}</Text>
          <Text style={styles.playText}>
            {isPlaying ? 'Playing...' : 'Listen'}
          </Text>
        </TouchableOpacity>

        {/* Recording Section */}
        <View style={styles.recordSection}>
          {!isRecording && !isProcessing && accuracyScore === null && (
            <TouchableOpacity
              style={styles.recordButton}
              onPress={handleStartRecording}
              accessibilityRole="button"
              accessibilityLabel="Start recording">
              <Text style={styles.recordIcon}>🎙️</Text>
              <Text style={styles.recordText}>Tap to Record</Text>
            </TouchableOpacity>
          )}

          {isRecording && (
            <View style={styles.recordingContainer}>
              <TouchableOpacity
                style={styles.stopButton}
                onPress={handleStopRecording}
                accessibilityRole="button"
                accessibilityLabel="Stop recording">
                <Text style={styles.stopIcon}>⏹</Text>
              </TouchableOpacity>
              <Text style={styles.recordingTime}>
                {recordingTime}s / {MAX_RECORDING_SECONDS}s
              </Text>
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingLabel}>Recording...</Text>
              </View>
            </View>
          )}

          {isProcessing && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.processingText}>Analyzing pronunciation...</Text>
            </View>
          )}
        </View>

        {/* Results Section */}
        {accuracyScore !== null && (
          <View style={styles.resultsContainer}>
            {/* Accuracy Score */}
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreLabel}>Accuracy</Text>
              <Text
                style={[
                  styles.scoreValue,
                  {color: accuracyScore >= 80 ? colors.green : accuracyScore >= 60 ? colors.gold : colors.error},
                ]}>
                {accuracyScore}%
              </Text>
            </View>

            {/* Syllable Results */}
            <View style={styles.syllablesContainer}>
              <Text style={styles.syllablesTitle}>Syllable Breakdown</Text>
              <View style={styles.syllableRow}>
                {syllableResults.map((result, index) => (
                  <View
                    key={index}
                    style={[
                      styles.syllableChip,
                      {
                        backgroundColor: result.isCorrect
                          ? colors.green + '20'
                          : colors.error + '20',
                        borderColor: result.isCorrect ? colors.green : colors.error,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.syllableText,
                        {color: result.isCorrect ? colors.green : colors.error},
                      ]}>
                      {result.syllable}
                    </Text>
                    <Text style={styles.syllableIcon}>
                      {result.isCorrect ? '✓' : '✗'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleRetry}
                accessibilityRole="button"
                accessibilityLabel="Retry pronunciation">
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nextButton}
                onPress={handleNext}
                accessibilityRole="button"
                accessibilityLabel="Next word">
                <Text style={styles.nextText}>Next →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
    alignItems: 'center',
  },
  wordContainer: {
    alignItems: 'center',
    marginTop: spacing.xxxl,
    marginBottom: spacing.xl,
  },
  word: {
    fontWeight: 'bold',
    color: colors.dark,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  phonetic: {
    fontSize: 16,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.button,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 3,
    marginBottom: spacing.xxxl,
  },
  playButtonActive: {
    backgroundColor: colors.primary + '15',
  },
  playIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  playText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  recordSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  recordIcon: {
    fontSize: 36,
    marginBottom: 4,
  },
  recordText: {
    fontSize: 11,
    color: colors.white,
    fontWeight: '600',
  },
  recordingContainer: {
    alignItems: 'center',
  },
  stopButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: colors.error,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  stopIcon: {
    fontSize: 36,
  },
  recordingTime: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    marginRight: spacing.xs,
  },
  recordingLabel: {
    fontSize: 13,
    color: colors.error,
    fontWeight: '500',
  },
  processingContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  processingText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  resultsContainer: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.cardLarge,
    padding: spacing.xl,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  scoreLabel: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  syllablesContainer: {
    marginBottom: spacing.xl,
  },
  syllablesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  syllableRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  syllableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.buttonSm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  syllableText: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
  syllableIcon: {
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  retryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  nextButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  nextText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
});
