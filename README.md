# 🚀 FINA Backend API

Backend para FINA - CFO Virtual para PyMEs Argentinas

## 📋 Stack

- Node.js 18+
- Express.js
- Supabase (PostgreSQL)
- Redis (Bull Queue)
- AFIP.js

## 🚀 Deploy en Railway

Este proyecto está configurado para deploy automático en Railway.

### Variables de entorno requeridas:

- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- REDIS_URL (Railway lo genera automático)

## 💻 Desarrollo Local
```
npm install
Copy-Item .env.example .env
# Completar .env con tus datos
npm run dev
```

## 📝 Endpoints

- GET /health - Health check
- GET / - Info del API

## 📚 Documentación

Ver /docs para más información.
