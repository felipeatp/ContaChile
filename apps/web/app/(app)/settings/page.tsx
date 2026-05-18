"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Field } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Building2, Mail, Phone, MapPin, User, Loader2, FileKey, CheckCircle2 } from "lucide-react"

interface Company {
  id: string
  rut: string
  name: string
  giro: string | null
  address: string | null
  commune: string | null
  city: string | null
  economicActivity: string | null
  phone: string | null
  email: string | null
  defaultPaymentMethod: string
  defaultDocumentType: number
  siiCertified: boolean
  certEncrypted?: string | null
}

export default function SettingsPage() {
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [certLoading, setCertLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [certFile, setCertFile] = useState<File | null>(null)
  const [certPassword, setCertPassword] = useState("")

  useEffect(() => {
    fetch("/api/company")
      .then((res) => res.json())
      .then((data) => {
        setCompany(data)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
        setMessage("Error al cargar datos de la empresa")
      })
  }, [])

  const handleChange = (field: keyof Company, value: string | number) => {
    setCompany((prev) => (prev ? { ...prev, [field]: value } : null))
  }

  const handleSave = async () => {
    if (!company) return
    setSaving(true)
    setMessage(null)

    const res = await fetch("/api/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rut: company.rut,
        name: company.name,
        giro: company.giro,
        address: company.address,
        commune: company.commune,
        city: company.city,
        economicActivity: company.economicActivity,
        phone: company.phone,
        email: company.email,
        defaultPaymentMethod: company.defaultPaymentMethod,
        defaultDocumentType: company.defaultDocumentType,
      }),
    })

    if (res.ok) {
      const updated = await res.json()
      setCompany(updated)
      setMessage("Cambios guardados correctamente")
    } else {
      setMessage("Error al guardar los cambios")
    }
    setSaving(false)
  }

  const handleCertUpload = async () => {
    if (!certFile) return
    setCertLoading(true)
    setMessage(null)

    const reader = new FileReader()
    reader.readAsDataURL(certFile)
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1]
      const res = await fetch("/api/company/certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certBase64: base64, password: certPassword || undefined }),
      })

      if (res.ok) {
        setMessage("Certificado subido correctamente")
        setCertFile(null)
        setCertPassword("")
      } else {
        const err = await res.json().catch(() => ({}))
        setMessage(err.error || "Error al subir certificado")
      }
      setCertLoading(false)
    }
    reader.onerror = () => {
      setMessage("Error al leer el archivo")
      setCertLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const isError = message?.toLowerCase().includes("error")

  return (
    <div className="space-y-8 animate-fade-up">
      <section className="max-w-2xl">
        <div className="flex items-center gap-3 mb-3">
          <span className="eyebrow">Sistema · Configuración</span>
          <span className="h-px w-10 bg-foreground/20" />
          <span className="eyebrow text-muted-foreground/60">
            {company?.siiCertified ? "Certificado SII" : "Pre-certificación"}
          </span>
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
          Datos de tu{' '}
          <em className="text-primary not-italic font-medium">empresa</em>
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Información tributaria que aparece en los DTE, preferencias por defecto y certificado digital para firma XML.
        </p>
      </section>

      {message && (
        <div className={`rounded-sm border px-3 py-2 text-xs ${isError ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-sage/30 bg-sage/5 text-sage"}`}>
          {message}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <SectionCard
          eyebrow="I · Empresa"
          title="Información tributaria"
          description="Datos que aparecen en tus documentos electrónicos."
          icon={<Building2 className="h-5 w-5 text-muted-foreground/70" />}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="RUT">
              <Input
                placeholder="76.123.456-7"
                value={company?.rut ?? ""}
                onChange={(e) => handleChange("rut", e.target.value)}
              />
            </Field>
            <Field label="Razón social">
              <Input
                placeholder="Empresa SpA"
                value={company?.name ?? ""}
                onChange={(e) => handleChange("name", e.target.value)}
              />
            </Field>
            <Field label="Giro" className="col-span-2">
              <Input
                placeholder="Actividad económica"
                value={company?.giro ?? ""}
                onChange={(e) => handleChange("giro", e.target.value)}
              />
            </Field>
            <Field label="Dirección">
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <Input
                  className="pl-9"
                  placeholder="Av. Principal 123"
                  value={company?.address ?? ""}
                  onChange={(e) => handleChange("address", e.target.value)}
                />
              </div>
            </Field>
            <Field label="Comuna">
              <Input
                placeholder="Santiago"
                value={company?.commune ?? ""}
                onChange={(e) => handleChange("commune", e.target.value)}
              />
            </Field>
            <Field label="Ciudad">
              <Input
                placeholder="Santiago"
                value={company?.city ?? ""}
                onChange={(e) => handleChange("city", e.target.value)}
              />
            </Field>
            <Field label="Actividad económica" hint="Acteco">
              <Input
                placeholder="620200"
                value={company?.economicActivity ?? ""}
                onChange={(e) => handleChange("economicActivity", e.target.value)}
              />
            </Field>
            <Field label="Teléfono">
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <Input
                  className="pl-9"
                  placeholder="+56 2 1234 5678"
                  value={company?.phone ?? ""}
                  onChange={(e) => handleChange("phone", e.target.value)}
                />
              </div>
            </Field>
            <Field label="Email">
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <Input
                  className="pl-9"
                  placeholder="contacto@empresa.cl"
                  value={company?.email ?? ""}
                  onChange={(e) => handleChange("email", e.target.value)}
                />
              </div>
            </Field>
          </div>
          <div className="pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="II · Cuenta"
          title="Perfil de usuario"
          description="Configuración personal de tu sesión."
          icon={<User className="h-5 w-5 text-muted-foreground/70" />}
        >
          <div className="space-y-3">
            <Field label="Nombre">
              <Input placeholder="Tu nombre" disabled />
            </Field>
            <Field label="Email">
              <Input type="email" placeholder="tu@email.com" disabled />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            Pronto disponible. Mientras tanto, gestiona desde tu proveedor de identidad.
          </p>
        </SectionCard>

        <SectionCard
          eyebrow="III · DTE"
          title="Preferencias por defecto"
          description="Valores que se preseleccionan al emitir un nuevo documento."
        >
          <div className="space-y-3">
            <Field label="Método de pago por defecto">
              <Select
                value={company?.defaultPaymentMethod ?? "CONTADO"}
                onChange={(e) => handleChange("defaultPaymentMethod", e.target.value)}
              >
                <option value="CONTADO">Contado</option>
                <option value="CREDITO">Crédito</option>
              </Select>
            </Field>
            <Field label="Tipo de documento por defecto">
              <Select
                value={company?.defaultDocumentType ?? 33}
                onChange={(e) => handleChange("defaultDocumentType", Number(e.target.value))}
              >
                <option value={33}>33 — Factura electrónica</option>
                <option value={39}>39 — Boleta electrónica</option>
                <option value={61}>61 — Nota de crédito</option>
              </Select>
            </Field>
          </div>
          <div className="pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar preferencias
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="IV · Firma electrónica"
          title="Certificado digital"
          description="Tu .pfx/.p12 se almacena cifrado con AES-256."
          icon={<FileKey className="h-5 w-5 text-muted-foreground/70" />}
        >
          {company?.certEncrypted && (
            <div className="flex items-center gap-2 text-xs text-sage">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-medium">Certificado cargado</span>
            </div>
          )}

          <div className="space-y-3">
            <Field label="Archivo de certificado" hint=".pfx o .p12">
              <input
                type="file"
                accept=".pfx,.p12"
                onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-sm file:border-0 file:bg-foreground file:px-3 file:py-2 file:text-xs file:font-medium file:uppercase file:tracking-eyebrow file:text-background hover:file:bg-foreground/90"
              />
            </Field>
            <Field label="Contraseña del certificado" hint="opcional">
              <Input
                type="password"
                placeholder="••••••"
                value={certPassword}
                onChange={(e) => setCertPassword(e.target.value)}
              />
            </Field>
          </div>

          <div className="pt-2">
            <Button
              variant="outline"
              onClick={handleCertUpload}
              disabled={!certFile || certLoading}
            >
              {certLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Subir certificado
            </Button>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function SectionCard({
  eyebrow,
  title,
  description,
  icon,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <article className="card-editorial p-6 space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h3 className="font-display text-xl font-semibold tracking-tightest mt-1">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        {icon}
      </header>
      <div className="h-px bg-border/60" />
      <div className="space-y-4">{children}</div>
    </article>
  )
}
