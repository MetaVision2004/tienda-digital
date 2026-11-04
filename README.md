# Marea Digital

Tienda digital construida con Next.js App Router, TypeScript y Supabase. Usa el esquema existente de empresas, usuarios, roles, clientes, productos y pedidos; el servicio privado se ejecuta en el servidor y las tablas pueden seguir con RLS sin políticas públicas.

## Puesta en marcha

1. Instala dependencias con `npm install`.
2. Copia `.env.example` a `.env.local` y completa las variables de Supabase.
3. En Supabase, elige el UUID de la empresa para `STORE_COMPANY_ID` y crea un bucket **privado** llamado `digital-products` (o configura otro nombre). El límite recomendado del bucket es 25 MB.
4. Genera un secreto de pedidos de al menos 32 caracteres, por ejemplo con `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`, y colócalo en `ORDER_ACCESS_SECRET`.
5. Ejecuta `npm run dev` y abre `http://localhost:3000`.

Sin variables de Supabase, la tienda muestra productos de muestra y desactiva el checkout. Cuando las variables estén completas, lee el catálogo real de la compañía seleccionada.

## Acceso inicial del equipo

El empleado debe existir en Supabase Auth y también en `public.users` con el **mismo UUID** en ambas partes. `public.users.company_id` debe corresponder a `STORE_COMPANY_ID`; agrega su rol `admin` o `seller` en `public.user_roles`. Ejemplo para asignar el rol después de crear el usuario en Auth:

```sql
insert into public.users (id, company_id, full_name, email)
values ('AUTH_USER_UUID', 'STORE_COMPANY_UUID', 'Nombre Admin', 'admin@example.com');

insert into public.user_roles (user_id, role_id)
select 'AUTH_USER_UUID', id from public.roles where name = 'admin';
```

Luego entra por `/admin/login`. `admin` y `seller` pueden editar productos; `admin`, `seller` y `support` pueden revisar pedidos. No hay registro público de empleados.

## Flujo de tienda

- El cliente crea un pedido con estado `pending`; no se procesa ningún pago.
- El backend vuelve a consultar los precios y disponibilidad antes de insertar el pedido y sus líneas.
- El enlace de seguimiento contiene un token firmado, no requiere políticas RLS públicas y vence a los 90 días.
- El equipo confirma el pago manualmente y puede marcar el pedido como entregado. En ese momento se habilita la descarga por 30 días y se pueden guardar claves de licencia.
- Los archivos se suben al bucket privado desde el panel. `products.file_url` guarda la ruta del objeto, por ejemplo `COMPANY_UUID/archivo.pdf`; también se permiten URLs HTTPS externas.

## Configuración y seguridad

- `SUPABASE_SERVICE_ROLE_KEY` solo se utiliza en módulos de servidor y **nunca** debe llevar el prefijo `NEXT_PUBLIC_`.
- El navegador solo utiliza `NEXT_PUBLIC_SUPABASE_ANON_KEY` para Supabase Auth. Las consultas de datos se realizan en el servidor con alcance de compañía.
- Mantén RLS activado en todas las tablas. El acceso privilegiado se concentra en Route Handlers y Server Actions con validación de sesión, rol y `company_id`.
- `NEXT_PUBLIC_STORE_CURRENCY` define la moneda mostrada; por defecto es `USD`. El esquema actual no almacena moneda por producto.
- El proveedor de pagos y el envío de correos no están integrados porque el proyecto no proporciona esas credenciales ni campos. El checkout informa claramente que el pedido queda pendiente.

## Comandos

- `npm run dev`: servidor local.
- `npm run lint`: ESLint.
- `npm run build`: build de producción.
