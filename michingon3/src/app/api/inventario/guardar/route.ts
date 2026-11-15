import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb, negocioId, usuarioDesdeRequest } from '@/lib/server/firebase-admin';
import type { ArticuloImportado } from '@/lib/server/inventario-import';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clave = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const r2 = (n: number) => Math.round(n * 100) / 100;

// POST /api/inventario/guardar { articulos, proveedor?, folio? }
// Si el producto ya existe (mismo nombre) suma stock y promedia el costo; si no, lo crea.
export async function POST(req: NextRequest) {
    const usuario = await usuarioDesdeRequest(req);
    if (!usuario) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = (await req.json().catch(() => null)) as { articulos?: ArticuloImportado[]; proveedor?: string; folio?: string } | null;
    const articulos = (body?.articulos || []).filter((a) => a?.nombre && Number(a.cantidad) >= 0).slice(0, 1000);
    if (!articulos.length) return NextResponse.json({ error: 'No hay artículos para guardar' }, { status: 400 });

    const db = adminDb();
    const bid = negocioId();
    const productos = db.collection(`businesses/${bid}/products`);
    const existentes = await productos.get();
    const porNombre = new Map(existentes.docs.map((d) => [clave(String(d.data().name || '')), d]));
    const ahora = Timestamp.now();
    const proveedor = (body?.proveedor || 'Carga de inventario').slice(0, 120);

    let creados = 0;
    let actualizados = 0;
    const lote = db.batch();

    for (const a of articulos) {
        const cantidad = Math.max(0, Number(a.cantidad) || 0);
        const costo = r2(Number(a.costoUnitario) || 0);
        const batch = {
            id: `lote-${ahora.toMillis()}-${Math.random().toString(36).slice(2, 7)}`,
            provider: proveedor,
            invoice: body?.folio || null,
            date: ahora,
            quantity: cantidad,
            cost: costo,
            merma: 0,
        };
        const previo = porNombre.get(clave(a.nombre));
        if (previo) {
            const d = previo.data();
            const stockPrevio = Number(d.stock || 0);
            const costoPrevio = Number(d.cost || 0);
            const total = stockPrevio + cantidad;
            const costoProm = total > 0 ? r2((stockPrevio * costoPrevio + cantidad * costo) / total) : costo;
            lote.update(previo.ref, {
                stock: FieldValue.increment(cantidad),
                cost: costo > 0 ? costoProm : costoPrevio,
                ...(a.precioVenta > 0 && !a.precioSugerido ? { price: r2(a.precioVenta) } : {}),
                batches: FieldValue.arrayUnion(batch),
                updatedAt: ahora,
            });
            actualizados++;
        } else {
            const ref = productos.doc();
            lote.set(ref, {
                id: ref.id,
                name: a.nombre.trim(),
                description: a.claveSat ? `Clave SAT ${a.claveSat}` : '',
                price: r2(Number(a.precioVenta) || r2(costo * 1.4)),
                cost: costo,
                stock: cantidad,
                category: a.categoria || 'Sin categoría',
                unit: a.unidad || 'unit',
                minStock: Math.max(1, Math.round(cantidad * 0.25)),
                ...(a.claveSat ? { satKey: a.claveSat } : {}),
                batches: [batch],
                createdAt: ahora,
                updatedAt: ahora,
            });
            porNombre.set(clave(a.nombre), { ref, data: () => ({ name: a.nombre, stock: cantidad, cost: costo }) } as any);
            creados++;
        }
    }

    // Proveedor nuevo → a la ficha de proveedores
    if (body?.proveedor) {
        const provs = await db.collection(`businesses/${bid}/suppliers`).where('name', '==', proveedor).limit(1).get();
        if (provs.empty) {
            const ref = db.collection(`businesses/${bid}/suppliers`).doc();
            lote.set(ref, { id: ref.id, name: proveedor, category: 'General', contactPerson: '', phone: '', creditDays: 0, notes: 'Creado al cargar factura', createdAt: ahora, updatedAt: ahora });
        }
    }

    lote.set(db.collection(`businesses/${bid}/eventos`).doc(), {
        tipo: 'inventario_cargado',
        texto: `📦 Inventario cargado: ${creados} nuevos, ${actualizados} actualizados${body?.proveedor ? ` · ${proveedor}` : ''}`,
        creadoEn: ahora,
    });
    await lote.commit();

    // Valor total del inventario después de cargar (a costo y a precio de venta)
    const todos = await productos.get();
    let valorCosto = 0;
    let valorVenta = 0;
    todos.docs.forEach((d) => {
        const x = d.data();
        const s = Math.max(0, Number(x.stock || 0));
        valorCosto += s * Number(x.cost || 0);
        valorVenta += s * Number(x.price || 0);
    });

    return NextResponse.json({
        ok: true,
        creados,
        actualizados,
        inventario: { productos: todos.size, valorCosto: r2(valorCosto), valorVenta: r2(valorVenta) },
    });
}
