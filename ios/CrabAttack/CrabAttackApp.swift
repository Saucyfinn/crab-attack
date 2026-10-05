import SwiftUI
import WebKit

private let sea = UIColor(red: 16 / 255, green: 44 / 255, blue: 56 / 255, alpha: 1)

@main
struct CrabAttackApp: App {
    var body: some Scene {
        WindowGroup {
            GameView()
                .ignoresSafeArea()
                .background(Color(sea))
                .statusBarHidden()
                .persistentSystemOverlays(.hidden)
        }
    }
}

/// Shows the bundled web game full-screen. The page handles its own touch input, sound and saved progress.
struct GameView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        // Keep long-press callouts and text selection from interrupting towel swipes.
        let noSelect = "document.documentElement.style.webkitUserSelect='none';document.documentElement.style.webkitTouchCallout='none';"
        config.userContentController.addUserScript(WKUserScript(source: noSelect, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        // Forward page errors to the Xcode console so a blank screen can be diagnosed.
        let reportErrors = "addEventListener('error',e=>webkit.messageHandlers.log.postMessage('JS error: '+e.message+' at '+e.lineno+':'+e.colno));webkit.messageHandlers.log.postMessage('page loaded: '+document.title)"
        config.userContentController.addUserScript(WKUserScript(source: reportErrors, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController.add(context.coordinator, name: "log")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = sea
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsLinkPreview = false
        #if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true } // Safari > Develop menu on the Mac
        #endif
        context.coordinator.load(webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        func load(_ webView: WKWebView) {
            guard let page = Bundle.main.url(forResource: "index", withExtension: "html") else {
                print("CrabAttack: index.html is missing from the app bundle")
                return
            }
            webView.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
        }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            print("CrabAttack: \(message.body)")
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            print("CrabAttack: load failed: \(error)")
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            print("CrabAttack: load failed: \(error)")
        }

        // iOS can kill the web content process (e.g. under memory pressure), which leaves a blank view; reload instead.
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            print("CrabAttack: web content process ended; reloading")
            load(webView)
        }
    }
}
