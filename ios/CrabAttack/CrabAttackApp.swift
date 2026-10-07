import StoreKit
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
        // Tell the game it can sell the full game, and let it ask the store to buy, restore or report status.
        config.userContentController.addUserScript(WKUserScript(source: "window.crabStore={available:true}", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController.add(context.coordinator, name: "store")

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
        context.coordinator.store.webView = webView
        context.coordinator.load(webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        let store = Store()

        func load(_ webView: WKWebView) {
            guard let page = Bundle.main.url(forResource: "index", withExtension: "html") else {
                print("CrabAttack: index.html is missing from the app bundle")
                return
            }
            webView.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
        }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "store" else { return print("CrabAttack: \(message.body)") }
            switch message.body as? String {
            case "buy": Task { await store.buy() }
            case "restore": Task { await store.restore() }
            default: Task { await store.refresh() }
            }
        }

        // Each time the page (re)loads, tell it whether the full game is unlocked and what it costs.
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            Task { await store.refresh() }
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

/// The one in-app purchase: a non-consumable that unlocks rounds 4–8. Create it in App Store Connect with this product ID.
private let fullGameID = "com.saucyfinn.CrabAttack.fullgame"

/// Buys, restores and checks the full-game purchase with StoreKit 2, and reports the result to the page through
/// `storeChanged({unlocked, price, message})`. The App Store is the record of the purchase, so nothing is saved locally.
@MainActor
final class Store {
    weak var webView: WKWebView?
    private var product: Product?
    private var unlocked = false
    private var updates: Task<Void, Never>?

    // The store lives as long as the app, so the listener is never cancelled.
    init() {
        // Purchases can also complete outside the app (Ask to Buy, a purchase on another device, a refund).
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let transaction) = result { await transaction.finish() }
                await self?.refresh()
            }
        }
    }

    func refresh() async {
        await loadProduct()
        var owned = false
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result, transaction.productID == fullGameID, transaction.revocationDate == nil {
                owned = true
            }
        }
        unlocked = owned
        report(nil)
    }

    func buy() async {
        await loadProduct()
        guard let product else { return report("The App Store isn't available right now. Please try again later.") }
        do {
            switch try await product.purchase() {
            case .success(let result):
                if case .verified(let transaction) = result { await transaction.finish() }
                await refresh()
            case .pending:
                report("Your purchase is waiting for approval.")
            case .userCancelled:
                report(nil)
            @unknown default:
                report(nil)
            }
        } catch {
            report("The purchase didn't go through: \(error.localizedDescription)")
        }
    }

    func restore() async {
        do {
            try await AppStore.sync()
        } catch {
            return report("Couldn't restore: \(error.localizedDescription)")
        }
        await refresh()
        if !unlocked { report("No full-game purchase was found for this Apple Account.") }
    }

    private func loadProduct() async {
        if product == nil { product = try? await Product.products(for: [fullGameID]).first }
    }

    private func report(_ message: String?) {
        var state: [String: Any] = ["unlocked": unlocked, "price": product?.displayPrice ?? ""]
        if let message { state["message"] = message }
        guard let data = try? JSONSerialization.data(withJSONObject: state),
              let json = String(data: data, encoding: .utf8) else { return }
        webView?.evaluateJavaScript("window.storeChanged&&storeChanged(\(json))")
    }
}
