// Carga fácil de inventario: el dueño sube lo que tenga (Excel de su tienda, factura XML/PDF
// o foto de su lista/factura) y el sistema arma los artículos, los agrupa por categoría,
// pone costo, precio y stock, y calcula el valor del inventario.
import * as XLSX from 'xlsx';
import { chatJSON, llmDisponible } from '../agente/llm';

export interface ArticuloImportado {
    nombre: string;
    categoria: string;
    cantidad: number;
    unidad: 'unit' | 'kg' | 'liter';
    costoUnitario: number; // pesos, con el precio al que llegó
    precioVenta: number; // pesos
    precioSugerido: boolean; // true si lo calculamos con el margen
    claveSat?: string;
}

export interface ResultadoImport {
    fuente: 'excel' | 'xml' | 'pdf' | 'foto';
    proveedor?: string;
    folio?: string;
    articulos: ArticuloImportado[];
    avisos: string[];
}

const MARGEN = () => Number(process.env.MARGEN_SUGERIDO || 0.4);
const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => {
    const n = Number(String(v ?? '').replace(/[$,\s]/g, ''));
    return Number.isFinite(n) ? n : 0;
};

function unidad(u: unknown): ArticuloImportado['unidad'] {
    const s = String(u ?? '').toLowerCase();
    if (/(^|\b)(kg|kgm|kilo|kilogramo|gr|gramo)/.test(s)) return 'kg';
    if (/(^|\b)(l|lt|ltr|litro|ml|mililitro)/.test(s)) return 'liter';
    return 'unit';
}

function normalizar(a: Partial<ArticuloImportado> & { nombre: string }): ArticuloImportado {
    const costo = r2(num(a.costoUnitario));
    const venta = r2(num(a.precioVenta));
    return {
        nombre: String(a.nombre).trim().slice(0, 120),
        categoria: String(a.categoria || '').trim() || 'Sin categoría',
        cantidad: Math.max(0, num(a.cantidad) || 0),
        unidad: a.unidad ? unidad(a.unidad) : 'unit',
        costoUnitario: costo,
        precioVenta: venta > 0 ? venta : r2(costo * (1 + MARGEN())),
        precioSugerido: !(venta > 0),
        claveSat: a.claveSat,
    };
}

// ───────── Excel / CSV ─────────
const COLS: Record<keyof Omit<ArticuloImportado, 'precioSugerido' | 'claveSat'>, RegExp> = {
    nombre: /(producto|art[ií]culo|descripci[oó]n|nombre|concepto|item)/i,
    categoria: /(categor[ií]a|grupo|familia|departamento|l[ií]nea|tipo)/i,
    cantidad: /(cantidad|existencia|stock|piezas|inventario|qty|unidades disponibles)/i,
    unidad: /(unidad|u\.?m\.?|medida)/i,
    costoUnitario: /(costo|precio (de )?compra|p\.?\s?compra|valor unitario|precio unitario)/i,
    precioVenta: /(precio( de)? venta|p\.?\s?venta|pvp|precio p[uú]blico|^precio$)/i,
};

export function leerExcel(buf: Buffer): { filas: unknown[][]; articulos: ArticuloImportado[] | null } {
    const wb = XLSX.read(buf, { type: 'buffer' });
    const hoja = wb.Sheets[wb.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, blankrows: false, defval: '' });
    // Busca la fila de encabezados en las primeras 10
    for (let h = 0; h < Math.min(10, filas.length); h++) {
        const enc = (filas[h] || []).map((c) => String(c));
        const idx: Partial<Record<keyof typeof COLS, number>> = {};
        (Object.keys(COLS) as (keyof typeof COLS)[]).forEach((k) => {
            const i = enc.findIndex((c, j) => COLS[k].test(c) && !Object.values(idx).includes(j));
            if (i >= 0) idx[k] = i;
        });
        if (idx.nombre !== undefined && (idx.cantidad !== undefined || idx.costoUnitario !== undefined || idx.precioVenta !== undefined)) {
            const articulos = filas
                .slice(h + 1)
                .filter((f) => String(f[idx.nombre!] ?? '').trim())
                .map((f) =>
                    normalizar({
                        nombre: String(f[idx.nombre!]),
                        categoria: idx.categoria !== undefined ? String(f[idx.categoria]) : '',
                        cantidad: idx.cantidad !== undefined ? num(f[idx.cantidad]) : 0,
                        unidad: idx.unidad !== undefined ? unidad(f[idx.unidad]) : 'unit',
                        costoUnitario: idx.costoUnitario !== undefined ? num(f[idx.costoUnitario]) : 0,
                        precioVenta: idx.precioVenta !== undefined ? num(f[idx.precioVenta]) : 0,
                    }),
                );
            return { filas, articulos };
        }
    }
    return { filas, articulos: null }; // encabezados raros → que lo lea el LLM
}

// ───────── Factura CFDI (XML) ─────────
function attr(tag: string, nombre: string): string | undefined {
    const m = tag.match(new RegExp(`\\b${nombre}="([^"]*)"`, 'i'));
    return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>') : undefined;
}

export function leerCfdi(xml: string): ResultadoImport {
    const emisor = xml.match(/<(?:\w+:)?Emisor\b[^>]*>/i)?.[0] || '';
    const comp = xml.match(/<(?:\w+:)?Comprobante\b[^>]*>/i)?.[0] || '';
    const conceptos = xml.match(/<(?:\w+:)?Concepto\b[^>]*>/gi) || [];
    const articulos = conceptos.map((c) => {
        const cantidad = num(attr(c, 'Cantidad'));
        const valorUnit = num(attr(c, 'ValorUnitario'));
        const descuento = num(attr(c, 'Descuento'));
        const costo = cantidad > 0 ? valorUnit - descuento / cantidad : valorUnit;
        return normalizar({
            nombre: attr(c, 'Descripcion') || 'Artículo',
            cantidad,
            unidad: unidad(attr(c, 'Unidad') || attr(c, 'ClaveUnidad')),
            costoUnitario: costo,
            precioVenta: 0,
            claveSat: attr(c, 'ClaveProdServ'),
        });
    });
    return {
        fuente: 'xml',
        proveedor: attr(emisor, 'Nombre') || attr(emisor, 'Rfc'),
        folio: [attr(comp, 'Serie'), attr(comp, 'Folio')].filter(Boolean).join('') || undefined,
        articulos,
        avisos: conceptos.length ? [] : ['El XML no trae conceptos. ¿Es un CFDI de compra?'],
    };
}

// ───────── PDF / Foto / Excel raro → LLM ─────────
const SISTEMA_EXTRACCION = `Eres el almacenista de un negocio pequeño en México. Te dan una factura de proveedor, una lista de inventario o una foto de una lista escrita a mano.
Extrae CADA artículo con: nombre (claro y corto), categoria (agrupa en familias útiles para el negocio, p. ej. "Tintes", "Shampoos", "Abarrotes", "Bebidas", "Limpieza"), cantidad (número), unidad ("unit", "kg" o "liter"), costoUnitario (precio unitario al que llegó, sin IVA si se distingue; 0 si no aparece), precioVenta (0 si no aparece).
Si es factura, devuelve también proveedor y folio. No inventes artículos ni cantidades; si no se lee, omítelo y anótalo en avisos.
Formato: {"proveedor": string|null, "folio": string|null, "articulos": [{"nombre","categoria","cantidad","unidad","costoUnitario","precioVenta"}], "avisos": [string]}`;

async function extraerConLLM(fuente: ResultadoImport['fuente'], texto: string, imagenes: string[] = []): Promise<ResultadoImport> {
    if (!llmDisponible()) {
        return { fuente, articulos: [], avisos: ['Para leer fotos o PDF hay que configurar el LLM (LLM_BASE_URL, LLM_API_KEY, LLM_MODEL).'] };
    }
    const r = await chatJSON<{ proveedor?: string; folio?: string; articulos?: any[]; avisos?: string[] }>(SISTEMA_EXTRACCION, texto, imagenes);
    return {
        fuente,
        proveedor: r.proveedor || undefined,
        folio: r.folio || undefined,
        articulos: (r.articulos || []).filter((a) => a?.nombre).map((a) => normalizar(a)),
        avisos: r.avisos || [],
    };
}

/** Agrupa en categorías los artículos que llegaron sin categoría (Excel/XML). */
async function clasificar(articulos: ArticuloImportado[]): Promise<void> {
    const sin = articulos.filter((a) => a.categoria === 'Sin categoría');
    if (!sin.length || !llmDisponible()) return;
    try {
        const r = await chatJSON<{ categorias: Record<string, string> }>(
            'Clasifica productos de un negocio pequeño mexicano en familias útiles y consistentes (pocas categorías, en español, con mayúscula inicial).',
            `Productos:\n${sin.map((a, i) => `${i}. ${a.nombre}`).join('\n')}\nDevuelve {"categorias": {"<índice>": "<Categoría>"}}`,
        );
        sin.forEach((a, i) => {
            const c = r.categorias?.[String(i)];
            if (c) a.categoria = String(c).trim();
        });
    } catch (e) {
        console.warn('[import] clasificación falló', e);
    }
}

export async function extraerInventario(nombreArchivo: string, mime: string, buf: Buffer): Promise<ResultadoImport> {
    const ext = nombreArchivo.toLowerCase().split('.').pop() || '';
    let res: ResultadoImport;

    if (['xlsx', 'xls', 'csv', 'ods'].includes(ext)) {
        const { filas, articulos } = leerExcel(buf);
        if (articulos?.length) res = { fuente: 'excel', articulos, avisos: [] };
        else {
            const csv = filas.slice(0, 150).map((f) => f.join(' | ')).join('\n');
            res = await extraerConLLM('excel', `Lista de inventario (tabla):\n${csv}`);
        }
    } else if (ext === 'xml' || mime.includes('xml')) {
        res = leerCfdi(buf.toString('utf8'));
    } else if (ext === 'pdf' || mime === 'application/pdf') {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: new Uint8Array(buf) });
        try {
            const { text } = await parser.getText();
            res = await extraerConLLM('pdf', `Factura o lista en PDF (texto extraído):\n${String(text).slice(0, 15000)}`);
        } finally {
            await parser.destroy().catch(() => undefined);
        }
    } else if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)) {
        const dataUrl = `data:${mime || 'image/jpeg'};base64,${buf.toString('base64')}`;
        res = await extraerConLLM('foto', 'Lee esta imagen (lista de inventario o factura) y extrae los artículos.', [dataUrl]);
    } else {
        throw new Error('Formato no soportado. Sube Excel/CSV, factura XML o PDF, o una foto.');
    }

    await clasificar(res.articulos);
    return res;
}

export function resumen(articulos: ArticuloImportado[]) {
    const porCategoria = new Map<string, { categoria: string; productos: number; piezas: number; valorCosto: number; valorVenta: number }>();
    for (const a of articulos) {
        const c = porCategoria.get(a.categoria) || { categoria: a.categoria, productos: 0, piezas: 0, valorCosto: 0, valorVenta: 0 };
        c.productos += 1;
        c.piezas += a.cantidad;
        c.valorCosto += a.cantidad * a.costoUnitario;
        c.valorVenta += a.cantidad * a.precioVenta;
        porCategoria.set(a.categoria, c);
    }
    const cats = Array.from(porCategoria.values()).map((c) => ({ ...c, valorCosto: r2(c.valorCosto), valorVenta: r2(c.valorVenta) }));
    return {
        productos: articulos.length,
        piezas: r2(articulos.reduce((s, a) => s + a.cantidad, 0)),
        valorCosto: r2(cats.reduce((s, c) => s + c.valorCosto, 0)),
        valorVenta: r2(cats.reduce((s, c) => s + c.valorVenta, 0)),
        porCategoria: cats.sort((a, b) => b.valorCosto - a.valorCosto),
    };
}
