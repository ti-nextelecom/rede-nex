package br.com.nextelecom.redenex;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.webkit.CookieManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;
import androidx.core.content.ContextCompat;
import com.google.firebase.messaging.RemoteMessage;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

// Keep Capacitor's token refresh bridge while displaying data-only FCM messages.
public class MessagingService extends com.capacitorjs.plugins.pushnotifications.MessagingService {
    static final String KEY_REPLY = "key_reply";
    static final String CHANNEL_ID = "rede-nex-chat";
    static final String ACTION_REPLY = "br.com.nextelecom.redenex.REPLY";
    private static final AtomicInteger notifCounter = new AtomicInteger(2000);

    @Override
    public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        Map<String, String> data = message.getData();
        RemoteMessage.Notification notification = message.getNotification();
        String title = data.getOrDefault("title", notification != null && notification.getTitle() != null ? notification.getTitle() : "Rede NEX");
        String body = data.getOrDefault("body", notification != null && notification.getBody() != null ? notification.getBody() : "Nova mensagem");
        String conversationId = data.get("conversationId");
        String senderAvatar = data.get("senderAvatar");
        boolean chat = conversationId != null && conversationId.matches("[0-9a-fA-F-]{36}");
        String link = data.getOrDefault("link", "/");
        Uri target = chat ? new Uri.Builder().scheme("rede-nex").authority("chat").appendPath(conversationId)
            .appendQueryParameter("mensagem", data.getOrDefault("messageId", ""))
            .appendQueryParameter("mencao", "true".equals(data.get("mention")) ? "1" : "0").build()
            : new Uri.Builder().scheme("rede-nex").authority("open").appendQueryParameter("link", link).build();
        ensureChannel();
        int id = data.containsKey("notificationId") ? data.get("notificationId").hashCode() & 0x7fffffff : notifCounter.getAndIncrement();
        Intent tapIntent = new Intent(this, MainActivity.class).setAction(Intent.ACTION_VIEW).setData(target)
            .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tapPending = PendingIntent.getActivity(this, id, tapIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_nex).setContentTitle(title).setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body)).setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true).setContentIntent(tapPending);
        if (chat) {
            RemoteInput remoteInput = new RemoteInput.Builder(KEY_REPLY).setLabel("Responder...").build();
            Intent replyIntent = new Intent(this, ReplyReceiver.class).setAction(ACTION_REPLY);
            replyIntent.putExtra("conversationId", conversationId).putExtra("notifId", id);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
            builder.addAction(new NotificationCompat.Action.Builder(android.R.drawable.ic_menu_send, "Responder",
                PendingIntent.getBroadcast(this, id, replyIntent, flags)).addRemoteInput(remoteInput).setAllowGeneratedReplies(true).build());
        }
        NotificationManager mgr = (NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        if (mgr != null) {
            // Show the alert immediately; a slow avatar must not delay delivery.
            mgr.notify(id, builder.build());
            Bitmap avatar = downloadBitmap(senderAvatar);
            if (avatar != null) mgr.notify(id, builder.setLargeIcon(avatar).setOnlyAlertOnce(true).build());
        }
    }
    private Bitmap downloadBitmap(String urlString) {
        if (urlString == null || urlString.isEmpty()) return null;
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlString);
            if (!"https".equalsIgnoreCase(url.getProtocol()) || url.getUserInfo() != null) return null;
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(1500); conn.setReadTimeout(2000);
            conn.setInstanceFollowRedirects(false);
            // Uploaded avatars are private. Never forward the app cookie to an external host.
            if ("rede.nextelecom.net.br".equalsIgnoreCase(url.getHost()) && (url.getPort() == -1 || url.getPort() == 443)) {
                String cookie = CookieManager.getInstance().getCookie("https://rede.nextelecom.net.br");
                if (cookie != null) conn.setRequestProperty("Cookie", cookie);
            }
            if (conn.getResponseCode() != 200 || conn.getContentLengthLong() > 2 * 1024 * 1024) return null;
            byte[] bytes;
            try (InputStream input = conn.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192]; int read;
                while ((read = input.read(buffer)) != -1) {
                    if (output.size() + read > 2 * 1024 * 1024) return null;
                    output.write(buffer, 0, read);
                }
                bytes = output.toByteArray();
            }
            BitmapFactory.Options bounds = new BitmapFactory.Options(); bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;
            BitmapFactory.Options options = new BitmapFactory.Options(); options.inSampleSize = 1;
            while (bounds.outWidth / options.inSampleSize > 128 || bounds.outHeight / options.inSampleSize > 128) options.inSampleSize *= 2;
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
        } catch (Exception ignored) { return null; }
        finally { if (conn != null) conn.disconnect(); }
    }
    private void ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Mensagens", NotificationManager.IMPORTANCE_HIGH);
            channel.enableVibration(true);
            NotificationManager mgr = getSystemService(NotificationManager.class);
            if (mgr != null) mgr.createNotificationChannel(channel);
        }
    }
}
