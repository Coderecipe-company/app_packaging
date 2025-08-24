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
import FCMService from './src/services/FCMService';

const App = () => {
  const [webViewUrl, setWebViewUrl] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [fcmToken, setFcmToken] = useState(null);
  const webViewRef = React.useRef(null);

  useEffect(() => {
    initializeApp();
    initializeFCM();
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

  const initializeFCM = async () => {
    try {
      // google-services.json이 없으면 FCM을 초기화하지 않음
      // Firebase 설정 체크 (초기화 시도를 통해 간접적으로 확인)
      console.log('Attempting FCM initialization...');
      
      // FCM 초기화
      await FCMService.initialize();
      
      // FCM 토큰 가져오기
      const token = await FCMService.getToken();
      if (token) {
        console.log('FCM Token:', token);
        setFcmToken(token);
        
        // WebView에서 접근할 수 있도록 global 설정
        global.fcmToken = token;
      }
      
      // 메시지 핸들러 설정
      FCMService.setupMessageHandlers();
      
      // WebView 참조를 global로 설정 (FCMService에서 사용)
      global.webViewRef = webViewRef;
      
      // URL 변경 함수를 global로 설정
      global.navigateToUrl = (url) => {
        console.log('Navigating to URL from FCM:', url);
        setWebViewUrl(url);
      };
      
      // 대기 중인 딥링크가 있는지 확인
      const pendingDeepLink = await AsyncStorage.getItem('pending_deep_link');
      if (pendingDeepLink) {
        console.log('Found pending deep link:', pendingDeepLink);
        setWebViewUrl(pendingDeepLink);
        await AsyncStorage.removeItem('pending_deep_link');
      }
      
      console.log('FCM initialized successfully');
    } catch (error) {
      console.log('FCM not configured or initialization failed:', error.message);
      // FCM 실패해도 앱은 계속 실행되도록 함
      // google-services.json이 없을 때도 정상 동작
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
        fcmToken={fcmToken}
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