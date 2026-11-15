package mx.anillo.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.graphics.Bitmap;
import android.graphics.Outline;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CaptureRequest;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.HandlerThread;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.view.Gravity;
import android.view.TextureView;
import android.view.View;
import android.view.ViewOutlineProvider;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.util.Collections;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private WebView web;
    private FrameLayout capaCara;
    private TextureView vistaCara;
    private CameraDevice camara;
    private CameraCaptureSession sesionCam;
    private HandlerThread hiloFondo;
    private Handler hiloCam;
    private boolean esperandoCara;
    private boolean capturando;
    private int vistos;
    private final Executor hilo = Executors.newSingleThreadExecutor();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.CAMERA}, 1);
        }
        web = new WebView(this);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            web.setAutoHandwritingEnabled(false);
        }
        WebSettings ajustes = web.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true);
        ajustes.setMediaPlaybackRequiresUserGesture(false);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host != null && !host.contains("10.0.2.2") && !host.equals("127.0.0.1") && !host.equals("localhost")) {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    return true;
                }
                return false;
            }
        });
        web.addJavascriptInterface(new Bio(), "AnilloBio");
        web.addJavascriptInterface(new Cara(), "AnilloCara");
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(request.getResources());
                    } else {
                        request.deny();
                    }
                });
            }
        });
        armarCamara();
        setContentView(armarRaiz());
        web.loadUrl(getString(R.string.start_url));
    }

    private FrameLayout armarRaiz() {
        FrameLayout raiz = new FrameLayout(this);
        raiz.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        int lado = (int) (280 * getResources().getDisplayMetrics().density);
        capaCara = new FrameLayout(this);
        capaCara.setBackgroundColor(0xFFF6F1E8);
        capaCara.setVisibility(View.GONE);
        LinearLayout columna = new LinearLayout(this);
        columna.setOrientation(LinearLayout.VERTICAL);
        columna.setGravity(Gravity.CENTER);
        vistaCara.setOutlineProvider(new ViewOutlineProvider() {
            @Override
            public void getOutline(View view, Outline outline) {
                outline.setOval(0, 0, view.getWidth(), view.getHeight());
            }
        });
        vistaCara.setClipToOutline(true);
        columna.addView(vistaCara, new LinearLayout.LayoutParams(lado, lado));
        TextView texto = new TextView(this);
        texto.setText("Mírame. Te estoy registrando.");
        texto.setTextColor(0xFF241C22);
        texto.setTextSize(18);
        texto.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        tp.topMargin = (int) (28 * getResources().getDisplayMetrics().density);
        columna.addView(texto, tp);
        capaCara.addView(columna, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        raiz.addView(capaCara, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        return raiz;
    }

    private void armarCamara() {
        vistaCara = new TextureView(this);
        hiloFondo = new HandlerThread("camara");
        hiloFondo.start();
        hiloCam = new Handler(hiloFondo.getLooper());
    }

    private class Cara {
        @JavascriptInterface
        public void registrar() {
            runOnUiThread(() -> abrirCamara());
        }
    }

    private void abrirCamara() {
        if (capaCara.getVisibility() == View.VISIBLE) return;
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            esperandoCara = true;
            requestPermissions(new String[]{Manifest.permission.CAMERA}, 1);
            return;
        }
        capturando = false;
        vistos = 0;
        capaCara.setVisibility(View.VISIBLE);
        if (vistaCara.isAvailable()) iniciarCamara();
        else vistaCara.setSurfaceTextureListener(new TextureView.SurfaceTextureListener() {
            @Override
            public void onSurfaceTextureAvailable(android.graphics.SurfaceTexture surface, int width, int height) {
                iniciarCamara();
            }

            @Override
            public void onSurfaceTextureSizeChanged(android.graphics.SurfaceTexture surface, int width, int height) {}

            @Override
            public boolean onSurfaceTextureDestroyed(android.graphics.SurfaceTexture surface) {
                hiloCam.post(() -> cerrarCamara());
                return true;
            }

            @Override
            public void onSurfaceTextureUpdated(android.graphics.SurfaceTexture surface) {}
        });
    }

    private void iniciarCamara() {
        android.graphics.SurfaceTexture tex = vistaCara.getSurfaceTexture();
        if (tex == null) {
            terminarCara(false, "");
            return;
        }
        tex.setDefaultBufferSize(640, 480);
        android.view.Surface surface = new android.view.Surface(tex);
        try {
            CameraManager mgr = (CameraManager) getSystemService(CAMERA_SERVICE);
            String id = elegirCamara(mgr);
            if (id == null) {
                terminarCara(false, "");
                return;
            }
            mgr.openCamera(id, new CameraDevice.StateCallback() {
                @Override
                public void onOpened(CameraDevice device) {
                    camara = device;
                    try {
                        device.createCaptureSession(Collections.singletonList(surface), new CameraCaptureSession.StateCallback() {
                            @Override
                            public void onConfigured(CameraCaptureSession session) {
                                sesionCam = session;
                                try {
                                    CaptureRequest.Builder b = device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW);
                                    b.addTarget(surface);
                                    session.setRepeatingRequest(b.build(), null, hiloCam);
                                    runOnUiThread(() -> capturarCuandoHayaImagen(0));
                                } catch (Exception e) {
                                    runOnUiThread(() -> terminarCara(false, ""));
                                }
                            }

                            @Override
                            public void onConfigureFailed(CameraCaptureSession session) {
                                runOnUiThread(() -> terminarCara(false, ""));
                            }
                        }, hiloCam);
                    } catch (Exception e) {
                        runOnUiThread(() -> terminarCara(false, ""));
                    }
                }

                @Override
                public void onDisconnected(CameraDevice device) {
                    device.close();
                }

                @Override
                public void onError(CameraDevice device, int error) {
                    device.close();
                    runOnUiThread(() -> terminarCara(false, ""));
                }
            }, hiloCam);
        } catch (Exception e) {
            terminarCara(false, "");
        }
    }

    private String elegirCamara(CameraManager mgr) throws Exception {
        String cualquiera = null;
        for (String id : mgr.getCameraIdList()) {
            Integer facing = mgr.getCameraCharacteristics(id).get(CameraCharacteristics.LENS_FACING);
            if (cualquiera == null) cualquiera = id;
            if (facing != null && facing == CameraCharacteristics.LENS_FACING_FRONT) return id;
        }
        return cualquiera;
    }

    private void capturarCuandoHayaImagen(int intento) {
        if (capaCara.getVisibility() != View.VISIBLE || capturando) return;
        vistaCara.postDelayed(() -> {
            if (capaCara.getVisibility() != View.VISIBLE || capturando) return;
            Bitmap bmp = vistaCara.getBitmap();
            boolean lista = bmp != null && !oscura(bmp);
            if (lista) vistos++;
            if (!lista && intento < 16) {
                capturarCuandoHayaImagen(intento + 1);
                return;
            }
            if (lista && vistos < 4) {
                capturarCuandoHayaImagen(intento + 1);
                return;
            }
            if (bmp == null) {
                terminarCara(false, "");
                return;
            }
            capturando = true;
            int ancho = 320;
            int alto = Math.max(1, bmp.getHeight() * ancho / Math.max(1, bmp.getWidth()));
            Bitmap chico = Bitmap.createScaledBitmap(bmp, ancho, alto, true);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            chico.compress(Bitmap.CompressFormat.JPEG, 75, out);
            String jpeg = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
            terminarCara(true, jpeg);
        }, 350);
    }

    private static boolean oscura(Bitmap bmp) {
        int pixel = bmp.getPixel(bmp.getWidth() / 2, bmp.getHeight() / 2);
        int r = (pixel >> 16) & 0xff;
        int g = (pixel >> 8) & 0xff;
        int b = pixel & 0xff;
        return r < 12 && g < 12 && b < 12;
    }

    private void terminarCara(boolean ok, String jpeg) {
        capturando = false;
        if (capaCara != null) capaCara.setVisibility(View.GONE);
        if (hiloCam != null) hiloCam.post(this::cerrarCamara);
        String js = "window.anilloCaraLista&&window.anilloCaraLista("
                + ok + "," + JSONObject.quote(jpeg == null ? "" : jpeg) + ")";
        if (web != null) web.evaluateJavascript(js, null);
    }

    private void cerrarCamara() {
        try {
            if (sesionCam != null) {
                sesionCam.close();
                sesionCam = null;
            }
        } catch (Exception ignored) {}
        try {
            if (camara != null) {
                camara.close();
                camara = null;
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (!esperandoCara) return;
        esperandoCara = false;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) abrirCamara();
        else terminarCara(false, "");
    }

    private void avisar(boolean ok, String publica, String firma, String credencial) {
        String js = "window.anilloBioListo&&window.anilloBioListo("
                + ok + "," + JSONObject.quote(publica == null ? "" : publica) + ","
                + JSONObject.quote(firma == null ? "" : firma) + ","
                + JSONObject.quote(credencial == null ? "" : credencial) + ")";
        runOnUiThread(() -> web.evaluateJavascript(js, null));
    }

    private class Bio {
        @JavascriptInterface
        public boolean disponible() {
            if (Build.VERSION.SDK_INT < 29) return false;
            BiometricManager bm = (BiometricManager) getSystemService(BIOMETRIC_SERVICE);
            if (bm == null) return false;
            int r = Build.VERSION.SDK_INT >= 30
                    ? bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                    : bm.canAuthenticate();
            return r == BiometricManager.BIOMETRIC_SUCCESS;
        }

        @JavascriptInterface
        public void confirmar(String desafioHex, String alias) {
            confirmar(desafioHex, alias, "cara");
        }

        @JavascriptInterface
        public void confirmar(String desafioHex, String alias, String metodo) {
            runOnUiThread(() -> pedir(desafioHex, alias, metodo));
        }
    }

    private void pedir(String desafioHex, String alias, String metodo) {
        try {
            asegurarLlave(alias);
            KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
            ks.load(null);
            PrivateKey key = (PrivateKey) ks.getKey(alias, null);
            Signature signature = Signature.getInstance("SHA256withECDSA");
            signature.initSign(key);
            String texto = "huella".equals(metodo)
                    ? "Confirma con tu huella. Esto abre la sesión, no envía el pago."
                    : "Confirma con tu cara. Esto abre la sesión, no envía el pago.";
            BiometricPrompt prompt = new BiometricPrompt.Builder(this)
                    .setTitle("Anillo")
                    .setDescription(texto)
                    .setNegativeButton("Cancelar", hilo, (dialog, which) -> avisar(false, null, null, alias))
                    .build();
            CancellationSignal cancel = new CancellationSignal();
            prompt.authenticate(new BiometricPrompt.CryptoObject(signature), cancel, hilo, new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                    try {
                        Signature s = result.getCryptoObject().getSignature();
                        s.update(hex(desafioHex));
                        String firma = Base64.encodeToString(s.sign(), Base64.NO_WRAP);
                        String publica = Base64.encodeToString(
                                ks.getCertificate(alias).getPublicKey().getEncoded(), Base64.NO_WRAP);
                        avisar(true, publica, firma, alias);
                    } catch (Exception e) {
                        avisar(false, null, null, alias);
                    }
                }

                @Override
                public void onAuthenticationError(int errorCode, CharSequence errString) {
                    avisar(false, null, null, alias);
                }
            });
        } catch (Exception e) {
            avisar(false, null, null, alias);
        }
    }

    private void asegurarLlave(String alias) throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(alias)) return;
        KeyPairGenerator kpg = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore");
        KeyGenParameterSpec.Builder b = new KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1"))
                .setUserAuthenticationRequired(true);
        if (Build.VERSION.SDK_INT >= 30) {
            b.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG);
        } else {
            b.setUserAuthenticationValidityDurationSeconds(-1);
        }
        kpg.initialize(b.build());
        kpg.generateKeyPair();
    }

    private static byte[] hex(String s) {
        int n = s.length() / 2;
        byte[] out = new byte[n];
        for (int i = 0; i < n; i++) {
            out[i] = (byte) Integer.parseInt(s.substring(i * 2, i * 2 + 2), 16);
        }
        return out;
    }

    @Override
    public void onBackPressed() {
        if (capaCara != null && capaCara.getVisibility() == View.VISIBLE) {
            terminarCara(false, "");
            return;
        }
        if (web != null && web.canGoBack()) {
            web.goBack();
            return;
        }
        super.onBackPressed();
    }
}
