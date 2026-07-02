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
  const apiUrl =
    window.location.protocol === "file:"
      ? "http://localhost:3000/api/business-partners"
      : "/api/business-partners";
  const lookupApiUrl =
    window.location.protocol === "file:"
      ? "http://localhost:3000/api/business-partners/lookup"
      : "/api/business-partners/lookup";
  const configApiUrl =
    window.location.protocol === "file:"
      ? "http://localhost:3000/api/config"
      : "/api/config";
  const errors = new Map(
    Array.from(document.querySelectorAll("[data-error-for]")).map((node) => [
      node.dataset.errorFor,
      node,
    ])
  );

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
      logo: "./assets/logo-amphora.png",
      website: "https://www.amphora.cl",
    },
    SCALPERS: {
      code: "SCALPERS",
      label: "Scalpers",
      email: "datospersonales@scalpers.cl",
      bodyClass: "brand-scalpers",
      logo: "./assets/logo-scalpers.svg",
      website: "https://cl.scalperscompany.com",
    },
    RENATTA: {
      code: "RENATTA",
      label: "Renatta",
      email: "datospersonales@amphora.cl",
      bodyClass: "brand-renatta",
      logo: "./assets/logo-renatta.png",
      website: "https://www.renattandgo.cl",
    },
  };

  const brandParams = new URLSearchParams(window.location.search);
  const brandCode = (brandParams.get("brand") || brandParams.get("marca") || "AMPHORA")
    .trim()
    .toUpperCase();
  const activeBrand = brandConfig[brandCode] || brandConfig.AMPHORA;

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
    document.title = `${activeBrand.label} | Suscribete y recibe beneficios`;
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
      node.textContent = `Ir a ${activeBrand.label}`;
    });
  }

  function openPolicyModal(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
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
    openPolicyButton.focus();
  }

  function openMarketingPolicyModal(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
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
    openMarketingPolicyButton.focus();
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
    acceptPolicy.disabled = true;
    acknowledgePolicyButton.disabled = true;
    acknowledgePolicyButton.textContent = "Lee hasta el final";
    marketingPolicyRead = false;
    acceptMarketingPolicy.checked = false;
    acceptMarketingPolicy.disabled = true;
    acknowledgeMarketingPolicyButton.disabled = true;
    acknowledgeMarketingPolicyButton.textContent = "Lee hasta el final";
  }

  function validateRutStep() {
    const value = rutEntryInput.value.trim();
    setError("rutStep", "");

    if (!value) {
      setError("rutStep", "El RUT es obligatorio.");
      return false;
    }

    if (!isValidRut(value)) {
      setError("rutStep", "Ingresa un RUT chileno valido.");
      return false;
    }

    syncRutFields(rutEntryInput);
    return true;
  }

  function validate(data) {
    clearErrors();
    const issues = {};

    if (!data.rut) issues.rut = "El RUT es obligatorio.";
    else if (!isValidRut(data.rut)) issues.rut = "Ingresa un RUT chileno valido.";

    if (!data.name) issues.name = "El nombre es obligatorio.";
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      issues.email = "Ingresa un email valido.";
    }
    if (data.birthDate) {
      const birth = new Date(`${data.birthDate}T00:00:00`);
      const today = new Date();
      if (birth > today) issues.birthDate = "La fecha no puede estar en el futuro.";
    }
    if (!policyRead) {
      issues.acceptPolicy = "Debes leer el texto completo antes de aceptar.";
    } else if (!data.acceptPolicy) {
      issues.acceptPolicy = "Debes aceptar la Politica de Privacidad para continuar.";
    }
    if (!marketingPolicyRead) {
      issues.acceptMarketingPolicy = "Debes leer el texto completo antes de aceptar.";
    } else if (!data.acceptMarketingPolicy) {
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
            "Ya tienes una cuenta con nosotros. Completamos tus datos automaticamente.",
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
            : "No pudimos completar tu suscripcion en este momento. Intenta nuevamente en unos minutos.";
        setStatus(friendlyMessage, "fail", result.sapFound || result.sapSearchResponse);
        return;
      }

      form.reset();
      registrationPanel.hidden = true;
      thanksPanel.hidden = false;
      thanksPanel.focus();
    } catch (error) {
      setStatus(
        "No pudimos completar tu suscripcion. Verifica tu conexion e intenta nuevamente.",
        "fail"
      );
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Suscribirme";
    }
  });

  loadRuntimeConfig().finally(() => {
    showRutStep();
    applyBrand();
  });
})();
