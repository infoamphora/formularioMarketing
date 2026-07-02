# Formulario Interandina de Comercio

Aplicacion web para registrar datos de usuario y crear un socio de negocios en SAP Business One mediante Service Layer.

## Ejecutar

1. Copia `.env.example` a `.env` y completa las credenciales y parametros reales de SAP. **Nunca subas `.env` a git.**
2. Inicia el servidor.

```bash
node server.js
```

Luego abre `http://localhost:3000`. Tambien puede abrirse `index.html` como archivo local, pero el servidor Node debe estar ejecutandose para enviar los datos a SAP.

## Configuracion SAP incluida

- Las variables de conexion se leen desde `.env` (ver `.env.example`):
  - `PORT`
  - `SAP_B1_SERVICE_LAYER_URL`
  - `SAP_B1_COMPANY_DBAMP`
  - `SAP_B1_COMPANY_DBRTA`
  - `SAP_B1_COMPANY_DBSCA`
  - `SAP_B1_USERNAME`
  - `SAP_B1_PASSWORD`
  - `SAP_B1_BP_SERIES`
  - `SAP_B1_REJECT_UNAUTHORIZED`
  - `SAP_B1_TLS_MIN_VERSION`
  - `SAP_B1_TLS_CIPHERS`
  - `SAP_B1_TIMEOUT_MS`
  - `APP_DEBUG_LOOKUP`
- Campo fecha nacimiento: `U_GSP_BIRTHDATE`
- Campo envio TPV: `U_GSP_SENDTPV='Y'`
- Telefono: se envia a `Cellular` y `Phone1`.
- Al crear un socio nuevo se envia `CardType='cCustomer'`, `GroupCode=100`, `CardForeignName` igual al nombre ingresado, `DebitorAccount='1141003'`, `U_GSP_SubGroupCode=2` y `U_GSP_SubGroupName='PERSONA NATURAL'`.
- CardCode: `C+RUT`, por ejemplo `C17273201-1`
- RUT en OCRD: se envia y se busca en Service Layer como `FederalTaxID`, que corresponde a `LicTradNum`.
- El RUT se normaliza sin puntos y con guion antes de crear o actualizar, por ejemplo `17.273.201-1` y `172732011` quedan como `17273201-1`.
- TLS SAP: el backend prueba perfiles TLS con fallback para Service Layer antiguo, incluyendo `TLSv1` y `DEFAULT@SECLEVEL=0`. Se puede cambiar con `SAP_B1_TLS_MIN_VERSION`, `SAP_B1_TLS_CIPHERS` y `SAP_B1_TIMEOUT_MS`.
- Depuracion de busqueda por RUT: `APP_DEBUG_LOOKUP=true` muestra en pantalla la query enviada a Service Layer y el JSON crudo devuelto por SAP.

Si el socio ya existe en SAP, el formulario muestra un mensaje indicando que existe y actualiza los datos no obligatorios: email, telefono en `Cellular` y `Phone1`, fecha de nacimiento, ciudad, `U_GSP_SENDTPV='Y'` y el RUT normalizado en `LicTradNum`.

La busqueda de socios existentes se realiza con `$filter` sobre `CardCode` y `FederalTaxID`, evitando el `GET BusinessPartners('codigo')` directo porque algunos proxys de Service Layer devuelven `502 Proxy Error` en esa ruta.

Si SAP devuelve un socio sin `CardCode`, el backend repite la busqueda sin `$select`. Si aun asi no recibe el codigo, detiene la actualizacion para evitar llamadas a `BusinessPartners('null')`.

Si el proxy devuelve `502 Proxy Error` durante el `PATCH` de un socio existente, el backend reintenta la actualizacion con `POST` y headers `X-HTTP-Method: PATCH` / `X-HTTP-Method-Override: PATCH`.

## Seguridad

Las credenciales SAP no estan en `index.html` ni en `app.js`. El navegador envia los datos al backend local y el backend se comunica con SAP.

`.env` esta en `.gitignore` y nunca debe commitearse. Usa `.env.example` como plantilla.

## Marca Por URL

La marca se puede pasar por URL con `brand` o `marca`, por ejemplo `?brand=AMPHORA`.

- `AMPHORA` muestra `datospersonales@amphora.cl`
- `SCALPERS` muestra `datospersonales@scalpers.cl`
- `RENATTA` usa la identidad visual de Renatta y, mientras no se indique otro correo, conserva `datospersonales@amphora.cl` como respaldo

## CompanyDB por marca

- `AMPHORA` usa `SAP_B1_COMPANY_DBAMP`
- `RENATTA` usa `SAP_B1_COMPANY_DBRTA`
- `SCALPERS` usa `SAP_B1_COMPANY_DBSCA`
