const STORAGE_KEY = 'farmacia-cruz-verde-inventory';
const CHANNEL_NAME = 'farmacia-cruz-verde-channel';

const readProducts = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
};

let products = readProducts();

const syncAcrossTabs = (nextProducts) => {
  products = nextProducts;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ type: 'inventory-sync', products });
    channel.close();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('productName');
  const codeInput = document.getElementById('productCode');
  const depositInput = document.getElementById('stockDeposito');
  const localInput = document.getElementById('stockLocal');
  const saveButton = document.getElementById('saveProduct');
  const searchInput = document.getElementById('searchInput');
  const tableBody = document.getElementById('inventoryTableBody');

  if (!nameInput || !codeInput || !depositInput || !localInput || !saveButton || !searchInput || !tableBody) return;

  const persistProducts = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
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

  const renderProducts = () => {
    tableBody.replaceChildren();

    products.forEach((product, index) => {
      const total = Number(product.deposit) + Number(product.local);
      const row = document.createElement('tr');
      const productCell = document.createElement('td');
      const productName = document.createElement('div');
      productName.textContent = product.name;
      productCell.append(productName);
      productCell.dataset.label = 'Producto';

      if (product.code) {
        const productCode = document.createElement('small');
        productCode.textContent = product.code;
        productCell.append(productCode);
      }

      [
        [productCell, 'Producto'],
        [product.deposit, 'Depósito'],
        [product.local, 'Local'],
        [total, 'Total'],
        [total <= 3 ? 'Reponer' : 'Disponible', 'Estado'],
      ].forEach(([value, label]) => {
        if (value === productCell) {
          row.append(value);
          return;
        }
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
      deleteButton.addEventListener('click', () => {
        products.splice(index, 1);
        persistProducts();
        syncAcrossTabs(products);
        renderProducts();
      });
      actionsCell.append(deleteButton);
      row.append(actionsCell);
      tableBody.append(row);
    });

    updateMetrics();
    filterRows();
  };

  const filterRows = () => {
    const query = searchInput.value.trim().toLocaleLowerCase();
    for (const row of tableBody.rows) {
      row.hidden = query !== '' && !row.textContent.toLocaleLowerCase().includes(query);
    }
  };

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener('message', (event) => {
      const payload = event.data;
      if (payload && payload.type === 'inventory-sync') {
        products = Array.isArray(payload.products) ? payload.products : readProducts();
        renderProducts();
      }
    });
    window.addEventListener('beforeunload', () => channel.close());
  }

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      products = readProducts();
      renderProducts();
    }
  });

  saveButton.addEventListener('click', () => {
    const name = nameInput.value.trim();
    const deposit = Number(depositInput.value);
    const local = Number(localInput.value);

    if (!name) {
      nameInput.focus();
      return;
    }
    if (!Number.isFinite(deposit) || deposit < 0 || !Number.isFinite(local) || local < 0) return;

    products.push({
      name,
      code: codeInput.value.trim(),
      deposit,
      local,
    });
    syncAcrossTabs(products);
    renderProducts();

    nameInput.value = '';
    codeInput.value = '';
    depositInput.value = '0';
    localInput.value = '0';
    nameInput.focus();
  });

  searchInput.addEventListener('input', filterRows);
  renderProducts();
});
