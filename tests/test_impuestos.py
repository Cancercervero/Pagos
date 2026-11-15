from app.db import ahora_iso, transaccion
from app.departamentos.impuestos import estimar, texto_estimacion
from app.departamentos.libro import resumen


def _cargar():
    with transaccion() as conn:
        conn.execute(
            "INSERT INTO movimientos (tipo, monto_centavos, concepto, con_factura, fecha) VALUES ('ingreso', 11600, 'venta', 0, ?)",
            (ahora_iso(),),
        )
        conn.execute(
            "INSERT INTO movimientos (tipo, monto_centavos, concepto, con_factura, fecha) VALUES ('gasto', 1160, 'insumo', 1, ?)",
            (ahora_iso(),),
        )


def test_iva_e_isr_resico():
    _cargar()
    datos = estimar("mes")
    assert datos["iva_trasladado_centavos"] == 1600
    assert datos["iva_acreditable_centavos"] == 160
    assert datos["iva_neto_centavos"] == 1440
    assert datos["isr_centavos"] == 100
    assert datos["tasa_isr"] == 0.01
    texto = texto_estimacion(datos)
    assert "Estimación informativa" in texto
    assert "contador" in texto


def test_resumen_del_mes():
    _cargar()
    datos = resumen("mes")
    assert datos["cobrado_centavos"] == 11600
    assert datos["gastos_centavos"] == 1160
    assert datos["utilidad_centavos"] == 10440
