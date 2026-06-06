import React from 'react';
import {View, Image, StyleSheet, ActivityIndicator} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {AuthProvider, useAuthContext} from './src/context/AuthContext';
import {
  RootStackParamList,
  AuthStackParamList,
  MainStackParamList,
} from './src/navigation/routeResolver';
import HeaderLogo from './src/components/HeaderLogo';

// Existing screens
import SubjectSelectionScreen from './src/screens/SubjectSelectionScreen';
import TextbookListScreen from './src/screens/TextbookListScreen';
import ChapterSelectionScreen from './src/screens/ChapterSelectionScreen';
import LearningScreen from './src/screens/LearningScreen';

// Auth screens (tasks 4.7, 4.9, 4.10)
import LoginScreen from './src/screens/LoginScreen';
import ParentRegistrationScreen from './src/screens/ParentRegistrationScreen';
import StudentRegistrationScreen from './src/screens/StudentRegistrationScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

const sharedScreenOptions = {
  headerStyle: {backgroundColor: '#6C63FF'},
  headerTintColor: '#FFF',
  headerTitleStyle: {fontWeight: '600' as const},
  headerTitle: () => <HeaderLogo />,
};

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={sharedScreenOptions}>
      <AuthStack.Screen
        name="Login"
        component={LoginScreen}
        options={{title: 'Login'}}
      />
      <AuthStack.Screen
        name="ParentRegistration"
        component={ParentRegistrationScreen}
        options={{title: 'Parent Registration'}}
      />
      <AuthStack.Screen
        name="StudentRegistration"
        component={StudentRegistrationScreen}
        options={{title: 'Student Registration'}}
      />
      <AuthStack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{title: 'Forgot Password'}}
      />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator screenOptions={sharedScreenOptions}>
      <MainStack.Screen
        name="SubjectSelection"
        component={SubjectSelectionScreen}
        options={{title: 'ChikuMiku LearnVerse'}}
      />
      <MainStack.Screen
        name="TextbookList"
        component={TextbookListScreen}
        options={{title: 'Textbooks'}}
      />
      <MainStack.Screen
        name="ChapterSelection"
        component={ChapterSelectionScreen}
        options={{title: 'Select Chapter'}}
      />
      <MainStack.Screen
        name="Learning"
        component={LearningScreen}
        options={{title: 'Learning', headerBackVisible: false}}
      />
    </MainStack.Navigator>
  );
}

function RootNavigator() {
  const {isLoading, isAuthenticated} = useAuthContext();

  if (isLoading) {
    // Inline splash view while auth state is being resolved.
    // The full SplashScreen with timeout clamping (task 4.5) is used
    // when navigating within the stack.
    return (
      <View style={splashStyles.container}>
        <Image
          source={require('./ChikuMiku-LearnVerse-Logo.png')}
          style={splashStyles.logo}
          resizeMode="contain"
          accessibilityLabel="ChikuMiku LearnVerse Logo"
        />
        <ActivityIndicator
          size="large"
          color="#6C63FF"
          style={splashStyles.spinner}
        />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{headerShown: false}}>
        {isAuthenticated ? (
          <RootStack.Screen name="Main" component={MainNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
  spinner: {
    marginTop: 32,
  },
});

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
