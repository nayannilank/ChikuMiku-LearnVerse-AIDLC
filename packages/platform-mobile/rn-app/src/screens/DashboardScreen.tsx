/**
 * DashboardScreen (Mobile)
 *
 * Displays the learner dashboard with:
 * - Greeting header with student name (truncated at 30 chars) and date
 * - Streak display with fire icon and gold color
 * - Subject card grid (2 columns for mobile viewport)
 * - Loading and error states
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 3.5, 4.1
 */
import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  FlatList,
  Dimensions,
} from 'react-native';
import {colors, spacing, radius, mobileLayout, subjectColors} from '../theme/tokens';

// Mock data for when API is unavailable
const MOCK_SUBJECTS = [
  {subjectId: '1', subjectName: 'Kannada', progressPercentage: 45, color: '#9B59B6'},
  {subjectId: '2', subjectName: 'English', progressPercentage: 72, color: '#5DADE2'},
  {subjectId: '3', subjectName: 'Hindi', progressPercentage: 30, color: '#F7C948'},
  {subjectId: '4', subjectName: 'Maths', progressPercentage: 88, color: '#E94F9B'},
  {subjectId: '5', subjectName: 'Computers', progressPercentage: 55, color: '#4A6CF7'},
  {subjectId: '6', subjectName: 'EVS', progressPercentage: 20, color: '#27AE60'},
];

interface SubjectCardData {
  subjectId: string;
  subjectName: string;
  progressPercentage: number;
  color: string;
}

/**
 * Formats the current date as "Day, DD Month" (e.g., "Monday, 15 January").
 */
function formatDate(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}

/**
 * Truncates a name to at most 30 characters.
 */
function truncateName(name: string): string {
  return name.length > 30 ? name.substring(0, 30) : name;
}

function SubjectCard({item}: {item: SubjectCardData}) {
  return (
    <TouchableOpacity
      style={[styles.subjectCard, {borderLeftColor: item.color}]}
      accessibilityRole="button"
      accessibilityLabel={`${item.subjectName} - ${item.progressPercentage}% complete`}>
      <View style={[styles.subjectIconCircle, {backgroundColor: item.color + '20'}]}>
        <Text style={[styles.subjectInitial, {color: item.color}]}>
          {item.subjectName.charAt(0)}
        </Text>
      </View>
      <Text style={styles.subjectName} numberOfLines={1}>
        {item.subjectName}
      </Text>
      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBarFill,
            {width: `${item.progressPercentage}%`, backgroundColor: item.color},
          ]}
        />
      </View>
      <Text style={styles.progressText}>{item.progressPercentage}%</Text>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [subjects, setSubjects] = useState<SubjectCardData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [studentName] = useState('Learner'); // Would come from auth context

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    setError(null);
    try {
      // In production, these would be real API calls:
      // const streakData = await getStreak(studentId);
      // const progressData = await getProgress(studentId);
      // For now, use mock data
      await new Promise(resolve => setTimeout(resolve, 500));
      setStreak(7);
      setSubjects(MOCK_SUBJECTS);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
      // Fall back to mock data on error
      setSubjects(MOCK_SUBJECTS);
      setStreak(0);
    } finally {
      setLoading(false);
    }
  }

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = (screenWidth - mobileLayout.screenPadding * 2 - spacing.md) / 2;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
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
        {/* Greeting Header */}
        <View style={styles.greetingContainer}>
          <Text style={styles.greetingName}>
            Hi, {truncateName(studentName)}! 👋
          </Text>
          <Text style={styles.greetingDate}>{formatDate(new Date())}</Text>
        </View>

        {/* Streak Display */}
        <View style={styles.streakContainer}>
          <Text style={styles.streakIcon}>🔥</Text>
          <Text style={styles.streakCount}>{streak}</Text>
          <Text style={styles.streakLabel}>days streak</Text>
        </View>

        {/* Error display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Subject Card Grid - 2 columns */}
        <Text style={styles.sectionTitle}>Your Subjects</Text>
        <View style={styles.subjectGrid}>
          {subjects.map(subject => (
            <View key={subject.subjectId} style={{width: cardWidth}}>
              <SubjectCard item={subject} />
            </View>
          ))}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textMuted,
  },
  greetingContainer: {
    marginBottom: spacing.lg,
  },
  greetingName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  greetingDate: {
    fontSize: 14,
    color: colors.textMuted,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.cardSmall,
    padding: spacing.md,
    marginBottom: spacing.xl,
    elevation: mobileLayout.cardElevation,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  streakIcon: {
    fontSize: 28,
    marginRight: spacing.sm,
  },
  streakCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.gold,
    marginRight: spacing.xs,
  },
  streakLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: radius.input,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  errorText: {
    color: '#C62828',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  subjectCard: {
    backgroundColor: colors.white,
    borderRadius: radius.cardSmall,
    padding: spacing.md,
    borderLeftWidth: 4,
    elevation: mobileLayout.cardElevation,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 4,
    marginBottom: spacing.sm,
  },
  subjectIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  subjectInitial: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  subjectName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
