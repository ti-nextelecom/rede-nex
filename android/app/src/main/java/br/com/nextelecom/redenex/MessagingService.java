package br.com.nextelecom.redenex;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

public class MessagingService extends FirebaseMessagingService {

    static final String KEY_REPLY = "key_reply";
    static final String CHANNEL_ID = "rede-nex-chat";
    static final String ACTION_REPLY = "br.com.nextelecom.redenex.REPLY";
    private static final AtomicInteger notifCounter = new AtomicInteger(2000);

    @Override
    public void onMessageReceived(RemoteMessage message) {
        Map<String, String> data = message.getData();
        String title = data.getOrDefault("title", "Rede Nex");
        String body = data.getOrDefault("body", "Nova mensagem");
        String conversationId = data.get("conversationId");
        String senderAvatar = data.get("senderAvatar");

        ensureChannel();
        int id = notifCounter.getAndIncrement();

        Intent tapIntent = new Intent(Intent.ACTION_VIEW,
            Uri.parse("rede-nex://chat/" + (conversationId != null ? conversationId : "")));
        tapIntent.setPackage(getPackageName());
        tapIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tapPending = PendingIntent.getActivity(this, id, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(tapPending);

        if (senderAvatar != null && !senderAvatar.isEmpty()) {
            Bitmap avatar = downloadBitmap(senderAvatar);
            if (avatar != null) builder.setLargeIcon(avatar);
        }

        if (conversationId != null) {
            RemoteInput remoteInput = new RemoteInput.Builder(KEY_REPLY)
                .setLabel("Responder...")
                .build();
            Intent replyIntent = new Intent(ACTION_REPLY);
            replyIntent.setPackage(getPackageName());
            replyIntent.putExtra("conversationId", conversationId);
            replyIntent.putExtra("notifId", id);
            int replyFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                replyFlags |= PendingIntent.FLAG_MUTABLE;
            }
            PendingIntent replyPending = PendingIntent.getBroadcast(this, id, replyIntent, replyFlags);
            NotificationCompat.Action replyAction = new NotificationCompat.Action.Builder(
                android.R.drawable.ic_menu_send, "Responder", replyPending)
                .addRemoteInput(remoteInput)
                .setAllowGeneratedReplies(true)
                .build();
            builder.addAction(replyAction);
        }

        NotificationManager mgr = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (mgr != null) mgr.notify(id, builder.build());
    }

    private Bitmap downloadBitmap(String urlString) {
        try {
            URL url = new URL(urlString);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(5000);
            conn.setDoInput(true);
            conn.connect();
            InputStream input = conn.getInputStream();
            Bitmap bitmap = BitmapFactory.decodeStream(input);
            input.close();
            conn.disconnect();
            return bitmap;
        } catch (Exception e) {
            return null;
        }
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "Mensagens", NotificationManager.IMPORTANCE_HIGH);
            ch.enableVibration(true);
            NotificationManager mgr = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (mgr != null) mgr.createNotificationChannel(ch);
        }
    }
}
