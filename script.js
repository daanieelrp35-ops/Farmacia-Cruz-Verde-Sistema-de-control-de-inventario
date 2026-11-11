const STORAGE_KEY = 'farmacia-cruz-verde-inventory';

const readProducts = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
};

let products = readProducts();

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

      if (product.code) {
        const productCode = document.createElement('small');
        productCode.textContent = product.code;
        productCell.append(productCode);
      }

      [productCell, product.deposit, product.local, total, total <= 3 ? 'Reponer' : 'Disponible'].forEach((value) => {
        if (value === productCell) {
          row.append(value);
          return;
        }
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      });

      const actionsCell = document.createElement('td');
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.textContent = 'Eliminar';
      deleteButton.setAttribute('aria-label', `Eliminar ${product.name}`);
      deleteButton.addEventListener('click', () => {
        products.splice(index, 1);
        persistProducts();
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
    persistProducts();
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
