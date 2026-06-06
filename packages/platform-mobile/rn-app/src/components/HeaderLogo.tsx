import React from 'react';
import {Image, StyleSheet} from 'react-native';

const LOGO_SOURCE = require('../../ChikuMiku-LearnVerse-Logo.png');

/**
 * HeaderLogo - Displays the ChikuMiku LearnVerse logo in the navigation bar header,
 * scaled to fit the navigation bar height without cropping.
 *
 * Validates: Requirement 6.4
 */
export default function HeaderLogo() {
  return (
    <Image
      source={LOGO_SOURCE}
      style={styles.logo}
      resizeMode="contain"
      accessibilityLabel="ChikuMiku LearnVerse Logo"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 120,
    height: 40,
  },
});
