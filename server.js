const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

loadDotEnv(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 3000);
const SAP_URL = process.env.SAP_B1_SERVICE_LAYER_URL;
const SAP_COMPANY_DB_AMP = process.env.SAP_B1_COMPANY_DBAMP;
const SAP_COMPANY_DB_RTA = process.env.SAP_B1_COMPANY_DBRTA;
const SAP_COMPANY_DB_SCA = process.env.SAP_B1_COMPANY_DBSCA;
const SAP_USERNAME = process.env.SAP_B1_USERNAME;
const SAP_PASSWORD = process.env.SAP_B1_PASSWORD;
const BP_SERIES = process.env.SAP_B1_BP_SERIES ? Number(process.env.SAP_B1_BP_SERIES) : undefined;
const REJECT_UNAUTHORIZED = process.env.SAP_B1_REJECT_UNAUTHORIZED
  ? process.env.SAP_B1_REJECT_UNAUTHORIZED !== "false"
  : false;
const SAP_TLS_MIN_VERSION = process.env.SAP_B1_TLS_MIN_VERSION || "TLSv1";
const SAP_TLS_CIPHERS = process.env.SAP_B1_TLS_CIPHERS || "DEFAULT@SECLEVEL=0";
const SAP_TIMEOUT_MS = Number(process.env.SAP_B1_TIMEOUT_MS || 30000);
const APP_DEBUG_LOOKUP = process.env.APP_DEBUG_LOOKUP === "true";
const LEGACY_SECURE_OPTIONS = crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT || 0;

function assertRequiredSapConfig() {
  const missing = [
    ["SAP_B1_SERVICE_LAYER_URL", SAP_URL],
    ["SAP_B1_USERNAME", SAP_USERNAME],
    ["SAP_B1_PASSWORD", SAP_PASSWORD],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(
      `Faltan variables obligatorias en outputs/.env: ${missing.join(", ")}.`
    );
  }
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] !== undefined) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    value = value.replace(/\\n/g, "\n");
    process.env[key] = value;
  }
}

function getBrandPolicyFieldMap(brand) {
  const normalizedBrand = String(brand || "").trim().toUpperCase();
  const fieldMap = {
    AMPHORA: {
      marketing: "U_AMP_MARKETINGAMP",
      dataPolicy: "U_AMP_POLITICASAMP",
    },
    SCALPERS: {
      marketing: "U_AMP_MARKETINGSCA",
      dataPolicy: "U_AMP_POLITICASSCA",
    },
    RENATTA: {
      marketing: "U_AMP_MARKETINGRTA",
      dataPolicy: "U_AMP_POLITICASRTA",
    },
  };

  return fieldMap[normalizedBrand] || fieldMap.AMPHORA;
}

function buildBrandPolicyPayload(data) {
  const fields = getBrandPolicyFieldMap(data.brand);
  return {
    [fields.marketing]: data.acceptMarketingPolicy ? "Y" : "N",
    [fields.dataPolicy]: data.acceptPolicy ? "Y" : "N",
  };
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Solicitud demasiado grande."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const tlsProfiles = [
  {
    name: "configured",
    minVersion: SAP_TLS_MIN_VERSION,
    ciphers: SAP_TLS_CIPHERS,
    secureOptions: LEGACY_SECURE_OPTIONS,
  },
  {
    name: "tls12",
    minVersion: "TLSv1.2",
    ciphers: "DEFAULT",
    secureOptions: LEGACY_SECURE_OPTIONS,
  },
  {
    name: "tls11-legacy",
    minVersion: "TLSv1.1",
    ciphers: "DEFAULT@SECLEVEL=0",
    secureOptions: LEGACY_SECURE_OPTIONS,
  },
  {
    name: "tls10-legacy",
    minVersion: "TLSv1",
    ciphers: "DEFAULT@SECLEVEL=0",
    secureOptions: LEGACY_SECURE_OPTIONS,
  },
];

function maskSapBody(body) {
  if (!body || typeof body !== "object") return body;
  return {
    ...body,
    Password: body.Password ? "***" : body.Password,
  };
}

function createDebugLogger(enabled) {
  const requestId = new Date().toISOString();
  let step = 0;

  return (message, data) => {
    if (!enabled) return;
    step += 1;
    const prefix = `[SAP DEBUG ${requestId}] Paso ${step}: ${message}`;
    if (data === undefined) {
      console.log(prefix);
      return;
    }
    console.log(prefix, data);
  };
}

function requestSapWithProfile(method, endpoint, body, cookies, tlsProfile, debugLog, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    if (!SAP_URL) return reject(new Error("Falta SAP_B1_SERVICE_LAYER_URL."));

    const url = new URL(endpoint, SAP_URL.endsWith("/") ? SAP_URL : `${SAP_URL}/`);
    const payload = body ? JSON.stringify(body) : undefined;
    debugLog("Preparando request SAP.", {
      method,
      endpoint,
      tlsProfile: tlsProfile.name,
      body: maskSapBody(body),
      hasCookies: Boolean(cookies?.length),
      extraHeaders,
    });

    const options = {
      method,
      hostname: url.hostname,
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      rejectUnauthorized: REJECT_UNAUTHORIZED,
      minVersion: tlsProfile.minVersion,
      ciphers: tlsProfile.ciphers,
      secureOptions: tlsProfile.secureOptions,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Connection: "close",
        ...extraHeaders,
      },
    };

    if (payload) options.headers["Content-Length"] = Buffer.byteLength(payload);
    if (cookies) options.headers.Cookie = cookies.join("; ");

    const req = https.request(options, (res) => {
      debugLog("SAP respondio headers.", {
        method,
        endpoint,
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
      });

      let responseBody = "";
      res.on("data", (chunk) => {
        responseBody += chunk;
      });
      res.on("end", () => {
        let parsed = {};
        if (responseBody) {
          try {
            parsed = JSON.parse(responseBody);
          } catch {
            parsed = { raw: responseBody };
          }
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          const sapMessage =
            parsed.error?.message?.value ||
            parsed.error?.message ||
            extractHtmlMessage(parsed.raw) ||
            "Error SAP.";
          const error = new Error(sapMessage);
          error.statusCode = res.statusCode;
          reject(error);
          return;
        }

        debugLog("SAP respondio body parseado.", {
          method,
          endpoint,
          data: parsed,
        });

        resolve({ data: parsed, cookies: res.headers["set-cookie"] || [] });
      });
    });

    req.setTimeout(SAP_TIMEOUT_MS, () => {
      req.destroy(new Error(`Timeout conectando a SAP despues de ${SAP_TIMEOUT_MS} ms.`));
    });
    req.on("error", (error) => {
      debugLog("Error de red/TLS llamando a SAP.", {
        method,
        endpoint,
        tlsProfile: tlsProfile.name,
        code: error.code,
        message: error.message,
      });
      error.tlsProfile = tlsProfile.name;
      reject(error);
    });
    if (payload) req.write(payload);
    req.end();
  });
}

async function requestSap(method, endpoint, body, cookies, debugLog = () => {}, extraHeaders = {}) {
  let lastNetworkError;

  for (const profile of tlsProfiles) {
    try {
      debugLog("Probando perfil TLS.", {
        profile: profile.name,
        minVersion: profile.minVersion,
        ciphers: profile.ciphers,
      });
      return await requestSapWithProfile(
        method,
        endpoint,
        body,
        cookies,
        profile,
        debugLog,
        extraHeaders
      );
    } catch (error) {
      const canRetry =
        !error.statusCode &&
        ["ECONNRESET", "EPROTO", "ESOCKETTIMEDOUT", "ETIMEDOUT"].includes(error.code);

      if (!canRetry) {
        debugLog("Error SAP no reintentable.", {
          statusCode: error.statusCode,
          message: error.message,
        });
        throw error;
      }
      lastNetworkError = error;
    }
  }

  throw new Error(
    `SAP cerro la conexion (${lastNetworkError?.code || "sin codigo"}) durante ${method} ${endpoint}. Ultimo perfil TLS probado: ${lastNetworkError?.tlsProfile || "desconocido"}. Detalle: ${lastNetworkError?.message || "socket hang up"}`
  );
}

async function loginSap(debugLog) {
  return loginSapForCompany(resolveCompanyDbFromBrand("AMPHORA"), debugLog);
}

function resolveCompanyDbFromBrand(brand) {
  const normalizedBrand = String(brand || "").trim().toUpperCase();
  const brandCompanyDbMap = {
    AMPHORA: ["SAP_B1_COMPANY_DBAMP", SAP_COMPANY_DB_AMP],
    RENATTA: ["SAP_B1_COMPANY_DBRTA", SAP_COMPANY_DB_RTA],
    SCALPERS: ["SAP_B1_COMPANY_DBSCA", SAP_COMPANY_DB_SCA],
  };
  const [envName, companyDb] = brandCompanyDbMap[normalizedBrand] || brandCompanyDbMap.AMPHORA;

  if (!companyDb) {
    throw new Error(
      `Falta la variable obligatoria ${envName} para la marca ${normalizedBrand || "AMPHORA"}.`
    );
  }

  return companyDb;
}

async function loginSapForCompany(companyDb, debugLog) {
  const missing = [
    ["SAP_B1_SERVICE_LAYER_URL", SAP_URL],
    ["SAP_B1_USERNAME", SAP_USERNAME],
    ["SAP_B1_PASSWORD", SAP_PASSWORD],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(`Faltan variables de entorno: ${missing.join(", ")}.`);
  }

  debugLog("Iniciando login en SAP Service Layer.", {
    serviceLayerUrl: SAP_URL,
    companyDb,
    username: SAP_USERNAME,
  });

  return requestSap(
    "POST",
    "Login",
    {
      CompanyDB: companyDb,
      UserName: SAP_USERNAME,
      Password: SAP_PASSWORD,
    },
    undefined,
    debugLog
  );
}

function buildBusinessPartner(data) {
  const cardCode = `C${normalizeRut(data.rut)}`;
  const payload = {
    CardCode: cardCode,
    CardName: data.name,
    CardType: "cCustomer",
    GroupCode: 100,
    CardForeignName: data.name,
    DebitorAccount: "1141003",
    FederalTaxID: normalizeRut(data.rut),
    Cellular: data.phone || undefined,
    Phone1: data.phone || undefined,
    EmailAddress: data.email || undefined,
    City: data.city || undefined,
    Notes: "Registro creado desde formulario web con aceptacion de politicas de datos personales.",
    U_GSP_BIRTHDATE: data.birthDate || undefined,
    U_GSP_SENDTPV: "Y",
    U_GSP_SubGroupCode: 2,
    U_GSP_SubGroupName: "PERSONA NATURAL",
    ...buildBrandPolicyPayload(data),
  };

  if (BP_SERIES) payload.Series = BP_SERIES;

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || payload[key] === "") delete payload[key];
  });

  return payload;
}

const CLIENT_PARTNER_FIELDS = [
  "CardCode",
  "CardName",
  "CardForeignName",
  "FederalTaxID",
  "LicTradNum",
  "Phone1",
  "Phone2",
  "Cellular",
  "EmailAddress",
  "E_Mail",
  "MailAddress",
  "City",
  "CityName",
  "U_GSP_BIRTHDATE",
  "BirthDate",
  "U_AMP_MARKETINGAMP",
  "U_AMP_POLITICASAMP",
  "U_AMP_MARKETINGSCA",
  "U_AMP_POLITICASSCA",
  "U_AMP_MARKETINGRTA",
  "U_AMP_POLITICASRTA",
];

function sanitizePartnerForClient(partner) {
  if (!partner || typeof partner !== "object") return null;
  const sanitized = {};
  for (const field of CLIENT_PARTNER_FIELDS) {
    if (partner[field] !== undefined) sanitized[field] = partner[field];
  }
  return sanitized;
}

function buildOptionalPartnerUpdate(data) {
  const payload = {
    FederalTaxID: normalizeRut(data.rut),
    Cellular: data.phone || undefined,
    Phone1: data.phone || undefined,
    EmailAddress: data.email || undefined,
    City: data.city || undefined,
    U_GSP_BIRTHDATE: data.birthDate || undefined,
    U_GSP_SENDTPV: "Y",
    ...buildBrandPolicyPayload(data),
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || payload[key] === "") delete payload[key];
  });

  return payload;
}

function normalizeRut(value) {
  const rut = String(value || "")
    .replace(/\./g, "")
    .replace(/\s/g, "")
    .toUpperCase();

  if (rut.includes("-")) return rut;
  if (rut.length < 2) return rut;
  return `${rut.slice(0, -1)}-${rut.slice(-1)}`;
}

function compactRut(value) {
  return normalizeRut(value).replace(/-/g, "");
}

function businessPartnerEndpoint(cardCode) {
  if (!cardCode || cardCode === "null" || cardCode === "undefined") {
    throw new Error("SAP encontro un socio existente, pero no devolvio CardCode para actualizarlo.");
  }

  const escapedCardCode = String(cardCode).replace(/'/g, "''");
  return `BusinessPartners(${encodeURIComponent(`'${escapedCardCode}'`)})`;
}

function isProxyPatchError(error) {
  const message = String(error?.message || "");
  return (
    error?.statusCode === 502 ||
    message.includes("502 Proxy Error") ||
    message.includes("Error reading from remote server")
  );
}

async function updateBusinessPartner(cardCode, updatePayload, cookies, debugLog) {
  const endpoint = businessPartnerEndpoint(cardCode);

  try {
    return await requestSap("PATCH", endpoint, updatePayload, cookies, debugLog);
  } catch (error) {
    if (!isProxyPatchError(error)) throw error;

    debugLog("PATCH fallo por proxy 502. Reintentando con POST + override PATCH.", {
      cardCode,
      originalError: error.message,
    });

    return requestSap("POST", endpoint, updatePayload, cookies, debugLog, {
      "X-HTTP-Method": "PATCH",
      "X-HTTP-Method-Override": "PATCH",
    });
  }
}

function escapeOData(value) {
  return String(value).replace(/'/g, "''");
}

function extractHtmlMessage(value) {
  if (!value || !String(value).includes("<html")) return value;

  const text = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  return text || "Error HTTP devuelto por SAP.";
}

function getPartnerCardCode(partner) {
  if (!partner || typeof partner !== "object") return "";

  const directCardCode =
    partner.CardCode || partner.cardCode || partner.Cardcode || partner.CARDCODE || partner.cardcode;
  if (directCardCode && directCardCode !== "null") return String(directCardCode);

  const uri = partner.__metadata?.uri || partner["@odata.id"] || "";
  const match = String(uri).match(/BusinessPartners\('([^']+)'\)/);
  return match ? match[1] : "";
}

async function probePartnerCardCode(candidateCodes, cookies, debugLog) {
  for (const cardCode of candidateCodes) {
    try {
      debugLog("Probando acceso directo al socio candidato.", { cardCode });
      const response = await requestSap(
        "GET",
        businessPartnerEndpoint(cardCode),
        undefined,
        cookies,
        debugLog
      );
      const resolvedCardCode = getPartnerCardCode(response.data) || cardCode;
      debugLog("Socio candidato confirmado por CardCode.", { cardCode: resolvedCardCode });
      return resolvedCardCode;
    } catch (error) {
      debugLog("El socio candidato no respondio al acceso directo.", {
        cardCode,
        statusCode: error.statusCode,
        message: error.message,
      });
    }
  }

  return "";
}

async function runBusinessPartnerSearch(search, cookies, debugLog) {
  const endpoint = `BusinessPartners?$top=1&$filter=${encodeURIComponent(search.filter)}`;
  debugLog("Ejecutando busqueda de socio.", {
    reason: search.reason,
    filter: search.filter,
    endpoint,
  });

  const response = await requestSap("GET", endpoint, undefined, cookies, debugLog);
  const foundPartner = response.data.value?.[0] || null;
  return { response, foundPartner, endpoint };
}

async function retryBusinessPartnerSearchWithoutSelect(search, cookies, debugLog) {
  const endpoint = `BusinessPartners?$top=1&$filter=${encodeURIComponent(search.filter)}`;
  debugLog("Reintentando busqueda de socio sin $select.", {
    reason: search.reason,
    filter: search.filter,
    endpoint,
  });

  const response = await requestSap("GET", endpoint, undefined, cookies, debugLog);
  const foundPartner = response.data.value?.[0] || null;
  return { response, foundPartner, endpoint };
}

async function findBusinessPartnerByRut(data, cookies, debugLog, options = {}) {
  const requireCardCode = options.requireCardCode !== false;
  const normalizedRut = normalizeRut(data.rut);
  const rutWithoutDash = compactRut(data.rut);
  const candidateCodes = [`C${normalizedRut}`, `C${rutWithoutDash}`];
  const searches = [
    {
      reason: "RUT normalizado en FederalTaxID/LicTradNum",
      filter: `FederalTaxID eq '${escapeOData(normalizedRut)}'`,
    },
    {
      reason: "RUT sin guion en FederalTaxID/LicTradNum",
      filter: `FederalTaxID eq '${escapeOData(rutWithoutDash)}'`,
    },
    ...candidateCodes.map((cardCode) => ({
      reason: `CardCode candidato ${cardCode}`,
      filter: `CardCode eq '${escapeOData(cardCode)}'`,
    })),
  ];
  debugLog("Buscando socio existente por RUT.", {
    normalizedRut,
    rutWithoutDash,
    candidateCodes,
    searches,
    requireCardCode,
  });

  let response = null;
  let foundPartner = null;
  let matchedSearch = null;
  let matchedEndpoint = "";
  const attemptedQueries = [];

  for (const search of searches) {
    const searchResult = await runBusinessPartnerSearch(search, cookies, debugLog);
    response = searchResult.response;
    foundPartner = searchResult.foundPartner;
    matchedSearch = search;
    matchedEndpoint = searchResult.endpoint;
    attemptedQueries.push({
      reason: search.reason,
      filter: search.filter,
      endpoint: searchResult.endpoint,
    });
    if (foundPartner) break;
  }

  if (!foundPartner) {
    debugLog("No se encontro socio existente en SAP.");
    if (!requireCardCode) {
      return {
        __notFound: true,
        __sapSearchResponse: response?.data || null,
        __sapLookupQuery: attemptedQueries[attemptedQueries.length - 1] || null,
        __sapLookupQueries: attemptedQueries,
      };
    }
    return null;
  }

  debugLog("SAP encontro un candidato con busqueda filtrada.", {
    matchedSearch,
    foundPartner,
  });
  let cardCode = getPartnerCardCode(foundPartner);
  if (!cardCode) {
    debugLog("El candidato no incluyo CardCode. Reintentando busqueda sin $select.");
    const retryResult = await retryBusinessPartnerSearchWithoutSelect(matchedSearch, cookies, debugLog);
    response = retryResult.response;
    foundPartner = retryResult.foundPartner || foundPartner;
    matchedEndpoint = retryResult.endpoint;
    attemptedQueries.push({
      reason: `${matchedSearch.reason} sin $select`,
      filter: matchedSearch.filter,
      endpoint: retryResult.endpoint,
    });
    cardCode = getPartnerCardCode(foundPartner);
  }

  if (!cardCode) {
    debugLog("No se pudo leer CardCode desde la busqueda. Probando codigos candidatos.");
    cardCode = await probePartnerCardCode(candidateCodes, cookies, debugLog);
  }

  if (!cardCode && !requireCardCode) {
    debugLog("La busqueda encontro socio, pero sin CardCode. Se devuelve solo para precarga.");
    return {
      ...foundPartner,
      CardCode: undefined,
      __sapMatchedSearch: matchedSearch,
      __sapSearchResponse: response.data,
      __sapLookupQuery: {
        reason: matchedSearch?.reason || "Busqueda por RUT",
        filter: matchedSearch?.filter || "",
        endpoint: matchedEndpoint,
      },
      __sapLookupQueries: attemptedQueries,
    };
  }

  if (!cardCode) {
    const error = new Error(
      `SAP encontro un socio con RUT ${normalizedRut}, pero la respuesta no incluyo CardCode ni fue posible confirmarlo desde los codigos candidatos. No se actualizo para evitar BusinessPartners('null').`
    );
    error.sapFound = foundPartner;
    error.sapSearchResponse = response.data;
    throw error;
  }

  debugLog("CardCode extraido para actualizacion.", { cardCode });
  return {
    ...foundPartner,
    CardCode: cardCode,
    __sapMatchedSearch: matchedSearch,
    __sapSearchResponse: response.data,
    __sapLookupQuery: {
      reason: matchedSearch?.reason || "Busqueda por RUT",
      filter: matchedSearch?.filter || "",
      endpoint: matchedEndpoint,
    },
    __sapLookupQueries: attemptedQueries,
  };
}

function validatePartner(data) {
  if (!data || typeof data !== "object") return "No pudimos leer tus datos. Intenta nuevamente.";
  if (!data.rut) return "El RUT es obligatorio.";
  if (!data.name) return "El nombre es obligatorio.";
  if (!data.acceptPolicy) return "Debes aceptar la Politica de Privacidad para continuar.";
  return "";
}

async function handleBusinessPartner(req, res) {
  let debugLog = () => {};

  try {
    const body = JSON.parse(await readBody(req));
    debugLog = createDebugLogger(Boolean(body.debugMode));
    debugLog("Solicitud recibida desde formulario.", {
      rut: body.rut,
      name: body.name,
      hasEmail: Boolean(body.email),
      hasPhone: Boolean(body.phone),
      hasBirthDate: Boolean(body.birthDate),
      city: body.city,
      acceptPolicy: body.acceptPolicy,
      debugMode: body.debugMode,
    });

    const validationError = validatePartner(body);
    if (validationError) {
      debugLog("Validacion fallida.", { validationError });
      sendJson(res, 400, { message: validationError });
      return;
    }

    debugLog("Validacion local OK.");
    const companyDb = resolveCompanyDbFromBrand(body.brand);
    debugLog("Marca recibida para registro.", { brand: body.brand, companyDb });
    const login = await loginSapForCompany(companyDb, debugLog);
    debugLog("Login SAP OK.", { cookiesCount: login.cookies.length });

    const partner = buildBusinessPartner(body);
    debugLog("Payload preparado para crear socio si no existe.", partner);

    const existingPartner = await findBusinessPartnerByRut(body, login.cookies, debugLog);

    if (existingPartner) {
      if (body.debugMode && APP_DEBUG_LOOKUP) {
        debugLog("Modo depuracion activo: se detiene antes del PATCH y se devuelve respuesta SAP.");
        sendJson(res, 200, {
          message: `Depuracion: SAP encontro el socio ${existingPartner.CardCode}. No se actualizo para mostrar la respuesta encontrada.`,
          cardCode: existingPartner.CardCode,
          exists: true,
          debugMode: true,
          sapFound: sanitizePartnerForClient(existingPartner),
        });
        return;
      }

      const updatePayload = buildOptionalPartnerUpdate(body);
      debugLog("Socio existente encontrado. Ejecutando PATCH.", {
        cardCode: existingPartner.CardCode,
        updatePayload,
      });

      await updateBusinessPartner(existingPartner.CardCode, updatePayload, login.cookies, debugLog);

      debugLog("PATCH finalizado correctamente.");
      sendJson(res, 200, {
        message: `El socio de negocios ${existingPartner.CardCode} ya existe. Se actualizaron los campos no obligatorios y el RUT se normalizo sin puntos.`,
        cardCode: existingPartner.CardCode,
        exists: true,
        sapFound: sanitizePartnerForClient(existingPartner),
      });
      return;
    }

    debugLog("No existe socio. Ejecutando POST BusinessPartners.");
    const created = await requestSap("POST", "BusinessPartners", partner, login.cookies, debugLog);
    debugLog("POST finalizado correctamente.", created.data);

    sendJson(res, 201, {
      message: "Socio de negocios creado correctamente.",
      cardCode: created.data.CardCode || partner.CardCode,
    });
  } catch (error) {
    debugLog("Error capturado en backend.", {
      message: error.message,
      statusCode: error.statusCode,
      sapFound: error.sapFound,
      sapSearchResponse: error.sapSearchResponse,
    });

    sendJson(res, 500, {
      message: error.message,
      sapFound: APP_DEBUG_LOOKUP ? sanitizePartnerForClient(error.sapFound) : null,
      sapSearchResponse: APP_DEBUG_LOOKUP ? error.sapSearchResponse : null,
    });
  }
}

async function handleBusinessPartnerLookup(req, res) {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const rut = requestUrl.searchParams.get("rut") || "";
    const debugMode = requestUrl.searchParams.get("debugMode") === "true";
    const brand = requestUrl.searchParams.get("brand") || "";
    const normalizedRut = normalizeRut(rut);

    if (!normalizedRut) {
      sendJson(res, 400, { message: "El RUT es obligatorio." });
      return;
    }

    if (!/^\d{7,8}[\dK]$/.test(compactRut(normalizedRut))) {
      sendJson(res, 400, { message: "Ingresa un RUT chileno valido." });
      return;
    }

    const debugLog = createDebugLogger(debugMode);
    const companyDb = resolveCompanyDbFromBrand(brand);
    debugLog("Solicitud de busqueda de socio recibida.", {
      rut: normalizedRut,
      debugMode,
      brand,
      companyDb,
    });

    const login = await loginSapForCompany(companyDb, debugLog);
    debugLog("Login SAP OK para busqueda.", { cookiesCount: login.cookies.length });

    const existingPartner = await findBusinessPartnerByRut(
      { rut: normalizedRut },
      login.cookies,
      debugLog,
      { requireCardCode: false }
    );

    if (!existingPartner || existingPartner.__notFound) {
      sendJson(res, 200, {
        exists: false,
        rut: normalizedRut,
        brand,
        sapFound: null,
        sapSearchResponse: APP_DEBUG_LOOKUP ? existingPartner?.__sapSearchResponse || null : null,
        sapLookupQuery: APP_DEBUG_LOOKUP ? existingPartner?.__sapLookupQuery || null : null,
        sapLookupQueries: APP_DEBUG_LOOKUP ? existingPartner?.__sapLookupQueries || [] : [],
        message: "No se encontro un socio de negocios con ese RUT.",
      });
      return;
    }

    sendJson(res, 200, {
      exists: true,
      rut: normalizedRut,
      brand,
      cardCode: existingPartner.CardCode || null,
      sapFound: sanitizePartnerForClient(existingPartner),
      sapSearchResponse: APP_DEBUG_LOOKUP
        ? existingPartner.__sapSearchResponse || existingPartner
        : null,
      sapLookupQuery: APP_DEBUG_LOOKUP ? existingPartner.__sapLookupQuery || null : null,
      sapLookupQueries: APP_DEBUG_LOOKUP ? existingPartner.__sapLookupQueries || [] : [],
      debugEnabled: APP_DEBUG_LOOKUP,
      message: existingPartner.CardCode
        ? "Socio de negocios encontrado."
        : "Socio de negocios encontrado. Se completaron los datos disponibles.",
    });
  } catch (error) {
    sendJson(res, 500, {
      message: error.message,
      sapFound: APP_DEBUG_LOOKUP ? error.sapFound : null,
      sapSearchResponse: APP_DEBUG_LOOKUP ? error.sapSearchResponse : null,
      debugEnabled: APP_DEBUG_LOOKUP,
    });
  }
}

function handleRuntimeConfig(_req, res) {
  sendJson(res, 200, {
    debugLookupEnabled: APP_DEBUG_LOOKUP,
  });
}

function serveStatic(req, res) {
  const pathname = decodeURIComponent((req.url || "/").split("?")[0]);
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(__dirname, requested);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === "POST" && req.url === "/api/business-partners") {
    handleBusinessPartner(req, res);
    return;
  }

  if (req.method === "GET" && req.url && req.url.startsWith("/api/business-partners/lookup")) {
    handleBusinessPartnerLookup(req, res);
    return;
  }

  if (req.method === "GET" && req.url === "/api/config") {
    handleRuntimeConfig(req, res);
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  sendJson(res, 405, { message: "Metodo no permitido." });
});

assertRequiredSapConfig();

server.listen(PORT, () => {
  console.log(`Formulario disponible en http://localhost:${PORT}`);
});
