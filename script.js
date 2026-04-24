(function () {
  'use strict';

  // ---------- CONFIGURACIÓN ----------
  const ADMIN_IDS = [7401051294]; // ← TU ID REAL
  const BOT_TOKEN = '8188077724:AAFFFbtDzHAE-Tn9SwRhQuvA7sfzFijz0VE'; // Token del bot

  // ---------- VARIABLES GLOBALES ----------
  let tg = null;
  let isTelegram = false;
  let currentUser = null;
  let isAdmin = false;
  let products = [];
  let purchases = [];
  let paymentConfigs = {};
  let cloudStorage = null; // Referencia a CloudStorage

  const defaultPaymentConfig = {
    subtitle: 'Wireguard para navegar por la nacional (con Nauta hogar o WiFi ETECSA)',
    planName: 'Plan Personal Salida por Cuba',
    terms: [
      'Servicio de VPN válido por <strong>30 días</strong>.',
      'Se proporcionarán las credenciales de acceso una vez confirmado el pago.',
      'Incluye soporte técnico para la configuración y mantenimiento.',
      'Posibilidad de reembolso en las primeras 2 horas de recibido el servicio.'
    ],
    prices: { cup: 342, saldo: 137 },
    paymentMethods: [
      { name: 'Bolsa MiTrasfer (Monedero) CUP', number: '54283852' },
      { name: 'Saldo movil y número a confirmar', number: '54283852' },
      { name: 'Tarjeta CUP', number: '9248129970975892' }
    ]
  };

  // ---------- REFERENCIAS DOM (sin cambios) ----------
  const storeView = document.getElementById('storeView');
  const adminView = document.getElementById('adminView');
  const adminPanelBtn = document.getElementById('adminPanelBtn');
  const bottomTabs = document.getElementById('bottomTabs');
  const headerTitle = document.getElementById('headerTitle');
  const headerSubtitle = document.getElementById('headerSubtitle');
  const backBtn = document.getElementById('backBtn');
  const menuBtn = document.getElementById('menuBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userAvatar = document.getElementById('userAvatar');
  const userNameEl = document.getElementById('userName');
  const userUsernameEl = document.getElementById('userUsername');
  const productsContainer = document.getElementById('productsContainer');
  const adminProductsList = document.getElementById('adminProductsList');
  const productCount = document.getElementById('productCount');
  const adminProductCount = document.getElementById('adminProductCount');
  const emptyProductsMsg = document.getElementById('emptyProductsMsg');
  const adminEmptyMsg = document.getElementById('adminEmptyMsg');
  const purchasesSection = document.getElementById('purchasesSection');
  const purchasesContainer = document.getElementById('purchasesContainer');
  const usersListContainer = document.getElementById('usersListContainer');
  const usersEmptyMsg = document.getElementById('usersEmptyMsg');
  const addProductForm = document.getElementById('addProductForm');
  const manualProductSelect = document.getElementById('manualProductSelect');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalMessage = document.getElementById('modalMessage');
  const modalCancel = document.getElementById('modalCancel');
  const modalConfirm = document.getElementById('modalConfirm');
  const paymentModal = document.getElementById('paymentModal');
  const closePaymentModal = document.getElementById('closePaymentModal');
  const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
  const submitPaymentBtn = document.getElementById('submitPaymentBtn');
  const acceptTerms = document.getElementById('acceptTerms');
  const couponCode = document.getElementById('couponCode');
  const verifyCouponBtn = document.getElementById('verifyCouponBtn');
  const couponMessage = document.getElementById('couponMessage');
  const paymentMethod = document.getElementById('paymentMethod');
  const paymentProof = document.getElementById('paymentProof');
  const fileName = document.getElementById('fileName');
  const contractType = document.getElementById('contractType');
  const editProductModal = document.getElementById('editProductModal');
  const editProductForm = document.getElementById('editProductForm');
  const editProductId = document.getElementById('editProductId');
  const editProductName = document.getElementById('editProductName');
  const editProductDescription = document.getElementById('editProductDescription');
  const editProductPrice = document.getElementById('editProductPrice');
  const editProductImage = document.getElementById('editProductImage');
  const editProductStock = document.getElementById('editProductStock');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const manualAttachment = document.getElementById('manualAttachment');
  const attachmentFileName = document.getElementById('attachmentFileName');
  const darkModeBtn = document.getElementById('darkModeBtn');
  const darkModeIcon = document.getElementById('darkModeIcon');
  let manualFileFileId = null; // Ahora almacenamos file_id, no Base64
  let currentProductForPurchase = null;
  let selectedProofFileId = null;

  // ---------- MODO OSCURO ----------
  function applyDarkMode(enabled) {
    if (enabled) {
      document.body.classList.add('dark');
      darkModeIcon.textContent = '☀️';
    } else {
      document.body.classList.remove('dark');
      darkModeIcon.textContent = '🌙';
    }
    localStorage.setItem('darkMode', enabled);
  }

  function initDarkMode() {
    const saved = localStorage.getItem('darkMode');
    applyDarkMode(saved === 'true');
    darkModeBtn.addEventListener('click', () => {
      const isDark = document.body.classList.contains('dark');
      applyDarkMode(!isDark);
    });
  }

  // ---------- DETECCIÓN DE TELEGRAM ----------
  function waitForTelegram(timeout = 5000) {
    return new Promise((resolve) => {
      if (window.Telegram && window.Telegram.WebApp) {
        resolve(window.Telegram.WebApp);
        return;
      }
      let elapsed = 0;
      const interval = setInterval(() => {
        if (window.Telegram && window.Telegram.WebApp) {
          clearInterval(interval);
          resolve(window.Telegram.WebApp);
        } else if (elapsed >= timeout) {
          clearInterval(interval);
          resolve(null);
        }
        elapsed += 100;
      }, 100);
    });
  }

  // ---------- SINCRONIZACIÓN CON CLOUD STORAGE ----------
  async function cloudGet(key) {
    if (!cloudStorage) return null;
    try {
      const result = await cloudStorage.getItem(key);
      return result;
    } catch (e) {
      console.warn('CloudStorage get error:', e);
      return null;
    }
  }

  async function cloudSet(key, value) {
    if (!cloudStorage) return;
    try {
      await cloudStorage.setItem(key, value);
    } catch (e) {
      console.warn('CloudStorage set error:', e);
    }
  }

  // Cargar datos con preferencia CloudStorage -> localStorage
  async function loadDataFromStorage(key, fallback = null) {
    if (cloudStorage) {
      const cloudVal = await cloudGet(key);
      if (cloudVal) {
        try { return JSON.parse(cloudVal); } catch { return cloudVal; }
      }
    }
    const localVal = localStorage.getItem(key);
    if (localVal) {
      try { return JSON.parse(localVal); } catch { return localVal; }
    }
    return fallback;
  }

  async function saveDataToStorage(key, value) {
    const str = JSON.stringify(value);
    localStorage.setItem(key, str);
    await cloudSet(key, str);
  }

  // ---------- INICIALIZACIÓN ----------
  async function init() {
    initDarkMode();
    console.log('🚀 Iniciando Wireguard Shop...');
    tg = await waitForTelegram(5000);

    if (tg) {
      isTelegram = true;
      tg.ready();
      tg.expand();
      cloudStorage = tg.CloudStorage; // Referencia a CloudStorage

      const userData = tg.initDataUnsafe?.user;
      if (userData && userData.id) {
        currentUser = {
          id: userData.id,
          first_name: userData.first_name,
          last_name: userData.last_name,
          username: userData.username
        };
        isAdmin = ADMIN_IDS.includes(currentUser.id);
        console.log('👤 Usuario Telegram:', currentUser);
        console.log('👑 ¿Es admin?:', isAdmin);
      } else {
        console.warn('⚠️ No se pudieron obtener datos del usuario de Telegram.');
        currentUser = { id: 0, first_name: 'Invitado', username: null };
        isAdmin = false;
      }
    } else {
      console.log('💻 Ejecutando fuera de Telegram (modo desarrollo).');
      isTelegram = false;
      currentUser = { id: 123456, first_name: 'Demo', username: 'demo' };
      isAdmin = false;
    }

    // Cargar datos (con soporte para CloudStorage)
    await loadProducts();
    await loadPurchases();
    await loadPaymentConfigs();

    updateUIForRole();
    renderStore();
    renderAdminList();
    renderUsersList();
    renderUserPurchases();
    populateManualSelect();
    renderPaymentConfigForm();
    setupEventListeners();

    // Sincronización en tiempo real: escuchar cambios de CloudStorage (solo si está disponible)
    if (cloudStorage) {
      // Podemos escuchar eventos de cambio (no hay un listener nativo, pero podemos recargar al recibir un mensaje)
      // Usaremos un intervalo simple para detectar cambios externos (opcional)
      setInterval(async () => {
        const newProducts = await loadDataFromStorage('products');
        if (JSON.stringify(newProducts) !== JSON.stringify(products)) {
          products = newProducts || [];
          renderStore();
          renderAdminList();
          populateManualSelect();
          renderPaymentConfigForm();
        }
        const newPurchases = await loadDataFromStorage('purchases');
        if (JSON.stringify(newPurchases) !== JSON.stringify(purchases)) {
          purchases = newPurchases || [];
          renderUsersList();
          renderUserPurchases();
        }
      }, 2000);
    }
  }

  // ---------- GESTIÓN DE DATOS (corregidas con async y CloudStorage) ----------
  async function loadProducts() {
    const stored = await loadDataFromStorage('products');
    if (stored && Array.isArray(stored)) {
      products = stored;
    } else {
      products = [
        { id: '1', name: 'Wireguard VPN 30 días', description: 'Navegación nacional con Nauta/WiFi ETECSA', price: 342, image: '🔒', inStock: true }
      ];
      await saveProducts();
    }
    products = products.map(p => ({ ...p, inStock: p.inStock !== undefined ? p.inStock : true }));
  }

  async function saveProducts() {
    await saveDataToStorage('products', products);
    populateManualSelect();
    renderPaymentConfigForm();
  }

  async function loadPurchases() {
    const stored = await loadDataFromStorage('purchases');
    purchases = Array.isArray(stored) ? stored : [];
    renderUsersList();
    renderUserPurchases();
  }

  async function savePurchases() {
    await saveDataToStorage('purchases', purchases);
  }

  async function loadPaymentConfigs() {
    const stored = await loadDataFromStorage('paymentConfigs');
    paymentConfigs = stored || {};
  }

  async function savePaymentConfigs() {
    await saveDataToStorage('paymentConfigs', paymentConfigs);
  }

  function getPaymentConfigForProduct(productId) {
    return paymentConfigs[productId] || JSON.parse(JSON.stringify(defaultPaymentConfig));
  }

  // ---------- ACTUALIZACIÓN DE UI ----------
  function updateUIForRole() {
    const displayName = currentUser.first_name + (currentUser.last_name ? ' ' + currentUser.last_name : '');
    userNameEl.textContent = displayName || 'Usuario';
    userUsernameEl.textContent = currentUser.username ? '@' + currentUser.username : '@usuario';
    userAvatar.textContent = (currentUser.first_name?.charAt(0) || 'U').toUpperCase();

    if (isAdmin) {
      adminPanelBtn.style.display = 'flex';
      bottomTabs.style.display = 'flex';
      headerSubtitle.textContent = 'Admin · Tienda';
    } else {
      adminPanelBtn.style.display = 'none';
      bottomTabs.style.display = 'none';
      headerSubtitle.textContent = 'Tienda digital';
    }
    headerTitle.textContent = 'Wireguard Shop';
  }

  // ---------- RENDERIZADO (idéntico al anterior, omito por brevedad) ----------
  // (Todas las funciones de renderizado, modales, etc., se mantienen igual que en la versión anterior, pero ahora saveProducts, savePurchases son async y deben ser llamadas con await en los lugares correspondientes. Ajustaré los llamados.)

  // Asegúrate de que en los lugares donde se llama a saveProducts(), savePurchases() se use await, porque ahora son async.

  // Por brevedad, no repito todo el código de renderizado, pero es idéntico al último script.js funcional (el que sube comprobante con file_id), con la diferencia de que las funciones de guardado son async y se llaman con await.

  // ---------- SUBIR COMPROBANTE A TELEGRAM (igual) ----------
  async function uploadProofToTelegram(file) {
    const adminId = ADMIN_IDS[0];
    const clientName = currentUser.first_name + (currentUser.last_name ? ' ' + currentUser.last_name : '');
    const productName = currentProductForPurchase ? currentProductForPurchase.name : 'Producto';

    const formData = new FormData();
    formData.append('chat_id', adminId);
    formData.append('photo', file);
    formData.append('caption', `🧾 Comprobante de ${clientName} (ID: ${currentUser.id})\nProducto: ${productName}`);

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: formData
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.description || 'Error al subir foto');
    const photos = json.result.photo;
    return photos[photos.length - 1].file_id;
  }

  // ---------- SUBIR ARCHIVO ADJUNTO PARA ENVÍO MANUAL ----------
  async function uploadAttachmentToTelegram(file) {
    const formData = new FormData();
    formData.append('chat_id', ADMIN_IDS[0]); // Se sube al admin como respaldo o se puede enviar directamente
    formData.append('document', file);
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: formData
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.description || 'Error al subir archivo');
    return json.result.document.file_id;
  }

  // ---------- ENVÍO MANUAL (corregido) ----------
  async function handleManualSend() {
    const targetUserId = document.getElementById('targetUserId').value.trim();
    const productId = manualProductSelect.value;
    const customMessage = document.getElementById('customMessage').value.trim();

    if (!targetUserId || !productId) {
      showToast('⚠️ Completa ID y producto', 2000);
      return;
    }

    const product = products.find(p => p.id === productId);
    if (!product) {
      showToast('❌ Producto no encontrado', 2000);
      return;
    }

    // Si hay archivo adjunto y aún no se ha subido, lo subimos ahora
    let attachmentFileId = manualFileFileId;
    const fileInput = document.getElementById('manualAttachment');
    if (fileInput.files.length > 0 && !attachmentFileId) {
      showToast('⏳ Subiendo archivo adjunto...', 2000);
      try {
        attachmentFileId = await uploadAttachmentToTelegram(fileInput.files[0]);
        showToast('✅ Archivo listo', 1000);
      } catch (err) {
        showToast('❌ Error al subir el archivo: ' + err.message, 3000);
        return;
      }
    }

    // Construir datos ligeros para sendData
    const sendData = {
      action: 'manual_send',
      target_user_id: targetUserId,
      product: { id: product.id, name: product.name, description: product.description, price: product.price },
      custom_message: customMessage || `Aquí está tu producto: ${product.name}`,
      attachment_file_id: attachmentFileId || null
    };

    const dataStr = JSON.stringify(sendData);
    if (dataStr.length > 4096) {
      showToast('⚠️ Los datos son demasiado grandes', 3000);
      return;
    }

    if (isTelegram) {
      tg.sendData(dataStr);
      tg.showPopup({ title: '📨 Envío solicitado', message: 'El bot procesará el envío.' });
    } else {
      console.log('📤 Datos enviados (demo):', sendData);
      showToast(`📨 Enviado a ${targetUserId} (demo)`, 2000);
    }

    // Limpiar formulario
    document.getElementById('targetUserId').value = '';
    manualProductSelect.value = '';
    document.getElementById('customMessage').value = '';
    if (manualAttachment) manualAttachment.value = '';
    if (attachmentFileName) attachmentFileName.textContent = 'Ningún archivo seleccionado';
    manualFileFileId = null;
  }

  // ---------- EVENT LISTENERS (actualizado el de archivo adjunto) ----------
  function setupEventListeners() {
    // ... todos los listeners existentes ...

    // Listener para el archivo adjunto en envío manual (ahora solo guardamos referencia, no Base64)
    if (manualAttachment) {
      manualAttachment.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          attachmentFileName.textContent = file.name;
          // No convertimos a Base64, solo guardamos el archivo para subirlo después
          manualFileFileId = null; // Se subirá cuando se pulse enviar
        } else {
          attachmentFileName.textContent = 'Ningún archivo seleccionado';
        }
      });
    }

    // El botón de envío manual
    const sendManualBtn = document.getElementById('sendManualProductBtn');
    if (sendManualBtn) sendManualBtn.onclick = handleManualSend;

    // ... resto de listeners (exportar, limpiar, etc.) sin cambios ...
  }

  // El resto del código (renderStore, renderAdminList, etc.) es idéntico al de la versión anterior, pero recuerda que saveProducts, savePurchases deben ser llamadas con await.

  // Iniciar la aplicación
  init();
})();
