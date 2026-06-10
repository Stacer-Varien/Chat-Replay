package com.chatreplay.viewer;

import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "NativePrint")
public class NativePrintPlugin extends Plugin {

    private final List<WebView> printWebViews = new ArrayList<>();

    @PluginMethod
    public void printHtml(PluginCall call) {
        String html = call.getString("html");
        String title = call.getString("title", "Chat Replay conversation");
        if (title == null) {
            title = "Chat Replay conversation";
        }
        
        if (html == null || html.isBlank()) {
            call.reject("No printable conversation was provided.");
            return;
        }

        final String finalTitle = title;
        getActivity().runOnUiThread(() -> {
            PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
            if (printManager == null) {
                call.reject("Android printing is not available on this device.");
                return;
            }

            WebView printWebView = new WebView(getContext());
            printWebViews.add(printWebView);
            printWebView.setWebViewClient(
                new WebViewClient() {
                    private boolean printStarted = false;

                    @Override
                    public void onPageFinished(WebView view, String url) {
                        if (printStarted) return;
                        printStarted = true;
                        PrintDocumentAdapter adapter = cleanupAfterPrint(
                            view,
                            view.createPrintDocumentAdapter(finalTitle)
                        );
                        printManager.print(finalTitle, adapter, new PrintAttributes.Builder().build());
                        call.resolve();
                    }
                }
            );
            printWebView.loadDataWithBaseURL("https://localhost/", html, "text/html", "UTF-8", null);
        });
    }

    private PrintDocumentAdapter cleanupAfterPrint(WebView printWebView, PrintDocumentAdapter delegate) {
        return new PrintDocumentAdapter() {
            @Override
            public void onStart() {
                delegate.onStart();
            }

            @Override
            public void onLayout(
                PrintAttributes oldAttributes,
                PrintAttributes newAttributes,
                CancellationSignal cancellationSignal,
                LayoutResultCallback callback,
                Bundle extras
            ) {
                delegate.onLayout(oldAttributes, newAttributes, cancellationSignal, callback, extras);
            }

            @Override
            public void onWrite(
                PageRange[] pages,
                ParcelFileDescriptor destination,
                CancellationSignal cancellationSignal,
                WriteResultCallback callback
            ) {
                delegate.onWrite(pages, destination, cancellationSignal, callback);
            }

            @Override
            public void onFinish() {
                delegate.onFinish();
                printWebViews.remove(printWebView);
                printWebView.destroy();
            }
        };
    }

    @Override
    protected void handleOnDestroy() {
        for (WebView printWebView : printWebViews) {
            printWebView.destroy();
        }
        printWebViews.clear();
        super.handleOnDestroy();
    }
}
