import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Building2, Mail, Phone, MapPin, User } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-muted-foreground">Administra la información de tu empresa y preferencias</p>
      </div>

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
                <Input placeholder="76.123.456-7" defaultValue="76.123.456-7" />
              </div>
              <div>
                <label className="text-sm font-medium">Nombre / Razón Social</label>
                <Input placeholder="Empresa SpA" defaultValue="Empresa de Prueba SpA" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Giro</label>
              <Input placeholder="Actividad económica" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Dirección</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Av. Principal 123" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Comuna</label>
                <Input placeholder="Santiago" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Teléfono</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="+56 2 1234 5678" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="contacto@empresa.cl" />
                </div>
              </div>
            </div>
            <Button disabled>Guardar cambios</Button>
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
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="CONTADO">Contado</option>
                <option value="CREDITO">Crédito</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Tipo de documento por defecto</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="33">33 - Factura Electrónica</option>
                <option value="39">39 - Boleta Electrónica</option>
                <option value="61">61 - Nota de Crédito</option>
              </select>
            </div>
            <Button disabled>Guardar preferencias</Button>
          </CardContent>
        </Card>

        {/* Certificates */}
        <Card>
          <CardHeader>
            <CardTitle>Certificado digital</CardTitle>
            <CardDescription>Gestiona tu certificado para firma de DTE</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Arrastra tu certificado .pfx aquí o haz click para seleccionar
              </p>
              <Button variant="outline" size="sm" disabled>
                Seleccionar archivo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Tu certificado se almacena cifrado con AES-256. La clave de cifrado se gestiona de forma segura.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
