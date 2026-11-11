# Marea Digital

Tienda digital construida con Next.js App Router, TypeScript y Supabase. Usa el esquema existente de empresas, usuarios, roles, clientes, productos y pedidos; el servicio privado se ejecuta en el servidor y las tablas pueden seguir con RLS sin políticas públicas.

## Puesta en marcha

1. Instala dependencias con `npm install`.
2. Usa Node.js 22.12 o posterior y copia `.env.example` a `.env.local`. Sustituye todos los valores `replace-*` con secretos nuevos.
3. En Supabase, elige el UUID de la empresa para `STORE_COMPANY_ID` y crea un bucket **privado** llamado `digital-products` (o configura otro nombre). El límite recomendado del bucket es 25 MB.
4. Genera un secreto de pedidos de al menos 32 caracteres, por ejemplo con `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`, y colócalo en `ORDER_ACCESS_SECRET`. `RATE_LIMIT_SECRET` es opcional; si se deja vacío, se deriva el hash desde el secreto de pedidos.
5. Ejecuta `npm run dev` y abre `http://localhost:3000`.

Antes de desplegar esta versión, ejecuta **en orden** todos los archivos de `supabase/migrations/` en el SQL Editor del proyecto Supabase. La primera migración agrega metadata de catálogo. La segunda agrega `company_id` a categorías y pedidos, backfillea ownership, crea los RPC transaccionales de checkout/pedidos/personal y el limitador de solicitudes. La segunda migración aborta si una categoría no se puede asignar inequívocamente a una empresa o un pedido no tiene cliente con empresa; resuelve esos datos antes de volver a ejecutarla. No despliegues el código antes de aplicar las migraciones.

Sin configuración operativa válida, la tienda muestra productos de muestra y desactiva el checkout; los valores `replace-*` nunca cuentan como secretos configurados. `/api/health` devuelve solo el estado general de la aplicación y su conexión con Supabase.

## Acceso inicial del equipo

El empleado debe existir en Supabase Auth y también en `public.users` con el **mismo UUID** en ambas partes. `public.users.company_id` debe corresponder a `STORE_COMPANY_ID`; agrega su rol `admin` o `seller` en `public.user_roles`. Ejemplo para asignar el rol después de crear el usuario en Auth:

```sql
insert into public.users (id, company_id, full_name, email)
values ('AUTH_USER_UUID', 'STORE_COMPANY_UUID', 'Nombre Admin', 'admin@example.com');

insert into public.user_roles (user_id, role_id)
select 'AUTH_USER_UUID', id from public.roles where name = 'admin';
```

Luego entra por `/admin/login`. `admin` gestiona personal; `admin` y `seller` gestionan productos, categorías y pedidos; `support` solo consulta pedidos. El admin invita al personal desde el panel y cada persona confirma el correo y establece su propia contraseña. Los clientes sí pueden crear una cuenta pública en `/cuenta/registro`; no reciben roles internos y solo consultan pedidos asociados a su propio perfil.

El acceso del equipo admite contraseña y magic link. Las cuentas de cliente admiten registro confirmado por correo, login con contraseña y recuperación. Los cambios de email y reautenticación requieren correo saliente configurado en Supabase. Añade `http://localhost:3000/auth/callback` y el dominio de producción con `/auth/callback` en **Authentication → URL Configuration → Redirect URLs**. Mantén activadas las plantillas de confirmación, invitación, magic link, recuperación y cambio de correo en **Authentication → Email Templates**. Los cambios de email usan la confirmación segura de Supabase para ambas direcciones.

## Flujo de tienda

- El cliente crea un pedido con estado `pending`; no se procesa ningún pago.
- El backend crea pedido y líneas en una función Postgres transaccional, vuelve a validar precios/disponibilidad y usa una clave idempotente por intento.
- Checkout, login y descargas usan límites atómicos almacenados en Supabase; las solicitudes fallan cerradas si el limitador no está disponible.
- El enlace de seguimiento contiene un token firmado, no requiere políticas RLS públicas y vence a los 90 días.
- El equipo confirma el pago manualmente con transiciones controladas: `pending → paid/cancelled`, `paid → delivered/refunded`, `delivered → refunded`. La entrega, licencias y expiración se guardan en una única transacción.
- Los archivos se suben al bucket privado desde el panel. `products.file_url` guarda una ruta bajo el UUID de la empresa, por ejemplo `COMPANY_UUID/archivo.pdf`; la descarga requiere estado `delivered` y entrega una URL firmada de 60 segundos dentro de una ventana de 30 días.
- Las portadas usan `products.image_url` (HTTPS), los enlaces amigables usan `products.slug` (`/producto/<slug>`), `compare_at_price` debe superar `price`, e `is_featured` / `is_new` controlan las insignias y el orden del catálogo.

## Configuración y seguridad

- `SUPABASE_SERVICE_ROLE_KEY` solo se utiliza en módulos de servidor y **nunca** debe llevar el prefijo `NEXT_PUBLIC_`.
- El navegador solo utiliza `NEXT_PUBLIC_SUPABASE_ANON_KEY` para Supabase Auth. Las consultas de datos se realizan en el servidor con alcance de compañía.
- Mantén RLS activado en todas las tablas. El acceso privilegiado se concentra en Route Handlers y Server Actions con validación de sesión, rol y `company_id`; los RPC de escritura solo conceden ejecución a `service_role`.
- La clave `SUPABASE_SERVICE_ROLE_KEY` nunca va en `.env.example`, prefijos `NEXT_PUBLIC_`, logs o navegador. Si una clave real se compartió o llegó al repositorio, revócala y genera otra en Supabase.
- `NEXT_PUBLIC_STORE_CURRENCY` define la moneda mostrada; por defecto es `USD`. El esquema actual no almacena moneda por producto.
- `NEXT_PUBLIC_SITE_URL` define el origen canónico para metadatos, sitemap y robots. En Vercel puede omitirse para usar el dominio del despliegue; en otros hosts configura el dominio público HTTPS.
- El proveedor de pagos y el envío de correos no están integrados porque el proyecto no proporciona esas credenciales ni campos. El checkout informa claramente que el pedido queda pendiente.

## Comandos

- `npm run dev`: servidor local.
- `npm run lint`: ESLint.
- `npm test`: pruebas de lógica de dominio.
- `npm run test:coverage`: pruebas con umbral mínimo configurado.
- `npm run build`: build de producción.
