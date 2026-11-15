# Grabación del recorrido simulado · 2026-11-15 09:38

Recorrido generado contra el servidor local. El banco es simulado; ningún pago real se hizo.

| Quién | Qué se pidió | Qué respondió Anillo |
|---|---|---|
| Cliente | quiero comprar una cita para el peluquero | Cotización COT-20261115-0002 ⏎ • Corte de cabello x1 — $2.00 ⏎ Subtotal $2.00 ⏎ IVA $0.32 ⏎ Total $2.32 ⏎ Cobro de esta etapa: $0.01. ⏎ Si te late, dime "va" y te paso horarios. |
| Cliente | va | Horarios libres: ⏎ 1) 16/11 10:00 ⏎ 2) 16/11 11:00 ⏎ 3) 16/11 12:00 ⏎ Dime cuál quieres, por ejemplo "el de las 5". |
| Cliente | el de las 5 | Aparté 2026-11-18T17:00 para COT-20261115-0002. ⏎ Tu banco muestra un cobro de $0.01. En esta mesa lo confirmas con Face ID, al lado. ⏎ Confírmalo en tu app bancaria. Si pide Face ID o huella, es tu banco. En cuanto el pago quede confirmado, la cita entra a tu agenda. |
| Banco (simulado) | Cobro 7 pendiente de autorizar. Trámite falso de Face ID. |  |
| Banco (simulado) | Autorizado. El aviso se aplica una sola vez. | ✅ Recibimos tu pago de $0.01. Tu cita del 2026-11-18T17:00 ya está en tu agenda. La autorización fue en tu banca; si pidió Face ID o huella, fue ahí.; 💰 Adrián Soto pagó $0.01 (anticipo COT-20261115-0002) Apartado para el SAT, estimación: IVA $0.00, ISR $0.00. Puedes usar $0.01. Estimación informativa, no sustituye a tu contador ni al SAT. |
| Banco (simulado) | Mismo aviso otra vez | Rechazado (409): Ese cobro ya no está pendiente. |
| Dueño | existencias | Almacén: ⏎ • Guantes: 6 ⏎ • Papel aluminio: 2 · hay que surtir ⏎ • Papel de baño: 5 ⏎ • tinte: 15 ⏎   lote $80.00 × 9 ⏎   lote $80.00 × 6 |
| Dueño | factura tinte 6 piezas a 80 | Entré 6 de tinte en un lote nuevo a $80.00 por pieza. Quedan 21. El lote anterior no cambia de precio. |
| Dueño | existencias | Almacén: ⏎ • Guantes: 6 ⏎ • Papel aluminio: 2 · hay que surtir ⏎ • Papel de baño: 5 ⏎ • tinte: 21 ⏎   lote $80.00 × 9 ⏎   lote $80.00 × 6 ⏎   lote $80.00 × 6 |

## Estado al terminar

- Mes: cobrado $5.24, por cobrar $17.96, utilidad $5.24
- Citas: 2026-11-07T17:00:00 (confirmada), 2026-11-14T17:00 (confirmada), 2026-11-16T17:00 (confirmada), 2026-11-17T17:00 (confirmada), 2026-11-18T17:00 (confirmada)
