import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  StatusBar,
  Platform,
  BackHandler,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WebViewContainer from './src/components/WebViewContainer';

const App = () => {
  const [webViewUrl, setWebViewUrl] = useState('');
  const [isReady, setIsReady] = useState(false);
  const webViewRef = React.useRef(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // 저장된 URL 또는 기본 URL 사용
      const savedUrl = await AsyncStorage.getItem('BASE_URL');
      const defaultUrl = 'https://vpvmall.com'; // 기본 URL
      
      // 빌드 시 설정된 URL이 있으면 사용, 없으면 기본값
      const baseUrl = savedUrl || process.env.BASE_URL || defaultUrl;
      
      console.log('Loading URL:', baseUrl);
      setWebViewUrl(baseUrl);
      setIsReady(true);
    } catch (error) {
      console.error('App initialization error:', error);
      Alert.alert('오류', '앱 초기화 중 오류가 발생했습니다.');
    }
  };

  // Android 뒤로가기 버튼 처리
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backAction = () => {
        if (webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        return false;
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
    }
  }, []);

  if (!isReady || !webViewUrl) {
    return null; // 초기화 중
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <WebViewContainer
        ref={webViewRef}
        url={webViewUrl}
        onUrlChange={(newUrl) => {
          console.log('URL changed to:', newUrl);
          setWebViewUrl(newUrl);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});

export default App;