import crypto from "node:crypto";
import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";
import { adminDb, demoBusinessId } from "@/lib/server/firebase-admin";
import { obtenerTransaccion, PeyError, type TransaccionPey } from "@/lib/pey";
import type { SaleItem } from "@/types/business";

export function verificarFirmaPey(
  secret: string,
  headers: Headers,
  rawBody: string,
  toleranciaS = 300
): boolean {
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const firmas = headers.get("webhook-signature");
  if (!id || !ts || !firmas) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > toleranciaS) return false;
  const llave = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const esperado = crypto.createHmac("sha256", llave).update(`${id}.${ts}.${rawBody}`).digest("base64");
  return firmas.split(" ").some((f) => {
    const [version, valor] = f.split(",");
    return (
      version === "v1" &&
      !!valor &&
      valor.length === esperado.length &&
      crypto.timingSafeEqual(Buffer.from(valor), Buffer.from(esperado))
    );
  });
}

export type EventoPey = {
  type?: string;
  transactionId?: string;
  amount?: number;
  concept?: string;
  datePaid?: string | number;
  numRef?: string;
  apiKeyId?: string;
  bankAccountId?: string;
  metadata?: Record<string, unknown>;
  codiQrId?: string;
};

export type MensajePendiente = { para: "dueno" | "cliente" | "proveedor"; texto: string };

export type ResultadoWebhook = {
  http: number;
  duplicado?: boolean;
  sinConciliar?: boolean;
  mensajes?: MensajePendiente[];
};

type CobroDoc = {
  tipo?: string;
  metodo?: string;
  montoCentavos?: number;
  concepto?: string;
  estado?: string;
  clienteId?: string;
  orderId?: string;
  saleDraft?: { products?: SaleItem[]; total?: number; clientId?: string };
  peyTransactionId?: string;
};

function centavos(pesos: number): number {
  return Math.round(pesos * 100);
}

function metaString(meta: unknown, key: string): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const o = meta as Record<string, unknown>;
  const directo = o[key];
  if (typeof directo === "string" && directo) return directo;
  const ext = o.externalMetadata;
  if (ext && typeof ext === "object") {
    const v = (ext as Record<string, unknown>)[key];
    if (typeof v === "string" && v) return v;
  }
  return undefined;
}

function yaExiste(error: unknown): boolean {
  const code = (error as { code?: number | string })?.code;
  const message = error instanceof Error ? error.message : "";
  return (
    code === 6 ||
    code === "already-exists" ||
    code === "ALREADY_EXISTS" ||
    message.includes("ALREADY_EXISTS") ||
    message.includes("already exists")
  );
}

async function localizarCobro(
  db: Firestore,
  evento: EventoPey,
  txn: TransaccionPey
): Promise<{ bid: string; ref: DocumentReference } | null> {
  const metas = [evento.metadata, txn.metadata];
  const cobroId = metas.map((m) => metaString(m, "cobro_id") || metaString(m, "cobroId")).find(Boolean);
  const businessMeta = metas.map((m) => metaString(m, "businessId")).find(Boolean);
  const bids = [...new Set([businessMeta, demoBusinessId()].filter((x): x is string => !!x))];

  for (const bid of bids) {
    const col = db.collection(`businesses/${bid}/cobros`);
    if (cobroId) {
      const ref = col.doc(cobroId);
      const snap = await ref.get();
      if (snap.exists) return { bid, ref };
    }
    if (txn.id) {
      const q = await col.where("peyTransactionId", "==", txn.id).limit(1).get();
      if (!q.empty) return { bid, ref: q.docs[0].ref };
    }
    const qrId = evento.codiQrId || (txn.payableType === "API_CODI_QR" ? txn.payableId : undefined);
    if (qrId) {
      const q = await col.where("peyQrId", "==", qrId).limit(1).get();
      if (!q.empty) return { bid, ref: q.docs[0].ref };
    }
    if (txn.payableType === "PAYMENT_LINK" && txn.payableId) {
      const q = await col.where("peyLinkId", "==", txn.payableId).limit(1).get();
      if (!q.empty) return { bid, ref: q.docs[0].ref };
    }
  }
  return null;
}

async function refProducto(db: Firestore, tx: Transaction, bid: string, productId: string) {
  const directo = db.doc(`businesses/${bid}/products/${productId}`);
  const snap = await tx.get(directo);
  if (snap.exists) return { ref: directo, data: snap.data() || {} };
  const q = db.collection(`businesses/${bid}/products`).where("id", "==", productId).limit(1);
  const found = await tx.get(q);
  if (found.empty) return null;
  return { ref: found.docs[0].ref, data: found.docs[0].data() };
}

export async function procesarEventoPey(evento: EventoPey, webhookId: string): Promise<ResultadoWebhook> {
  if (!evento.transactionId) return { http: 200 };
  const db = adminDb();

  let txn: TransaccionPey;
  try {
    txn = await obtenerTransaccion(evento.transactionId);
  } catch (error) {
    if (error instanceof PeyError && error.status === 404) return { http: 200 };
    return { http: 503 };
  }
  if (txn.status !== "PAID") return { http: 503 };

  const base = txn.amountBreakdown?.base;
  const confirmado = typeof base === "number" ? centavos(base) : centavos(txn.amount);
  const donde = await localizarCobro(db, evento, txn);
  const mensajes: MensajePendiente[] = [];

  try {
    await db.runTransaction(async (tx) => {
      const cobroSnap = donde ? await tx.get(donde.ref) : null;
      const cobro = (cobroSnap?.data() || null) as CobroDoc | null;
      const montoOk = !cobro || cobro.montoCentavos === confirmado;
      const eventoOk =
        typeof evento.amount !== "number" ||
        centavos(evento.amount) === confirmado ||
        centavos(evento.amount) === centavos(txn.amount);
      const aplica = !!(cobro && montoOk && eventoOk);
      const yaPagado = cobro?.estado === "pagado" && cobro.peyTransactionId && cobro.peyTransactionId !== txn.id;
      const tardio = cobro?.estado === "expirado";

      const bid = donde?.bid || demoBusinessId();
      const productos = aplica && !yaPagado ? await leerProductos(db, tx, bid, cobro!) : [];
      const orderRef = aplica && cobro?.orderId ? db.doc(`businesses/${bid}/orders/${cobro.orderId}`) : null;
      const orderSnap = orderRef ? await tx.get(orderRef) : null;
      const clientId = cobro?.saleDraft?.clientId || cobro?.clienteId;
      const clientRef = aplica && clientId ? db.doc(`businesses/${bid}/clients/${clientId}`) : null;
      const clientSnap = clientRef ? await tx.get(clientRef) : null;

      tx.create(db.collection("webhookEventos").doc(webhookId), {
        recibidoEn: FieldValue.serverTimestamp(),
      });
      tx.create(db.doc(`businesses/${bid}/pagos/${txn.id}`), {
        cobroId: aplica ? donde!.ref.id : null,
        montoCentavos: confirmado,
        tipoEvento: evento.type || "",
        payload: evento,
        recibidoEn: FieldValue.serverTimestamp(),
      });

      if (!aplica || yaPagado || !donde) return;

      const saleItems = itemsDeCobro(cobro!, orderSnap?.data(), productos);
      const saleRef = db.collection(`businesses/${bid}/sales`).doc();
      const totalPesos = confirmado / 100;

      if (cobro!.tipo !== "anticipo") {
        tx.set(saleRef, {
          id: saleRef.id,
          products: saleItems,
          ...(clientId ? { clientId } : {}),
          total: totalPesos,
          paymentMethod: "codi",
          status: "completed",
          createdAt: FieldValue.serverTimestamp(),
        });
        if (clientRef && clientSnap?.exists) {
          tx.update(clientRef, { totalPurchases: FieldValue.increment(totalPesos) });
        }
      }

      const bajos: { productId: string; cantidad: number; costoUnit: number }[] = [];
      if (cobro!.tipo !== "anticipo") {
        const cantidades = new Map<string, number>();
        for (const item of saleItems) {
          cantidades.set(item.productId, (cantidades.get(item.productId) || 0) + item.quantity);
        }
        for (const [productId, cantidad] of cantidades) {
          const encontrado = productos.find((p) => p.productId === productId);
          if (!encontrado) continue;
          const nuevo = Number(encontrado.data.stock || 0) - cantidad;
          tx.update(encontrado.ref, {
            stock: FieldValue.increment(-cantidad),
            updatedAt: FieldValue.serverTimestamp(),
          });
          if (typeof encontrado.data.minStock === "number" && nuevo < encontrado.data.minStock) {
            bajos.push({
              productId,
              cantidad,
              costoUnit: Number(encontrado.data.cost || 0),
            });
          }
        }
      }

      if (bajos.length) {
        const po = db.collection(`businesses/${bid}/purchaseOrders`).doc();
        tx.set(po, {
          supplierId: "",
          items: bajos,
          estado: "pendiente",
        });
        mensajes.push({
          para: "dueno",
          texto: "¿Mando el pedido al proveedor?",
        });
      }

      tx.update(donde.ref, {
        estado: "pagado",
        pagadoEn: FieldValue.serverTimestamp(),
        peyTransactionId: txn.id,
        pagoTardio: !!tardio,
      });

      if (orderRef && orderSnap?.exists) {
        if (cobro!.tipo === "pedido") {
          tx.update(orderRef, { status: "preparing", updatedAt: FieldValue.serverTimestamp() });
          mensajes.push({ para: "cliente", texto: "✅ Pagado, tu pedido está en preparación" });
          mensajes.push({ para: "dueno", texto: `💰 Pagado ${cobro!.concepto || ""}`.trim() });
        } else if (cobro!.tipo === "anticipo") {
          tx.update(orderRef, { confirmada: true, updatedAt: FieldValue.serverTimestamp() });
          mensajes.push({ para: "cliente", texto: "✅ Recibimos tu anticipo. Tu cita quedó confirmada." });
          mensajes.push({ para: "dueno", texto: `💰 Anticipo pagado ${cobro!.concepto || ""}`.trim() });
        }
      }
    });
  } catch (error) {
    if (yaExiste(error)) return { http: 200, duplicado: true };
    throw error;
  }

  return {
    http: 200,
    sinConciliar: !donde,
    mensajes,
  };
}

async function leerProductos(
  db: Firestore,
  tx: Transaction,
  bid: string,
  cobro: CobroDoc
) {
  const ids = (cobro.saleDraft?.products || []).map((p) => p.productId);
  const unicos = [...new Set(ids)];
  const out: { productId: string; ref: DocumentReference; data: DocumentData }[] = [];
  for (const productId of unicos) {
    const encontrado = await refProducto(db, tx, bid, productId);
    if (encontrado) out.push({ productId, ...encontrado });
  }
  return out;
}

function itemsDeCobro(
  cobro: CobroDoc,
  order: DocumentData | undefined,
  productos: { productId: string; data: DocumentData }[]
): SaleItem[] {
  const draft = cobro.saleDraft?.products || [];
  if (draft.length) return draft;
  const items = (order?.items || []) as { productId: string; productName?: string; quantity: number }[];
  return items.map((item) => {
    const prod = productos.find((p) => p.productId === item.productId);
    const price = Number(prod?.data.price || 0);
    const quantity = Number(item.quantity || 0);
    return {
      productId: item.productId,
      productName: item.productName || String(prod?.data.name || ""),
      quantity,
      price,
      subtotal: price * quantity,
    };
  });
}
