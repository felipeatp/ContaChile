"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Building2, Mail, Phone, MapPin, User, Loader2, FileKey } from "lucide-react"

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-muted-foreground">Administra la información de tu empresa y preferencias</p>
      </div>

      {message && (
        <div className={`rounded-lg px-4 py-2 text-sm ${message.includes("Error") ? "bg-destructive/10 text-destructive" : "bg-green-100 text-green-800"}`}>
          {message}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Company info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building2 className="mr-2 h-5 w-5" />
              Información de la empresa
            </CardTitle>
            <CardDescription>Datos que aparecen en tus documentos tributarios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">RUT</label>
                <Input
                  placeholder="76.123.456-7"
                  value={company?.rut ?? ""}
                  onChange={(e) => handleChange("rut", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Nombre / Razón Social</label>
                <Input
                  placeholder="Empresa SpA"
                  value={company?.name ?? ""}
                  onChange={(e) => handleChange("name", e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Giro</label>
              <Input
                placeholder="Actividad económica"
                value={company?.giro ?? ""}
                onChange={(e) => handleChange("giro", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Dirección</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Av. Principal 123"
                    value={company?.address ?? ""}
                    onChange={(e) => handleChange("address", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Comuna</label>
                <Input
                  placeholder="Santiago"
                  value={company?.commune ?? ""}
                  onChange={(e) => handleChange("commune", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Ciudad</label>
                <Input
                  placeholder="Santiago"
                  value={company?.city ?? ""}
                  onChange={(e) => handleChange("city", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Actividad Económica (Acteco)</label>
                <Input
                  placeholder="620200"
                  value={company?.economicActivity ?? ""}
                  onChange={(e) => handleChange("economicActivity", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Teléfono</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="+56 2 1234 5678"
                    value={company?.phone ?? ""}
                    onChange={(e) => handleChange("phone", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="contacto@empresa.cl"
                    value={company?.email ?? ""}
                    onChange={(e) => handleChange("email", e.target.value)}
                  />
                </div>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar cambios
            </Button>
          </CardContent>
        </Card>

        {/* User profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="mr-2 h-5 w-5" />
              Perfil de usuario
            </CardTitle>
            <CardDescription>Configuración de tu cuenta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input placeholder="Tu nombre" />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input type="email" placeholder="tu@email.com" />
            </div>
            <Button disabled>Actualizar perfil</Button>
          </CardContent>
        </Card>

        {/* DTE Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Preferencias de DTE</CardTitle>
            <CardDescription>Configuración por defecto para nuevos documentos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Método de pago por defecto</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={company?.defaultPaymentMethod ?? "CONTADO"}
                onChange={(e) => handleChange("defaultPaymentMethod", e.target.value)}
              >
                <option value="CONTADO">Contado</option>
                <option value="CREDITO">Crédito</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Tipo de documento por defecto</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={company?.defaultDocumentType ?? 33}
                onChange={(e) => handleChange("defaultDocumentType", Number(e.target.value))}
              >
                <option value={33}>33 - Factura Electrónica</option>
                <option value={39}>39 - Boleta Electrónica</option>
                <option value={61}>61 - Nota de Crédito</option>
              </select>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar preferencias
            </Button>
          </CardContent>
        </Card>

        {/* Certificates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileKey className="mr-2 h-5 w-5" />
              Certificado digital
            </CardTitle>
            <CardDescription>Gestiona tu certificado para firma de DTE</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <input
                type="file"
                accept=".pfx,.p12"
                onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              />
              <Input
                type="password"
                placeholder="Contraseña del certificado (opcional)"
                value={certPassword}
                onChange={(e) => setCertPassword(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={handleCertUpload}
                disabled={!certFile || certLoading}
              >
                {certLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Subir certificado
              </Button>
            </div>
            {company?.certEncrypted && (
              <p className="text-xs text-green-600">✓ Certificado cargado</p>
            )}
            <p className="text-xs text-muted-foreground">
              Tu certificado se almacena cifrado con AES-256. La clave de cifrado se gestiona de forma segura.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
