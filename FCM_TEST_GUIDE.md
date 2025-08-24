# FCM 푸시 알림 테스트 가이드

## 푸시 알림 형식

FCM 푸시 알림에 URL을 포함시켜 보내면, 알림을 클릭했을 때 해당 URL이 WebView에 로드됩니다.

## 🔥 전체 사용자에게 발송하기

모든 앱 사용자는 자동으로 `all_users` topic에 구독되어 있습니다.

### Topic을 사용한 전체 발송

```bash
# 전체 사용자에게 발송
curl -X POST https://fcm.googleapis.com/fcm/send \
  -H "Authorization: key=YOUR_SERVER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "/topics/all_users",
    "notification": {
      "title": "전체 공지",
      "body": "모든 사용자에게 전달되는 메시지입니다"
    },
    "data": {
      "url": "https://vpvmall.com/notice"
    }
  }'
```

### Firebase Console에서 전체 발송
1. Firebase Console > Cloud Messaging
2. 새 캠페인 > 알림
3. 타겟 설정에서 "주제" 선택
4. `all_users` 입력
5. 알림 내용 작성 후 전송

## 1. Firebase Console에서 테스트

Firebase Console > Cloud Messaging에서 테스트 메시지 보내기:

**알림 내용:**
- 제목: 원하는 제목
- 본문: 원하는 내용

**추가 옵션 > 맞춤 데이터:**
- 키: `url`
- 값: `https://vpvmall.com/special-page` (원하는 URL)

## 2. cURL로 테스트

```bash
# FCM 서버 키는 Firebase Console > 프로젝트 설정 > 클라우드 메시징에서 확인
# YOUR_FCM_TOKEN은 앱에서 window.fcmToken으로 확인한 값
# YOUR_SERVER_KEY는 Firebase 서버 키

curl -X POST https://fcm.googleapis.com/fcm/send \
  -H "Authorization: key=YOUR_SERVER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "YOUR_FCM_TOKEN",
    "notification": {
      "title": "특별 할인!",
      "body": "오늘만 50% 할인! 클릭해서 확인하세요"
    },
    "data": {
      "url": "https://vpvmall.com/sale",
      "custom_key": "custom_value"
    }
  }'
```

## 3. Node.js로 테스트

```javascript
const admin = require('firebase-admin');

// Firebase Admin SDK 초기화 (서비스 계정 키 필요)
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 푸시 알림 보내기
const message = {
  token: 'YOUR_FCM_TOKEN',
  notification: {
    title: '새로운 상품 입고!',
    body: '인기 상품이 재입고되었습니다'
  },
  data: {
    url: 'https://vpvmall.com/new-arrivals',
    category: 'fashion'
  },
  android: {
    notification: {
      clickAction: 'OPEN_URL'
    }
  }
};

admin.messaging().send(message)
  .then((response) => {
    console.log('Successfully sent message:', response);
  })
  .catch((error) => {
    console.log('Error sending message:', error);
  });
```

## 4. 서버에서 보내기 (PHP 예제)

### 개별 사용자에게 보내기

```php
<?php
$fcmToken = "YOUR_FCM_TOKEN";
$serverKey = "YOUR_SERVER_KEY";

$notification = [
    'title' => '주문 완료',
    'body' => '주문이 성공적으로 완료되었습니다'
];

$data = [
    'url' => 'https://vpvmall.com/order/12345',
    'order_id' => '12345'
];

$fields = [
    'to' => $fcmToken,
    'notification' => $notification,
    'data' => $data
];

$headers = [
    'Authorization: key=' . $serverKey,
    'Content-Type: application/json'
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://fcm.googleapis.com/fcm/send');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($fields));

$result = curl_exec($ch);
curl_close($ch);

echo $result;
?>
```

### 전체 사용자에게 보내기 (PHP)

```php
<?php
$serverKey = "YOUR_SERVER_KEY";

$notification = [
    'title' => '전체 공지사항',
    'body' => '모든 사용자분들께 알립니다'
];

$data = [
    'url' => 'https://vpvmall.com/notice',
    'type' => 'broadcast'
];

$fields = [
    'to' => '/topics/all_users',  // 전체 사용자 topic
    'notification' => $notification,
    'data' => $data
];

$headers = [
    'Authorization: key=' . $serverKey,
    'Content-Type: application/json'
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://fcm.googleapis.com/fcm/send');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($fields));

$result = curl_exec($ch);
curl_close($ch);

echo $result;
?>
```

## 5. 동작 방식

### 앱이 포그라운드에 있을 때:
1. 알림이 Alert으로 표시됨
2. 사용자가 "확인"을 누르면 data.url로 이동

### 앱이 백그라운드에 있을 때:
1. 시스템 알림으로 표시됨
2. 알림을 탭하면 앱이 열리며 data.url로 이동

### 앱이 종료된 상태일 때:
1. 시스템 알림으로 표시됨
2. 알림을 탭하면 앱이 시작되며 data.url로 이동

## 6. WebView에서 현재 URL 확인

```javascript
// 현재 WebView URL 확인 (웹 페이지에서 실행)
console.log('현재 URL:', window.location.href);

// FCM으로 받은 데이터 확인
window.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'NOTIFICATION_RECEIVED') {
    console.log('푸시 데이터:', data.data);
    if (data.data.url) {
      console.log('이동할 URL:', data.data.url);
    }
  }
});
```

## 7. 주의사항

1. **URL 형식**: 반드시 `https://` 또는 `http://`로 시작하는 완전한 URL이어야 함
2. **데이터 키**: `url` 키를 사용해야 자동으로 처리됨
3. **권한**: Android 13+ 에서는 알림 권한이 필요함
4. **토큰 갱신**: FCM 토큰은 주기적으로 갱신되므로 서버에 업데이트 필요

## 8. 디버깅

```bash
# 로그 확인
adb logcat | grep -E "FCM|Deep Link|Navigating"

# React Native 로그
npx react-native log-android
```

로그에서 확인할 내용:
- `FCM Deep Link received: [URL]` - 딥링크 수신
- `Navigating to URL from FCM: [URL]` - URL 이동
- `Found pending deep link: [URL]` - 대기 중인 딥링크 처리