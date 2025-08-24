import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform, Alert, PermissionsAndroid} from 'react-native';

class FCMService {
  constructor() {
    this.token = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      if (this.isInitialized) {
        return;
      }

      console.log('Initializing FCM Service...');

      // 권한 요청 (iOS에서 필요)
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!enabled) {
          console.warn('FCM permission not granted');
          return;
        }
      }

      // Android에서 POST_NOTIFICATIONS 권한 요청 (API 33+)
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            {
              title: '알림 권한',
              message: '푸시 알림을 받기 위해 알림 권한이 필요합니다.',
              buttonNeutral: '나중에',
              buttonNegative: '거부',
              buttonPositive: '허용',
            },
          );
        } catch (err) {
          console.warn('Notification permission request error:', err);
        }
      }

      // 토큰 생성
      await this.generateToken();

      // 백그라운드 메시지 핸들러 설정
      messaging().setBackgroundMessageHandler(async remoteMessage => {
        console.log('Message handled in the background!', remoteMessage);
        this.handleBackgroundMessage(remoteMessage);
      });

      // 토큰 갱신 리스너
      messaging().onTokenRefresh(token => {
        console.log('FCM Token refreshed:', token);
        this.token = token;
        AsyncStorage.setItem('fcm_token', token);
      });

      this.isInitialized = true;
      console.log('FCM Service initialized successfully');
    } catch (error) {
      console.error('FCM initialization error:', error);
      throw error;
    }
  }

  async generateToken() {
    try {
      const token = await messaging().getToken();
      if (token) {
        console.log('FCM Token generated:', token);
        this.token = token;
        await AsyncStorage.setItem('fcm_token', token);
        return token;
      } else {
        console.warn('Failed to get FCM token');
        return null;
      }
    } catch (error) {
      console.error('Token generation error:', error);
      return null;
    }
  }

  async getToken() {
    if (this.token) {
      return this.token;
    }

    try {
      const storedToken = await AsyncStorage.getItem('fcm_token');
      if (storedToken) {
        this.token = storedToken;
        return storedToken;
      }

      return await this.generateToken();
    } catch (error) {
      console.error('Get token error:', error);
      return null;
    }
  }

  setupMessageHandlers() {
    // 앱이 포어그라운드에서 실행 중일 때 메시지 수신
    messaging().onMessage(async remoteMessage => {
      console.log('A new FCM message arrived!', JSON.stringify(remoteMessage));
      this.handleForegroundMessage(remoteMessage);
    });

    // 앱이 백그라운드에서 실행 중이거나 종료된 상태에서 알림을 탭했을 때
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log(
        'Notification caused app to open from background state:',
        remoteMessage
      );
      this.handleNotificationOpen(remoteMessage);
    });

    // 앱이 종료된 상태에서 알림을 탭해서 앱이 열렸을 때
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log(
            'Notification caused app to open from quit state:',
            remoteMessage
          );
          this.handleNotificationOpen(remoteMessage);
        }
      });
  }

  handleForegroundMessage(remoteMessage) {
    const {notification, data} = remoteMessage;
    
    if (notification) {
      Alert.alert(
        notification.title || '알림',
        notification.body || '',
        [
          {
            text: '확인',
            onPress: () => {
              if (data && data.url) {
                this.handleDeepLink(data.url);
              }
            },
          },
        ],
        {cancelable: true}
      );
    }

    // 커스텀 데이터 처리
    if (data) {
      this.processNotificationData(data);
    }
  }

  handleBackgroundMessage(remoteMessage) {
    const {data} = remoteMessage;
    
    console.log('Background message data:', data);
    
    // 백그라운드에서 필요한 데이터 처리
    if (data) {
      this.processNotificationData(data);
    }
  }

  handleNotificationOpen(remoteMessage) {
    const {data} = remoteMessage;
    
    if (data && data.url) {
      this.handleDeepLink(data.url);
    }
    
    this.processNotificationData(data);
  }

  handleDeepLink(url) {
    console.log('FCM Deep Link received:', url);
    
    // WebView가 준비되어 있으면 직접 URL 변경
    if (global.webViewRef && global.webViewRef.current) {
      // WebView에서 URL 로드
      if (global.navigateToUrl) {
        global.navigateToUrl(url);
      }
    } else {
      // WebView가 아직 준비되지 않았으면 저장해두고 나중에 처리
      AsyncStorage.setItem('pending_deep_link', url);
    }
    
    // DeepLinkService와도 연동
    if (global.handleDeepLinkUrl) {
      global.handleDeepLinkUrl(url);
    }
  }

  processNotificationData(data) {
    try {
      // 알림 데이터를 AsyncStorage에 저장하여 앱에서 활용
      const notificationData = {
        ...data,
        receivedAt: new Date().toISOString(),
      };
      
      AsyncStorage.setItem(
        'last_notification_data',
        JSON.stringify(notificationData)
      );

      // 웹뷰에 알림 데이터 전달
      if (global.webViewRef && global.webViewRef.current) {
        const script = `
          window.postMessage(JSON.stringify({
            type: 'NOTIFICATION_RECEIVED',
            data: ${JSON.stringify(notificationData)}
          }), '*');
        `;
        global.webViewRef.current.injectJavaScript(script);
      }
    } catch (error) {
      console.error('Process notification data error:', error);
    }
  }

  async subscribeTopic(topic) {
    try {
      await messaging().subscribeToTopic(topic);
      console.log(`Subscribed to topic: ${topic}`);
    } catch (error) {
      console.error('Topic subscription error:', error);
    }
  }

  async unsubscribeFromTopic(topic) {
    try {
      await messaging().unsubscribeFromTopic(topic);
      console.log(`Unsubscribed from topic: ${topic}`);
    } catch (error) {
      console.error('Topic unsubscription error:', error);
    }
  }

  async deleteToken() {
    try {
      await messaging().deleteToken();
      this.token = null;
      await AsyncStorage.removeItem('fcm_token');
      console.log('FCM token deleted');
    } catch (error) {
      console.error('Token deletion error:', error);
    }
  }

  // 배지 개수 설정 (iOS)
  async setBadgeCount(count) {
    if (Platform.OS === 'ios') {
      try {
        await messaging().setApplicationIconBadgeNumber(count);
      } catch (error) {
        console.error('Badge count setting error:', error);
      }
    }
  }
}

export default new FCMService();