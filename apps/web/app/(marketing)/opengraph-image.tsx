import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "ContaChile — Facturación Electrónica para Chile"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#fafaf8",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "80px",
          fontFamily: "serif",
          position: "relative",
        }}
      >
        {/* Top border accent */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "6px", background: "#2563eb", display: "flex" }} />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "auto" }}>
          <div style={{
            width: "52px", height: "52px",
            border: "2px solid #1a1a1a",
            background: "#fafaf8",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "24px", fontWeight: 900, color: "#1a1a1a",
          }}>
            C
          </div>
          <span style={{ fontSize: "22px", fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>
            ContaChile
          </span>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
          <div style={{ fontSize: "14px", color: "#6b7280", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "16px" }}>
            Facturación Electrónica · SaaS Chileno
          </div>
          <div style={{ fontSize: "60px", fontWeight: 700, color: "#1a1a1a", lineHeight: 1, letterSpacing: "-0.03em", marginBottom: "24px" }}>
            Emite DTE al SII en menos de un segundo.
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            {["Boletas", "Facturas", "Notas de Crédito", "F29 Automático"].map((tag) => (
              <div key={tag} style={{
                padding: "6px 14px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                color: "#374151",
                display: "flex",
              }}>
                {tag}
              </div>
            ))}
          </div>
        </div>

        {/* Decorative pilcrow */}
        <div style={{
          position: "absolute", right: "60px", bottom: "40px",
          fontSize: "320px", fontWeight: 900, color: "#2563eb",
          opacity: 0.04, lineHeight: 1,
        }}>
          ¶
        </div>
      </div>
    ),
    { ...size }
  )
}
