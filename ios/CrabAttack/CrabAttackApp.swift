import GameKit
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
        // The app is paid for up front, so every round is open.
        config.userContentController.addUserScript(WKUserScript(source: "window.crabFullGame=true", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        // Tell the game it can report scores and achievements to Game Center.
        config.userContentController.addUserScript(WKUserScript(source: "window.crabGameCenter={available:true}", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController.add(context.coordinator, name: "gameCenter")
        // Funnel events from the page (first open, round cleared) update the SKAdNetwork conversion value.
        config.userContentController.add(context.coordinator, name: "attribution")

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

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        let gameCenter = GameCenter()

        func load(_ webView: WKWebView) {
            guard let page = Bundle.main.url(forResource: "index", withExtension: "html") else {
                print("CrabAttack: index.html is missing from the app bundle")
                return
            }
            webView.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
        }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "gameCenter" { return gameCenter.handle(message.body) }
            if message.name == "attribution" { return Attribution.handle(message.body) }
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

/// Game Center IDs from App Store Connect → Game Center. The page sends achievement IDs without this prefix.
private let gameCenterPrefix = "com.saucyfinn.CrabAttack."
private let highScoreID = gameCenterPrefix + "highscore"

/// Signs the player in to Game Center, and passes on what the page sends to `webkit.messageHandlers.gameCenter`:
/// `{score, achievements}` at the end of each round and `{accessPoint}` as the start screen shows or hides.
@MainActor
final class GameCenter {
    private var earned = Set<String>()
    private var showAccessPoint = false

    init() {
        GKAccessPoint.shared.location = .bottomLeading
        GKLocalPlayer.local.authenticateHandler = { [weak self] viewController, error in
            if let viewController {
                let scene = UIApplication.shared.connectedScenes.first { $0.activationState == .foregroundActive } as? UIWindowScene
                scene?.keyWindow?.rootViewController?.present(viewController, animated: true)
            } else if let error {
                print("CrabAttack: Game Center sign-in failed: \(error.localizedDescription)")
            }
            guard let self else { return }
            GKAccessPoint.shared.isActive = showAccessPoint && GKLocalPlayer.local.isAuthenticated
        }
    }

    func handle(_ body: Any) {
        guard let message = body as? [String: Any] else { return }
        if let show = message["accessPoint"] as? Bool {
            showAccessPoint = show
            GKAccessPoint.shared.isActive = show && GKLocalPlayer.local.isAuthenticated
        }
        guard GKLocalPlayer.local.isAuthenticated else { return }
        if let score = message["score"] as? Int, score > 0 {
            Task {
                do {
                    try await GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [highScoreID])
                } catch {
                    print("CrabAttack: couldn't submit score: \(error.localizedDescription)")
                }
            }
        }
        // Each achievement is reported once per launch; Game Center keeps it earned after that.
        let new = ((message["achievements"] as? [String]) ?? []).filter { earned.insert($0).inserted }
        guard !new.isEmpty else { return }
        let achievements = new.map { id in
            let achievement = GKAchievement(identifier: gameCenterPrefix + id)
            achievement.percentComplete = 100
            achievement.showsCompletionBanner = true
            return achievement
        }
        Task {
            do {
                try await GKAchievement.report(achievements)
            } catch {
                earned.subtract(new)
                print("CrabAttack: couldn't report achievements: \(error.localizedDescription)")
            }
        }
    }
}

/// Install attribution for ads on Meta and Google: the ad networks are listed under SKAdNetworkItems in Info.plist, and
/// Apple sends their install postbacks (with a copy to the Worker, NSAdvertisingAttributionReportEndpoint) carrying the
/// conversion value set here. Values only rise: 1 opened, then 1 + n once round n is cleared (up to 40). The coarse value
/// is low once opened, medium after a round and high once the first beach (round 8) is cleared.
enum Attribution {
    private static let key = "attributionConversionValue"

    static func handle(_ body: Any) {
        guard let message = body as? [String: Any], let event = message["event"] as? String else { return }
        let value: Int
        let coarse: SKAdNetwork.CoarseConversionValue
        switch event {
        case "first_open": (value, coarse) = (1, .low)
        case "round_cleared":
            let round = (message["round"] as? Int) ?? 1
            (value, coarse) = (min(1 + round, 40), round >= 8 ? .high : .medium)
        default: return
        }
        guard value > UserDefaults.standard.integer(forKey: key) else { return }
        UserDefaults.standard.set(value, forKey: key)
        SKAdNetwork.updatePostbackConversionValue(value, coarseValue: coarse, lockWindow: false) { error in
            if let error { print("CrabAttack: couldn't update the conversion value: \(error.localizedDescription)") }
        }
    }
}
