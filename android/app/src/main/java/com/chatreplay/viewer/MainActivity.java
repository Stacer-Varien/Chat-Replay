package com.chatreplay.viewer;

import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativePrintPlugin.class);
        super.onCreate(savedInstanceState);

        View webViewContainer = (View) getBridge().getWebView().getParent();
        ViewCompat.setOnApplyWindowInsetsListener(webViewContainer, (view, windowInsets) -> {
            int systemBarsAndCutout =
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
            Insets systemInsets = windowInsets.getInsets(systemBarsAndCutout);
            Insets keyboardInsets = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            boolean keyboardVisible = windowInsets.isVisible(WindowInsetsCompat.Type.ime());

            view.setPadding(
                systemInsets.left,
                systemInsets.top,
                systemInsets.right,
                keyboardVisible ? keyboardInsets.bottom : systemInsets.bottom
            );

            return new WindowInsetsCompat.Builder(windowInsets)
                .setInsets(systemBarsAndCutout, Insets.of(0, 0, 0, 0))
                .build();
        });
        ViewCompat.requestApplyInsets(webViewContainer);
    }
}
