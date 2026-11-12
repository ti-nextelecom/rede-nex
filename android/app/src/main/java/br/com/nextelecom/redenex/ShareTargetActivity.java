package br.com.nextelecom.redenex;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.database.Cursor;
import android.provider.OpenableColumns;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.widget.Toast;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;
import android.util.Base64;

public class ShareTargetActivity extends Activity {

    private static final String BASE_URL = "https://rede.nextelecom.net.br";
    private static final String SHARE_CAT = "br.com.nextelecom.redenex.SHARE_TARGET";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        String cookie = CookieManager.getInstance().getCookie(BASE_URL);
        if (cookie == null || cookie.isEmpty()) {
            Toast.makeText(this, "Abra a Rede Nex primeiro para fazer login", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        String shortcutId = getIntent().getStringExtra(Intent.EXTRA_SHORTCUT_ID);
        if (shortcutId != null && shortcutId.startsWith("conv_")) {
            handleShare(cookie, shortcutId.replace("conv_", ""));
            return;
        }

        loadAndPickConversation(cookie);
    }

    private void loadAndPickConversation(String cookie) {
        new Thread(() -> {
            try {
                List<String[]> convs = fetchConversations(cookie);
                if (convs.isEmpty()) {
                    runOnUiThread(() -> {
                        Toast.makeText(this, "Nenhuma conversa encontrada", Toast.LENGTH_SHORT).show();
                        finish();
                    });
                    return;
                }
                updateShortcuts(convs);
                String[] names = convs.stream().map(c -> c[1]).toArray(String[]::new);
                runOnUiThread(() -> new AlertDialog.Builder(this)
                    .setTitle("Compartilhar via Rede Nex")
                    .setItems(names, (d, i) -> handleShare(cookie, convs.get(i)[0]))
                    .setNegativeButton("Cancelar", (d, w) -> finish())
                    .setOnCancelListener(d -> finish())
                    .show());
            } catch (Exception e) {
                runOnUiThread(() -> {
                    Toast.makeText(this, "Erro ao carregar conversas", Toast.LENGTH_SHORT).show();
                    finish();
                });
            }
        }).start();
    }

    private void handleShare(String cookie, String convId) {
        Intent intent = getIntent();
        String action = intent.getAction();
        String type = intent.getType();

        new Thread(() -> {
            try {
                if (Intent.ACTION_SEND.equals(action) && "text/plain".equals(type)) {
                    String text = intent.getStringExtra(Intent.EXTRA_TEXT);
                    if (text != null && !text.isEmpty()) sendMessage(cookie, convId, text, null);
                } else if (Intent.ACTION_SEND.equals(action)) {
                    Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                    if (uri != null) {
                        String mediaContent = uploadFile(cookie, uri, type);
                        if (mediaContent != null) sendMessage(cookie, convId, mediaContent, null);
                    }
                } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
                    ArrayList<Uri> uris = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                    if (uris != null) {
                        for (Uri uri : uris) {
                            String mediaContent = uploadFile(cookie, uri, type);
                            if (mediaContent != null) sendMessage(cookie, convId, mediaContent, null);
                        }
                    }
                }
                runOnUiThread(() -> {
                    Toast.makeText(this, "Enviado!", Toast.LENGTH_SHORT).show();
                    finish();
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    Toast.makeText(this, "Erro ao enviar", Toast.LENGTH_SHORT).show();
                    finish();
                });
            }
        }).start();
    }

    private List<String[]> fetchConversations(String cookie) throws Exception {
        URL url = new URL(BASE_URL + "/api/chat/conversations?limit=50");
        HttpURLConnection conn = openConn(url, "GET", cookie);
        int code = conn.getResponseCode();
        if (code != 200) { conn.disconnect(); return Collections.emptyList(); }
        String resp = readStream(conn.getInputStream());
        conn.disconnect();

        List<String[]> result = new ArrayList<>();
        JSONObject root = new JSONObject(resp);
        JSONArray items = root.optJSONArray("conversations");
        if (items == null) items = root.optJSONArray("data");
        if (items == null && resp.trim().startsWith("[")) items = new JSONArray(resp);
        if (items == null) return result;

        for (int i = 0; i < Math.min(items.length(), 15); i++) {
            JSONObject c = items.getJSONObject(i);
            String id = c.optString("id", c.optString("conversation_id", ""));
            String name = c.optString("name", c.optString("title", "Conversa " + (i + 1)));
            if (!id.isEmpty()) result.add(new String[]{ id, name });
        }
        return result;
    }

    private void sendMessage(String cookie, String convId, String text, String fileUrl) throws Exception {
        URL url = new URL(BASE_URL + "/api/chat/conversations/" + convId + "/messages");
        HttpURLConnection conn = openConn(url, "POST", cookie);
        conn.setDoOutput(true);
        JSONObject body = new JSONObject();
        if (text != null) body.put("content", text);
        if (fileUrl != null) body.put("attachment_url", fileUrl);
        byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
        try (OutputStream os = conn.getOutputStream()) { os.write(bytes); }
        int status = conn.getResponseCode();
        conn.disconnect();
        if (status < 200 || status >= 300) throw new java.io.IOException("Falha ao enviar mensagem");
    }

    private String uploadFile(String cookie, Uri uri, String mimeType) throws Exception {
        InputStream is = getContentResolver().openInputStream(uri);
        if (is == null) throw new java.io.IOException("Nao foi possivel abrir o arquivo");
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = is.read(buf)) != -1) { if (baos.size() + n > 20 * 1024 * 1024) { is.close(); throw new java.io.IOException("Arquivo maior que 20 MB"); } baos.write(buf, 0, n); }
        is.close();
        String b64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
        String fileName = uri.getLastPathSegment();
        try (Cursor cursor = getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst() && !cursor.isNull(0)) fileName = cursor.getString(0);
        } catch (Exception ignored) { }
        String resolvedType = getContentResolver().getType(uri);
        if (resolvedType != null && !resolvedType.isEmpty()) mimeType = resolvedType;
        if (fileName == null) fileName = "file_" + System.currentTimeMillis();

        URL url = new URL(BASE_URL + "/api/chat/media");
        HttpURLConnection conn = openConn(url, "POST", cookie);
        conn.setDoOutput(true);
        JSONObject body = new JSONObject();
        body.put("data", b64);
        body.put("file_name", fileName);
        body.put("file_type", mimeType != null ? mimeType : "application/octet-stream");
        byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
        try (OutputStream os = conn.getOutputStream()) { os.write(bytes); }

        int code = conn.getResponseCode();
        if (code < 200 || code >= 300) { conn.disconnect(); throw new java.io.IOException("Falha ao enviar arquivo"); }
        String resp = readStream(conn.getInputStream());
        conn.disconnect();

        JSONObject respObj = new JSONObject(resp);
        JSONObject dataObj = respObj.optJSONObject("data");
        String mediaUrl = dataObj != null ? dataObj.optString("public_url", null) : null;
        if (mediaUrl == null || mediaUrl.isEmpty()) throw new java.io.IOException("Arquivo nao confirmado pelo servidor");
        String cleanName = fileName.replace("]", "").replace("\n", " ").replace("\r", " ");
        boolean audio = (mimeType != null && (mimeType.startsWith("audio/") || mimeType.equals("application/ogg")))
            || mediaUrl.matches("(?i).*\\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|amr)$");
        String prefix = mimeType != null && mimeType.startsWith("image/") ? "[IMAGE]"
            : mimeType != null && mimeType.startsWith("video/") ? "[VIDEO]"
            : audio ? "[AUDIO_MSG]" : "[DOC|" + cleanName + "]";
        return prefix + mediaUrl;
    }

    private HttpURLConnection openConn(URL url, String method, String cookie) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod(method);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Cookie", cookie);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(15000);
        return conn;
    }

    private String readStream(InputStream is) throws Exception {
        BufferedReader r = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = r.readLine()) != null) sb.append(line);
        return sb.toString();
    }

    private void updateShortcuts(List<String[]> conversations) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N_MR1) return;
            List<ShortcutInfoCompat> shortcuts = new ArrayList<>();
            for (String[] conv : conversations) {
                Intent dummyIntent = new Intent(Intent.ACTION_VIEW)
                    .setClass(this, ShareTargetActivity.class);
                String label = conv[1].length() > 25 ? conv[1].substring(0, 25) : conv[1];
                ShortcutInfoCompat s = new ShortcutInfoCompat.Builder(this, "conv_" + conv[0])
                    .setShortLabel(label)
                    .setLongLabel(conv[1])
                    .setIcon(IconCompat.createWithResource(this, R.mipmap.ic_launcher))
                    .setIntent(dummyIntent)
                    .setCategories(new HashSet<>(Collections.singletonList(SHARE_CAT)))
                    .setIsConversation()
                    .build();
                shortcuts.add(s);
                if (shortcuts.size() >= 10) break;
            }
            ShortcutManagerCompat.addDynamicShortcuts(this, shortcuts);
        } catch (Exception ignored) {}
    }
}
