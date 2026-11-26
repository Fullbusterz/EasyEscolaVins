import Foundation
import Capacitor

/// Trae la ruta del portal de Escolà sin marcador: abre el portal dentro de la app (con la sesión guardada,
/// así que se entra una sola vez) y, al pulsar «Traer mi ruta», lee la ruta con las mismas dos consultas que
/// la pantalla «Repartos de entrega». La lectura la manda la web (`reader`, ver js/portal.js), para que el
/// formato de la ruta viva en un solo sitio.
///
/// Desde la web: `Capacitor.Plugins.Portal.open({ url, reader })` → `{ text }` con la ruta, o `{ cancelled: true }`.
@objc(PortalPlugin)
public class PortalPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PortalPlugin"
    public let jsName = "Portal"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]

    @objc func open(_ call: CAPPluginCall) {
        guard let reader = call.getString("reader"), !reader.isEmpty else {
            call.reject("Falta el lector de la ruta")
            return
        }
        let address = call.getString("url") ?? "https://portal.escoladist.com/Repartos/Index"
        // Solo el portal de Escolà: el lector corre con la sesión del repartidor.
        guard let url = URL(string: address), url.scheme == "https",
              let host = url.host, host == "escoladist.com" || host.hasSuffix(".escoladist.com") else {
            call.reject("Esa no es la dirección del portal")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let presenter = self?.bridge?.viewController else {
                call.reject("No se puede abrir el portal ahora")
                return
            }
            let portal = PortalViewController(url: url, reader: reader) { text in
                if let text = text {
                    call.resolve(["text": text])
                } else {
                    call.resolve(["cancelled": true])
                }
            }
            let nav = UINavigationController(rootViewController: portal)
            nav.modalPresentationStyle = .fullScreen
            nav.overrideUserInterfaceStyle = .dark
            presenter.present(nav, animated: true)
        }
    }
}
