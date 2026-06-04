import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import SubjectSelectionScreen from './src/screens/SubjectSelectionScreen';
import ChapterSelectionScreen from './src/screens/ChapterSelectionScreen';
import LearningScreen from './src/screens/LearningScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="SubjectSelection"
        screenOptions={{
          headerStyle: {backgroundColor: '#6C63FF'},
          headerTintColor: '#FFF',
          headerTitleStyle: {fontWeight: '600'},
        }}>
        <Stack.Screen
          name="SubjectSelection"
          component={SubjectSelectionScreen}
          options={{title: 'ChikuMiku LearnVerse'}}
        />
        <Stack.Screen
          name="ChapterSelection"
          component={ChapterSelectionScreen}
          options={{title: 'Select Chapter'}}
        />
        <Stack.Screen
          name="Learning"
          component={LearningScreen}
          options={{title: 'Learning', headerBackVisible: false}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
