package com.chatreplay.viewer;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.Executor;

@CapacitorPlugin(name = "NativeAuth")
public class NativeAuthPlugin extends Plugin {

    @PluginMethod
    public void canUseBiometrics(PluginCall call) {
        int authenticators =
            BiometricManager.Authenticators.BIOMETRIC_STRONG |
            BiometricManager.Authenticators.DEVICE_CREDENTIAL;
        int result = BiometricManager.from(getContext()).canAuthenticate(authenticators);
        JSObject response = new JSObject();
        response.put("available", result == BiometricManager.BIOMETRIC_SUCCESS);
        call.resolve(response);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        String title = call.getString("title", "Unlock Chat Replay");
        String subtitle = call.getString("subtitle", "Use your device lock to open saved chats.");
        int authenticators =
            BiometricManager.Authenticators.BIOMETRIC_STRONG |
            BiometricManager.Authenticators.DEVICE_CREDENTIAL;

        getActivity().runOnUiThread(() -> {
            Executor executor = ContextCompat.getMainExecutor(getContext());
            FragmentActivity activity = (FragmentActivity) getActivity();
            BiometricPrompt prompt = new BiometricPrompt(
                activity,
                executor,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        JSObject response = new JSObject();
                        response.put("ok", true);
                        call.resolve(response);
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errString) {
                        call.reject(errString != null ? errString.toString() : "Authentication cancelled.");
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        // Keep the prompt open; Android will call onAuthenticationError if it ends.
                    }
                }
            );

            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)
                .setAllowedAuthenticators(authenticators)
                .build();
            prompt.authenticate(info);
        });
    }
}
