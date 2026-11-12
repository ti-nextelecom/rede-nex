package br.com.nextelecom.redenex;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.CookieManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class ReplyReceiver extends BroadcastReceiver {

    private static final String BASE_URL = "https://rede.nextelecom.net.br";

    @Override
    public void onReceive(Context context, Intent intent) {
        Bundle remoteInputResults = RemoteInput.getResultsFromIntent(intent);
        if (remoteInputResults == null) return;
        CharSequence replyText = remoteInputResults.getCharSequence(MessagingService.KEY_REPLY);
        String conversationId = intent.getStringExtra("conversationId");
        int notifId = intent.getIntExtra("notifId", -1);
        if (replyText == null || conversationId == null) return;
        String text = replyText.toString().trim();
        if (text.isEmpty()) return;

        showStatus(context, notifId, "Enviando...");

        final String finalText = text;
        final String finalConvId = conversationId;
        final int finalNotifId = notifId;
        final String cookie = CookieManager.getInstance().getCookie(BASE_URL);

        new Thread(() -> {
            try {
                if (cookie == null || cookie.isEmpty()) {
                    showStatus(context, finalNotifId, "Abra o app para fazer login");
                    return;
                }
                URL url = new URL(BASE_URL + "/api/chat/conversations/" + finalConvId + "/messages");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Cookie", cookie);
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                byte[] payload = ("{\"content\":" + jsonEscape(finalText) + "}").getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = conn.getOutputStream()) { os.write(payload); }
                int code = conn.getResponseCode();
                conn.disconnect();
                if (code >= 200 && code < 300) {
                    dismiss(context, finalNotifId);
                } else {
                    showStatus(context, finalNotifId, "Falha ao enviar (tente pelo app)");
                }
            } catch (Exception e) {
                showStatus(context, finalNotifId, "Falha ao enviar. Verifique a conexão.");
            }
        }).start();
    }

    private void showStatus(Context ctx, int id, String msg) {
        if (id < 0) return;
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, MessagingService.CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Rede Nex")
            .setContentText(msg)
            .setPriority(NotificationCompat.PRIORITY_LOW);
        NotificationManager mgr = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (mgr != null) mgr.notify(id, b.build());
    }

    private void dismiss(Context ctx, int id) {
        NotificationManager mgr = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (mgr != null) mgr.cancel(id);
    }

    private String jsonEscape(String s) {
        return "\"" + s
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "") + "\"";
    }
}