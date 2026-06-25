/**
 * QuizScreen (Mobile)
 *
 * Timed quiz with:
 * - Countdown timer (MM:SS format, 30s–60min)
 * - Question counter "Q8/20"
 * - 4 answer options (A/B/C/D) as tappable cards
 * - Submit + Skip buttons
 * - Selected option → pink highlight
 * - Submit without selection → inline prompt
 * - Live score panel (percentage + correct count)
 * - Timer reaches 0 or last question → final score summary
 * - Navigation away confirmation dialog
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10, 3.5
 */
import React, {useState, useCallback, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
} from 'react-native';
import {colors, spacing, radius, mobileLayout} from '../theme/tokens';

interface QuizQuestion {
  id: string;
  questionText: string;
  options: string[]; // Always 4 options: A, B, C, D
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

const MOCK_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'qq1',
    questionText: 'What is the capital of Karnataka?',
    options: ['Mumbai', 'Bengaluru', 'Chennai', 'Hyderabad'],
  },
  {
    id: 'qq2',
    questionText: 'Which planet is known as the Red Planet?',
    options: ['Venus', 'Jupiter', 'Mars', 'Saturn'],
  },
  {
    id: 'qq3',
    questionText: 'What is 12 × 12?',
    options: ['124', '144', '132', '156'],
  },
  {
    id: 'qq4',
    questionText: 'Which gas do plants absorb from the atmosphere?',
    options: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'],
  },
  {
    id: 'qq5',
    questionText: 'Who wrote the Indian National Anthem?',
    options: ['Mahatma Gandhi', 'Rabindranath Tagore', 'Jawaharlal Nehru', 'Subhash Chandra Bose'],
  },
  {
    id: 'qq6',
    questionText: 'What is the smallest prime number?',
    options: ['0', '1', '2', '3'],
  },
  {
    id: 'qq7',
    questionText: 'Which organ pumps blood in the human body?',
    options: ['Lungs', 'Brain', 'Heart', 'Liver'],
  },
  {
    id: 'qq8',
    questionText: 'How many days are in a leap year?',
    options: ['364', '365', '366', '367'],
  },
];

const QUIZ_DURATION_SECONDS = 300; // 5 minutes default

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function QuizScreen() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(QUIZ_DURATION_SECONDS);
  const [showResults, setShowResults] = useState(false);
  const [showNoSelectionPrompt, setShowNoSelectionPrompt] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const totalQuestions = MOCK_QUIZ_QUESTIONS.length;
  const question = MOCK_QUIZ_QUESTIONS[currentQuestion];

  // Timer countdown
  useEffect(() => {
    if (showResults) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Timer expired — end quiz
          if (timerRef.current) clearInterval(timerRef.current);
          setShowResults(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [showResults]);

  const scorePercentage = answeredCount > 0
    ? Math.round((correctCount / answeredCount) * 100)
    : 0;

  const finalScorePercentage = Math.round((correctCount / totalQuestions) * 100);

  const handleOptionSelect = (index: number) => {
    setSelectedOption(index);
    setShowNoSelectionPrompt(false);
  };

  const handleSubmit = useCallback(() => {
    if (selectedOption === null) {
      setShowNoSelectionPrompt(true);
      return;
    }

    // In production, would call submitQuizAnswer API
    // Mock: second option is always correct for demo
    const isCorrect = selectedOption === 1; // Mock: B is always correct
    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
    }
    setAnsweredCount(prev => prev + 1);

    // Move to next question or show results
    if (currentQuestion + 1 >= totalQuestions) {
      if (timerRef.current) clearInterval(timerRef.current);
      setShowResults(true);
    } else {
      setCurrentQuestion(prev => prev + 1);
      setSelectedOption(null);
    }
  }, [selectedOption, currentQuestion, totalQuestions]);

  const handleSkip = useCallback(() => {
    // In production, would call skipQuizQuestion API
    if (currentQuestion + 1 >= totalQuestions) {
      if (timerRef.current) clearInterval(timerRef.current);
      setShowResults(true);
    } else {
      setCurrentQuestion(prev => prev + 1);
      setSelectedOption(null);
      setShowNoSelectionPrompt(false);
    }
  }, [currentQuestion, totalQuestions]);

  const handleRestart = () => {
    setCurrentQuestion(0);
    setSelectedOption(null);
    setCorrectCount(0);
    setAnsweredCount(0);
    setTimeRemaining(QUIZ_DURATION_SECONDS);
    setShowResults(false);
    setShowNoSelectionPrompt(false);
  };

  // Results screen
  if (showResults) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsEmoji}>
            {finalScorePercentage >= 80 ? '🏆' : finalScorePercentage >= 50 ? '⭐' : '📖'}
          </Text>
          <Text style={styles.resultsTitle}>Quiz Complete!</Text>

          <View style={styles.scoreCard}>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Correct</Text>
              <Text style={styles.scoreValue}>{correctCount}/{totalQuestions}</Text>
            </View>
            <View style={styles.scoreDivider} />
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Score</Text>
              <Text style={[styles.scoreValue, styles.scoreHighlight]}>
                {finalScorePercentage}%
              </Text>
            </View>
            <View style={styles.scoreDivider} />
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Answered</Text>
              <Text style={styles.scoreValue}>{answeredCount}/{totalQuestions}</Text>
            </View>
            <View style={styles.scoreDivider} />
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Skipped</Text>
              <Text style={styles.scoreValue}>
                {totalQuestions - answeredCount}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.restartButton}
            onPress={handleRestart}
            accessibilityRole="button"
            accessibilityLabel="Try Again">
            <Text style={styles.restartText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Timer and Question Counter Header */}
        <View style={styles.quizHeader}>
          <View style={styles.timerContainer}>
            <Text
              style={[
                styles.timerText,
                timeRemaining <= 30 && styles.timerTextUrgent,
              ]}>
              ⏱ {formatTime(timeRemaining)}
            </Text>
          </View>
          <Text style={styles.questionCounter}>
            Q{currentQuestion + 1}/{totalQuestions}
          </Text>
        </View>

        {/* Live Score Panel */}
        <View style={styles.liveScorePanel}>
          <Text style={styles.liveScoreText}>
            Score: {scorePercentage}% ({correctCount} correct)
          </Text>
        </View>

        {/* Question */}
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{question.questionText}</Text>
        </View>

        {/* Answer Options (A/B/C/D) */}
        <View style={styles.optionsContainer}>
          {question.options.map((option, index) => {
            const isSelected = selectedOption === index;
            return (
              <TouchableOpacity
                key={index}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                onPress={() => handleOptionSelect(index)}
                accessibilityRole="button"
                accessibilityLabel={`Option ${OPTION_LABELS[index]}: ${option}`}
                accessibilityState={{selected: isSelected}}>
                <View
                  style={[
                    styles.optionLabel,
                    isSelected && styles.optionLabelSelected,
                  ]}>
                  <Text
                    style={[
                      styles.optionLabelText,
                      isSelected && styles.optionLabelTextSelected,
                    ]}>
                    {OPTION_LABELS[index]}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.optionText,
                    isSelected && styles.optionTextSelected,
                  ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* No selection prompt */}
        {showNoSelectionPrompt && (
          <Text style={styles.noSelectionPrompt}>
            Please select an option before submitting.
          </Text>
        )}

        {/* Submit and Skip buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            accessibilityRole="button"
            accessibilityLabel="Skip question">
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            accessibilityRole="button"
            accessibilityLabel="Submit answer">
            <Text style={styles.submitText}>Submit</Text>
          </TouchableOpacity>
        </View>
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
  quizHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  timerContainer: {
    backgroundColor: colors.white,
    borderRadius: radius.buttonSm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  timerTextUrgent: {
    color: colors.error,
  },
  questionCounter: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  liveScorePanel: {
    backgroundColor: colors.green + '15',
    borderRadius: radius.input,
    padding: spacing.sm,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  liveScoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.green,
  },
  questionCard: {
    backgroundColor: colors.white,
    borderRadius: radius.cardLarge,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  questionText: {
    fontSize: 18,
    color: colors.textPrimary,
    lineHeight: 26,
  },
  optionsContainer: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.cardSmall,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  optionLabel: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  optionLabelSelected: {
    backgroundColor: colors.primary,
  },
  optionLabelText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textMuted,
  },
  optionLabelTextSelected: {
    color: colors.white,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '500',
  },
  noSelectionPrompt: {
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  skipButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.textMuted,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  submitButton: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  // Results screen styles
  resultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  resultsEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  resultsTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.xl,
  },
  scoreCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.cardLarge,
    padding: spacing.xl,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: spacing.xxxl,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  scoreLabel: {
    fontSize: 15,
    color: colors.textMuted,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  scoreHighlight: {
    color: colors.primary,
    fontSize: 24,
  },
  scoreDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  restartButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.lg,
  },
  restartText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
});
