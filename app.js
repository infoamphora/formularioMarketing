(function () {
  const form = document.querySelector("#partner-form");
  const registrationPanel = document.querySelector("#registration-panel");
  const thanksPanel = document.querySelector("#thanks-panel");
  const rutStep = document.querySelector("#rut-step");
  const detailsStep = document.querySelector("#details-step");
  const rutEntryInput = document.querySelector("#rut-entry");
  const rutInput = document.querySelector("#rut");
  const continueButton = document.querySelector("#continue-button");
  const submitButton = document.querySelector("#submit-button");
  const statusBox = document.querySelector("#status");
  const acceptPolicy = document.querySelector("#acceptPolicy");
  const acceptMarketingPolicy = document.querySelector("#acceptMarketingPolicy");
  const openPolicyButton = document.querySelector("#open-policy");
  const openMarketingPolicyButton = document.querySelector("#open-marketing-policy");
  const policyModal = document.querySelector("#policy-modal");
  const policyContent = policyModal.querySelector(".modal-content");
  const acknowledgePolicyButton = document.querySelector("#acknowledge-policy");
  const marketingPolicyModal = document.querySelector("#marketing-policy-modal");
  const marketingPolicyContent = marketingPolicyModal.querySelector(".modal-content");
  const acknowledgeMarketingPolicyButton = document.querySelector("#acknowledge-marketing-policy");
  const brandLogoNodes = document.querySelectorAll("[data-brand-logo]");
  const brandEmailNodes = document.querySelectorAll("[data-brand-contact-email]");
  const brandWebsiteNodes = document.querySelectorAll("[data-brand-website-link]");
  const brandBannerNodes = document.querySelectorAll("[data-brand-banner]");
  const brandBannerTextNodes = document.querySelectorAll("[data-brand-banner-text]");
  const formTitleNode = document.querySelector("[data-form-title]");
  const formSubtitleNode = document.querySelector("[data-form-subtitle]");
  const thanksTitleNode = document.querySelector("[data-thanks-title]");
  const thanksSubtitleNode = document.querySelector("[data-thanks-subtitle]");
  const thanksDiscountTextNode = document.querySelector("[data-thanks-discount-text]");
  const discountCodeBox = document.querySelector("[data-discount-code]");
  const discountCodeValue = document.querySelector("[data-discount-code-value]");
  const appBasePath = detectBasePath();
  const apiUrl =
    window.location.protocol === "file:"
      ? "http://localhost:3000/api/business-partners"
      : `${appBasePath}/api/business-partners`;
  const lookupApiUrl =
    window.location.protocol === "file:"
      ? "http://localhost:3000/api/business-partners/lookup"
      : `${appBasePath}/api/business-partners/lookup`;
  const configApiUrl =
    window.location.protocol === "file:"
      ? "http://localhost:3000/api/config"
      : `${appBasePath}/api/config`;
  const errors = new Map(
    Array.from(document.querySelectorAll("[data-error-for]")).map((node) => [
      node.dataset.errorFor,
      node,
    ])
  );

  let policyOpener = null;
  let policyRead = false;
  let marketingPolicyRead = false;
  let currentStep = "rut-step";
  let debugLookupEnabled = false;

  const brandConfig = {
    AMPHORA: {
      code: "AMPHORA",
      label: "Amphora",
      email: "datospersonales@amphora.cl",
      bodyClass: "brand-amphora",
      logo: "./assets/logo-amphora.svg",
      website: "https://amphora.cl/?utm_source=form&utm_medium=form&utm_campaign=loyalty_program",
      club: {
        name: "Club Amphora",
        tagline: "Tu lugar en Amphora: lo nuevo antes que nadie, nuestros eventos y experiencias pensadas para ti.",
        perks: [
          "Novedades",
          "Invitaciones a activaciones",
          "Eventos de marca",
          "Experiencias especiales",
          "Acceso anticipado",
        ],
        logo: "./assets/club-logo-amphora.svg",
        photoMobile: "./assets/club-walk-800.webp 800w, ./assets/club-walk-1200.webp 1200w",
        photoDesktop: "./assets/club-seat-894.webp",
        photoFallback: "./assets/club-walk-800.webp",
        photoAlt: "Modelo frente al mar con una cartera de la colección Under the sun",
        siteLabel: "Ver lo nuevo en amphora.cl",
      },
    },
    SCALPERS: {
      code: "SCALPERS",
      label: "Scalpers",
      email: "datospersonales@scalpers.cl",
      bodyClass: "brand-scalpers",
      logo: "./assets/logo-scalpers.svg",
      website: "https://cl.scalperscompany.com",
      bannerText: "",
      formTitle: "Suscríbete y no te pierdas nuestros beneficios",
      formSubtitle: "Completa tus datos para sumarte a nuestra lista de novedades, promociones y descuentos.",
      thanksTitle: "Listo, ya estás suscrito",
      thanksSubtitle: "Te avisaremos por correo cuando tengamos novedades, promociones y descuentos especiales para ti.",
      thanksDiscountText: "",
      discountCode: "",
      websiteLinkText: "",
    },
    RENATTA: {
      code: "RENATTA",
      label: "Renatta",
      email: "datospersonales@amphora.cl",
      bodyClass: "brand-renatta",
      logo: "./assets/logo-renatta.png",
      website: "https://www.renattandgo.cl",
      bannerText: "",
      formTitle: "Suscríbete y no te pierdas nuestros beneficios",
      formSubtitle: "Completa tus datos para sumarte a nuestra lista de novedades, promociones y descuentos.",
      thanksTitle: "Listo, ya estás suscrito",
      thanksSubtitle: "Te avisaremos por correo cuando tengamos novedades, promociones y descuentos especiales para ti.",
      thanksDiscountText: "",
      discountCode: "",
      websiteLinkText: "",
    },
  };

  const brandParams = new URLSearchParams(window.location.search);
  const brandCode = (brandParams.get("brand") || brandParams.get("marca") || "AMPHORA")
    .trim()
    .toUpperCase();
  const activeBrand = brandConfig[brandCode] || brandConfig.AMPHORA;

  function detectBasePath() {
    const path = window.location.pathname || "/";
    if (path === "/" || path === "/index.html") return "";
    if (path.endsWith("/index.html")) return path.slice(0, -"/index.html".length);

    const segments = path.split("/").filter(Boolean);
    if (segments.length === 0) return "";
    return `/${segments[0]}`;
  }

  function cleanRut(value) {
    return value.replace(/\./g, "").replace(/-/g, "").trim().toUpperCase();
  }

  function isValidRut(value) {
    const rut = cleanRut(value);
    if (!/^\d{7,8}[\dK]$/.test(rut)) return false;

    const body = rut.slice(0, -1);
    const verifier = rut.slice(-1);
    let sum = 0;
    let factor = 2;

    for (let i = body.length - 1; i >= 0; i -= 1) {
      sum += Number(body[i]) * factor;
      factor = factor === 7 ? 2 : factor + 1;
    }

    const expectedValue = 11 - (sum % 11);
    const expected =
      expectedValue === 11 ? "0" : expectedValue === 10 ? "K" : String(expectedValue);

    return verifier === expected;
  }

  function formatRut(value) {
    const rut = cleanRut(value);
    if (rut.length < 2) return value;
    const body = rut.slice(0, -1);
    const verifier = rut.slice(-1);
    return `${Number(body).toLocaleString("es-CL")}-${verifier}`;
  }

  function setError(field, message) {
    const node = errors.get(field);
    if (node) node.textContent = message;
  }

  function clearErrors() {
    errors.forEach((node) => {
      node.textContent = "";
    });
  }

  function setStatus(message, type, debugData, debugQuery) {
    statusBox.textContent = "";
    const messageNode = document.createElement("div");
    messageNode.textContent = message;
    statusBox.appendChild(messageNode);

    if (debugLookupEnabled && debugQuery) {
      const queryTitle = document.createElement("strong");
      queryTitle.className = "debug-title";
      queryTitle.textContent = "Query Service Layer:";

      const queryNode = document.createElement("pre");
      queryNode.className = "debug-json debug-query";
      queryNode.textContent =
        typeof debugQuery === "string" ? debugQuery : JSON.stringify(debugQuery, null, 2);

      statusBox.appendChild(queryTitle);
      statusBox.appendChild(queryNode);
    }

    if (debugLookupEnabled && debugData) {
      const debugTitle = document.createElement("strong");
      debugTitle.className = "debug-title";
      debugTitle.textContent = "JSON respuesta SAP:";

      const debugNode = document.createElement("pre");
      debugNode.className = "debug-json";
      debugNode.textContent = JSON.stringify(debugData, null, 2);

      statusBox.appendChild(debugTitle);
      statusBox.appendChild(debugNode);
    }

    statusBox.className = `status show ${type}`;
  }

  function clearStatus() {
    statusBox.textContent = "";
    statusBox.className = "status";
  }

  async function loadRuntimeConfig() {
    try {
      const response = await fetch(configApiUrl);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return;
      debugLookupEnabled = result.debugLookupEnabled === true;
    } catch {
      debugLookupEnabled = false;
    }
  }

  function setLoadingState(isLoading, label = "Continuar") {
    continueButton.disabled = isLoading;
    continueButton.textContent = isLoading ? "Un momento..." : label;
  }

  function setExistingPartnerMode(isExistingPartner) {
    rutInput.readOnly = isExistingPartner;
    form.elements.name.readOnly = isExistingPartner;
    rutInput.classList.toggle("locked-field", isExistingPartner);
    form.elements.name.classList.toggle("locked-field", isExistingPartner);
  }

  function applyBrand() {
    document.title = `${activeBrand.label} | Suscríbete y recibe beneficios`;
    document.body.classList.remove("brand-amphora", "brand-scalpers", "brand-renatta");
    document.body.classList.add(activeBrand.bodyClass);
    brandLogoNodes.forEach((node) => {
      node.src = activeBrand.logo;
      node.alt = activeBrand.label;
    });
    brandEmailNodes.forEach((node) => {
      node.textContent = activeBrand.email;
    });
    brandWebsiteNodes.forEach((node) => {
      node.href = activeBrand.website;
      node.textContent = activeBrand.websiteLinkText || `Ir a ${activeBrand.label}`;
    });

    if (activeBrand.bannerText) {
      brandBannerNodes.forEach((node) => node.classList.add("show"));
      brandBannerTextNodes.forEach((node) => {
        node.textContent = activeBrand.bannerText;
      });
    } else {
      brandBannerNodes.forEach((node) => node.classList.remove("show"));
    }

    if (formTitleNode) formTitleNode.textContent = activeBrand.formTitle;
    if (formSubtitleNode) formSubtitleNode.textContent = activeBrand.formSubtitle;
    if (thanksTitleNode) thanksTitleNode.textContent = activeBrand.thanksTitle;
    if (thanksSubtitleNode) thanksSubtitleNode.textContent = activeBrand.thanksSubtitle;

    if (activeBrand.thanksDiscountText && thanksDiscountTextNode) {
      thanksDiscountTextNode.textContent = activeBrand.thanksDiscountText;
      thanksDiscountTextNode.hidden = false;
    }

    if (activeBrand.discountCode && discountCodeBox && discountCodeValue) {
      discountCodeValue.textContent = activeBrand.discountCode;
      discountCodeBox.hidden = false;
    }
  }

  function openPolicyModal(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      policyOpener = event.currentTarget;
    }

    policyModal.hidden = false;
    policyContent.scrollTop = 0;
    if (!policyRead) {
      acknowledgePolicyButton.disabled = true;
      acknowledgePolicyButton.textContent = "Lee hasta el final";
      window.setTimeout(updatePolicyReadState, 0);
    }
    policyContent.focus();
  }

  function closePolicyModal() {
    policyModal.hidden = true;
    (policyOpener || openPolicyButton).focus();
  }

  function openMarketingPolicyModal(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      policyOpener = event.currentTarget;
    }

    marketingPolicyModal.hidden = false;
    marketingPolicyContent.scrollTop = 0;
    if (!marketingPolicyRead) {
      acknowledgeMarketingPolicyButton.disabled = true;
      acknowledgeMarketingPolicyButton.textContent = "Lee hasta el final";
      window.setTimeout(updateMarketingPolicyReadState, 0);
    }
    marketingPolicyContent.focus();
  }

  function closeMarketingPolicyModal() {
    marketingPolicyModal.hidden = true;
    (policyOpener || openMarketingPolicyButton).focus();
  }

  function updatePolicyReadState() {
    const distanceToBottom =
      policyContent.scrollHeight - policyContent.scrollTop - policyContent.clientHeight;

    if (distanceToBottom <= 6) {
      acknowledgePolicyButton.disabled = false;
      acknowledgePolicyButton.textContent = "Entendido";
    }
  }

  function updateMarketingPolicyReadState() {
    const distanceToBottom =
      marketingPolicyContent.scrollHeight -
      marketingPolicyContent.scrollTop -
      marketingPolicyContent.clientHeight;

    if (distanceToBottom <= 6) {
      acknowledgeMarketingPolicyButton.disabled = false;
      acknowledgeMarketingPolicyButton.textContent = "Entendido";
    }
  }

  function syncRutFields(sourceInput) {
    const formattedRut = formatRut(sourceInput.value.trim());
    rutEntryInput.value = formattedRut;
    rutInput.value = formattedRut;
  }

  function valueFromPartner(partner, keys) {
    for (const key of keys) {
      const value = partner?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value);
      }
    }
    return "";
  }

  function getBrandPolicyKeys() {
    const brandPolicyKeys = {
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

    return brandPolicyKeys[activeBrand.code] || brandPolicyKeys.AMPHORA;
  }

  function applyPartnerPolicyState(partner) {
    const policyKeys = getBrandPolicyKeys();
    const hasDataPolicyAuthorization = String(partner?.[policyKeys.dataPolicy] || "").toUpperCase() === "Y";
    const hasMarketingAuthorization =
      String(partner?.[policyKeys.marketing] || "").toUpperCase() === "Y";

    if (hasDataPolicyAuthorization) {
      policyRead = true;
      acceptPolicy.disabled = false;
      acceptPolicy.checked = true;
      acknowledgePolicyButton.disabled = false;
      acknowledgePolicyButton.textContent = "Entendido";
      setError("acceptPolicy", "");
    }

    if (hasMarketingAuthorization) {
      marketingPolicyRead = true;
      acceptMarketingPolicy.disabled = false;
      acceptMarketingPolicy.checked = true;
      acknowledgeMarketingPolicyButton.disabled = false;
      acknowledgeMarketingPolicyButton.textContent = "Entendido";
      setError("acceptMarketingPolicy", "");
    }
  }

  function formatBirthDate(value) {
    if (!value) return "";
    const text = String(value).trim();
    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

    const dateMatch = text.match(/\/Date\((\d+)\)\//);
    if (dateMatch) {
      const date = new Date(Number(dateMatch[1]));
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
  }

  function fillDetailsFromPartner(partner) {
    if (!partner) return;

    const rutValue = valueFromPartner(partner, ["FederalTaxID", "LicTradNum", "rut", "RUT"]);
    const nameValue = valueFromPartner(partner, ["CardName", "CardForeignName", "name", "Nombre"]);
    const phoneValue = valueFromPartner(partner, [
      "Phone1",
      "Phone2",
      "Cellular",
      "Cellolar",
      "Phone",
      "Telephone",
    ]);
    const emailValue = valueFromPartner(partner, [
      "EmailAddress",
      "E_Mail",
      "E_mail",
      "MailAddress",
      "Email",
      "Correo",
    ]);
    const birthValue = formatBirthDate(
      valueFromPartner(partner, ["U_GSP_BIRTHDATE", "BirthDate", "BirthDay", "birthDate"])
    );
    const cityValue = valueFromPartner(partner, [
      "City",
      "CityName",
      "County",
      "U_City",
      "city",
    ]);

    if (rutValue) {
      const formattedRut = formatRut(rutValue);
      rutEntryInput.value = formattedRut;
      rutInput.value = formattedRut;
    }
    if (nameValue) form.elements.name.value = nameValue;
    if (phoneValue) form.elements.phone.value = phoneValue;
    if (emailValue) form.elements.email.value = emailValue;
    if (birthValue) form.elements.birthDate.value = birthValue;
    if (cityValue) form.elements.city.value = cityValue;
    applyPartnerPolicyState(partner);
    setExistingPartnerMode(true);
  }

  function showRutStep() {
    currentStep = "rut-step";
    rutStep.hidden = false;
    detailsStep.hidden = true;
    clearStatus();
    setExistingPartnerMode(false);
    setError("rut", "");
    rutEntryInput.focus();
  }

  function showDetailsStep(options = {}) {
    const preserveStatus = Boolean(options.preserveStatus);
    currentStep = "details-step";
    rutStep.hidden = true;
    detailsStep.hidden = false;
    if (!preserveStatus) clearStatus();
    setError("rutStep", "");
    rutInput.focus();
  }

  function resetPolicyState() {
    setExistingPartnerMode(false);
    policyRead = false;
    acceptPolicy.checked = false;
    marketingPolicyRead = false;
    acceptMarketingPolicy.checked = false;
  }

  function validateRutStep() {
    const value = rutEntryInput.value.trim();
    setError("rutStep", "");

    if (!value) {
      setError("rutStep", "El RUT es obligatorio.");
      return false;
    }

    if (!isValidRut(value)) {
      setError("rutStep", "Ingresa un RUT chileno válido.");
      return false;
    }

    syncRutFields(rutEntryInput);
    return true;
  }

  function validate(data) {
    clearErrors();
    const issues = {};

    if (!data.rut) issues.rut = "El RUT es obligatorio.";
    else if (!isValidRut(data.rut)) issues.rut = "Ingresa un RUT chileno válido.";

    if (!data.name) issues.name = "El nombre es obligatorio.";
    if (!data.email) {
      issues.email = "El email es obligatorio.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      issues.email = "Ingresa un email válido.";
    }
    if (data.birthDate) {
      const birth = new Date(`${data.birthDate}T00:00:00`);
      const today = new Date();
      if (birth > today) issues.birthDate = "La fecha no puede estar en el futuro.";
    }
    if (!data.acceptPolicy) {
      issues.acceptPolicy = "Debes aceptar la Política de Privacidad para continuar.";
    }
    if (!data.acceptMarketingPolicy) {
      issues.acceptMarketingPolicy = "Debes aceptar para recibir promociones y novedades.";
    }

    Object.entries(issues).forEach(([field, message]) => setError(field, message));
    return Object.keys(issues).length === 0;
  }

  function getPayload() {
    const data = new FormData(form);
    return {
      brand: activeBrand.code,
      rut: data.get("rut").trim(),
      name: data.get("name").trim(),
      email: data.get("email").trim(),
      phone: data.get("phone").trim(),
      birthDate: data.get("birthDate"),
      city: data.get("city").trim(),
      acceptPolicy: data.get("acceptPolicy") === "on",
      acceptMarketingPolicy: data.get("acceptMarketingPolicy") === "on",
    };
  }

  rutEntryInput.addEventListener("blur", () => {
    if (rutEntryInput.value.trim()) syncRutFields(rutEntryInput);
  });

  rutEntryInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      continueButton.click();
    }
  });

  rutInput.addEventListener("blur", () => {
    if (rutInput.value.trim()) syncRutFields(rutInput);
  });

  continueButton.addEventListener("click", () => {
    clearStatus();
    if (!validateRutStep()) return;

    const rut = rutInput.value.trim();
    if (!rut) return;

    setLoadingState(true);
    setStatus("Buscando tus datos...", "info");

    fetch(
      `${lookupApiUrl}?rut=${encodeURIComponent(rut)}&brand=${encodeURIComponent(activeBrand.code)}&debugMode=${debugLookupEnabled ? "true" : "false"}`
    )
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          const error = new Error(
            "No pudimos verificar tus datos en este momento. Intenta nuevamente en unos segundos."
          );
          error.debugData = result.sapSearchResponse || result.sapFound || result;
          error.debugQuery = result.sapLookupQuery || null;
          throw error;
        }
        return result;
      })
      .then((result) => {
        const sapDebugData = result.sapSearchResponse || result.sapFound || result;
        const sapDebugQuery = result.sapLookupQuery || null;

        if (result.sapFound) {
          fillDetailsFromPartner(result.sapFound);
          setStatus(
            "Ya tienes una cuenta con nosotros. Completamos tus datos automáticamente.",
            "success",
            sapDebugData,
            sapDebugQuery
          );
        } else {
          setExistingPartnerMode(false);
          setStatus(
            "No encontramos una cuenta con ese RUT. Completa tus datos para crear una.",
            "info",
            sapDebugData,
            sapDebugQuery
          );
        }

        showDetailsStep({ preserveStatus: true });
      })
      .catch((error) => {
        setExistingPartnerMode(false);
        setStatus(error.message, "fail", error.debugData, error.debugQuery);
      })
      .finally(() => {
        setLoadingState(false);
      });
  });

  openPolicyButton.addEventListener("click", openPolicyModal);
  policyContent.addEventListener("scroll", updatePolicyReadState);
  openMarketingPolicyButton.addEventListener("click", openMarketingPolicyModal);
  marketingPolicyContent.addEventListener("scroll", updateMarketingPolicyReadState);

  acknowledgePolicyButton.addEventListener("click", () => {
    policyRead = true;
    acceptPolicy.disabled = false;
    setError("acceptPolicy", "");
    closePolicyModal();
  });

  acknowledgeMarketingPolicyButton.addEventListener("click", () => {
    marketingPolicyRead = true;
    acceptMarketingPolicy.disabled = false;
    setError("acceptMarketingPolicy", "");
    closeMarketingPolicyModal();
  });

  policyModal.querySelectorAll("[data-close-policy]").forEach((button) => {
    button.addEventListener("click", closePolicyModal);
  });

  marketingPolicyModal.querySelectorAll("[data-close-marketing-policy]").forEach((button) => {
    button.addEventListener("click", closeMarketingPolicyModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !policyModal.hidden) closePolicyModal();
    if (event.key === "Escape" && !marketingPolicyModal.hidden) closeMarketingPolicyModal();
  });

  form.addEventListener("reset", () => {
    clearErrors();
    clearStatus();
    resetPolicyState();
    window.setTimeout(() => {
      showRutStep();
      rutInput.value = "";
      rutEntryInput.value = "";
    }, 0);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearStatus();

    if (currentStep !== "details-step") return;

    syncRutFields(rutInput);
    const payload = getPayload();
    if (!validate(payload)) return;

    submitButton.disabled = true;
    submitButton.textContent = "Enviando...";

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const friendlyMessage =
          response.status < 500
            ? result.message || "Revisa los datos ingresados e intenta nuevamente."
            : "No pudimos completar tu suscripción en este momento. Intenta nuevamente en unos minutos.";
        setStatus(friendlyMessage, "fail", result.sapFound || result.sapSearchResponse);
        return;
      }

      form.reset();
      registrationPanel.hidden = true;
      thanksPanel.hidden = false;
      thanksPanel.focus();
    } catch (error) {
      setStatus(
        "No pudimos completar tu suscripción. Verifica tu conexión e intenta nuevamente.",
        "fail"
      );
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Suscribirme";
    }
  });

  function startClub(config) {
    const root = document
      .querySelector("#club-template")
      .content.firstElementChild.cloneNode(true);
    const $ = (selector) => root.querySelector(selector);
    const $$ = (selector) => Array.from(root.querySelectorAll(selector));

    // Datos de marca: se asignan antes de insertar para no pedir fotos que no se usan.
    $("[data-club-side]").setAttribute("aria-label", config.name);
    $("[data-club-photo-desktop]").srcset = config.photoDesktop;
    const photo = $("[data-club-photo]");
    photo.alt = config.photoAlt;
    photo.srcset = config.photoMobile;
    photo.src = config.photoFallback;
    $$("[data-club-logo]").forEach((node) => {
      node.src = config.logo;
      node.alt = activeBrand.label;
    });
    $$("[data-club-name]").forEach((node) => {
      node.textContent = config.name;
    });
    $("[data-club-tagline]").textContent = config.tagline;
    config.perks.forEach((perk) => {
      [$("[data-club-perks]"), $("[data-club-chips]")].forEach((list) => {
        const item = document.createElement("li");
        item.textContent = perk;
        list.appendChild(item);
      });
    });
    $("[data-club-site]").href = activeBrand.website;
    $("[data-club-site]").textContent = config.siteLabel;

    const live = $("#club-live");
    const rut = $("#club-rut");
    const rut2 = $("#club-rut2");
    const name = $("#club-name");
    const email = $("#club-email");
    const phone = $("#club-phone");
    const birth = $("#club-birth");
    const city = $("#club-city");
    const priv = $("#club-priv");
    const mkt = $("#club-mkt");
    const continueBtn = $("#club-f1 .club-btn");
    const joinBtn = $("#club-f2 .club-btn");
    const step1Error = $("#club-f1-error");
    const step2Error = $("#club-f2-error");
    const fields = [name, email, phone, birth, city];
    const SEND_ERROR =
      "No pudimos completar tu registro. Revisa tu conexión e intenta de nuevo. Si sigue fallando, avísale a quien te atiende en caja.";
    const LOOKUP_ERROR =
      "No pudimos verificar tus datos en este momento. Intenta nuevamente en unos segundos.";
    // RUT cuyos datos ya están en el paso 2: volver y continuar no borra lo escrito.
    let loadedRut = "";
    let busy = false;

    function showError(node, message) {
      node.textContent = message;
      node.hidden = !message;
    }

    function setFieldError(input, message) {
      const node = $(`#${input.id}-msg`);
      if (!node) return;
      showError(node, message);
      const box = input.closest(".club-fld, .club-chk");
      box.classList.toggle("bad", Boolean(message));
      input.setAttribute("aria-invalid", message ? "true" : "false");
    }

    function announce(message) {
      live.textContent = message;
    }

    function showPanel(number) {
      [1, 2, 3, 4].forEach((n) => {
        $(`#club-p${n}`).hidden = n !== number;
      });
      window.scrollTo(0, 0);
      $(`#club-t${number}`).focus({ preventScroll: true });
      const step = $(`#club-p${number} .club-steps span`);
      announce(step ? step.textContent : "");
    }

    function clearDetails() {
      fields.forEach((input) => {
        if (!input.readOnly) input.value = "";
      });
      priv.checked = false;
      mkt.checked = false;
      [...fields, priv].forEach((input) => setFieldError(input, ""));
      showError(step2Error, "");
    }

    function resetDetails() {
      name.readOnly = false;
      clearDetails();
      loadedRut = "";
    }

    function formatRutLive(value) {
      const clean = value.replace(/[^0-9kK]/g, "").toUpperCase().slice(0, 9);
      if (clean.length < 2) return clean;
      return `${clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${clean.slice(-1)}`;
    }

    function mobileDigits(value) {
      const digits = String(value).replace(/\D/g, "");
      return /^569\d{8}$/.test(digits) ? digits.slice(2) : digits;
    }

    function formatMobile(digits) {
      return `${digits[0]} ${digits.slice(1, 5)} ${digits.slice(5)}`;
    }

    function localToday() {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    }

    function fillDetails(partner, rutText) {
      resetDetails();
      rut2.value = rutText;
      birth.max = localToday();

      if (partner) {
        const policyKeys = getBrandPolicyKeys();
        name.value = valueFromPartner(partner, ["CardName", "CardForeignName"]).trim();
        // El backend no actualiza el nombre de un cliente existente.
        name.readOnly = name.value.length >= 3;
        email.value = valueFromPartner(partner, ["EmailAddress", "E_Mail", "MailAddress"]);
        const digits = ["Phone1", "Cellular", "Phone2"]
          .map((key) => mobileDigits(partner[key] || ""))
          .find((value) => /^9\d{8}$/.test(value));
        phone.value = digits ? formatMobile(digits) : "";
        birth.value = formatBirthDate(
          valueFromPartner(partner, ["U_GSP_BIRTHDATE", "BirthDate"])
        );
        city.value = valueFromPartner(partner, ["City", "CityName"]);
        // Conserva un permiso ya otorgado; si no, va desmarcado.
        mkt.checked = String(partner[policyKeys.marketing] || "").toUpperCase() === "Y";
      }

      $("#club-note-icon").setAttribute(
        "d",
        partner ? "M8 12.5l2.6 2.5L16 9.5" : "M12 8v5M12 16h.01"
      );
      $("#club-note-title").textContent = partner
        ? "Qué bueno verte de nuevo."
        : `Bienvenida a ${activeBrand.label}.`;
      $("#club-note-text").textContent = partner
        ? "Completamos tus datos con tus compras anteriores. Revísalos y listo."
        : "Completa tus datos para unirte al Club.";
      loadedRut = rutText;
    }

    // Es socia quien ya aceptó la política de datos de esta marca en SAP.
    function isMember(partner) {
      const flag = partner?.[getBrandPolicyKeys().dataPolicy];
      return String(flag || "").toUpperCase() === "Y";
    }

    rut.addEventListener("input", () => {
      const atEnd = rut.selectionStart === rut.value.length;
      const caret = rut.selectionStart;
      rut.value = formatRutLive(rut.value);
      const position = atEnd ? rut.value.length : caret;
      rut.setSelectionRange(position, position);
      setFieldError(rut, "");
      showError(step1Error, "");
    });

    $("#club-f1").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy) return;
      showError(step1Error, "");

      const message = !rut.value.trim()
        ? "Ingresa tu RUT para continuar."
        : !isValidRut(rut.value)
          ? "Revisa tu RUT: el dígito verificador no coincide."
          : "";
      setFieldError(rut, message);
      if (message) {
        announce(message);
        rut.focus();
        return;
      }

      const rutText = formatRutLive(rut.value);
      if (rutText === loadedRut) {
        showPanel(2);
        return;
      }

      busy = true;
      rut.readOnly = true;
      continueBtn.disabled = true;
      continueBtn.textContent = "Un momento…";
      try {
        const response = await fetch(
          `${lookupApiUrl}?rut=${encodeURIComponent(rutText)}&brand=${encodeURIComponent(activeBrand.code)}&debugMode=false`
        );
        if (!response.ok) throw new Error("lookup");
        const result = await response.json();

        if (isMember(result.sapFound)) {
          resetDetails();
          showPanel(4);
        } else {
          fillDetails(result.sapFound, rutText);
          showPanel(2);
        }
      } catch {
        showError(step1Error, LOOKUP_ERROR);
        announce(LOOKUP_ERROR);
      } finally {
        busy = false;
        rut.readOnly = false;
        continueBtn.disabled = false;
        continueBtn.textContent = "Continuar";
      }
    });

    function validateDetails() {
      const digits = mobileDigits(phone.value);
      const issues = [
        [name, name.value.trim().length < 3 && "Escribe tu nombre y apellido."],
        [
          email,
          !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim()) &&
            "Revisa tu email, parece que falta algo.",
        ],
        [
          phone,
          phone.value.trim() &&
            !/^9\d{8}$/.test(digits) &&
            "El celular tiene 9 dígitos y empieza con 9.",
        ],
        [
          birth,
          birth.validity.badInput
            ? "Revisa la fecha de nacimiento."
            : birth.value > localToday() && "La fecha no puede estar en el futuro.",
        ],
        [
          priv,
          !priv.checked &&
            "Para unirte al Club necesitamos que aceptes la Política de Privacidad.",
        ],
      ];
      issues.forEach(([input, message]) => setFieldError(input, message || ""));
      const failed = issues.filter(([, message]) => message);
      if (failed.length) {
        announce(failed.map(([, message]) => message).join(" "));
        failed[0][0].focus();
      }
      return failed.length === 0;
    }

    fields.forEach((input) => input.addEventListener("input", () => setFieldError(input, "")));
    priv.addEventListener("change", () => setFieldError(priv, ""));

    $("#club-f2").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy) return;
      showError(step2Error, "");
      if (!validateDetails()) return;

      const digits = mobileDigits(phone.value);
      const payload = {
        brand: activeBrand.code,
        rut: rut2.value,
        name: name.value.trim(),
        email: email.value.trim(),
        phone: digits ? `+56 ${formatMobile(digits)}` : "",
        birthDate: birth.value,
        city: city.value.trim(),
        acceptPolicy: priv.checked,
        acceptMarketingPolicy: mkt.checked,
      };

      busy = true;
      joinBtn.disabled = true;
      joinBtn.textContent = "Enviando…";
      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("submit");

        $("#club-first").textContent = payload.name.split(/\s+/)[0];
        $("#club-w-name").textContent = payload.name;
        $("#club-w-rut").textContent = payload.rut;
        $("#club-ok-text").textContent = payload.acceptMarketingPolicy
          ? "Desde ahora te llegan las novedades del Club, invitaciones a activaciones y eventos de marca, experiencias especiales y acceso anticipado."
          : "Ya eres parte del Club. Si quieres recibir novedades, invitaciones y accesos anticipados, puedes activarlos cuando quieras.";
        resetDetails();
        rut.value = "";
        tick();
        showPanel(3);
      } catch {
        showError(step2Error, SEND_ERROR);
        announce(SEND_ERROR);
      } finally {
        busy = false;
        joinBtn.disabled = false;
        joinBtn.textContent = "Unirme al Club";
      }
    });

    $("#club-clear").addEventListener("click", () => {
      if (!busy) clearDetails();
    });
    $$("[data-club-go]").forEach((button) =>
      button.addEventListener("click", () => {
        if (busy) return;
        if (button.dataset.clubGo === "restart") {
          resetDetails();
          rut.value = "";
        }
        showPanel(1);
      })
    );
    $("#club-more-priv").addEventListener("click", openPolicyModal);
    $("#club-more-mkt").addEventListener("click", openMarketingPolicyModal);

    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    function tick() {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const date = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
      const time = [now.getHours(), now.getMinutes(), now.getSeconds()].map(pad).join(":");
      $$("[data-club-clock]").forEach((node) => {
        node.textContent = `${date} · ${time}`;
      });
      $("[data-club-date]").textContent = date;
    }

    document.title = `Registro ${config.name}`;
    document.body.prepend(root);
    tick();
    window.setInterval(tick, 1000);
  }

  if (activeBrand.club) {
    applyBrand();
    // El formulario clásico no se usa en esta marca.
    document.querySelector(".shell").remove();
    startClub(activeBrand.club);
  } else {
    loadRuntimeConfig().finally(() => {
      showRutStep();
      applyBrand();
    });
  }
})();
