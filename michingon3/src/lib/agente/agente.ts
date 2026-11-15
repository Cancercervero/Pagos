// Agente de WhatsApp NUEVO (la IA Genkit de Michingón no se usa).
// Reglas duras (INSTRUCCIONES §9): el LLM no marca pagos ni calcula montos; los montos
// salen de Firestore y solo el webhook/servidor confirma pagos. El rol se valida en cada tool.
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb, negocioId } from '../server/firebase-admin';
import { crearCobro, fmt } from '../server/pagos';
import { enviarTexto, esDueno, esStaff } from '../whatsapp';
import { chat, llmDisponible, Mensaje } from './llm';

type Rol = 'dueno' | 'staff' | 'cliente';
const db = () => adminDb();
const col = (n: string) => db().collection(`businesses/${negocioId()}/${n}`);
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

async function productos() {
    const s = await col('products').get();
    return s.docs.map((d) => ({ ref: d.ref, docId: d.id, ...(d.data() as any) })) as any[];
}

function buscar(lista: any[], texto: string) {
    const t = norm(texto);
    return (
        lista.find((p) => norm(p.name) === t) ||
        lista.find((p) => norm(p.name).includes(t)) ||
        lista.find((p) => t.split(/\s+/).every((w) => norm(p.name).includes(w))) ||
        null
    );
}

// ───────────────────────── Herramientas ─────────────────────────

type Tool = { roles: Rol[]; def: { name: string; description: string; parameters: any }; run: (a: any, ctx: Ctx) => Promise<unknown> };
interface Ctx { tel10: string; rol: Rol; nombre?: string }

const TOOLS: Tool[] = [
    {
        roles: ['cliente', 'staff', 'dueno'],
        def: { name: 'ver_productos', description: 'Lista productos disponibles con precio. Opcional: buscar texto.', parameters: { type: 'object', properties: { buscar: { type: 'string' } } } },
        run: async (a, ctx) => {
            let l = (await productos()).filter((p) => Number(p.stock) > 0);
            if (a?.buscar) l = l.filter((p) => norm(p.name).includes(norm(a.buscar)) || norm(p.category || '').includes(norm(a.buscar)));
            return l.slice(0, 25).map((p) => ({ nombre: p.name, precio: p.price, categoria: p.category, ...(ctx.rol !== 'cliente' ? { stock: p.stock } : { disponible: true }) }));
        },
    },
    {
        roles: ['cliente', 'dueno'],
        def: {
            name: 'crear_pedido',
            description: 'Crea un pedido para recoger. El total lo calcula el sistema con los precios del inventario.',
            parameters: {
                type: 'object',
                required: ['items'],
                properties: {
                    items: { type: 'array', items: { type: 'object', required: ['producto', 'cantidad'], properties: { producto: { type: 'string' }, cantidad: { type: 'number' } } } },
                    fecha: { type: 'string', description: 'YYYY-MM-DD para recoger (opcional)' },
                    hora: { type: 'string', description: 'HH:MM (opcional)' },
                    nombre: { type: 'string', description: 'Nombre del cliente (opcional)' },
                },
            },
        },
        run: async (a, ctx) => {
            const lista = await productos();
            const items: any[] = [];
            const faltan: string[] = [];
            for (const it of a?.items || []) {
                const p = buscar(lista, String(it.producto || ''));
                const q = Math.max(1, Math.floor(Number(it.cantidad) || 1));
                if (!p) { faltan.push(String(it.producto)); continue; }
                if (Number(p.stock) < q) { faltan.push(`${p.name} (solo hay ${p.stock})`); continue; }
                items.push({ productId: p.id || p.docId, productName: p.name, quantity: q, price: Number(p.price) });
            }
            if (!items.length) return { error: 'No encontré esos productos con existencia', faltan };
            const fecha = a?.fecha ? new Date(`${a.fecha}T${a.hora || '12:00'}:00-06:00`) : new Date(Date.now() + 24 * 3600 * 1000);
            const ref = col('orders').doc();
            const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
            await ref.set({
                id: ref.id,
                clientName: a?.nombre || ctx.nombre || `WhatsApp ${ctx.tel10.slice(-4)}`,
                telefono10: ctx.tel10,
                deliveryDate: Timestamp.fromDate(fecha),
                deliveryTime: a?.hora || '',
                items: items.map((i) => ({ productId: i.productId, productName: i.productName, quantity: i.quantity })),
                itemsPrecio: items,
                total,
                status: 'pending',
                canal: 'whatsapp',
                notes: 'Pedido por WhatsApp',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            return { orderId: ref.id, total: fmt(Math.round(total * 100)), items: items.map((i) => `${i.quantity} × ${i.productName}`), faltan };
        },
    },
    {
        roles: ['cliente', 'dueno'],
        def: { name: 'cobrar_pedido', description: 'Envía el cobro CoDi del pedido a la app bancaria del cliente (push). Úsalo cuando el cliente confirme el pedido.', parameters: { type: 'object', required: ['orderId'], properties: { orderId: { type: 'string' } } } },
        run: async (a, ctx) => {
            const snap = await col('orders').doc(String(a.orderId)).get();
            const o = snap.data();
            if (!o) return { error: 'Pedido no encontrado' };
            if (ctx.rol === 'cliente' && o.telefono10 !== ctx.tel10) return { error: 'Ese pedido no es tuyo' };
            if (o.pagado) return { ok: true, mensaje: 'Ese pedido ya está pagado' };
            const c = await crearCobro({ tipo: 'pedido', metodo: 'push', items: o.itemsPrecio, telefono10: o.telefono10, orderId: snap.id, concepto: `Pedido ${snap.id.slice(0, 6)}` });
            await snap.ref.update({ cobroId: c.cobroId, updatedAt: Timestamp.now() });
            return { ok: true, monto: fmt(c.montoCentavos), montoDemo: c.montoDemo ? fmt(c.montoCobradoCentavos) : null, expiraMin: 6, mensaje: 'Cobro enviado a la app bancaria del cliente' };
        },
    },
    {
        roles: ['cliente', 'dueno'],
        def: { name: 'estado_pedido', description: 'Estado de los pedidos recientes del cliente.', parameters: { type: 'object', properties: {} } },
        run: async (_a, ctx) => {
            const s = await col('orders').where('telefono10', '==', ctx.tel10).limit(10).get();
            return s.docs
                .map((d) => d.data())
                .sort((x, y) => (y.createdAt?.toMillis?.() ?? 0) - (x.createdAt?.toMillis?.() ?? 0))
                .slice(0, 3)
                .map((o) => ({ orderId: o.id, estado: o.status, pagado: !!o.pagado, total: o.total, items: (o.items || []).map((i: any) => `${i.quantity} × ${i.productName}`) }));
        },
    },
    {
        roles: ['dueno'],
        def: { name: 'ordenes_compra', description: 'Órdenes de compra a proveedores pendientes de aprobar.', parameters: { type: 'object', properties: {} } },
        run: async () => (await col('purchaseOrders').where('estado', '==', 'pendiente').get()).docs.map((d) => d.data()),
    },
    {
        roles: ['dueno'],
        def: { name: 'aprobar_orden', description: 'Aprueba una orden de compra y la envía al proveedor por WhatsApp.', parameters: { type: 'object', properties: { ordenId: { type: 'string' } } } },
        run: async (a) => aprobarOrden(a?.ordenId),
    },
    {
        roles: ['dueno'],
        def: { name: 'resumen_del_dia', description: 'Ventas de hoy, cobros CoDi, cobros pendientes, stock bajo y valor del inventario.', parameters: { type: 'object', properties: {} } },
        run: async () => {
            const inicio = new Date();
            inicio.setHours(0, 0, 0, 0);
            const ventas = (await col('sales').where('createdAt', '>=', Timestamp.fromDate(inicio)).get()).docs.map((d) => d.data());
            const lista = await productos();
            const bajo = lista.filter((p) => Number(p.minStock) > 0 && Number(p.stock) <= Number(p.minStock)).map((p) => `${p.name} (${p.stock})`);
            const pendientes = (await col('cobros').where('estado', '==', 'pendiente').get()).size;
            const valor = lista.reduce((s, p) => s + Math.max(0, Number(p.stock || 0)) * Number(p.cost || 0), 0);
            const total = ventas.reduce((s, v) => s + Number(v.total || 0), 0);
            return {
                ventasHoy: ventas.length,
                totalHoy: fmt(Math.round(total * 100)),
                ventasCodi: ventas.filter((v) => v.paymentMethod === 'codi').length,
                cobrosPendientes: pendientes,
                stockBajo: bajo,
                valorInventarioCosto: fmt(Math.round(valor * 100)),
                ivaEstimado: fmt(Math.round((total / 1.16) * 0.16 * 100)) + ' (estimación informativa)',
            };
        },
    },
    {
        roles: ['dueno', 'staff'],
        def: { name: 'consultar_stock', description: 'Existencia de un producto (sin costos).', parameters: { type: 'object', required: ['producto'], properties: { producto: { type: 'string' } } } },
        run: async (a) => {
            const p = buscar(await productos(), String(a.producto || ''));
            return p ? { producto: p.name, stock: p.stock, minimo: p.minStock ?? null } : { error: 'No encontré ese producto' };
        },
    },
    {
        roles: ['dueno', 'staff'],
        def: { name: 'registrar_uso', description: 'Registra salida de insumo por uso interno (staff).', parameters: { type: 'object', required: ['producto', 'cantidad'], properties: { producto: { type: 'string' }, cantidad: { type: 'number' } } } },
        run: async (a, ctx) => {
            const p = buscar(await productos(), String(a.producto || ''));
            if (!p) return { error: 'No encontré ese producto' };
            const q = Math.max(0, Number(a.cantidad) || 0);
            await p.ref.update({ stock: FieldValue.increment(-q), updatedAt: Timestamp.now() });
            await col('eventos').add({ tipo: 'uso_insumo', texto: `🧴 ${q} × ${p.name} usado (staff ${ctx.tel10.slice(-4)})`, creadoEn: Timestamp.now() });
            return { ok: true, producto: p.name, quedan: Number(p.stock) - q };
        },
    },
];

export async function aprobarOrden(ordenId?: string) {
    let ref;
    if (ordenId) ref = col('purchaseOrders').doc(String(ordenId));
    else {
        const s = await col('purchaseOrders').where('estado', '==', 'pendiente').limit(2).get();
        if (s.size !== 1) return { error: s.empty ? 'No hay órdenes pendientes' : 'Hay varias órdenes pendientes; dime cuál' };
        ref = s.docs[0].ref;
    }
    const snap = await ref.get();
    const o = snap.data();
    if (!o || o.estado !== 'pendiente') return { error: 'Esa orden no está pendiente' };
    const proveedorTel = process.env.SUPPLIER_PHONE || '';
    const texto = `🧾 *Orden de compra ${snap.id}*\n${o.cantidad} × ${o.productName}\nCosto estimado: ${fmt(Math.round(Number(o.totalEstimado || 0) * 100))}\n¿Nos confirma disponibilidad y fecha de entrega?`;
    const enviado = proveedorTel ? await enviarTexto(proveedorTel, texto) : false;
    await ref.update({ estado: 'enviada', enviadaEn: Timestamp.now(), enviadaPorWhatsApp: enviado });
    await col('eventos').add({ tipo: 'orden_enviada', texto: `📤 Orden ${o.cantidad} × ${o.productName} enviada al proveedor${enviado ? '' : ' (sin WhatsApp de proveedor configurado)'}`, creadoEn: Timestamp.now() });
    return { ok: true, orden: snap.id, producto: o.productName, cantidad: o.cantidad, enviadoAlProveedor: enviado };
}

// ───────────────────────── Bucle del agente ─────────────────────────

function sistema(rol: Rol) {
    const base = `Eres el asistente de WhatsApp de un negocio en México que usa Michingón. Hablas español de México, breve, cálido y profesional, con pocos emojis.
Reglas: NUNCA digas que algo está pagado si no lo confirma el sistema; NUNCA calcules precios ni totales tú: usa las herramientas. Si el cliente confirma un pedido, usa cobrar_pedido para mandarle el cobro CoDi a su banco y explícale que lo autorice en su app bancaria (tiene 6 minutos). Un pago no prueba identidad ni entrega.`;
    if (rol === 'dueno') return `${base}\nHablas con el DUEÑO: puede ver finanzas, órdenes de compra, inventario y aprobar compras. Los impuestos son estimación informativa.`;
    if (rol === 'staff') return `${base}\nHablas con STAFF: solo consulta stock y registra uso de insumos. Nunca le muestres costos, márgenes ni finanzas.`;
    return `${base}\nHablas con un CLIENTE: ayúdale a ver productos, hacer su pedido y pagarlo. No muestres existencias exactas ni costos.`;
}

async function historial(tel10: string): Promise<Mensaje[]> {
    const s = await col(`conversaciones/${tel10}/mensajes`).orderBy('creadoEn', 'desc').limit(10).get();
    return s.docs.reverse().map((d) => ({ role: d.data().rol, content: d.data().texto })) as Mensaje[];
}

async function guardar(tel10: string, rol: 'user' | 'assistant', texto: string) {
    await col(`conversaciones/${tel10}/mensajes`).add({ rol, texto: texto.slice(0, 4000), creadoEn: Timestamp.now() });
}

export async function responder(tel10: string, texto: string, nombre?: string): Promise<string> {
    const rol: Rol = esDueno(tel10) ? 'dueno' : esStaff(tel10) ? 'staff' : 'cliente';
    const ctx: Ctx = { tel10, rol, nombre };

    // Atajo determinista: el dueño responde "sí" a la alerta de stock bajo
    if (rol === 'dueno' && /^\s*s[ií]\b/i.test(texto)) {
        const r: any = await aprobarOrden();
        if (r.ok) return `✅ Listo. Orden enviada al proveedor: ${r.cantidad} × ${r.producto}.${r.enviadoAlProveedor ? '' : ' (Configura SUPPLIER_PHONE para enviarla por WhatsApp.)'}`;
    }

    if (!llmDisponible()) {
        return 'Hola 👋 Soy el asistente del negocio. Escríbeme qué producto buscas y te ayudo con tu pedido. (Asistente sin IA configurada.)';
    }

    const tools = TOOLS.filter((t) => t.roles.includes(rol));
    const mensajes: any[] = [{ role: 'system', content: sistema(rol) }, ...(await historial(tel10)), { role: 'user', content: texto }];
    await guardar(tel10, 'user', texto);

    for (let vuelta = 0; vuelta < 5; vuelta++) {
        const base = process.env.LLM_BASE_URL!.replace(/\/$/, '');
        const res = await fetch(`${base}/chat/completions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.LLM_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: process.env.LLM_MODEL, messages: mensajes, tools: tools.map((t) => ({ type: 'function', function: t.def })), temperature: 0.2 }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            console.error('[agente] LLM error', res.status, JSON.stringify(data).slice(0, 300));
            break;
        }
        const msg = data?.choices?.[0]?.message;
        const llamadas = msg?.tool_calls || [];
        if (!llamadas.length) {
            const respuesta = String(msg?.content || '').trim() || 'Perdón, ¿me lo repites?';
            await guardar(tel10, 'assistant', respuesta);
            return respuesta;
        }
        mensajes.push({ role: 'assistant', content: msg.content ?? '', tool_calls: llamadas });
        for (const call of llamadas) {
            const tool = tools.find((t) => t.def.name === call.function?.name);
            let salida: unknown;
            try {
                const args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
                salida = tool ? await tool.run(args, ctx) : { error: 'Herramienta no permitida' };
            } catch (e) {
                salida = { error: (e as Error).message };
            }
            mensajes.push({ role: 'tool', tool_call_id: call.id, name: call.function?.name, content: JSON.stringify(salida).slice(0, 6000) });
        }
    }
    const fallback = 'Tuve un problema para responder. Intenta de nuevo en un momento 🙏';
    await guardar(tel10, 'assistant', fallback);
    return fallback;
}

export async function responderYEnviar(waId: string, tel10: string, texto: string, nombre?: string) {
    const respuesta = await responder(tel10, texto, nombre);
    await enviarTexto(waId, respuesta);
    return respuesta;
}
