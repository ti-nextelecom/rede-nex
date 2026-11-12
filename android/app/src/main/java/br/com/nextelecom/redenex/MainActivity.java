package br.com.nextelecom.redenex;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                "rede-nex-chat",
                "Mensagens",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notificacoes de mensagens da Rede Nex");
            channel.enableVibration(true);
            NotificationManager mgr = getSystemService(NotificationManager.class);
            if (mgr != null) mgr.createNotificationChannel(channel);
        }
    }
}