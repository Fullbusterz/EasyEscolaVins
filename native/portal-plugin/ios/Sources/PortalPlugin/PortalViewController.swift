import UIKit
import WebKit

/// La pantalla del portal: la web del portal arriba y, abajo, un botón grande «Traer mi ruta».
/// Todo el texto sigue el «Tamaño del texto» del iPhone.
final class PortalViewController: UIViewController, WKNavigationDelegate {
    private let startURL: URL
    private let reader: String
    private var done: ((String?) -> Void)?

    private var webView: WKWebView!
    private let panel = UIView()
    private let hint = UILabel()
    private let button = UIButton(type: .system)
    private let progress = UIProgressView(progressViewStyle: .bar)
    private var observation: NSKeyValueObservation?

    private let gold = UIColor(red: 0.894, green: 0.788, blue: 0.498, alpha: 1)
    private let ink = UIColor(red: 0.102, green: 0.078, blue: 0.020, alpha: 1)
    private let surface = UIColor(red: 0.075, green: 0.098, blue: 0.086, alpha: 1)

    init(url: URL, reader: String, done: @escaping (String?) -> Void) {
        self.startURL = url
        self.reader = reader
        self.done = done
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) no se usa") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Portal de Escolà"
        view.backgroundColor = surface
        navigationItem.leftBarButtonItem = UIBarButtonItem(title: "Cerrar", style: .plain, target: self, action: #selector(close))
        navigationItem.rightBarButtonItem = UIBarButtonItem(barButtonSystemItem: .refresh, target: self, action: #selector(reload))

        // La sesión del portal se guarda en el móvil (como en Safari): el usuario y la contraseña, una vez.
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)

        progress.translatesAutoresizingMaskIntoConstraints = false
        progress.progressTintColor = gold
        view.addSubview(progress)
        observation = webView.observe(\.estimatedProgress, options: [.new]) { [weak self] web, _ in
            self?.progress.progress = Float(web.estimatedProgress)
            self?.progress.isHidden = web.estimatedProgress >= 1
        }

        panel.backgroundColor = surface
        panel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(panel)

        hint.text = "Entra con tu usuario del portal (solo la primera vez) y pulsa «Traer mi ruta»."
        hint.numberOfLines = 0
        hint.textColor = UIColor(white: 0.85, alpha: 1)
        hint.font = UIFont.preferredFont(forTextStyle: .body)
        hint.adjustsFontForContentSizeCategory = true
        hint.translatesAutoresizingMaskIntoConstraints = false
        panel.addSubview(hint)

        var look = UIButton.Configuration.filled()
        look.title = "Traer mi ruta"
        look.baseBackgroundColor = gold
        look.baseForegroundColor = ink
        look.cornerStyle = .large
        look.contentInsets = NSDirectionalEdgeInsets(top: 18, leading: 20, bottom: 18, trailing: 20)
        look.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { attrs in
            var a = attrs
            let base = UIFont.preferredFont(forTextStyle: .title3)
            a.font = UIFont.systemFont(ofSize: base.pointSize, weight: .bold)
            return a
        }
        look.showsActivityIndicator = false
        button.configuration = look
        button.titleLabel?.adjustsFontForContentSizeCategory = true
        button.addTarget(self, action: #selector(bring), for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        panel.addSubview(button)

        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: safe.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: panel.topAnchor),

            progress.topAnchor.constraint(equalTo: safe.topAnchor),
            progress.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progress.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            panel.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            panel.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            panel.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            hint.topAnchor.constraint(equalTo: panel.topAnchor, constant: 12),
            hint.leadingAnchor.constraint(equalTo: panel.layoutMarginsGuide.leadingAnchor),
            hint.trailingAnchor.constraint(equalTo: panel.layoutMarginsGuide.trailingAnchor),

            button.topAnchor.constraint(equalTo: hint.bottomAnchor, constant: 12),
            button.leadingAnchor.constraint(equalTo: panel.layoutMarginsGuide.leadingAnchor),
            button.trailingAnchor.constraint(equalTo: panel.layoutMarginsGuide.trailingAnchor),
            button.bottomAnchor.constraint(equalTo: safe.bottomAnchor, constant: -12),
            button.heightAnchor.constraint(greaterThanOrEqualToConstant: 56)
        ])

        webView.load(URLRequest(url: startURL))
    }

    @objc private func close() { finish(nil) }

    @objc private func reload() { webView.reload() }

    private func setBusy(_ busy: Bool) {
        var look = button.configuration
        look?.showsActivityIndicator = busy
        look?.title = busy ? "Buscando tu ruta…" : "Traer mi ruta"
        button.configuration = look
        button.isEnabled = !busy
    }

    /// Lee las rutas pendientes con la sesión del portal. El lector devuelve un texto JSON:
    /// { routes: [{ fecha, paradas, text }] } o { error }.
    @objc private func bring() {
        setBusy(true)
        webView.callAsyncJavaScript(reader, arguments: [:], in: nil, in: .page) { [weak self] result in
            guard let self = self else { return }
            self.setBusy(false)
            switch result {
            case .success(let value):
                guard let json = value as? String,
                      let data = json.data(using: .utf8),
                      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    self.tell("No he podido leer la ruta. ¿Has entrado con tu usuario?")
                    return
                }
                if let error = object["error"] as? String {
                    self.tell(error)
                    return
                }
                let routes = (object["routes"] as? [[String: Any]]) ?? []
                if routes.isEmpty {
                    self.tell("Aún no hay ruta pendiente. La de mañana suele salir sobre las 17:30.")
                } else if routes.count == 1, let text = routes[0]["text"] as? String {
                    self.finish(text)
                } else {
                    self.choose(routes)
                }
            case .failure:
                self.tell("No he podido leer la ruta. ¿Has entrado con tu usuario del portal?")
            }
        }
    }

    private func choose(_ routes: [[String: Any]]) {
        let sheet = UIAlertController(title: "¿Qué ruta traigo?", message: nil, preferredStyle: .actionSheet)
        for route in routes {
            guard let text = route["text"] as? String else { continue }
            let fecha = route["fecha"] as? String ?? "?"
            let paradas = route["paradas"] as? Int ?? 0
            sheet.addAction(UIAlertAction(title: "Ruta del \(fecha) · \(paradas) paradas", style: .default) { [weak self] _ in
                self?.finish(text)
            })
        }
        sheet.addAction(UIAlertAction(title: "Cancelar", style: .cancel))
        sheet.popoverPresentationController?.sourceView = button
        sheet.popoverPresentationController?.sourceRect = button.bounds
        present(sheet, animated: true)
    }

    private func tell(_ message: String) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Vale", style: .default))
        present(alert, animated: true)
    }

    private func finish(_ text: String?) {
        let callback = done
        done = nil
        dismiss(animated: true) { callback?(text) }
    }

    // Enlaces que no son del portal (teléfonos, correos, otras webs): fuera de esta pantalla.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.cancel) }
        if url.scheme == "https" || url.scheme == "about" || url.scheme == "blob" {
            // Lo que el portal abriría en otra ventana se abre aquí mismo.
            if action.targetFrame == nil {
                webView.load(action.request)
                return decisionHandler(.cancel)
            }
            return decisionHandler(.allow)
        }
        UIApplication.shared.open(url)
        decisionHandler(.cancel)
    }

    deinit { observation?.invalidate() }
}
