"""Portada del prototipo. Le dice al jurado qué es, qué es real y por dónde entrar."""

from html import escape


def portada_html(negocio: str, llave: str) -> str:
    q = f"?k={escape(llave)}" if llave else ""
    aviso = (
        ""
        if llave
        else '<p class="aviso">Abre esta página con la llave del equipo al final del enlace (<code>?k=…</code>) para entrar a las tres puertas.</p>'
    )
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Anillo · tu agente bancario</title>
<link rel="stylesheet" href="/marca/tokens.css">
<style>
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; font-family: Georgia, 'Times New Roman', serif; background: #fff7ec; color: #241c22; }}
  .tira {{ height: 14px; background: repeating-linear-gradient(90deg, #d4145a 0 28px, #f6b93b 28px 56px, #17a398 56px 84px, #7b2d8e 84px 112px, #f26419 112px 140px); }}
  main {{ max-width: 980px; margin: 0 auto; padding: 36px 20px 56px; }}
  h1 {{ font-size: clamp(40px, 7vw, 64px); margin: 0 0 6px; letter-spacing: -1px; }}
  .lema {{ font-size: 20px; margin: 0 0 22px; max-width: 46ch; }}
  .lema b {{ color: #d4145a; }}
  .puertas {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 14px; margin: 22px 0; }}
  a.puerta {{ display: block; text-decoration: none; color: inherit; background: #fffdf8; border: 1px solid #f1d9a8; border-radius: 22px; padding: 20px; transition: transform .12s, box-shadow .12s; }}
  a.puerta:hover {{ transform: translateY(-2px); box-shadow: 0 10px 24px rgba(92, 51, 24, .12); }}
  .puerta .sello {{ display: inline-block; font: 600 12px/1 system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: #fff; border-radius: 999px; padding: 6px 10px; margin-bottom: 10px; }}
  .uno .sello {{ background: #d4145a; }} .dos .sello {{ background: #17a398; }} .tres .sello {{ background: #7b2d8e; }}
  .puerta h2 {{ margin: 0 0 6px; font-size: 24px; }}
  .puerta p {{ margin: 0; font: 15px/1.45 system-ui, sans-serif; color: #4a3d45; }}
  .puerta .ir {{ display: inline-block; margin-top: 12px; font: 700 15px system-ui, sans-serif; color: #d4145a; }}
  h3 {{ font-size: 22px; margin: 30px 0 8px; }}
  ol, ul {{ font: 16px/1.55 system-ui, sans-serif; color: #33282f; padding-left: 22px; margin: 0; }}
  li {{ margin: 4px 0; }}
  .dos-col {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; }}
  .caja {{ background: #fffdf8; border: 1px solid #f1d9a8; border-radius: 18px; padding: 16px 18px; }}
  .caja h4 {{ margin: 0 0 6px; font-size: 17px; }}
  .aviso {{ background: #fff0c9; border: 1px solid #f6b93b; border-radius: 12px; padding: 10px 14px; font: 15px system-ui, sans-serif; }}
  footer {{ margin-top: 34px; font: 13px system-ui, sans-serif; color: #7a6b73; }}
  code {{ background: #f6ead3; padding: 1px 5px; border-radius: 5px; }}
</style>
</head>
<body>
<div class="tira"></div>
<main>
  <h1>Anillo</h1>
  <p class="lema">Tu <b>agente bancario</b> en el chat. Atiende, cotiza, agenda y cobra con <b>CoDi</b>. Cuando el banco confirma, el negocio se mueve solo: cita, venta, inventario, compra al proveedor y cuentas.</p>
  <p style="font:15px system-ui,sans-serif;color:#4a3d45;margin:0">Negocio de la demo: <b>{escape(negocio)}</b> · Cursor Hackatón México · pagos con la API de pey</p>
  {aviso}

  <div class="puertas">
    <a class="puerta uno" href="/simulacion{q}">
      <span class="sello">Empieza aquí · 2 minutos</span>
      <h2>La mesa</h2>
      <p>El recorrido completo en una pantalla: el cliente pide por chat, llega el cobro, el banco confirma y ves moverse la agenda, el almacén y el libro. El banco aquí es <b>simulado y lo dice</b>.</p>
      <span class="ir">Abrir la mesa →</span>
    </a>
    <a class="puerta dos" href="/panel{q}">
      <span class="sello">Pago real · $0.01</span>
      <h2>El mostrador</h2>
      <p>Genera un <b>QR CoDi real</b> con pey por un centavo. Págalo desde tu app bancaria y la pantalla cambia sola cuando el banco confirma.</p>
      <span class="ir">Abrir el mostrador →</span>
    </a>
    <a class="puerta tres" href="/app{q}">
      <span class="sello">La app</span>
      <h2>El teléfono</h2>
      <p>La app del dueño y del cliente: caja, inventario que se carga con el Excel, la factura o una foto, proveedores, agenda y gasto personal. Entra con cara, huella o correo.</p>
      <span class="ir">Abrir la app →</span>
    </a>
  </div>

  <h3>Qué ver en la mesa</h3>
  <ol>
    <li>Toca <b>Pedir corte</b>, luego <b>Ver horarios</b> y <b>El de las 5</b>: el agente cotiza, aparta la cita y manda el cobro del anticipo.</li>
    <li>Toca <b>Confirmar con Face ID</b>: es el banco avisando. La cita pasa a confirmada y el ingreso entra al libro, <b>una sola vez</b>.</li>
    <li>Toca otra vez <b>Confirmar</b>: no pasa nada. Un pago repetido no se aplica dos veces.</li>
    <li>Cambia a <b>Dueño</b> y toca <b>Cargar factura</b> y <b>Ver almacén</b>: cada entrada es un lote con su precio de llegada, y lo que llegó primero es lo que sale primero.</li>
    <li>Abajo se actualizan solos la <b>agenda</b>, el <b>almacén</b> y el <b>libro del negocio</b> (cobrado, por cobrar, lo que se aparta para el SAT).</li>
  </ol>

  <h3>Qué es real y qué es simulado</h3>
  <div class="dos-col">
    <div class="caja">
      <h4>Real</h4>
      <ul>
        <li>Cobros CoDi con pey: QR, aviso al banco y liga de pago.</li>
        <li>Confirmación del lado del servidor: aviso firmado y consulta a pey.</li>
        <li>Un pago repetido no se aplica dos veces.</li>
        <li>Pago tardío, de más, vencido y devolución tienen su regla.</li>
      </ul>
    </div>
    <div class="caja">
      <h4>Simulado, y se dice en pantalla</h4>
      <ul>
        <li>El banco de la mesa (para que el recorrido se vea sin gastar).</li>
        <li>El timbrado de la factura: es borrador, sin PAC ni CSD.</li>
        <li>Los impuestos: son una estimación, no una declaración.</li>
        <li>Las devoluciones: pey no reembolsa; el dueño transfiere y se anota.</li>
      </ul>
    </div>
  </div>

  <footer>Los pagos se confirman en el servidor. Un pago no prueba identidad ni entrega. · <a href="/privacidad">Privacidad</a></footer>
</main>
</body>
</html>"""
