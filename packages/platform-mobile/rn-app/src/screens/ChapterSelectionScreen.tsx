import React, {useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import {selectChapter, ChapterSummary} from '../api/learningApi';
import ChapterCreationForm from '../components/ChapterCreationForm';

interface Props {
  navigation: any;
  route: {
    params: {
      subjectId: string;
      textbookId: string;
      chapters: ChapterSummary[];
    };
  };
}

export default function ChapterSelectionScreen({navigation, route}: Props) {
  const {subjectId, textbookId, chapters} = route.params;
  const [showCreationForm, setShowCreationForm] = useState(false);

  async function handleSelectChapter(chapterId: string) {
    try {
      await selectChapter(chapterId);
      navigation.navigate('Learning', {subjectId, textbookId, chapterId});
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  function handleAddChapter() {
    setShowCreationForm(true);
  }

  function handleChapterCreated(chapter: any) {
    setShowCreationForm(false);
    navigation.navigate('Learning', {
      subjectId,
      textbookId,
      chapterId: chapter.id,
    });
  }

  function handleCancelCreation() {
    setShowCreationForm(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {subjectId.charAt(0).toUpperCase() + subjectId.slice(1)}
      </Text>
      <Text style={styles.subtitle}>
        {chapters.length > 0
          ? 'Pick a chapter or add a new one'
          : 'No chapters yet — add your first one!'}
      </Text>

      {chapters.length > 0 && (
        <FlatList
          data={chapters}
          keyExtractor={item => item.id}
          style={styles.list}
          renderItem={({item}) => (
            <TouchableOpacity
              style={styles.chapterCard}
              onPress={() => handleSelectChapter(item.id)}>
              <View style={styles.chapterNumber}>
                <Text style={styles.chapterNumberText}>
                  {item.chapterNumber}
                </Text>
              </View>
              <View style={styles.chapterInfo}>
                <Text style={styles.chapterTitle}>{item.textbookName}</Text>
                <Text style={styles.chapterMeta}>
                  Chapter {item.chapterNumber}
                </Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {showCreationForm ? (
        <ChapterCreationForm
          textbookId={textbookId}
          subjectId={subjectId}
          onSuccess={handleChapterCreated}
          onCancel={handleCancelCreation}
        />
      ) : (
        <TouchableOpacity
          style={styles.addChapterButton}
          onPress={handleAddChapter}>
          <Text style={styles.addChapterIcon}>+</Text>
          <Text style={styles.addChapterText}>Add Chapter</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8F9FA', padding: 20},
  title: {fontSize: 28, fontWeight: 'bold', color: '#2D2D2D', marginBottom: 4},
  subtitle: {fontSize: 16, color: '#666', marginBottom: 20},
  list: {flex: 1},
  chapterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  chapterNumber: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  chapterNumberText: {fontSize: 18, fontWeight: '700', color: '#6C63FF'},
  chapterInfo: {flex: 1},
  chapterTitle: {fontSize: 16, fontWeight: '600', color: '#2D2D2D'},
  chapterMeta: {fontSize: 13, color: '#999', marginTop: 3},
  arrow: {fontSize: 22, color: '#6C63FF'},
  addChapterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C63FF',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  addChapterIcon: {
    fontSize: 22,
    color: '#FFF',
    marginRight: 8,
    fontWeight: '700',
  },
  addChapterText: {fontSize: 16, color: '#FFF', fontWeight: '600'},
});
