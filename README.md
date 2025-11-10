# 🚀 FINA Backend API

Backend para FINA - CFO Virtual para PyMEs Argentinas

## 📋 Stack

- Node.js 20.x
- Express.js
- Supabase (PostgreSQL)
- Redis (Bull Queue) - Opcional
- AFIP.js SDK
- Winston Logger
- Zod Validation

## 🚀 Deploy en Railway

Este proyecto está configurado para deploy automático en Railway con Nixpacks.

### ⚠️ Configuración de Variables de Entorno

**IMPORTANTE**: Debes configurar estas variables en el dashboard de Railway (Variables tab):

#### Obligatorias:
```bash
NODE_ENV=production
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu_service_key_aqui
JWT_SECRET=tu_secreto_seguro_aqui
```

#### Opcionales:
```bash
# Redis (si usas Railway Redis addon)
REDIS_URL=redis://default:password@host:port

# CORS
CORS_ORIGIN=https://tu-frontend.com

# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# AFIP
AFIP_PRODUCTION=false

# Twilio (si usas WhatsApp)
TWILIO_ACCOUNT_SID=tu_account_sid
TWILIO_AUTH_TOKEN=tu_auth_token
TWILIO_WHATSAPP_NUMBER=+14155238886
```

### 📊 Verificar Deployment

Después del deploy, verifica que todo funcione:

1. **Health Check**: `https://tu-app.railway.app/health`
   - Debería mostrar `status: "ok"` y el estado de las variables de entorno

2. **Root Endpoint**: `https://tu-app.railway.app/`
   - Muestra información del API y endpoints disponibles

3. **Logs**: Revisa los logs en Railway para confirmar:
   - ✅ Supabase client initialized successfully
   - 🚀 FINA Backend API started

## 💻 Desarrollo Local

```bash
# Instalar dependencias
npm install

# Crear archivo .env
cp .env.example .env

# Editar .env con tus credenciales
# Luego iniciar servidor
npm run dev
```

## 📝 Endpoints

### Públicos:
- `GET /health` - Health check con info del sistema
- `GET /` - Información del API

### AFIP (requieren autenticación):
- `POST /api/afip/padron/validate` - Validar CUIT contra Padrón A5
- `GET /api/afip/ultimo-comprobante` - Obtener último número de comprobante

### Autenticación:
Incluir header: `X-User-ID: {user_id}`

## 🐛 Troubleshooting

### El servidor se reinicia constantemente en Railway:
- Verifica que todas las variables de entorno obligatorias estén configuradas
- Revisa los logs para ver errores específicos
- El healthcheck debe responder en `/health`

### Error "Missing Supabase environment variables":
- Configura `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` en Railway
- NO uses archivo `.env` en producción

### SIGTERM errors:
- Esto es normal al hacer deploy - Railway cierra el contenedor anterior
- El servidor ahora maneja SIGTERM con graceful shutdown

## 📚 Documentación

Para más información sobre los módulos, ver el código fuente en `/src`
