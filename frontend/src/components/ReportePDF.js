// src/components/ReportePDF.js
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/** Carga /public/logo.png (u otra) y la devuelve como base64. */
async function getBase64FromUrl(url) {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("No se pudo leer el blob"));
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Genera un PDF con encabezado, gráfico (opcional), tabla y pie de página.
 */
export async function generarPDF({
  titulo = "REPORTE DE MONITOREO EÓLICO",
  usuario = "—",
  descripcion = "",
  tabla = [],
  head = [],
  graficoBase64 = null,
  logoUrl = "/logo.png",
  nombreArchivo = "reporte_monitor.pdf",
  orientacion = "p",
  formato = "a4",
} = {}) {
  const doc = new jsPDF({ orientation: orientacion, format: formato, unit: "mm" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 14;
  let cursorY = 16;

  // Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(titulo, marginLeft, cursorY);
  cursorY += 8;

  // Fecha + Usuario
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Generado: ${new Date().toLocaleString()}`, marginLeft, cursorY);
  cursorY += 6;
  doc.text(`Usuario: ${usuario}`, marginLeft, cursorY);
  cursorY += 8;

  // Descripción (envoltura)
  if (descripcion) {
    const maxWidth = pageWidth * 0.9 - marginLeft;
    const lineas = doc.splitTextToSize(descripcion, maxWidth);
    doc.text(lineas, marginLeft, cursorY);
    cursorY += 6 * lineas.length;
  }

  // Logo (opcional)
  try {
    const base64Logo = await getBase64FromUrl(logoUrl);
    if (base64Logo) {
      const logoW = 32, logoH = 16;
      doc.addImage(base64Logo, "PNG", pageWidth - logoW - 10, 10, logoW, logoH);
    }
  } catch {}

  // Imagen del gráfico (opcional)
  if (graficoBase64) {
    try {
      const gW = pageWidth - marginLeft * 2; // ancho máximo
      const gH = 70;                          // alto fijo agradable
      doc.addImage(graficoBase64, "PNG", marginLeft, cursorY, gW, gH);
      cursorY += gH + 6;
    } catch {}
  }

  // Tabla
  const tableHead = head && head.length ? [head] : undefined;
  autoTable(doc, {
    startY: cursorY,
    head: tableHead,
    body: Array.isArray(tabla) ? tabla : [],
    theme: "grid",
    headStyles: { fillColor: [40, 167, 69] }, // verde
    styles: { fontSize: 9, cellPadding: 2 },
    margin: { left: marginLeft, right: marginLeft, top: 10 },
    didDrawPage: () => {
      const str = `Página ${doc.internal.getNumberOfPages()}`;
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(str, pageWidth - marginLeft, pageHeight - 8, { align: "right" });
    },
  });

  // Firma
  const totalPages = doc.internal.getNumberOfPages();
  doc.setPage(totalPages);
  const yFin = doc.lastAutoTable?.finalY || cursorY;
  const firmaY = Math.min(yFin + 20, pageHeight - 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("______________________________", pageWidth - 80, firmaY);
  doc.text("Firma Responsable", pageWidth - 60, firmaY + 6);

  const file = nombreArchivo.endsWith(".pdf") ? nombreArchivo : `${nombreArchivo}.pdf`;
  doc.save(file);
}

/* Compatibilidad con tu firma anterior */
export async function generarPDFLegacy(
  usuario,
  datosTabla,
  descripcion = "",
  graficoBase64 = null,
  head = []
) {
  return generarPDF({
    usuario,
    tabla: datosTabla,
    descripcion,
    graficoBase64,
    head,
  });
}
