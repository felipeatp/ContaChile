# Diseño: Vistas Separadas Empresa / Contador

> Fecha: 2026-05-19
> Estado: Diseño aprobado — pendiente de implementación post-Contabilidad General
> Decisión UX: Opción A (dos layouts distintos, mismo sistema de diseño con variantes de color)

---

## Contexto

ContaChile tiene dos usuarios principales con mental models completamente distintos:

| **Empresa (Dueño/Admin)** | **Contador Independiente** |
|---|---|
| Quiere operar: emitir, comprar, pagar, vender | Quiere cerrar: conciliar, ajustar, reportar, declarar |
| Ve dinero entrando y saliendo | Ve cuentas con saldos deudores/acreedores |
| Necesita cotizaciones, stock, remuneraciones | Necesstra libro diario, mayor, estados financieros |
| Invita a un contador para "que se encargue" | Maneja 10–30 empresas de clientes |

Mezclar ambas vistas en un solo sidebar genera ruido cognitivo. El contador no quiere ver "Emitir DTE"; la empresa no quiere ver "Balance de Comprobación".

---

## Principios de diseño

1. **Dos productos que comparten datos**, no un producto con permisos.
2. **Misma identidad visual, diferente personalidad**: el sistema de diseño (componentes, tipografía, spacing) es idéntico; la navegación, dashboards y flujos son distintos.
3. **Variante de color sutil**: Empresa usa el tema actual (primary verde/naranja). Contador usa una variante azul/gris sobria que transmite "oficina, precisión, confianza profesional". Se logra cambiando solo el `primary` token en el layout del contador.
4. **El contador no crea empresas**: las empresas lo invitan. Él acepta y accede.
5. **Un usuario puede tener ambos roles**: un dueño que hace su propia contabilidad, o un contador que también tiene su propia empresa. Se resuelve con un **selector de rol** post-login.

---

## Modelo de datos (ya implementado)

```prisma
model CompanyMembership {
  id        String   @id @default(cuid())
  userId    String
  companyId String
  role      String   @default("owner")  // OWNER | ADMIN | ACCOUNTANT | VIEWER
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([userId, companyId])
  @@index([companyId])
}
```

### Reglas de acceso

| Rol | Puede ver | Puede editar | Puede invitar |
|---|---|---|---|
| `OWNER` | Todo | Todo | Sí (todos los roles) |
| `ADMIN` | Todo | Todo | Sí (solo ACCOUNTANT, VIEWER) |
| `ACCOUNTANT` | Todo de la empresa | Asientos manuales, conciliación, config tributaria | No |
| `VIEWER` | Todo (solo lectura) | Nada | No |

**Nota:** el `ACCOUNTANT` invitado por una empresa solo ve esa empresa. El contador independiente con muchas empresas usa un **selector de empresa activa**.

---

## Arquitectura de routing

```
app/
├── (marketing)/              ← landing, blog, precios
├── (auth)/                   ← login, sign-up, recuperar contraseña
│   └── invitacion/           ← aceptar invitación de contador
│
├── (empresa)/                ← layout empresarial (sidebar + header empresa)
│   ├── layout.tsx            ← SidebarEmpresa, tema primary verde/naranja
│   ├── page.tsx              ← redirect a /empresa/dashboard
│   ├── dashboard/
│   ├── emit/
│   ├── ventas/
│   ├── documents/
│   ├── purchases/
│   ├── honorarios/
│   ├── libro-ventas/
│   ├── libro-compras/
│   ├── inventario/
│   ├── remuneraciones/
│   ├── banco/
│   ├── f29/
│   ├── f22/
│   ├── settings/
│   └── contador/             ← "Mi Contador": invitar, ver estado, revocar
│
├── (contador)/               ← layout contable (sidebar + header contador)
│   ├── layout.tsx            ← SidebarContador, tema primary azul profesional
│   ├── page.tsx              ← redirect a /contador/dashboard
│   ├── dashboard/            ← resumen de clientes, alertas, vencimientos
│   ├── clientes/             ← lista de empresas asignadas, selector de activa
│   ├── contabilidad/
│   │   ├── libro-diario/
│   │   ├── mayor/
│   │   └── reportes/
│   ├── impuestos/
│   │   ├── f29/
│   │   └── f22/
│   ├── tesoreria/
│   │   └── conciliacion/
│   ├── alertas/
│   └── settings/
│
└── api/                      ← route handlers (auth, AI proxies, etc.)
```

### Sidebar Empresa (`SidebarEmpresa`)

```typescript
const navSections: NavSection[] = [
  { items: [{ href: "/empresa/dashboard", label: "Resumen", icon: LayoutDashboard }] },
  {
    label: "Ventas",
    items: [
      { href: "/empresa/emit", label: "Emitir DTE", icon: PlusCircle },
      { href: "/empresa/ventas/cotizaciones", label: "Cotizaciones", icon: FileText },
      { href: "/empresa/documents", label: "Documentos", icon: FileText },
      { href: "/empresa/libro-ventas", label: "Libro de Ventas", icon: BookOpen },
    ],
  },
  {
    label: "Compras",
    items: [
      { href: "/empresa/purchases", label: "Compras", icon: ShoppingCart },
      { href: "/empresa/honorarios", label: "Honorarios", icon: ShoppingCart },
      { href: "/empresa/libro-compras", label: "Libro de Compras", icon: BookOpen },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { href: "/empresa/inventario/productos", label: "Inventario", icon: Boxes },
      { href: "/empresa/remuneraciones/trabajadores", label: "Remuneraciones", icon: Users },
      { href: "/empresa/banco/conciliacion", label: "Tesorería", icon: Landmark },
    ],
  },
  {
    label: "Impuestos",
    items: [
      { href: "/empresa/f29", label: "F29 Mensual", icon: FileBarChart },
      { href: "/empresa/f22", label: "F22 Anual", icon: FileBarChart },
    ],
  },
  {
    items: [
      { href: "/empresa/contador", label: "Mi Contador", icon: UserCheck },
      { href: "/empresa/settings", label: "Configuración", icon: Settings },
    ],
  },
]
```

### Sidebar Contador (`SidebarContador`)

```typescript
const navSections: NavSection[] = [
  { items: [{ href: "/contador/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Clientes",
    items: [
      { href: "/contador/clientes", label: "Mis Empresas", icon: Building2 },
      { href: "/contador/alertas", label: "Alertas", icon: Bell },
    ],
  },
  {
    label: "Contabilidad",
    items: [
      { href: "/contador/contabilidad/libro-diario", label: "Libro Diario", icon: BookOpen },
      { href: "/contador/contabilidad/mayor", label: "Libro Mayor", icon: BookOpen },
      { href: "/contador/contabilidad/reportes/balance-comprobacion", label: "Balance Comprob.", icon: FileBarChart },
      { href: "/contador/contabilidad/reportes/estado-resultados", label: "Estado Resultados", icon: FileBarChart },
      { href: "/contador/contabilidad/reportes/balance-general", label: "Balance General", icon: FileBarChart },
    ],
  },
  {
    label: "Impuestos",
    items: [
      { href: "/contador/impuestos/f29", label: "F29 Mensual", icon: CalendarClock },
      { href: "/contador/impuestos/f22", label: "F22 Anual", icon: CalendarClock },
    ],
  },
  {
    label: "Tesorería",
    items: [
      { href: "/contador/tesoreria/conciliacion", label: "Conciliación", icon: Landmark },
    ],
  },
  {
    items: [
      { href: "/contador/settings", label: "Configuración", icon: Settings },
    ],
  },
]
```

---

## Flujo de autenticación y redirección

### Post-login: Selector de Rol

```
/api/auth/get-session → user + memberships

IF memberships.length === 1:
  → redirect según rol de esa única membresía

IF memberships tiene mix de OWNER/ADMIN y ACCOUNTANT:
  → /selector (pantalla: "¿Entrar como Empresa o como Contador?")

IF memberships tiene múltiples como ACCOUNTANT:
  → /contador/dashboard (selector de empresa activa dentro del layout)
```

### Selector de Empresa Activa (contador con múltiples clientes)

```typescript
// Contexto global en (contador)/layout.tsx
const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null)

// Header del contador muestra:
// [Dropdown: "Cliente: MiPyme SpA ▼"]  [Alertas: 3]  [Perfil]
```

Cada request a la API incluye `x-company-id: activeCompanyId`.

### Invitación de contador (flujo empresa)

```
Empresa:
  /empresa/contador → "Invitar contador"
  → Ingresa email
  → Backend: CREATE CompanyMembership { role: 'ACCOUNTANT', invitedBy: userId }
  → Envía email con link /invitacion?token=xyz

Contador (nuevo o existente):
  /invitacion?token=xyz
  → Valida token
  → Si ya tiene cuenta: acepta, redirige a /contador/dashboard
  → Si no: signup, luego acepta, redirige a /contador/dashboard
```

---

## Cambios técnicos necesarios

### Backend

1. **Endpoint `GET /api/me/memberships`** — lista de empresas del usuario con su rol.
2. **Endpoint `POST /api/invitations`** — empresa invita contador por email.
3. **Endpoint `POST /api/invitations/:token/accept`** — contador acepta invitación.
4. **Tenant plugin**: validar que el `companyId` en `x-company-id` corresponda a una `CompanyMembership` del usuario autenticado (con rol adecuado para escritura).

### Frontend

1. **Nuevo layout `(empresa)/layout.tsx`** — refactor de `(app)/layout.tsx` actual.
2. **Nuevo layout `(contador)/layout.tsx`** — sidebar azul, selector de empresa.
3. **Refactor `(app)/`** — migrar páginas existentes a `(empresa)/` o `(contador)/` según corresponda.
4. **Página `/selector`** — elegir rol cuando el usuario tiene ambos.
5. **Contexto `ActiveCompanyContext`** — para el contador, guarda `companyId` activo.

### Auth

1. **Better Auth**: extender el modelo `User` o la sesión para incluir `memberships` (opcional, o hacer fetch separado).
2. **Cookie `active_company_id`** — para que el contador no tenga que re-seleccionar en cada refresh.

---

## Dashboards diferenciados

### Dashboard Empresa

```
┌─────────────────────────────────────────────┐
│  Resumen Operativo — MiPyme SpA             │
├─────────────────────────────────────────────┤
│  [Ventas del mes $X] [Compras $Y]           │
│  [Documentos pendientes: 3]                 │
│  [Próximo vencimiento: F29 20/may]          │
│  [Alertas IA: 2 insights]                   │
│  [Gráfico: ingresos vs gastos últ. 6 meses] │
└─────────────────────────────────────────────┘
```

### Dashboard Contador

```
┌─────────────────────────────────────────────┐
│  Dashboard Contable — Dr. Juan Pérez        │
├─────────────────────────────────────────────┤
│  [Empresas activas: 12] [Alertas: 5]        │
│  [Próximos vencimientos globales]           │
│  [Empresas con desbalance: 2]               │
│  [Tabla: Empresa | Último cierre | Alertas] │
│  [Gráfico: facturación acumulada por cliente]│
└─────────────────────────────────────────────┘
```

---

## Dependencias

- **Bloqueante**: Contabilidad General debe estar 100% funcional (libro diario, mayor, estados financieros).
- **Bloqueante**: Multi-tenancy real con `CompanyMembership` (ya en schema, falta usarlo en lugar de `companyId = user.id`).
- **Opcional**: Sistema de notificaciones/email para invitaciones.

---

## Plan de implementación sugerido

1. **Fase 0** (esta sesión): Cerrar Contabilidad General.
2. **Fase 1**: Refactor multi-tenancy real — `companyId` ya no es `user.id`, sino que viene de `CompanyMembership`.
3. **Fase 2**: Crear layouts `(empresa)/` y `(contador)/`, migrar páginas existentes.
4. **Fase 3**: Implementar selector de rol post-login y selector de empresa.
5. **Fase 4**: Flujo de invitación empresa → contador.
6. **Fase 5**: Dashboards diferenciados con datos reales.

---

## Notas

- La decisión de **no usar subdominios** (`empresa.contachile.cl` vs `contador.contachile.cl`) simplifica despliegue, SEO y auth. Se puede revertir en el futuro si escalamos a white-label.
- La variante de color del contador se implementa con una clase CSS en el layout (`data-theme="contador"`) que sobreescribe solo el token `--primary`.
