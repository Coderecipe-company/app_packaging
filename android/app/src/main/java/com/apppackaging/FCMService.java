package com.apppackaging;

import android.app.PendingIntent;
import android.content.Intent;
import android.app.NotificationManager;
import androidx.core.app.NotificationCompat;
import android.util.Log;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;
import java.util.Random;

public class FCMService extends FirebaseMessagingService {
    
    private static final String TAG = "FCMService";
    
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Log.d(TAG, "From: " + remoteMessage.getFrom());
        
        // 데이터 메시지 처리
        if (remoteMessage.getData().size() > 0) {
            Log.d(TAG, "Message data payload: " + remoteMessage.getData());
            handleDataMessage(remoteMessage.getData());
        }
        
        // 알림 메시지 처리
        if (remoteMessage.getNotification() != null) {
            Log.d(TAG, "Message Notification Body: " + remoteMessage.getNotification().getBody());
            showNotification(
                remoteMessage.getNotification().getTitle(),
                remoteMessage.getNotification().getBody(),
                remoteMessage.getData()
            );
        }
    }
    
    @Override
    public void onNewToken(String token) {
        Log.d(TAG, "Refreshed token: " + token);
        
        // 토큰을 서버로 전송
        sendRegistrationToServer(token);
    }
    
    private void handleDataMessage(Map<String, String> data) {
        // 데이터 메시지를 React Native로 전달
        Intent intent = new Intent("FCM_DATA_MESSAGE");
        for (Map.Entry<String, String> entry : data.entrySet()) {
            intent.putExtra(entry.getKey(), entry.getValue());
        }
        sendBroadcast(intent);
    }
    
    private void showNotification(String title, String messageBody, Map<String, String> data) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        // 딥링크 URL이 있는 경우 인텐트에 추가
        if (data.containsKey("url")) {
            intent.putExtra("deeplink_url", data.get("url"));
        }
        
        // 모든 데이터를 인텐트에 추가
        for (Map.Entry<String, String> entry : data.entrySet()) {
            intent.putExtra(entry.getKey(), entry.getValue());
        }
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 
            new Random().nextInt(), 
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        
        String channelId = "default_notification_channel";
        NotificationCompat.Builder notificationBuilder = 
            new NotificationCompat.Builder(this, channelId)
                .setContentTitle(title != null ? title : getString(R.string.app_name))
                .setContentText(messageBody)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setContentIntent(pendingIntent);
        
        // 앱 아이콘 설정
        notificationBuilder.setSmallIcon(R.drawable.ic_notification);
        
        // 큰 아이콘 설정 (옵션)
        // notificationBuilder.setLargeIcon(BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher));
        
        // 스타일 설정 (긴 텍스트)
        if (messageBody != null && messageBody.length() > 50) {
            notificationBuilder.setStyle(new NotificationCompat.BigTextStyle().bigText(messageBody));
        }
        
        NotificationManager notificationManager = 
            (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        
        notificationManager.notify(new Random().nextInt(), notificationBuilder.build());
    }
    
    private void sendRegistrationToServer(String token) {
        // 토큰을 React Native에 전달하여 서버로 전송하도록 처리
        Intent intent = new Intent("FCM_TOKEN_REFRESHED");
        intent.putExtra("token", token);
        sendBroadcast(intent);
    }
}