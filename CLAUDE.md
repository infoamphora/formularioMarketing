# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Formulario web (Interandina de Comercio) que registra clientes y crea/actualiza un socio de negocios (`BusinessPartners`) en SAP Business One vía Service Layer. Multimarca: AMPHORA, SCALPERS, RENATTA.

## Comandos

```bash
node server.js   # sirve en http://localhost:3000 (o PORT)
```

- Sin `package.json` ni dependencias npm: solo módulos nativos de Node (`http`, `https`, `crypto`, `fs`, `path`). No hay build, lint ni tests.
- Configuración en `.env` (plantilla `.env.example`), cargado por un parser propio (`loadDotEnv` en `server.js`), no por `dotenv`. `.env` nunca se commitea.
- Probar una marca: `http://localhost:3000/?brand=SCALPERS` (también `?marca=`). Con `APP_BASE_PATH=/formulario`, la app responde además bajo esa subruta (despliegue detrás de Apache).

## Arquitectura

- `index.html` + `app.js` + `styles.css`: frontend estático sin framework. `app.js` resuelve la marca desde la URL (`brandConfig`: logo, email de contacto, clase CSS `brand-*`) y llama al backend; nunca habla con SAP directamente.
- `server.js`: servidor HTTP único que sirve los estáticos y expone:
  - `GET /api/config` → flags de runtime (`debugLookupEnabled`).
  - `GET /api/business-partners/lookup?rut=&brand=` → busca socio existente por RUT para precargar el formulario.
  - `POST /api/business-partners` → valida, busca por RUT y crea o actualiza.
- Las respuestas de SAP se filtran con `sanitizePartnerForClient` (`CLIENT_PARTNER_FIELDS`) antes de llegar al navegador.

### Reglas de negocio SAP (no obvias)

- **Marca → CompanyDB**: `resolveCompanyDbFromBrand` elige `SAP_B1_COMPANY_DBAMP/DBRTA/DBSCA`; se hace login separado por compañía (`loginSapForCompany`).
- **Marca → campos de consentimiento**: `getBrandPolicyFieldMap` mapea a `U_AMP_MARKETING{AMP|SCA|RTA}` / `U_AMP_POLITICAS{AMP|SCA|RTA}` con valores `Y`/`N`.
- **RUT**: se normaliza a `12345678-9` (`normalizeRut`); `CardCode = "C" + RUT`; el RUT va en `FederalTaxID` (= `LicTradNum`).
- **Búsqueda**: siempre con `$filter` sobre `CardCode`/`FederalTaxID` y solo socios activos (`withActiveBusinessPartnerFilter`: `Valid eq 'tYES'` y `Frozen eq 'tNO'`). No usar `GET BusinessPartners('code')`: algunos proxys devuelven 502.
- Si SAP devuelve un socio sin `CardCode`, se reintenta sin `$select` y se aborta antes de llamar `BusinessPartners('null')`.
- **Socio existente**: solo se actualizan campos no obligatorios (`buildOptionalPartnerUpdate`). Si el `PATCH` da 502 de proxy, se reintenta como `POST` con `X-HTTP-Method: PATCH` / `X-HTTP-Method-Override: PATCH`.
- **Socio nuevo** (`buildBusinessPartner`): valores fijos `CardType='cCustomer'`, `GroupCode=100`, `DebitorAccount='1141003'`, `U_GSP_SubGroupCode=2`, `U_GSP_SENDTPV='Y'`; teléfono a `Cellular` y `Phone1`; nacimiento en `U_GSP_BIRTHDATE`.
- **TLS**: el Service Layer es antiguo; `requestSap` prueba perfiles TLS con fallback (`TLSv1`, `DEFAULT@SECLEVEL=0`, legacy renegotiation). No endurecer sin probar contra el servidor real.
- `APP_DEBUG_LOOKUP=true` devuelve al navegador la query y el JSON crudo de SAP (con contraseña enmascarada por `maskSapBody`); mantener en `false` en producción.

## Repositorio

El repo git vive en esta carpeta (`outputs/`); la carpeta padre tiene un `.git` vacío. Ramas `main` (activa) y `Master` (histórica).
