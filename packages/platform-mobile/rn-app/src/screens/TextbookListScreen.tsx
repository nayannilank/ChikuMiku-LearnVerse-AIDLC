import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  listTextbooks,
  listChaptersForTextbook,
  Textbook,
} from '../api/learningApi';
import TextbookEntryForm from '../components/TextbookEntryForm';

interface Props {
  navigation: any;
  route: {
    params: {
      subjectId: string;
    };
  };
}

export default function TextbookListScreen({navigation, route}: Props) {
  const {subjectId} = route.params;

  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchTextbooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listTextbooks(subjectId);
      setTextbooks(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load textbooks');
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    fetchTextbooks();
  }, [fetchTextbooks]);

  async function handleSelectTextbook(textbook: Textbook) {
    try {
      const response = await listChaptersForTextbook(textbook.id);
      navigation.navigate('ChapterSelection', {
        subjectId,
        textbookId: textbook.id,
        chapters: response.data,
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load chapters');
    }
  }

  function handleAddTextbookSuccess(textbook: Textbook) {
    setShowForm(false);
    setTextbooks(prev => [...prev, textbook]);
  }

  function handleCancelForm() {
    setShowForm(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Loading textbooks...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchTextbooks}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // If no textbooks exist, show the entry form immediately
  if (textbooks.length === 0 || showForm) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          {subjectId.charAt(0).toUpperCase() + subjectId.slice(1)}
        </Text>
        {textbooks.length === 0 ? (
          <Text style={styles.subtitle}>
            No textbooks yet — add your first one!
          </Text>
        ) : (
          <Text style={styles.subtitle}>Add a new textbook</Text>
        )}
        <TextbookEntryForm
          subjectId={subjectId}
          onSuccess={handleAddTextbookSuccess}
          onCancel={handleCancelForm}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {subjectId.charAt(0).toUpperCase() + subjectId.slice(1)}
      </Text>
      <Text style={styles.subtitle}>Select a textbook or add a new one</Text>

      <FlatList
        data={textbooks}
        keyExtractor={item => item.id}
        style={styles.list}
        renderItem={({item}) => (
          <TouchableOpacity
            style={styles.textbookCard}
            onPress={() => handleSelectTextbook(item)}>
            <View style={styles.textbookIcon}>
              <Text style={styles.textbookIconText}>📖</Text>
            </View>
            <View style={styles.textbookInfo}>
              <Text style={styles.textbookName}>{item.name}</Text>
              <Text style={styles.textbookMeta}>
                {item.chapters.length}{' '}
                {item.chapters.length === 1 ? 'chapter' : 'chapters'}
              </Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowForm(true)}>
        <Text style={styles.addButtonIcon}>+</Text>
        <Text style={styles.addButtonText}>Add Textbook</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8F9FA', padding: 20},
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {fontSize: 28, fontWeight: 'bold', color: '#2D2D2D', marginBottom: 4},
  subtitle: {fontSize: 16, color: '#666', marginBottom: 20},
  loadingText: {marginTop: 12, color: '#666', fontSize: 16},
  errorText: {
    color: '#E53E3E',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {color: '#FFF', fontWeight: '600'},
  list: {flex: 1},
  textbookCard: {
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
  textbookIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textbookIconText: {fontSize: 20},
  textbookInfo: {flex: 1},
  textbookName: {fontSize: 16, fontWeight: '600', color: '#2D2D2D'},
  textbookMeta: {fontSize: 13, color: '#999', marginTop: 3},
  arrow: {fontSize: 22, color: '#6C63FF'},
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C63FF',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  addButtonIcon: {
    fontSize: 22,
    color: '#FFF',
    marginRight: 8,
    fontWeight: '700',
  },
  addButtonText: {fontSize: 16, color: '#FFF', fontWeight: '600'},
});
