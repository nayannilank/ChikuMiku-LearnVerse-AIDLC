/**
 * GrammarExerciseScreen (Mobile)
 *
 * Grammar exercise with:
 * - Question counter "N/T" (T between 1-30)
 * - Progress bar (N/T × 100%)
 * - Sentence with underscore placeholder
 * - 2-5 multiple-choice options
 * - Selected option → pink highlight + feedback panel (green/red with explanation)
 * - Next button disabled until answered
 * - Completion summary on last question
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 13.11, 3.5
 */
import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import {colors, spacing, radius, mobileLayout} from '../theme/tokens';

interface GrammarQuestion {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

const MOCK_QUESTIONS: GrammarQuestion[] = [
  {
    id: 'q1',
    questionText: 'The cat _____ on the mat.',
    options: ['sit', 'sits', 'sat', 'sitting'],
    correctAnswer: 'sits',
    explanation: '"Sits" is correct because "the cat" is a singular subject requiring a third-person singular verb in present tense.',
  },
  {
    id: 'q2',
    questionText: 'She _____ to school every day.',
    options: ['go', 'goes', 'going', 'gone'],
    correctAnswer: 'goes',
    explanation: '"Goes" is the correct third-person singular present tense form of "go".',
  },
  {
    id: 'q3',
    questionText: 'They _____ playing in the park.',
    options: ['is', 'are', 'was', 'am'],
    correctAnswer: 'are',
    explanation: '"Are" is used with plural subjects like "they".',
  },
  {
    id: 'q4',
    questionText: 'I _____ a book yesterday.',
    options: ['read', 'reads', 'reading', 'readed'],
    correctAnswer: 'read',
    explanation: '"Read" (past tense, pronounced "red") is the correct past tense form. "Readed" is not a valid English word.',
  },
  {
    id: 'q5',
    questionText: 'The children _____ their homework.',
    options: ['do', 'does', 'did', 'doing'],
    correctAnswer: 'do',
    explanation: '"Do" is used with plural subjects like "the children" in present tense.',
  },
];

export default function GrammarExerciseScreen() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);

  const totalQuestions = MOCK_QUESTIONS.length;
  const question = MOCK_QUESTIONS[currentQuestion];
  const progress = ((currentQuestion + (isAnswered ? 1 : 0)) / totalQuestions) * 100;
  const isCorrect = selectedOption === question?.correctAnswer;

  const handleOptionSelect = useCallback(
    (option: string) => {
      if (isAnswered) return;

      setSelectedOption(option);
      setIsAnswered(true);

      if (option === question.correctAnswer) {
        setCorrectCount(prev => prev + 1);
      }
    },
    [isAnswered, question],
  );

  const handleNext = () => {
    if (currentQuestion + 1 >= totalQuestions) {
      setShowCompletion(true);
      return;
    }

    setCurrentQuestion(prev => prev + 1);
    setSelectedOption(null);
    setIsAnswered(false);
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setCorrectCount(0);
    setShowCompletion(false);
  };

  if (showCompletion) {
    const scorePercentage = Math.round((correctCount / totalQuestions) * 100);
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.completionContainer}>
          <Text style={styles.completionEmoji}>
            {scorePercentage >= 80 ? '🎉' : scorePercentage >= 50 ? '👍' : '📚'}
          </Text>
          <Text style={styles.completionTitle}>Exercise Complete!</Text>
          <Text style={styles.completionScore}>
            {correctCount}/{totalQuestions}
          </Text>
          <Text style={styles.completionPercentage}>{scorePercentage}% correct</Text>
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
        {/* Question Counter */}
        <View style={styles.headerRow}>
          <Text style={styles.questionCounter}>
            {currentQuestion + 1}/{totalQuestions}
          </Text>
          <Text style={styles.scoreDisplay}>
            ✓ {correctCount}
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarFill, {width: `${progress}%`}]} />
        </View>

        {/* Question */}
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>{question.questionText}</Text>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {question.options.map((option, index) => {
            const isSelected = selectedOption === option;
            const isCorrectOption = option === question.correctAnswer;

            const optionStyles: any[] = [styles.option];
            const textStyles: any[] = [styles.optionText];
            if (isAnswered && isCorrectOption) {
              optionStyles.push(styles.optionCorrect);
              textStyles.push(styles.optionTextCorrect);
            }
            if (isAnswered && isSelected && !isCorrectOption) {
              optionStyles.push(styles.optionIncorrect);
              textStyles.push(styles.optionTextIncorrect);
            }
            if (!isAnswered && isSelected) {
              optionStyles.push(styles.optionSelected);
              textStyles.push(styles.optionTextSelected);
            }

            return (
              <TouchableOpacity
                key={index}
                style={optionStyles}
                onPress={() => handleOptionSelect(option)}
                disabled={isAnswered}
                accessibilityRole="button"
                accessibilityLabel={`Option: ${option}`}
                accessibilityState={{selected: isSelected}}>
                <Text style={textStyles}>
                  {option}
                </Text>
                {isAnswered && isCorrectOption && (
                  <Text style={styles.correctIcon}>✓</Text>
                )}
                {isAnswered && isSelected && !isCorrectOption && (
                  <Text style={styles.incorrectIcon}>✗</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Feedback Panel */}
        {isAnswered && (
          <View
            style={[
              styles.feedbackPanel,
              isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect,
            ]}>
            <Text style={styles.feedbackTitle}>
              {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
            </Text>
            <Text style={styles.feedbackExplanation}>
              {question.explanation}
            </Text>
          </View>
        )}

        {/* Next Button */}
        <TouchableOpacity
          style={[styles.nextButton, !isAnswered && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!isAnswered}
          accessibilityRole="button"
          accessibilityLabel="Next question"
          accessibilityState={{disabled: !isAnswered}}>
          <Text style={[styles.nextText, !isAnswered && styles.nextTextDisabled]}>
            {currentQuestion + 1 >= totalQuestions ? 'Finish' : 'Next →'}
          </Text>
        </TouchableOpacity>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  questionCounter: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  scoreDisplay: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.green,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  questionContainer: {
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
    lineHeight: 28,
  },
  optionsContainer: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.cardSmall,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  optionCorrect: {
    borderColor: colors.green,
    backgroundColor: colors.green + '10',
  },
  optionIncorrect: {
    borderColor: colors.error,
    backgroundColor: colors.error + '10',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  optionTextCorrect: {
    color: colors.green,
    fontWeight: '600',
  },
  optionTextIncorrect: {
    color: colors.error,
    fontWeight: '600',
  },
  correctIcon: {
    fontSize: 18,
    color: colors.green,
    fontWeight: 'bold',
  },
  incorrectIcon: {
    fontSize: 18,
    color: colors.error,
    fontWeight: 'bold',
  },
  feedbackPanel: {
    borderRadius: radius.cardSmall,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderLeftWidth: 4,
  },
  feedbackCorrect: {
    backgroundColor: colors.green + '10',
    borderLeftColor: colors.green,
  },
  feedbackIncorrect: {
    backgroundColor: colors.error + '10',
    borderLeftColor: colors.error,
  },
  feedbackTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: spacing.sm,
    color: colors.textPrimary,
  },
  feedbackExplanation: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  nextButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: colors.border,
  },
  nextText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  nextTextDisabled: {
    color: colors.textMuted,
  },
  completionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  completionEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  completionScore: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.primary,
  },
  completionPercentage: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: spacing.xxxl,
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
