const hasSupabaseConfig = () => (
  window.SUPABASE_URL
  && window.SUPABASE_ANON_KEY
  && !window.SUPABASE_URL.includes('YOUR-PROJECT-REF')
  && !window.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_')
);

const escapeText = (value) => String(value ?? '');

document.addEventListener('DOMContentLoaded', () => {
  const loginPanel = document.getElementById('loginPanel');
  const loginForm = document.getElementById('loginForm');
  const loginMessage = document.getElementById('loginMessage');
  const inventoryApp = document.getElementById('inventoryApp');
  const appMessage = document.getElementById('appMessage');
  const currentUser = document.getElementById('currentUser');
  const nameInput = document.getElementById('productName');
  const codeInput = document.getElementById('productCode');
  const depositInput = document.getElementById('stockDeposito');
  const localInput = document.getElementById('stockLocal');
  const saveButton = document.getElementById('saveProduct');
  const searchInput = document.getElementById('searchInput');
  const tableBody = document.getElementById('inventoryTableBody');
  const emptyInventory = document.getElementById('emptyInventory');
  const logoutButton = document.getElementById('logoutButton');

  if (!hasSupabaseConfig()) {
    loginMessage.textContent = 'Falta configurar supabase-config.js con la URL del proyecto y la clave pública de Supabase.';
    loginMessage.classList.add('is-error');
    return;
  }

  if (!window.supabase?.createClient) {
    loginMessage.textContent = 'No se pudo cargar Supabase. Verifica tu conexión a internet e inténtalo otra vez.';
    loginMessage.classList.add('is-error');
    return;
  }

  const client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  let products = [];
  let inventoryChannel;

  const setAppMessage = (message = '', isError = false) => {
    appMessage.textContent = message;
    appMessage.classList.toggle('is-error', isError);
    appMessage.hidden = !message;
  };

  const updateMetrics = () => {
    document.getElementById('totalProducts').textContent = products.length;
    document.getElementById('totalUnits').textContent = products.reduce(
      (total, product) => total + Number(product.deposit) + Number(product.local), 0,
    );
    document.getElementById('needRestock').textContent = products.filter(
      (product) => Number(product.deposit) + Number(product.local) <= 3,
    ).length;
  };

  const filterRows = () => {
    const query = searchInput.value.trim().toLocaleLowerCase();
    let visibleRows = 0;
    for (const row of tableBody.rows) {
      row.hidden = query !== '' && !row.textContent.toLocaleLowerCase().includes(query);
      if (!row.hidden) visibleRows += 1;
    }
    emptyInventory.hidden = products.length > 0;
    if (products.length > 0 && visibleRows === 0) {
      emptyInventory.hidden = false;
      emptyInventory.textContent = 'No se encontraron productos para esa búsqueda.';
    } else if (products.length === 0) {
      emptyInventory.textContent = 'No hay productos registrados todavía.';
    }
  };

  const renderProducts = () => {
    tableBody.replaceChildren();
    products.forEach((product) => {
      const total = Number(product.deposit) + Number(product.local);
      const row = document.createElement('tr');
      const productCell = document.createElement('td');
      const productName = document.createElement('div');
      productName.textContent = escapeText(product.name);
      productCell.append(productName);
      productCell.dataset.label = 'Producto';
      if (product.code) {
        const productCode = document.createElement('small');
        productCode.textContent = escapeText(product.code);
        productCell.append(productCode);
      }
      row.append(productCell);

      [
        [product.deposit, 'Depósito'],
        [product.local, 'Local'],
        [total, 'Total'],
        [total <= 3 ? 'Reponer' : 'Disponible', 'Estado'],
      ].forEach(([value, label]) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        cell.dataset.label = label;
        row.append(cell);
      });

      const actionsCell = document.createElement('td');
      actionsCell.dataset.label = 'Acciones';
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.textContent = 'Eliminar';
      deleteButton.setAttribute('aria-label', `Eliminar ${product.name}`);
      deleteButton.addEventListener('click', async () => {
        deleteButton.disabled = true;
        const { error } = await client.from('inventory_products').delete().eq('id', product.id);
        if (error) {
          deleteButton.disabled = false;
          setAppMessage(`No se pudo eliminar el producto: ${error.message}`, true);
          return;
        }
        setAppMessage('Producto eliminado.');
        await loadProducts();
      });
      actionsCell.append(deleteButton);
      row.append(actionsCell);
      tableBody.append(row);
    });
    updateMetrics();
    filterRows();
  };

  async function loadProducts() {
    const { data, error } = await client
      .from('inventory_products')
      .select('id, name, code, deposit, local, created_at')
      .order('name', { ascending: true });
    if (error) {
      setAppMessage(`No se pudo cargar el inventario: ${error.message}. Revisa la tabla y las políticas RLS de Supabase.`, true);
      return;
    }
    products = data || [];
    renderProducts();
  }

  const stopRealtime = () => {
    if (inventoryChannel) {
      client.removeChannel(inventoryChannel);
      inventoryChannel = null;
    }
  };

  const startRealtime = () => {
    stopRealtime();
    inventoryChannel = client
      .channel('shared-inventory-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_products' }, loadProducts)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          setAppMessage('El inventario funciona, pero la actualización en tiempo real no está activa. Revisa supabase-setup.sql.', true);
        }
      });
  };

  const showSession = async (session) => {
    const authenticated = Boolean(session);
    loginPanel.hidden = authenticated;
    inventoryApp.hidden = !authenticated;
    if (!authenticated) {
      stopRealtime();
      products = [];
      tableBody.replaceChildren();
      updateMetrics();
      return;
    }
    currentUser.textContent = session.user.email || 'Sesión iniciada';
    setAppMessage('Conectado al inventario compartido.');
    await loadProducts();
    startRealtime();
  };

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('loginButton');
    button.disabled = true;
    loginMessage.textContent = 'Conectando…';
    loginMessage.classList.remove('is-error');
    const { data, error } = await client.auth.signInWithPassword({
      email: document.getElementById('loginEmail').value.trim(),
      password: document.getElementById('loginPassword').value,
    });
    button.disabled = false;
    if (error) {
      loginMessage.textContent = `No se pudo iniciar sesión: ${error.message}`;
      loginMessage.classList.add('is-error');
      return;
    }
    loginMessage.textContent = '';
    await showSession(data.session);
  });

  logoutButton.addEventListener('click', async () => {
    const { error } = await client.auth.signOut();
    if (error) setAppMessage(`No se pudo cerrar sesión: ${error.message}`, true);
    else await showSession(null);
  });

  saveButton.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const deposit = Number(depositInput.value);
    const local = Number(localInput.value);
    if (!name) {
      nameInput.focus();
      return;
    }
    if (!Number.isInteger(deposit) || deposit < 0 || !Number.isInteger(local) || local < 0) {
      setAppMessage('Ingresa cantidades enteras iguales o mayores que cero.', true);
      return;
    }

    saveButton.disabled = true;
    setAppMessage('Guardando producto…');
    const { error } = await client.from('inventory_products').insert({
      name,
      code: codeInput.value.trim(),
      deposit,
      local,
    });
    saveButton.disabled = false;
    if (error) {
      setAppMessage(`No se pudo guardar el producto: ${error.message}`, true);
      return;
    }
    nameInput.value = '';
    codeInput.value = '';
    depositInput.value = '0';
    localInput.value = '0';
    setAppMessage('Producto guardado en el inventario compartido.');
    await loadProducts();
    nameInput.focus();
  });

  searchInput.addEventListener('input', filterRows);
  client.auth.onAuthStateChange((_event, session) => {
    void showSession(session);
  });
  client.auth.getSession().then(({ data, error }) => {
    if (error) {
      loginMessage.textContent = `No se pudo recuperar la sesión: ${error.message}`;
      loginMessage.classList.add('is-error');
      return;
    }
    void showSession(data.session);
  });
});
