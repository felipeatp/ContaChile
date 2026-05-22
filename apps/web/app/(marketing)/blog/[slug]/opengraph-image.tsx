import { ImageResponse } from "next/og"
import { getPostBySlug } from "@/lib/blog"

export const runtime = "edge"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export async function generateImageMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  return [{ alt: post?.title ?? "ContaChile Blog", id: slug }]
}

export default async function BlogOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  const title = post?.title ?? "ContaChile Blog"
  const category = post?.category ?? "Blog"
  const readTime = post?.readTime ?? 5
  const date = post?.date
    ? new Date(post.date).toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric" })
    : ""

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
        {/* Blue top bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "6px", background: "#2563eb", display: "flex" }} />

        {/* Logo + Blog label */}
        <div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "auto" }}>
          <div style={{
            width: "44px", height: "44px",
            border: "2px solid #1a1a1a",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "20px", fontWeight: 900, color: "#1a1a1a",
          }}>
            C
          </div>
          <span style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>
            ContaChile
          </span>
          <span style={{ fontSize: "14px", color: "#6b7280", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Blog
          </span>
        </div>

        {/* Post metadata */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
            <span style={{
              background: "#2563eb",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "4px 12px",
              display: "flex",
            }}>
              {category}
            </span>
            <span style={{ fontSize: "13px", color: "#6b7280", fontFamily: "monospace" }}>
              {readTime} min · {date}
            </span>
          </div>

          {/* Title */}
          <div style={{
            fontSize: title.length > 60 ? "44px" : "52px",
            fontWeight: 700,
            color: "#1a1a1a",
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            maxWidth: "900px",
          }}>
            {title}
          </div>
        </div>

        {/* Decorative pilcrow */}
        <div style={{
          position: "absolute", right: "60px", bottom: "40px",
          fontSize: "280px", fontWeight: 900, color: "#2563eb",
          opacity: 0.04, lineHeight: 1,
        }}>
          ¶
        </div>
      </div>
    ),
    { ...size }
  )
}
