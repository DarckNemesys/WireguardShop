(function() {
  'use strict';

  // ---------- CONFIGURACIÓN ----------
  const ADMIN_IDS = [7401051294]; // ← TU ID REAL

  // ---------- VARIABLES GLOBALES ----------
  let tg = null;
  let isTelegram = false;
  let currentUser = null;
  let isAdmin = false;
  let products = [];
  let purchases = [];
  let paymentConfigs = {};

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

  // ---------- REFERENCIAS DOM ----------
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
  const userName = document.getElementById('userName');
  const userUsername = document.getElementById('userUsername');
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
  let manualFileBase64 = null;
  let currentProductForPurchase = null;
  let selectedImageBase64 = null;

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

  // ---------- INICIALIZACIÓN ----------
  async function init() {
    initDarkMode();
    console.log('🚀 Iniciando Wireguard Shop...');
    tg = await waitForTelegram(5000);

    if (tg) {
      isTelegram = true;
      tg.ready();
      tg.expand();

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
      isAdmin = false; // Cambiar a true para probar localmente como admin
    }

    loadProducts();
    loadPurchases();
    loadPaymentConfigs();
    updateUIForRole();
    renderStore();
    renderAdminList();
    renderUsersList();
    renderUserPurchases();
    populateManualSelect();
    renderPaymentConfigForm();
    setupEventListeners();
  }

  // ---------- GESTIÓN DE DATOS ----------
  function loadProducts() {
    const stored = localStorage.getItem('telegram_shop_products');
    if (stored) {
      try { products = JSON.parse(stored); } catch(e) { products = []; }
    } else {
      products = [
        { id: '1', name: 'Wireguard VPN 30 días', description: 'Navegación nacional con Nauta/WiFi ETECSA', price: 342, image: '🔒', inStock: true }
      ];
      saveProducts();
    }
    products = products.map(p => ({ ...p, inStock: p.inStock !== undefined ? p.inStock : true }));
    saveProducts();
    populateManualSelect();
    renderStore();
    renderAdminList();
    renderPaymentConfigForm();
  }

  function saveProducts() {
    localStorage.setItem('telegram_shop_products', JSON.stringify(products));
    populateManualSelect();
    renderPaymentConfigForm();
  }

  function loadPurchases() {
    const stored = localStorage.getItem('telegram_shop_purchases');
    if (stored) {
      try { purchases = JSON.parse(stored); } catch(e) { purchases = []; }
    }
    renderUsersList();
    renderUserPurchases();
  }

  function savePurchases() {
    localStorage.setItem('telegram_shop_purchases', JSON.stringify(purchases));
  }

  function loadPaymentConfigs() {
    const stored = localStorage.getItem('payment_configs');
    if (stored) {
      try { paymentConfigs = JSON.parse(stored); } catch(e) { paymentConfigs = {}; }
    }
  }

  function savePaymentConfigs() {
    localStorage.setItem('payment_configs', JSON.stringify(paymentConfigs));
  }

  function getPaymentConfigForProduct(productId) {
    return paymentConfigs[productId] || JSON.parse(JSON.stringify(defaultPaymentConfig));
  }

  // ---------- ACTUALIZACIÓN DE UI ----------
  function updateUIForRole() {
    const displayName = currentUser.first_name + (currentUser.last_name ? ' ' + currentUser.last_name : '');
    if (userName) userName.textContent = displayName || 'Usuario';
    if (userUsername) userUsername.textContent = currentUser.username ? '@' + currentUser.username : '@usuario';
    if (userAvatar) userAvatar.textContent = (currentUser.first_name?.charAt(0) || 'U').toUpperCase();

    if (isAdmin) {
      if (adminPanelBtn) adminPanelBtn.style.display = 'flex';
      if (bottomTabs) bottomTabs.style.display = 'flex';
      if (headerSubtitle) headerSubtitle.textContent = 'Admin · Tienda';
    } else {
      if (adminPanelBtn) adminPanelBtn.style.display = 'none';
      if (bottomTabs) bottomTabs.style.display = 'none';
      if (headerSubtitle) headerSubtitle.textContent = 'Tienda digital';
    }
    if (headerTitle) headerTitle.textContent = 'Wireguard Shop';
  }

  // ---------- RENDERIZADO DE PRODUCTOS ----------
  function populateManualSelect() {
    if (!manualProductSelect) return;
    manualProductSelect.innerHTML = '<option value="">Selecciona un producto...</option>';
    products.forEach(p => {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = `${p.name} - $${p.price.toFixed(2)} ${!p.inStock ? '(Agotado)' : ''}`;
      manualProductSelect.appendChild(option);
    });
  }

  function renderStore() {
    if (!productsContainer) return;
    productsContainer.innerHTML = '';
    if (products.length === 0) {
      emptyProductsMsg.style.display = 'block';
      productCount.textContent = '0 items';
      return;
    }
    emptyProductsMsg.style.display = 'none';
    productCount.textContent = `${products.length} items`;
    products.forEach(product => {
      const item = createProductElement(product, false);
      productsContainer.appendChild(item);
    });
  }

  function renderAdminList() {
    if (!adminProductsList) return;
    adminProductsList.innerHTML = '';
    if (products.length === 0) {
      adminEmptyMsg.style.display = 'block';
      adminProductCount.textContent = '0';
      return;
    }
    adminEmptyMsg.style.display = 'none';
    adminProductCount.textContent = products.length;
    products.forEach(product => {
      const item = createProductElement(product, true);
      adminProductsList.appendChild(item);
    });
  }

  function createProductElement(product, isAdminView) {
    const div = document.createElement('div');
    div.className = 'product-item';
    const stockStatus = product.inStock ? '<span class="stock-badge">En stock</span>' : '<span class="stock-badge out">Agotado</span>';
    div.innerHTML = `
      <div class="product-image">${product.image || '📦'}</div>
      <div class="product-details">
        <div class="product-title">
          ${escapeHtml(product.name)}
          ${!isAdminView ? stockStatus : ''}
        </div>
        <div class="product-description">${escapeHtml(product.description || '')}</div>
        <div class="product-price">$${product.price.toFixed(2)}</div>
      </div>
      <div class="product-actions"></div>
    `;
    const actionsDiv = div.querySelector('.product-actions');

    if (isAdminView) {
      const editBtn = document.createElement('button');
      editBtn.className = 'admin-edit-btn';
      editBtn.innerHTML = '✏️';
      editBtn.onclick = (e) => { e.stopPropagation(); openEditModal(product); };
      actionsDiv.appendChild(editBtn);
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'admin-delete-btn';
      deleteBtn.innerHTML = '🗑️';
      deleteBtn.onclick = (e) => { e.stopPropagation(); confirmDeleteProduct(product.id); };
      actionsDiv.appendChild(deleteBtn);
      
      const stockInfo = document.createElement('span');
      stockInfo.style.marginLeft = '8px';
      stockInfo.style.fontSize = '12px';
      stockInfo.style.color = product.inStock ? 'var(--tg-success)' : 'var(--tg-danger)';
      stockInfo.textContent = product.inStock ? '● Disponible' : '● Agotado';
      div.querySelector('.product-details').appendChild(stockInfo);
    } else {
      const buyBtn = document.createElement('button');
      buyBtn.className = 'buy-btn';
      buyBtn.textContent = product.inStock ? 'Comprar' : 'Agotado';
      buyBtn.disabled = !product.inStock;
      buyBtn.onclick = (e) => { 
        e.stopPropagation(); 
        if (product.inStock) openPaymentModal(product);
      };
      actionsDiv.appendChild(buyBtn);
    }
    return div;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ---------- RENDERIZADO DE USUARIOS Y COMPRAS ----------
  function renderUsersList() {
    if (!usersListContainer) return;
    usersListContainer.innerHTML = '';
    const userMap = new Map();
    purchases.forEach(p => {
      if (!userMap.has(p.userId)) {
        userMap.set(p.userId, { userId: p.userId, userName: p.userName, purchases: [] });
      }
      userMap.get(p.userId).purchases.push(p);
    });
    const users = Array.from(userMap.values());
    if (users.length === 0) {
      usersEmptyMsg.style.display = 'block';
      return;
    }
    usersEmptyMsg.style.display = 'none';
    users.forEach(user => {
      const div = document.createElement('div');
      div.className = 'user-item';
      div.innerHTML = `
        <div class="user-avatar">${user.userName?.charAt(0) || '👤'}</div>
        <div class="user-info">
          <div class="user-name">${escapeHtml(user.userName || 'Usuario')}</div>
          <div class="user-id">ID: ${user.userId}</div>
          <div class="user-purchases">📦 ${user.purchases.length} compra(s)</div>
        </div>
        <button class="send-to-user-btn" data-userid="${user.userId}">📨 Enviar</button>
      `;
      div.querySelector('.send-to-user-btn').onclick = (e) => {
        e.stopPropagation();
        openManualSendForUser(user.userId, user.userName);
      };
      usersListContainer.appendChild(div);
    });
  }

  function renderUserPurchases() {
    const userPurchases = purchases.filter(p => p.userId === currentUser.id);
    if (userPurchases.length === 0) {
      purchasesSection.style.display = 'none';
      return;
    }
    purchasesSection.style.display = 'block';
    purchasesContainer.innerHTML = '';
    userPurchases.forEach(purchase => {
      const product = products.find(p => p.id === purchase.productId);
      if (!product) return;
      const div = document.createElement('div');
      div.className = 'purchase-item';
      div.innerHTML = `
        <div class="product-image">${product.image || '📦'}</div>
        <div class="product-details">
          <div class="product-title">${escapeHtml(product.name)}</div>
          <div class="product-description">Comprado el ${new Date(purchase.date).toLocaleDateString()}</div>
        </div>
      `;
      purchasesContainer.appendChild(div);
    });
  }

  // ---------- CONFIGURACIÓN DE PAGO ----------
  function renderPaymentConfigForm() {
    const container = document.getElementById('paymentConfigContainer');
    if (!container) return;
    if (!isAdmin) {
      container.innerHTML = '<div class="empty-state">⛔ Solo administradores</div>';
      return;
    }
    
    let html = `
      <div class="form-group">
        <label>Seleccionar producto a configurar</label>
        <select id="configProductSelect" class="form-select">
          <option value="">-- Selecciona un producto --</option>
    `;
    products.forEach(p => {
      html += `<option value="${p.id}">${escapeHtml(p.name)}</option>`;
    });
    html += `</select></div>`;
    
    html += `
      <div id="configFormFields" style="display: none;">
        <div class="form-group">
          <label>Subtítulo</label>
          <input type="text" id="configSubtitle">
        </div>
        <div class="form-group">
          <label>Nombre del plan</label>
          <input type="text" id="configPlanName">
        </div>
        <div class="form-group">
          <label>Términos (uno por línea)</label>
          <textarea id="configTerms" rows="4"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group half">
            <label>Precio CUP</label>
            <input type="number" id="configPriceCUP">
          </div>
          <div class="form-group half">
            <label>Precio SALDO</label>
            <input type="number" id="configPriceSaldo">
          </div>
        </div>
        <div class="form-group">
          <label>Métodos de pago (JSON editable)</label>
          <textarea id="configMethods" rows="5"></textarea>
          <small>Formato: [{"name":"Nombre","number":"Número"}]</small>
        </div>
        <button type="button" class="primary-button" id="savePaymentConfigBtn">Guardar configuración para este producto</button>
      </div>
    `;
    container.innerHTML = html;
    
    const select = document.getElementById('configProductSelect');
    const fieldsDiv = document.getElementById('configFormFields');
    
    select.addEventListener('change', () => {
      const productId = select.value;
      if (!productId) {
        fieldsDiv.style.display = 'none';
        return;
      }
      const config = getPaymentConfigForProduct(productId);
      document.getElementById('configSubtitle').value = config.subtitle;
      document.getElementById('configPlanName').value = config.planName;
      document.getElementById('configTerms').value = config.terms.join('\n');
      document.getElementById('configPriceCUP').value = config.prices.cup;
      document.getElementById('configPriceSaldo').value = config.prices.saldo;
      document.getElementById('configMethods').value = JSON.stringify(config.paymentMethods, null, 2);
      fieldsDiv.style.display = 'block';
    });
    
    const saveBtn = document.getElementById('savePaymentConfigBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const productId = select.value;
        if (!productId) {
          showToast('⚠️ Selecciona un producto', 2000);
          return;
        }
        try {
          const newConfig = {
            subtitle: document.getElementById('configSubtitle').value,
            planName: document.getElementById('configPlanName').value,
            terms: document.getElementById('configTerms').value.split('\n').filter(l => l.trim() !== ''),
            prices: {
              cup: parseFloat(document.getElementById('configPriceCUP').value) || 0,
              saldo: parseFloat(document.getElementById('configPriceSaldo').value) || 0
            },
            paymentMethods: JSON.parse(document.getElementById('configMethods').value)
          };
          paymentConfigs[productId] = newConfig;
          savePaymentConfigs();
          showToast('✅ Configuración guardada', 1500);
          if (currentProductForPurchase && currentProductForPurchase.id === productId) {
            renderPaymentModalContent(productId);
          }
        } catch(e) {
          showToast('❌ Error en formato JSON', 2000);
        }
      });
    }
  }

  function renderPaymentModalContent(productId) {
    const config = getPaymentConfigForProduct(productId);
    const subtitleEl = document.querySelector('.payment-subtitle');
    const planBadgeEl = document.querySelector('.plan-badge');
    const termsList = document.querySelector('.terms-list');
    
    if (!subtitleEl || !planBadgeEl || !termsList) return;
    
    subtitleEl.textContent = config.subtitle;
    planBadgeEl.textContent = config.planName;
    
    termsList.innerHTML = config.terms.map(t => `<li>${t}</li>`).join('');
    
    document.getElementById('cupPrice').textContent = `${config.prices.cup} CUP`;
    document.getElementById('saldoPrice').textContent = `${config.prices.saldo} CUP`;
    
    const methodsContainer = document.querySelector('.payment-methods-section');
    methodsContainer.innerHTML = '<label>Métodos de Pago Disponibles</label>';
    config.paymentMethods.forEach(m => {
      const div = document.createElement('div');
      div.className = 'payment-method-item';
      div.innerHTML = `<span>${escapeHtml(m.name)}</span><span class="payment-number">${escapeHtml(m.number)}</span>`;
      methodsContainer.appendChild(div);
    });
    
    const select = document.getElementById('paymentMethod');
    select.innerHTML = '<option value="">Selecciona el método de pago</option>';
    config.paymentMethods.forEach((m, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = m.name;
      select.appendChild(opt);
    });
  }

  // ---------- MODAL DE PAGO ----------
  function openPaymentModal(product) {
    currentProductForPurchase = product;
    selectedImageBase64 = null;
    acceptTerms.checked = false;
    couponCode.value = '';
    couponMessage.textContent = '';
    paymentMethod.value = '';
    paymentProof.value = '';
    fileName.textContent = 'Ningún archivo seleccionado';
    contractType.value = 'nuevo';
    
    const previewContainer = document.querySelector('.file-input-wrapper');
    const existingPreview = previewContainer.querySelector('.image-preview');
    if (existingPreview) existingPreview.remove();
    
    renderPaymentModalContent(product.id);
    paymentModal.style.display = 'flex';
  }

  function closePaymentModalHandler() {
    paymentModal.style.display = 'none';
    currentProductForPurchase = null;
  }

  if (paymentProof) {
    paymentProof.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) {
        fileName.textContent = 'Ningún archivo seleccionado';
        selectedImageBase64 = null;
        return;
      }
      fileName.textContent = file.name;
      showToast('⏳ Preparando imagen...', 2000);
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        selectedImageBase64 = ev.target.result;
        const wrapper = document.querySelector('.file-input-wrapper');
        let preview = wrapper.querySelector('.image-preview');
        if (!preview) {
          preview = document.createElement('img');
          preview.className = 'image-preview';
          wrapper.appendChild(preview);
        }
        preview.src = selectedImageBase64;
        showToast('✅ Imagen lista', 1000);
      };
      reader.readAsDataURL(file);
    });
  }

  if (verifyCouponBtn) {
    verifyCouponBtn.addEventListener('click', () => {
      const code = couponCode.value.trim().toUpperCase();
      couponMessage.textContent = (code === 'DEVFAST10') ? '✅ Cupón válido: 10% de descuento aplicado' : '❌ Cupón inválido';
    });
  }

  function handlePaymentSubmit() {
    if (!acceptTerms.checked) { showToast('⚠️ Debes aceptar los términos', 2000); return; }
    if (!paymentMethod.value) { showToast('⚠️ Selecciona método de pago', 2000); return; }
    if (!contractType.value) { showToast('⚠️ Selecciona tipo de contrato', 2000); return; }
    
    const methodIndex = parseInt(paymentMethod.value);
    const config = getPaymentConfigForProduct(currentProductForPurchase.id);
    const selectedMethod = config.paymentMethods[methodIndex];
    
    const purchaseData = {
      action: 'purchase_with_details',
      product: currentProductForPurchase,
      user: { id: currentUser.id, name: userName.textContent, username: currentUser.username },
      payment: {
        method: selectedMethod,
        contractType: contractType.value,
        coupon: couponCode.value || null,
        proofFileId: selectedImageBase64 || null
      },
      timestamp: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(purchaseData);
    if (dataStr.length > 4096) {
      showToast('⚠️ Los datos son demasiado grandes', 3000);
      return;
    }
    
    const purchase = {
      userId: currentUser.id,
      userName: currentUser.first_name + (currentUser.last_name ? ' ' + currentUser.last_name : ''),
      productId: currentProductForPurchase.id,
      productName: currentProductForPurchase.name,
      date: new Date().toISOString(),
      paymentDetails: purchaseData.payment
    };
    purchases.push(purchase);
    savePurchases();
    
    if (isTelegram) {
      tg.HapticFeedback?.notificationOccurred('success');
      tg.sendData(dataStr);
      tg.showPopup({ title: '✅ Solicitud enviada', message: 'El administrador recibirá tu comprobante.' });
    } else {
      console.log('Purchase data:', purchaseData);
      showToast('✅ Compra simulada', 2000);
    }
    
    renderUserPurchases();
    renderUsersList();
    closePaymentModalHandler();
  }

  // ---------- ENVÍO MANUAL ----------
  function openManualSendForUser(userId, userDisplayName) {
    if (!isAdmin) {
      showToast('⛔ Solo administradores', 2000);
      return;
    }
    if (adminView && !adminView.classList.contains('active')) switchView('admin');
    const targetInput = document.getElementById('targetUserId');
    if (targetInput) targetInput.value = userId;
    showToast(`📝 Preparando envío para ${userDisplayName || 'usuario ' + userId}`, 2000);
  }

  function handleManualSend() {
    if (!isAdmin) {
      showToast('⛔ Solo administradores', 2000);
      return;
    }
    const targetUserId = document.getElementById('targetUserId').value.trim();
    const productId = manualProductSelect.value;
    const customMessage = document.getElementById('customMessage').value.trim();
    
    if (!targetUserId || !productId) {
      showToast('⚠️ Completa ID y producto', 2000);
      return;
    }
    
    const product = products.find(p => p.id === productId);
    const sendData = {
      action: 'manual_send',
      target_user_id: targetUserId,
      product: product,
      custom_message: customMessage || `Aquí está tu producto: ${product.name}`,
      attachment: manualFileBase64 || null
    };
    
    const dataStr = JSON.stringify(sendData);
    console.log(`📏 Tamaño del envío: ${dataStr.length} bytes (límite 4096)`);
    
    if (dataStr.length > 4096) {
      showToast(`⚠️ Datos demasiado grandes (${Math.round(dataStr.length/1024)} KB)`, 3000);
      return;
    }
    
    if (isTelegram) {
      tg.sendData(dataStr);
      tg.showPopup({ title: '📨 Envío solicitado', message: 'El bot procesará el envío.' });
    } else {
      console.log('📤 Datos enviados (demo):', sendData);
      showToast(`📨 Enviado a ${targetUserId} (demo)`, 2000);
    }
    
    document.getElementById('targetUserId').value = '';
    manualProductSelect.value = '';
    document.getElementById('customMessage').value = '';
    if (manualAttachment) manualAttachment.value = '';
    if (attachmentFileName) attachmentFileName.textContent = 'Ningún archivo seleccionado';
    manualFileBase64 = null;
  }

  // ---------- EDICIÓN DE PRODUCTOS ----------
  function openEditModal(product) {
    editProductId.value = product.id;
    editProductName.value = product.name;
    editProductDescription.value = product.description || '';
    editProductPrice.value = product.price;
    editProductImage.value = product.image || '📦';
    editProductStock.value = product.inStock ? 'true' : 'false';
    editProductModal.style.display = 'flex';
  }

  function closeEditModal() {
    editProductModal.style.display = 'none';
  }

  function handleEditProductSubmit(e) {
    e.preventDefault();
    if (!isAdmin) {
      showToast('⛔ Solo administradores', 2000);
      return;
    }
    const id = editProductId.value;
    const productIndex = products.findIndex(p => p.id === id);
    if (productIndex === -1) return;
    
    const updatedProduct = {
      ...products[productIndex],
      name: editProductName.value.trim(),
      description: editProductDescription.value.trim(),
      price: parseFloat(editProductPrice.value) || 0,
      image: editProductImage.value.trim() || '📦',
      inStock: editProductStock.value === 'true'
    };
    
    products[productIndex] = updatedProduct;
    saveProducts();
    renderStore();
    renderAdminList();
    populateManualSelect();
    closeEditModal();
    showToast('✅ Producto actualizado', 1500);
    if (isTelegram) tg.HapticFeedback?.notificationOccurred('success');
  }

  function confirmDeleteProduct(productId) {
    if (!isAdmin) {
      showToast('⛔ Solo administradores', 2000);
      return;
    }
    modalTitle.textContent = 'Eliminar producto';
    modalMessage.textContent = '¿Estás seguro?';
    modalOverlay.style.display = 'flex';
    modalConfirm.onclick = () => {
      products = products.filter(p => p.id !== productId);
      delete paymentConfigs[productId];
      saveProducts();
      savePaymentConfigs();
      renderStore();
      renderAdminList();
      populateManualSelect();
      modalOverlay.style.display = 'none';
      showToast('✅ Producto eliminado', 1500);
    };
    modalCancel.onclick = () => modalOverlay.style.display = 'none';
  }

  function handleAddProduct(e) {
    e.preventDefault();
    if (!isAdmin) {
      showToast('⛔ Solo administradores', 2000);
      return;
    }
    const name = document.getElementById('productName').value.trim();
    const description = document.getElementById('productDescription').value.trim();
    const price = parseFloat(document.getElementById('productPrice').value) || 0;
    const image = document.getElementById('productImage').value.trim() || '📦';
    const inStock = document.getElementById('productStock').value === 'true';
    if (!name) { showToast('⚠️ Nombre obligatorio', 2000); return; }
    const newId = Date.now().toString();
    const newProduct = { id: newId, name, description, price, image, inStock };
    products.push(newProduct);
    saveProducts();
    addProductForm.reset();
    document.getElementById('productImage').value = '📦';
    document.getElementById('productStock').value = 'true';
    renderStore();
    renderAdminList();
    showToast('✅ Producto agregado', 1500);
    if (window.innerWidth < 600) switchView('store');
  }

  function switchView(viewName) {
    if (viewName === 'admin') {
      if (!isAdmin) {
        showToast('⛔ Solo administradores', 2000);
        return;
      }
      if (storeView) storeView.classList.remove('active');
      if (adminView) adminView.classList.add('active');
      renderUsersList();
      populateManualSelect();
      renderPaymentConfigForm();
      document.querySelectorAll('.tab-item').forEach(t => t.classList.toggle('active', t.dataset.view === 'admin'));
    } else {
      if (storeView) storeView.classList.add('active');
      if (adminView) adminView.classList.remove('active');
      document.querySelectorAll('.tab-item').forEach(t => t.classList.toggle('active', t.dataset.view === 'store'));
    }
  }

  function showToast(message, duration = 2000) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = 'position:fixed; bottom:100px; left:50%; transform:translateX(-50%); background:rgba(28,28,30,0.9); color:white; padding:10px 20px; border-radius:40px; font-size:14px; z-index:9999; transition:opacity 0.2s ease;';
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 200); }, duration);
  }

  // ---------- EVENT LISTENERS ----------
  function setupEventListeners() {
    if (backBtn) backBtn.onclick = () => {
      if (adminView && adminView.classList.contains('active') && isAdmin) switchView('store');
      else if (isTelegram) tg.BackButton.onClick?.() || tg.close();
    };
    if (menuBtn) menuBtn.onclick = () => {
      if (isTelegram) tg.showPopup({ title: 'Wireguard Shop', message: 'Tienda de productos digitales' });
      else alert('Wireguard Shop');
    };
    if (adminPanelBtn) adminPanelBtn.onclick = () => {
      if (isAdmin) switchView('admin');
      else showToast('⛔ Solo administradores', 2000);
    };
    if (logoutBtn) logoutBtn.onclick = () => {
      if (isTelegram) tg.showPopup({ title: 'Cerrar sesión', message: 'Puedes cerrar la mini app.' });
    };
    document.querySelectorAll('.tab-item').forEach(tab => tab.onclick = () => switchView(tab.dataset.view));
    if (addProductForm) addProductForm.onsubmit = handleAddProduct;
    const sendManualBtn = document.getElementById('sendManualProductBtn');
    if (sendManualBtn) sendManualBtn.onclick = handleManualSend;
    
    if (manualAttachment) {
      manualAttachment.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          attachmentFileName.textContent = file.name;
          const reader = new FileReader();
          reader.onload = (ev) => { manualFileBase64 = ev.target.result; };
          reader.readAsDataURL(file);
        } else {
          attachmentFileName.textContent = 'Ningún archivo seleccionado';
          manualFileBase64 = null;
        }
      });
    }
    
    const exportBtn = document.getElementById('exportDataBtn');
    if (exportBtn) exportBtn.onclick = () => {
      if (!isAdmin) {
        showToast('⛔ Solo administradores', 2000);
        return;
      }
      const exportPayload = JSON.stringify({ action: 'export_data', data: { products, purchases, paymentConfigs } });
      if (isTelegram) {
        tg.sendData(exportPayload);
      } else {
        console.log('📊 Export:', { products, purchases, paymentConfigs });
        showToast('📤 Datos en consola', 1500);
      }
    };
    const clearPurchasesBtn = document.getElementById('clearPurchasesBtn');
    if (clearPurchasesBtn) {
      clearPurchasesBtn.onclick = () => {
        modalTitle.textContent = 'Limpiar historial';
        modalMessage.textContent = '¿Seguro que deseas borrar tu historial de compras?';
        modalOverlay.style.display = 'flex';
        modalConfirm.onclick = () => {
          purchases = purchases.filter(p => p.userId !== currentUser.id);
          savePurchases();
          renderUserPurchases();
          if (isAdmin) renderUsersList();
          modalOverlay.style.display = 'none';
          showToast('🧹 Historial limpio', 1500);
        };
        modalCancel.onclick = () => modalOverlay.style.display = 'none';
      };
    }
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) clearAllBtn.onclick = () => {
      if (!isAdmin) {
        showToast('⛔ Solo administradores', 2000);
        return;
      }
      modalTitle.textContent = 'Limpiar tienda';
      modalMessage.textContent = '¿Eliminar TODO (productos, compras, configuraciones)?';
      modalOverlay.style.display = 'flex';
      modalConfirm.onclick = () => {
        products = []; purchases = []; paymentConfigs = {};
        saveProducts(); savePurchases(); savePaymentConfigs();
        renderStore(); renderAdminList(); renderUsersList();
        modalOverlay.style.display = 'none';
        showToast('🧹 Tienda limpia', 1500);
      };
      modalCancel.onclick = () => modalOverlay.style.display = 'none';
    };
    if (closePaymentModal) closePaymentModal.onclick = closePaymentModalHandler;
    if (cancelPaymentBtn) cancelPaymentBtn.onclick = closePaymentModalHandler;
    if (submitPaymentBtn) submitPaymentBtn.onclick = handlePaymentSubmit;
    if (modalOverlay) modalOverlay.onclick = (e) => { if (e.target === modalOverlay) modalOverlay.style.display = 'none'; };
    if (paymentModal) paymentModal.onclick = (e) => { if (e.target === paymentModal) closePaymentModalHandler(); };
    if (editProductForm) editProductForm.onsubmit = handleEditProductSubmit;
    if (cancelEditBtn) cancelEditBtn.onclick = closeEditModal;
    if (editProductModal) editProductModal.onclick = (e) => { if (e.target === editProductModal) closeEditModal(); };
  }

  init();
})();