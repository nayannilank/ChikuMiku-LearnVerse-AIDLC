/**
 * Bottom Tab Navigator
 *
 * Implements the mobile bottom navigation with 5 tabs:
 * Home, Chapters, Scan, Revision, Me
 *
 * Height: 44px (Requirement 3.5)
 * Full-width layout designed for 320-420px viewport
 *
 * Requirements: 4.1, 4.2, 3.5
 */
import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {BottomTabParamList} from './types';
import {colors, mobileLayout} from '../theme/tokens';

// Screens
import DashboardScreen from '../screens/DashboardScreen';
import ContentIngestionScreen from '../screens/ContentIngestionScreen';
import PronunciationScreen from '../screens/PronunciationScreen';
import GrammarExerciseScreen from '../screens/GrammarExerciseScreen';
import QuizScreen from '../screens/QuizScreen';

// Simple icon representations using Unicode/emoji for the tabs
const TAB_ICONS: Record<string, string> = {
  Home: '🏠',
  Chapters: '📚',
  Scan: '📷',
  Revision: '🔄',
  Me: '👤',
};

const TABS: Array<{key: keyof BottomTabParamList; label: string}> = [
  {key: 'Home', label: 'Home'},
  {key: 'Chapters', label: 'Chapters'},
  {key: 'Scan', label: 'Scan'},
  {key: 'Revision', label: 'Revision'},
  {key: 'Me', label: 'Me'},
];

interface BottomTabBarProps {
  activeTab: keyof BottomTabParamList;
  onTabPress: (tab: keyof BottomTabParamList) => void;
}

/**
 * Custom bottom tab bar component with 44px height.
 * Renders 5 tabs with icons and labels, highlighting the active one.
 */
export function BottomTabBar({activeTab, onTabPress}: BottomTabBarProps) {
  return (
    <View style={styles.tabBar} accessibilityRole="tablist">
      {TABS.map(tab => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => onTabPress(tab.key)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{selected: isActive}}>
            <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
              {TAB_ICONS[tab.key]}
            </Text>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Main tab navigator that manages 5 screens with bottom navigation.
 * Uses a simple state-based approach since @react-navigation/bottom-tabs
 * is not installed — uses native stack navigators per tab with a custom tab bar.
 */
export function MainTabNavigator() {
  const [activeTab, setActiveTab] = React.useState<keyof BottomTabParamList>('Home');

  const renderScreen = () => {
    switch (activeTab) {
      case 'Home':
        return <DashboardScreen />;
      case 'Chapters':
        return <DashboardScreen />; // Reuses subject card grid, navigable via chapters
      case 'Scan':
        return <ContentIngestionScreen />;
      case 'Revision':
        return (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Revision</Text>
            <Text style={styles.placeholderSubtext}>
              Review your study materials here
            </Text>
          </View>
        );
      case 'Me':
        return (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Profile</Text>
            <Text style={styles.placeholderSubtext}>
              Manage your account settings
            </Text>
          </View>
        );
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>{renderScreen()}</View>
      <BottomTabBar activeTab={activeTab} onTabPress={setActiveTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    height: mobileLayout.bottomNavHeight,
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    width: '100%',
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabIcon: {
    fontSize: 16,
    opacity: 0.5,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  placeholderText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: colors.textMuted,
  },
});

export default MainTabNavigator;
