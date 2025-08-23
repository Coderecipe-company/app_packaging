import React, {useEffect, useState} from 'react';
import {
  StatusBar,
  Platform,
  SafeAreaView,
  StyleSheet,
  Alert,
  BackHandler,
} from 'react-native';
import SplashScreen from 'react-native-splash-screen';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WebViewContainer from './src/components/WebViewContainer';
import FCMService from './src/services/FCMService';
import DeepLinkService from './src/services/DeepLinkService';

const App = () => {
  const [webViewUrl, setWebViewUrl] = useState('');
  const [fcmToken, setFcmToken] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // FCM 토큰 생성 및 저장
      await FCMService.initialize();
      const token = await FCMService.getToken();
      setFcmToken(token);

      // 기본 URL 설정 (빌드 시 동적으로 변경됨)
      const baseUrl = await AsyncStorage.getItem('BASE_URL') || 'https://withcookie.com';
      const urlWithToken = `${baseUrl}?token=${token}`;
      setWebViewUrl(urlWithToken);

      // 딥링크 서비스 초기화
      DeepLinkService.initialize((url) => {
        if (url) {
          const urlWithToken = url.includes('?') 
            ? `${url}&token=${token}` 
            : `${url}?token=${token}`;
          setWebViewUrl(urlWithToken);
        }
      });

      // FCM 메시지 핸들러 설정
      FCMService.setupMessageHandlers();

      setIsReady(true);
      SplashScreen.hide();
    } catch (error) {
      console.error('App initialization error:', error);
      Alert.alert('오류', '앱 초기화 중 오류가 발생했습니다.');
      SplashScreen.hide();
    }
  };

  // Android 뒒로가기 버튼 처리
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

  const webViewRef = React.useRef(null);

  if (!isReady) {
    return null; // 스플래시 스크린이 보이는 동안
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <WebViewContainer
        ref={webViewRef}
        url={webViewUrl}
        fcmToken={fcmToken}
        onUrlChange={(newUrl) => {
          const urlWithToken = newUrl.includes('?') 
            ? `${newUrl}&token=${fcmToken}` 
            : `${newUrl}?token=${fcmToken}`;
          setWebViewUrl(urlWithToken);
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